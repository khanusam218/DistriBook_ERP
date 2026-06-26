-- Thok Software - SQLite Database Schema

CREATE TABLE IF NOT EXISTS stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_description TEXT DEFAULT '',
  packing_unit TEXT DEFAULT 'CTN',
  pieces_per_ctn INTEGER DEFAULT 1,
  purchase_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_code TEXT UNIQUE NOT NULL,
  shop_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_type TEXT NOT NULL DEFAULT 'RETAILER',
  opening_balance REAL NOT NULL DEFAULT 0,
  address TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  representative_name TEXT DEFAULT '',
  opening_balance REAL NOT NULL DEFAULT 0,
  address TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  purchase_date TEXT NOT NULL DEFAULT (date('now')),
  invoice_no TEXT DEFAULT '',
  total_amount REAL NOT NULL DEFAULT 0,
  remarks TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  stock_id INTEGER NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  purchase_price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vendor_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL,
  reference_id INTEGER DEFAULT NULL,
  reference_type TEXT DEFAULT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  transaction_date TEXT NOT NULL DEFAULT (date('now')),
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL,
  reference_id INTEGER DEFAULT NULL,
  reference_type TEXT DEFAULT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  transaction_date TEXT NOT NULL DEFAULT (date('now')),
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  reference_id INTEGER DEFAULT NULL,
  reference_type TEXT DEFAULT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  transaction_date TEXT NOT NULL DEFAULT (date('now')),
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
  return_date TEXT NOT NULL DEFAULT (date('now')),
  total_amount REAL NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  stock_id INTEGER NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  sale_date TEXT NOT NULL DEFAULT (date('now')),
  gate_pass_no TEXT DEFAULT '',
  bill_no TEXT DEFAULT '',
  total_amount REAL NOT NULL DEFAULT 0,
  remarks TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  stock_id INTEGER NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
  item_code TEXT DEFAULT '',
  product_name TEXT DEFAULT '',
  product_rate REAL NOT NULL DEFAULT 0,
  product_qty INTEGER NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sale_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  return_date TEXT NOT NULL DEFAULT (date('now')),
  total_amount REAL NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_return_id INTEGER NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  stock_id INTEGER NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stocks_company ON stocks(company_name);
CREATE INDEX IF NOT EXISTS idx_stocks_product ON stocks(product_name);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_vendors_code ON vendors(company_code);
CREATE INDEX IF NOT EXISTS idx_purchases_vendor ON purchases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor ON vendor_ledger(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON customer_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
