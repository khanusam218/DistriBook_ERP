const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true,
}));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

  // Auth routes — rate-limited, no db middleware (auth controller uses db.authDb directly)
  app.use('/api/auth', authLimiter, authRoutes);

  // Business routes — must be authenticated; db middleware routes queries to the user's own database
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

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // Serve React frontend in production
  const frontendDist = path.join(__dirname, '..', '..', 'public');
  if (require('fs').existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // All non-API routes serve the React app (for client-side routing)
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
