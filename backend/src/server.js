const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db/db');
const { verifyToken } = require('./services/authService');
const { authenticateJWT } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware: resolve which business database to use for the logged-in user
async function dbMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next();
    const decoded = verifyToken(token);
    if (!decoded) return next();
    const userRow = db.authDb.prepare('SELECT id, business_owner_id FROM users WHERE id = ?').get(decoded.userId);
    if (!userRow) return next();

    if (userRow.business_owner_id === null || userRow.business_owner_id === undefined) {
      // Legacy user (existed before multi-tenancy) — use shared thok.db
      db.setContext(db.authDb, next);
    } else {
      // New user — use their own isolated business database
      const bizDb = await db.getBusinessDb(Number(userRow.business_owner_id));
      db.setContext(bizDb, next);
    }
  } catch {
    next();
  }
}

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no Origin (same-origin / Electron / curl) and localhost only
    if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

db.initialize().then(() => {
  const authRoutes        = require('./routes/auth');
  const stockRoutes       = require('./routes/stocks');
  const customerRoutes    = require('./routes/customers');
  const vendorRoutes      = require('./routes/vendors');
  const purchaseRoutes    = require('./routes/purchases');
  const vendorLedgerRoutes   = require('./routes/vendorLedger');
  const customerLedgerRoutes = require('./routes/customerLedger');
  const purchaseReturnRoutes = require('./routes/purchaseReturns');
  const saleRoutes        = require('./routes/sales');
  const saleReturnRoutes  = require('./routes/saleReturns');
  const companyLedgerRoutes  = require('./routes/companyLedger');
  const trialBalanceRoutes   = require('./routes/trialBalance');
  const dashboardRoutes   = require('./routes/dashboard');
  const productRoutes     = require('./routes/products');
  const gatePassRoutes    = require('./routes/gatePasses');
  const bankAccountRoutes = require('./routes/bankAccounts');
  const receiptRoutes     = require('./routes/receipts');
  const vendorPaymentRoutes  = require('./routes/vendorPayments');
  const employeeRoutes    = require('./routes/employees');
  const posRoutes         = require('./routes/pos');
  const companyRoutes     = require('./routes/company');
  const expenseRoutes     = require('./routes/expenses');
  const backupRoutes      = require('./routes/backup');

  // Auth routes — no db middleware (auth controller uses db.authDb directly)
  app.use('/api/auth', authRoutes);

  // Business routes — JWT required, then db middleware routes to the user's business database
  app.use('/api/stocks',          authenticateJWT, dbMiddleware, stockRoutes);
  app.use('/api/customers',       authenticateJWT, dbMiddleware, customerRoutes);
  app.use('/api/vendors',         authenticateJWT, dbMiddleware, vendorRoutes);
  app.use('/api/purchases',       authenticateJWT, dbMiddleware, purchaseRoutes);
  app.use('/api/vendor-ledger',   authenticateJWT, dbMiddleware, vendorLedgerRoutes);
  app.use('/api/customer-ledger', authenticateJWT, dbMiddleware, customerLedgerRoutes);
  app.use('/api/purchase-returns',authenticateJWT, dbMiddleware, purchaseReturnRoutes);
  app.use('/api/sales',           authenticateJWT, dbMiddleware, saleRoutes);
  app.use('/api/sale-returns',    authenticateJWT, dbMiddleware, saleReturnRoutes);
  app.use('/api/company-ledger',  authenticateJWT, dbMiddleware, companyLedgerRoutes);
  app.use('/api/trial-balance',   authenticateJWT, dbMiddleware, trialBalanceRoutes);
  app.use('/api/dashboard',       authenticateJWT, dbMiddleware, dashboardRoutes);
  app.use('/api/products',        authenticateJWT, dbMiddleware, productRoutes);
  app.use('/api/gate-passes',     authenticateJWT, dbMiddleware, gatePassRoutes);
  app.use('/api/bank-accounts',   authenticateJWT, dbMiddleware, bankAccountRoutes);
  app.use('/api/receipts',        authenticateJWT, dbMiddleware, receiptRoutes);
  app.use('/api/vendor-payments', authenticateJWT, dbMiddleware, vendorPaymentRoutes);
  app.use('/api/employees',       authenticateJWT, dbMiddleware, employeeRoutes);
  app.use('/api/pos',             authenticateJWT, dbMiddleware, posRoutes);
  app.use('/api/company',         authenticateJWT, dbMiddleware, companyRoutes);
  app.use('/api/expenses',        authenticateJWT, dbMiddleware, expenseRoutes);
  app.use('/api/backup',          authenticateJWT, backupRoutes);

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // Serve React frontend in production (works for both dev and packaged)
  const fs = require('fs');
  const possibleDirs = [
    path.join(__dirname, '..', '..', 'public'),           // dev mode
    path.join(__dirname, 'public'),                        // packaged (pkg snapshot)
    path.join(path.dirname(process.execPath), 'public'),   // exe directory
  ];
  const frontendDist = possibleDirs.find(d => fs.existsSync(path.join(d, 'index.html')));
  if (frontendDist) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // Global error handler — catches any unhandled error thrown or passed to next(err)
  // This ensures every route error always gets a JSON response instead of hanging
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error('[Express error]', req.method, req.path, '—', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} already in use — server already running, skipping.`);
    } else {
      throw err;
    }
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Catch unhandled promise rejections so they don't silently crash route handlers
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled rejection]', reason);
});
