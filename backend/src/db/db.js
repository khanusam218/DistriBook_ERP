const { AsyncLocalStorage } = require('async_hooks');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { wasmBuffer } = require('./wasm-data');

// Database directory: env var (set by Electron), CWD when packaged, or dev path
const DEV_DIR = path.join(__dirname, '..', '..', '..');
const DB_DIR = process.env.DB_DIR || DEV_DIR;
fs.mkdirSync(DB_DIR, { recursive: true });
const AUTH_DB_PATH = path.join(DB_DIR, 'thok.db');

let SQL = null;
const storage = new AsyncLocalStorage();
const bizDbCache = new Map(); // ownerId -> DbWrapper

// ── DbWrapper ─────────────────────────────────────────────────────────────────
class DbWrapper {
  constructor(sqliteDb, filePath) {
    this.sqliteDb = sqliteDb;
    this.filePath = filePath;
    this._inTx = false;
    this._saveTimer = null;
    this._writing = false;
  }

  // Async debounced save — never blocks the event loop.
  // Schedules a write 200ms after the last change; multiple rapid writes = one disk write.
  _save() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._writeAsync();
    }, 200);
  }

  // Non-blocking async disk write
  _writeAsync() {
    if (this._writing) return; // skip if previous write still in progress
    try {
      const data = this.sqliteDb.export();
      const buf = Buffer.from(data);
      this._writing = true;
      fs.writeFile(this.filePath, buf, (err) => {
        this._writing = false;
        if (err) console.error(`[DB] Save error (${path.basename(this.filePath)}):`, err.message);
      });
    } catch (e) {
      this._writing = false;
      console.error('[DB] Export error:', e.message);
    }
  }

  // Synchronous save — used only for transactions and explicit flushes (shutdown, restore).
  // Cancels any pending debounced write and writes immediately.
  _saveSync() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    try {
      const data = this.sqliteDb.export();
      fs.writeFileSync(this.filePath, Buffer.from(data));
    } catch (e) {
      console.error('[DB] Sync save error:', e.message);
    }
  }

  _rowsToObjects(stmt) {
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  prepare(sql) {
    const self = this;
    return {
      all(...params) {
        const flat = params.flat();
        const stmt = self.sqliteDb.prepare(sql);
        if (flat.length > 0) stmt.bind(flat);
        return self._rowsToObjects(stmt);
      },
      get(...params) {
        const flat = params.flat();
        const stmt = self.sqliteDb.prepare(sql);
        if (flat.length > 0) stmt.bind(flat);
        let row;
        if (stmt.step()) row = stmt.getAsObject();
        stmt.free();
        return row;
      },
      run(...params) {
        const flat = params.flat();
        self.sqliteDb.run(sql, flat.length > 0 ? flat : []);
        const rowidResult = self.sqliteDb.exec('SELECT last_insert_rowid()');
        const changesResult = self.sqliteDb.exec('SELECT changes()');
        const lastInsertRowid = rowidResult[0]?.values[0][0] ?? 0;
        const changes = changesResult[0]?.values[0][0] ?? 0;
        // Only schedule async save when not inside a transaction
        // (transactions do one sync save at commit, which is more reliable)
        if (!self._inTx) self._save();
        return { lastInsertRowid, changes };
      },
    };
  }

  // Transactions: do ONE debounced async save at commit.
  // Individual steps inside the transaction do NOT trigger saves.
  // Async (not sync) so a slow disk write (e.g. antivirus scanning the file)
  // never blocks the event loop — the commit is already durable in memory,
  // this write is just persistence and shouldn't hold up the HTTP response.
  transaction(fn) {
    const self = this;
    return function (...args) {
      self.sqliteDb.run('BEGIN');
      self._inTx = true;
      try {
        const result = fn(...args);
        self.sqliteDb.run('COMMIT');
        self._save(); // One debounced async write after all changes are committed
        return result;
      } catch (e) {
        try { self.sqliteDb.run('ROLLBACK'); } catch {}
        throw e;
      } finally {
        self._inTx = false;
      }
    };
  }

  exec(sql) {
    this.sqliteDb.exec(sql);
    if (!this._inTx) this._save();
  }

  run(sql, params = []) {
    this.sqliteDb.run(sql, params);
    if (!this._inTx) this._save();
  }
}

// ── DB file helpers ───────────────────────────────────────────────────────────
function loadOrCreate(filePath) {
  if (fs.existsSync(filePath)) {
    return new SQL.Database(fs.readFileSync(filePath));
  }
  return new SQL.Database();
}

// ── Auth tables (users only — always in thok.db) ──────────────────────────────
function initAuthTables(w) {
  w.sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  try { w.sqliteDb.run('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"'); } catch {}
  try { w.sqliteDb.run('ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT "{}"'); } catch {}
  try { w.sqliteDb.run('ALTER TABLE users ADD COLUMN business_name TEXT DEFAULT ""'); } catch {}
  try { w.sqliteDb.run('ALTER TABLE users ADD COLUMN business_owner_id INTEGER DEFAULT NULL'); } catch {}
  w.sqliteDb.run("UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users)");
  w._saveSync();
}

// ── Business tables (all data tables — NOT users) ─────────────────────────────
function initBusinessTables(w) {
  const s = w.sqliteDb;
  const tryRun = (sql) => { try { s.run(sql); } catch {} };

  s.run(`CREATE TABLE IF NOT EXISTS stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL, product_name TEXT NOT NULL,
    product_description TEXT DEFAULT '', packing_unit TEXT DEFAULT 'CTN',
    pieces_per_ctn INTEGER DEFAULT 1, purchase_price REAL NOT NULL DEFAULT 0,
    sale_price REAL NOT NULL DEFAULT 0, quantity INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  tryRun('ALTER TABLE stocks ADD COLUMN barcode TEXT DEFAULT ""');

  s.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_code TEXT UNIQUE NOT NULL, shop_name TEXT NOT NULL,
    customer_name TEXT NOT NULL, customer_type TEXT NOT NULL DEFAULT 'RETAILER',
    opening_balance REAL NOT NULL DEFAULT 0, address TEXT DEFAULT '',
    email TEXT DEFAULT '', phone TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_code TEXT UNIQUE NOT NULL, company_name TEXT NOT NULL,
    representative_name TEXT DEFAULT '', opening_balance REAL NOT NULL DEFAULT 0,
    address TEXT DEFAULT '', email TEXT DEFAULT '', phone TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
    purchase_date TEXT NOT NULL DEFAULT (date('now')),
    invoice_no TEXT DEFAULT '', total_amount REAL NOT NULL DEFAULT 0, remarks TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    stock_id INTEGER NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 0, purchase_price REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS vendor_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL, reference_id INTEGER DEFAULT NULL,
    reference_type TEXT DEFAULT NULL, debit REAL NOT NULL DEFAULT 0,
    credit REAL NOT NULL DEFAULT 0, balance REAL NOT NULL DEFAULT 0,
    transaction_date TEXT NOT NULL DEFAULT (date('now')), description TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS customer_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL, reference_id INTEGER DEFAULT NULL,
    reference_type TEXT DEFAULT NULL, debit REAL NOT NULL DEFAULT 0,
    credit REAL NOT NULL DEFAULT 0, balance REAL NOT NULL DEFAULT 0,
    transaction_date TEXT NOT NULL DEFAULT (date('now')), description TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS company_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT NOT NULL, account_type TEXT NOT NULL, transaction_type TEXT NOT NULL,
    reference_id INTEGER DEFAULT NULL, reference_type TEXT DEFAULT NULL,
    debit REAL NOT NULL DEFAULT 0, credit REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0, transaction_date TEXT NOT NULL DEFAULT (date('now')),
    description TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS purchase_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
    return_date TEXT NOT NULL DEFAULT (date('now')), total_amount REAL NOT NULL DEFAULT 0,
    reason TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS purchase_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    stock_id INTEGER NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 0, price REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    sale_date TEXT NOT NULL DEFAULT (date('now')),
    gate_pass_no TEXT DEFAULT '', bill_no TEXT DEFAULT '',
    total_amount REAL NOT NULL DEFAULT 0, remarks TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  tryRun('ALTER TABLE sales ADD COLUMN sale_type TEXT DEFAULT "INVOICE"');
  tryRun('ALTER TABLE sales ADD COLUMN customer_name TEXT DEFAULT ""');
  tryRun('ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT "CASH"');
  tryRun('ALTER TABLE sales ADD COLUMN bank_account_id INTEGER DEFAULT NULL');
  tryRun('ALTER TABLE sales ADD COLUMN amount_paid REAL DEFAULT 0');
  tryRun('ALTER TABLE sales ADD COLUMN change_amount REAL DEFAULT 0');
  tryRun('ALTER TABLE sales ADD COLUMN discount_total REAL DEFAULT 0');

  s.run(`CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    stock_id INTEGER NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
    item_code TEXT DEFAULT '', product_name TEXT DEFAULT '',
    product_rate REAL NOT NULL DEFAULT 0, product_qty INTEGER NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
  )`);
  tryRun('ALTER TABLE sale_items ADD COLUMN description TEXT DEFAULT ""');
  tryRun('ALTER TABLE sale_items ADD COLUMN discount REAL DEFAULT 0');
  tryRun('ALTER TABLE sale_items ADD COLUMN qty_ctn INTEGER DEFAULT 0');
  tryRun('ALTER TABLE sale_items ADD COLUMN qty_loose_pieces INTEGER DEFAULT 0');
  tryRun('ALTER TABLE sale_items ADD COLUMN pieces_per_ctn INTEGER DEFAULT 1');

  s.run(`CREATE TABLE IF NOT EXISTS sale_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    return_date TEXT NOT NULL DEFAULT (date('now')), total_amount REAL NOT NULL DEFAULT 0,
    reason TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS sale_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_return_id INTEGER NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
    stock_id INTEGER NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 0, price REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT, vendor_id INTEGER NOT NULL,
    product_name TEXT NOT NULL, product_description TEXT DEFAULT '',
    packing_unit TEXT DEFAULT 'CTN', pieces_per_ctn INTEGER DEFAULT 1,
    purchase_price REAL DEFAULT 0, sale_price REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
  )`);
  tryRun('ALTER TABLE products ADD COLUMN product_code TEXT DEFAULT ""');

  s.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    mobile TEXT DEFAULT '', role TEXT DEFAULT '', base_salary REAL DEFAULT 0,
    ot_rate REAL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS employee_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL,
    date TEXT NOT NULL, transaction_type TEXT NOT NULL, description TEXT DEFAULT '',
    debit REAL DEFAULT 0, credit REAL DEFAULT 0, balance REAL DEFAULT 0,
    ot_hours REAL DEFAULT 0, gatepass_number TEXT DEFAULT '', customer_name TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`);
  tryRun('ALTER TABLE employee_ledger ADD COLUMN bank_account_id INTEGER DEFAULT NULL');
  tryRun('ALTER TABLE employee_ledger ADD COLUMN payment_method TEXT DEFAULT "CASH"');

  s.run(`CREATE TABLE IF NOT EXISTS gate_pass_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('SALE_REP','DELIVERY_MAN')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  tryRun('ALTER TABLE gate_pass_staff ADD COLUMN mobile TEXT DEFAULT ""');

  s.run(`CREATE TABLE IF NOT EXISTS gate_passes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ogp_number INTEGER, ogp_date TEXT,
    customer_id INTEGER, sale_rep TEXT DEFAULT '', delivery_man TEXT DEFAULT '',
    total_qty REAL DEFAULT 0, total_amount REAL DEFAULT 0, remarks TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);
  tryRun('ALTER TABLE gate_passes ADD COLUMN delivery_date TEXT DEFAULT ""');
  tryRun('ALTER TABLE gate_passes ADD COLUMN mobile TEXT DEFAULT ""');
  tryRun('ALTER TABLE gate_passes ADD COLUMN delivery_sale_man TEXT DEFAULT ""');
  tryRun('ALTER TABLE gate_passes ADD COLUMN area TEXT DEFAULT ""');
  tryRun('ALTER TABLE gate_passes ADD COLUMN status TEXT DEFAULT "OPEN"');

  s.run(`CREATE TABLE IF NOT EXISTS gate_pass_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, gate_pass_id INTEGER NOT NULL,
    stock_id INTEGER, item_code TEXT DEFAULT '', item_description TEXT DEFAULT '',
    quantity REAL DEFAULT 0, rate REAL DEFAULT 0, total REAL DEFAULT 0,
    FOREIGN KEY (gate_pass_id) REFERENCES gate_passes(id),
    FOREIGN KEY (stock_id) REFERENCES stocks(id)
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS ogp_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS booking_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gate_pass_id INTEGER NOT NULL REFERENCES gate_passes(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id),
    shop_name TEXT DEFAULT '', stock_id INTEGER REFERENCES stocks(id),
    brand TEXT DEFAULT '', item_code TEXT DEFAULT '', item_description TEXT DEFAULT '',
    qty_ctn REAL DEFAULT 0, qty_pieces REAL DEFAULT 0, rate REAL DEFAULT 0,
    amount REAL DEFAULT 0, discount REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS gate_pass_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gate_pass_id INTEGER NOT NULL REFERENCES gate_passes(id) ON DELETE CASCADE,
    customer_id INTEGER, shop_name TEXT DEFAULT '', return_date TEXT DEFAULT '',
    notes TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS gate_pass_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL REFERENCES gate_pass_returns(id) ON DELETE CASCADE,
    stock_id INTEGER REFERENCES stocks(id), item_code TEXT DEFAULT '',
    item_description TEXT DEFAULT '', brand TEXT DEFAULT '',
    qty_ctn REAL DEFAULT 0, qty_pieces REAL DEFAULT 0,
    rate REAL DEFAULT 0, amount REAL DEFAULT 0, net REAL DEFAULT 0
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, account_name TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'CASH', bank_name TEXT DEFAULT '',
    account_number TEXT DEFAULT '', opening_balance REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS cash_bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_date TEXT NOT NULL DEFAULT (date('now')),
    account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
    transaction_type TEXT NOT NULL, reference_id INTEGER,
    reference_type TEXT DEFAULT '', debit REAL DEFAULT 0, credit REAL DEFAULT 0,
    balance REAL DEFAULT 0, description TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_no TEXT NOT NULL,
    receipt_date TEXT NOT NULL DEFAULT (date('now')),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    amount REAL NOT NULL DEFAULT 0, payment_method TEXT NOT NULL DEFAULT 'CASH',
    bank_account_id INTEGER REFERENCES bank_accounts(id),
    notes TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  s.run(`CREATE TABLE IF NOT EXISTS vendor_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, payment_no TEXT NOT NULL,
    payment_date TEXT NOT NULL DEFAULT (date('now')),
    vendor_id INTEGER NOT NULL REFERENCES vendors(id),
    amount REAL NOT NULL DEFAULT 0, payment_method TEXT NOT NULL DEFAULT 'CASH',
    bank_account_id INTEGER REFERENCES bank_accounts(id),
    notes TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  const cashCount = s.exec('SELECT COUNT(*) FROM bank_accounts');
  const count = cashCount[0]?.values[0][0] ?? 0;
  if (count === 0) {
    s.run(`INSERT INTO bank_accounts (account_name, account_type, opening_balance) VALUES ('Cash in Hand', 'CASH', 0)`);
  }

  s.run(`CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name TEXT DEFAULT '', tagline TEXT DEFAULT '', address TEXT DEFAULT '',
    city TEXT DEFAULT '', phone TEXT DEFAULT '', mobile TEXT DEFAULT '',
    email TEXT DEFAULT '', website TEXT DEFAULT '', ntn TEXT DEFAULT '',
    strn TEXT DEFAULT '', updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  const csCount = s.exec('SELECT COUNT(*) FROM company_settings');
  if ((csCount[0]?.values[0][0] ?? 0) === 0) {
    s.run(`INSERT INTO company_settings (id) VALUES (1)`);
  }
  tryRun('ALTER TABLE company_settings ADD COLUMN delete_password_hash TEXT DEFAULT NULL');

  s.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_no TEXT NOT NULL, expense_date TEXT NOT NULL DEFAULT (date('now')),
    category TEXT NOT NULL, description TEXT DEFAULT '',
    amount REAL NOT NULL DEFAULT 0, payment_method TEXT NOT NULL DEFAULT 'CASH',
    bank_account_id INTEGER REFERENCES bank_accounts(id),
    notes TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  try {
    const orphanProducts = s.exec(
      `SELECT p.product_name, p.product_description, p.packing_unit, p.pieces_per_ctn,
              p.purchase_price, p.sale_price, v.company_name
       FROM products p
       LEFT JOIN vendors v ON p.vendor_id = v.id
       WHERE v.company_name IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM stocks st
           WHERE st.product_name = p.product_name AND st.company_name = v.company_name
         )`
    );
    if (orphanProducts.length > 0) {
      const cols = orphanProducts[0].columns;
      for (const row of orphanProducts[0].values) {
        const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
        s.run(
          `INSERT INTO stocks (company_name, product_name, product_description, packing_unit, pieces_per_ctn, purchase_price, sale_price, quantity)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
          [r.company_name, r.product_name, r.product_description || '', r.packing_unit || 'CTN', r.pieces_per_ctn || 1, r.purchase_price || 0, r.sale_price || 0]
        );
      }
    }
  } catch (_) {}

  try {
    const badAdvances = s.exec(
      `SELECT id, employee_id, debit FROM employee_ledger WHERE transaction_type = 'ADVANCE' AND debit > 0 AND credit = 0`
    );
    if (badAdvances.length > 0 && badAdvances[0].values.length > 0) {
      for (const row of badAdvances[0].values) {
        const [id, , debit] = row;
        s.run(`UPDATE employee_ledger SET debit = 0, credit = ? WHERE id = ?`, [debit, id]);
      }
      const empIds = [...new Set(badAdvances[0].values.map(r => r[1]))];
      for (const empId of empIds) {
        const ledger = s.exec(
          `SELECT id, debit, credit FROM employee_ledger WHERE employee_id = ${empId} ORDER BY date ASC, id ASC`
        );
        if (ledger.length > 0) {
          let running = 0;
          for (const row of ledger[0].values) {
            const [lid, debit, credit] = row;
            running = Math.round((running + Number(debit) - Number(credit)) * 100) / 100;
            s.run(`UPDATE employee_ledger SET balance = ? WHERE id = ?`, [running, lid]);
          }
        }
      }
    }
  } catch (_) {}

  w._saveSync();
}

// ── Public API ────────────────────────────────────────────────────────────────
const db = {
  authDb: null,

  async initialize() {
    SQL = await initSqlJs({ wasmBinary: wasmBuffer() });
    const sqliteDb = loadOrCreate(AUTH_DB_PATH);
    const authWrapper = new DbWrapper(sqliteDb, AUTH_DB_PATH);
    db.authDb = authWrapper;
    initAuthTables(authWrapper);
    initBusinessTables(authWrapper);

    const userCount = authWrapper.sqliteDb.exec('SELECT COUNT(*) FROM users');
    if ((userCount[0]?.values[0][0] ?? 0) === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      authWrapper.sqliteDb.run(
        'INSERT INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)',
        ['hafizluqman', 'hafizluqman@distribookerp.local', hash, 'Hafiz Luqman', 'admin']
      );
      authWrapper._saveSync();
      console.log('Default admin user created (hafizluqman / admin123)');
    }
  },

  async getBusinessDb(ownerId) {
    const id = Number(ownerId);
    if (bizDbCache.has(id)) return bizDbCache.get(id);
    const bizPath = path.join(DB_DIR, `thok_biz_${id}.db`);
    const sqliteDb = loadOrCreate(bizPath);
    const wrapper = new DbWrapper(sqliteDb, bizPath);
    initBusinessTables(wrapper);
    bizDbCache.set(id, wrapper);
    return wrapper;
  },

  setContext(wrapper, callback) {
    storage.run(wrapper, callback);
  },

  async reload() {
    if (db.authDb?.sqliteDb) {
      try { db.authDb.sqliteDb.close(); } catch {}
    }
    for (const [, wrapper] of bizDbCache) {
      try { wrapper.sqliteDb.close(); } catch {}
    }
    bizDbCache.clear();

    const sqliteDb = loadOrCreate(AUTH_DB_PATH);
    const authWrapper = new DbWrapper(sqliteDb, AUTH_DB_PATH);
    db.authDb = authWrapper;
    initAuthTables(authWrapper);
    initBusinessTables(authWrapper);
    console.log('Database reloaded from disk after restore.');
  },

  prepare(sql) {
    return (storage.getStore() || db.authDb).prepare(sql);
  },
  transaction(fn) {
    return (storage.getStore() || db.authDb).transaction(fn);
  },
  exec(sql) {
    return (storage.getStore() || db.authDb).exec(sql);
  },
  run(sql, params) {
    return (storage.getStore() || db.authDb).run(sql, params);
  },

  pragma() {},
};

// Flush all pending debounced saves before process exits (prevents data loss)
function flushAll() {
  if (db.authDb) {
    try { db.authDb._saveSync(); } catch {}
  }
  for (const wrapper of bizDbCache.values()) {
    try { wrapper._saveSync(); } catch {}
  }
}
process.on('exit', flushAll);
process.on('SIGINT', () => { flushAll(); process.exit(0); });
process.on('SIGTERM', () => { flushAll(); process.exit(0); });

module.exports = db;
