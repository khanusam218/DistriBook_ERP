const { AsyncLocalStorage } = require('async_hooks');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// ── Connection pool ──────────────────────────────────────────────────────────
// Real MySQL database (Hostinger-provided), lives outside the app folder so it
// survives redeploys — unlike the old sql.js file-based DBs which Hostinger
// wiped on every deploy. Config comes entirely from env vars.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true, // return DECIMAL columns as JS numbers (not strings), matching old REAL behavior
  dateStrings: true,    // return DATE/DATETIME/TIMESTAMP as strings, matching old sql.js TEXT behavior
});

// Note: this database's server (MariaDB 11.8) defaults new tables/databases to
// utf8mb4_uca1400_ai_ci, a MariaDB-specific collation the mysql2 driver doesn't
// recognize at all (not even in information_schema.COLLATIONS from a client
// connection) — trying to reference it by name crashes the driver. Rather than
// fight that, the database's default collation was explicitly changed to the
// standard utf8mb4_general_ci, and every CREATE TABLE below says so explicitly too.
//
// That alone isn't quite enough: MariaDB also has its own SESSION-level default
// collation (collation_connection), used for computed string values like
// DATE_FORMAT(...) results — and on this server that default is
// utf8mb4_unicode_ci, which still doesn't match. `SET NAMES` (plain SQL, not a
// driver-level charset option) forces client/connection/results collation to
// utf8mb4_general_ci on every new pooled connection, aligning it with both the
// table data and mysql2's own default parameter-encoding collation.
pool.on('connection', (connection) => {
  connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_general_ci");
});

// storage holds the active tenant context object: { tenantId } or null for the
// global auth context (users table only). txStorage holds the active
// transaction's dedicated connection, when inside db.transaction(fn).
const storage = new AsyncLocalStorage();
const txStorage = new AsyncLocalStorage();
const bizDbCache = new Map(); // ownerId -> DbWrapper

// ── Tables that are per-tenant "business data" and therefore carry a
// business_owner_id column. Every other table (only `users`) is global/shared.
// Centralizing this list here means individual controllers never need to
// remember to add a tenant filter themselves — see rewriteForTenant() below.
const TENANT_TABLES = new Set([
  'stocks', 'customers', 'vendors', 'purchases', 'purchase_items',
  'vendor_ledger', 'customer_ledger', 'company_ledger',
  'purchase_returns', 'purchase_return_items',
  'sales', 'sale_items', 'sale_returns', 'sale_return_items',
  'products', 'employees', 'employee_ledger',
  'gate_pass_staff', 'gate_passes', 'gate_pass_items', 'ogp_areas',
  'booking_order_items', 'gate_pass_returns', 'gate_pass_return_items',
  'bank_accounts', 'cash_bank_transactions',
  'receipts', 'vendor_payments', 'company_settings', 'expenses',
]);

// ── SQL tenant-filter rewriter ───────────────────────────────────────────────
// Every business table gets its rows scoped to the current tenant automatically
// here, so 20+ controllers don't each have to remember `WHERE business_owner_id = ?`.
// Only the PRIMARY (first FROM / INSERT INTO / UPDATE / DELETE FROM) table is
// filtered — this is sufficient because every table's `id` comes from a single
// shared AUTO_INCREMENT space, so any JOIN/subquery correlated via a foreign key
// to an already-filtered row can only ever match rows created by the same tenant.

function depthAt(sql, index) {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')') depth--;
  }
  return depth;
}

// Finds the first occurrence of `regex` in `sql` (searching from `fromIndex`)
// that sits outside any parentheses (i.e. not inside a subquery/function call).
function firstTopLevelMatch(sql, regex, fromIndex = 0) {
  const re = new RegExp(regex.source, 'gi');
  re.lastIndex = fromIndex;
  let m;
  while ((m = re.exec(sql))) {
    if (depthAt(sql, m.index) === 0) return m;
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return null;
}

const CLAUSE_BOUNDARY = /\b(GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT)\b/i;
const NON_ALIAS_KEYWORDS = /^(WHERE|SET|VALUES|ON|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|ORDER|LIMIT|HAVING|USING|CROSS)$/i;

function extractPrimaryFromTable(sql) {
  const fromM = firstTopLevelMatch(sql, /\bFROM\b/i);
  if (!fromM) return null;
  const after = sql.slice(fromM.index + fromM[0].length);

  const tableM = /^\s*`?([A-Za-z_]\w*)`?/i.exec(after);
  if (!tableM) return null;
  let matchEnd = fromM.index + fromM[0].length + tableM[0].length;

  // Optionally consume an explicit/implicit alias — but only advance matchEnd past
  // it when the captured word truly is an alias, not the start of the next clause
  // (WHERE, ORDER BY, JOIN, ...). Otherwise matchEnd would swallow that keyword,
  // and the caller's later search for it (e.g. an existing WHERE) would miss it.
  const rest = after.slice(tableM[0].length);
  const aliasM = /^\s+(?:AS\s+)?`?([A-Za-z_]\w*)`?/i.exec(rest);
  let alias = null;
  if (aliasM && !NON_ALIAS_KEYWORDS.test(aliasM[1])) {
    alias = aliasM[1];
    matchEnd += aliasM[0].length;
  }

  return {
    table: tableM[1],
    alias: alias || tableM[1],
    matchEnd,
  };
}

function rewriteSelect(sql, params, tenantId) {
  const primary = extractPrimaryFromTable(sql);
  if (!primary || !TENANT_TABLES.has(primary.table.toLowerCase())) return { sql, params };

  const condition = `${primary.alias}.business_owner_id = ?`;
  const whereM = firstTopLevelMatch(sql, /\bWHERE\b/i, primary.matchEnd);

  if (whereM) {
    const boundary = firstTopLevelMatch(sql, CLAUSE_BOUNDARY, whereM.index + whereM[0].length);
    const insertAt = boundary ? boundary.index : sql.length;
    const newSql = `${sql.slice(0, insertAt)} AND (${condition}) ${sql.slice(insertAt)}`;
    return { sql: newSql, params: [...params, tenantId] };
  }
  const boundary = firstTopLevelMatch(sql, CLAUSE_BOUNDARY, primary.matchEnd);
  const insertAt = boundary ? boundary.index : sql.length;
  const newSql = `${sql.slice(0, insertAt)} WHERE ${condition} ${sql.slice(insertAt)}`;
  return { sql: newSql, params: [...params, tenantId] };
}

function rewriteInsert(sql, params, tenantId) {
  const m = /^INSERT\s+INTO\s+`?([A-Za-z_]\w*)`?\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)\)\s*$/i.exec(sql.trim());
  if (!m) {
    throw new Error('[db] Unrecognized INSERT shape for tenant rewrite — cannot safely apply tenant filter: ' + sql.slice(0, 120));
  }
  const table = m[1];
  if (!TENANT_TABLES.has(table.toLowerCase())) return { sql, params };
  const newSql = `INSERT INTO ${table} (${m[2]}, business_owner_id) VALUES (${m[3]}, ?)`;
  return { sql: newSql, params: [...params, tenantId] };
}

function rewriteUpdateOrDelete(sql, params, tenantId, table) {
  if (!TENANT_TABLES.has(table.toLowerCase())) return { sql, params };
  const trimmed = sql.trim();
  if (CLAUSE_BOUNDARY.test(trimmed)) {
    throw new Error('[db] UPDATE/DELETE with GROUP BY/ORDER BY/LIMIT is not supported by the tenant rewriter: ' + sql.slice(0, 120));
  }
  const whereM = firstTopLevelMatch(trimmed, /\bWHERE\b/i);
  const newSql = whereM
    ? `${trimmed} AND (business_owner_id = ?)`
    : `${trimmed} WHERE business_owner_id = ?`;
  return { sql: newSql, params: [...params, tenantId] };
}

function rewriteForTenant(sql, params, tenantId) {
  const trimmed = sql.trim();
  if (/^INSERT\s+INTO/i.test(trimmed)) return rewriteInsert(trimmed, params, tenantId);
  if (/^UPDATE\s+`?[A-Za-z_]/i.test(trimmed)) {
    const m = /^UPDATE\s+`?([A-Za-z_]\w*)`?/i.exec(trimmed);
    return rewriteUpdateOrDelete(trimmed, params, tenantId, m[1]);
  }
  if (/^DELETE\s+FROM/i.test(trimmed)) {
    const m = /^DELETE\s+FROM\s+`?([A-Za-z_]\w*)`?/i.exec(trimmed);
    return rewriteUpdateOrDelete(trimmed, params, tenantId, m[1]);
  }
  if (/^SELECT\s/i.test(trimmed)) return rewriteSelect(trimmed, params, tenantId);
  // Anything else (DDL, etc.) — never routed through here in practice; pass through untouched.
  return { sql: trimmed, params };
}

// ── DbWrapper ─────────────────────────────────────────────────────────────────
// Preserves the exact interface controllers already use: prepare(sql).all/get/run(...),
// db.transaction(fn), db.exec(sql), db.run(sql, params). Internally now talks to
// MySQL via mysql2/promise, so every method is async — call sites must `await`.
class DbWrapper {
  // tenantId === null means "no tenant filtering" (used only for the global
  // auth context, which only ever touches the `users` table).
  constructor(tenantId) {
    this.tenantId = tenantId;
  }

  _conn() {
    return txStorage.getStore() || pool;
  }

  _rewrite(sql, params) {
    if (this.tenantId == null) return { sql, params };
    const out = rewriteForTenant(sql, params, this.tenantId);
    if (process.env.DEBUG_SQL) console.error('[DEBUG]', JSON.stringify(out.sql), JSON.stringify(out.params));
    return out;
  }

  prepare(sql) {
    const self = this;
    return {
      async all(...params) {
        const flat = params.flat();
        const { sql: finalSql, params: finalParams } = self._rewrite(sql, flat);
        const [rows] = await self._conn().execute(finalSql, finalParams);
        return rows;
      },
      async get(...params) {
        const flat = params.flat();
        const { sql: finalSql, params: finalParams } = self._rewrite(sql, flat);
        const [rows] = await self._conn().execute(finalSql, finalParams);
        return rows[0];
      },
      async run(...params) {
        const flat = params.flat();
        const { sql: finalSql, params: finalParams } = self._rewrite(sql, flat);
        const [result] = await self._conn().execute(finalSql, finalParams);
        return { lastInsertRowid: result.insertId, changes: result.affectedRows };
      },
    };
  }

  async run(sql, params = []) {
    return this.prepare(sql).run(...(Array.isArray(params) ? params : [params]));
  }

  async exec(sql) {
    // Used only for ad-hoc non-parameterized statements; never tenant-rewritten.
    await this._conn().query(sql);
  }

  // Runs `fn` (an async function that itself calls db.prepare/db.run any number
  // of times) inside a single MySQL transaction on a dedicated connection.
  // Returns an async function — callers must `await transaction(fn)(...)`.
  transaction(fn) {
    return async (...args) => {
      const conn = await pool.getConnection();
      await conn.beginTransaction();
      try {
        const result = await txStorage.run(conn, () => fn(...args));
        await conn.commit();
        return result;
      } catch (e) {
        try { await conn.rollback(); } catch { /* ignore */ }
        throw e;
      } finally {
        conn.release();
      }
    };
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────
// Auth table: global, shared by every tenant (login only).
async function initAuthTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(191) UNIQUE NOT NULL,
    email VARCHAR(191) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) DEFAULT '',
    is_active TINYINT(1) DEFAULT 1,
    role VARCHAR(32) DEFAULT 'user',
    permissions TEXT,
    business_name VARCHAR(255) DEFAULT '',
    business_owner_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await pool.query(
    "UPDATE users u JOIN (SELECT MIN(id) as minid FROM users) t ON u.id = t.minid SET u.role = 'admin'"
  );

  // Backfill: every legacy pre-multi-tenancy user (business_owner_id IS NULL)
  // now gets a real business_owner_id equal to their own id, so the shared-DB
  // tenant model has no special-cased "null means shared legacy db" path at all.
  await pool.query('UPDATE users SET business_owner_id = id WHERE business_owner_id IS NULL');
}

// Business tables: every one of these carries business_owner_id (added to the
// composite/unique keys wherever the original schema had a per-file-implicit
// unique constraint, since multiple tenants now share these physical tables).
// Money and fractional-quantity columns that were SQLite REAL are DECIMAL here
// to avoid floating point drift on financial figures.
async function initBusinessTables() {
  const q = (sql) => pool.query(sql);

  await q(`CREATE TABLE IF NOT EXISTS stocks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    company_name VARCHAR(255) NOT NULL, product_name VARCHAR(255) NOT NULL,
    product_description TEXT, packing_unit VARCHAR(32) DEFAULT 'CTN',
    pieces_per_ctn INT DEFAULT 1, purchase_price DECIMAL(14,2) NOT NULL DEFAULT 0,
    sale_price DECIMAL(14,2) NOT NULL DEFAULT 0, quantity INT NOT NULL DEFAULT 0,
    barcode VARCHAR(64) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_stocks_owner (business_owner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    customer_code VARCHAR(32) NOT NULL, shop_name VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255) NOT NULL, customer_type VARCHAR(32) NOT NULL DEFAULT 'RETAILER',
    opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0, address TEXT,
    email VARCHAR(191) DEFAULT '', phone VARCHAR(64) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_customers_owner_code (business_owner_id, customer_code),
    INDEX idx_customers_owner (business_owner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS vendors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    company_code VARCHAR(32) NOT NULL, company_name VARCHAR(255) NOT NULL,
    representative_name VARCHAR(255) DEFAULT '', opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
    address TEXT, email VARCHAR(191) DEFAULT '', phone VARCHAR(64) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_vendors_owner_code (business_owner_id, company_code),
    INDEX idx_vendors_owner (business_owner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS purchases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    vendor_id INT DEFAULT NULL,
    purchase_date DATE NOT NULL,
    invoice_no VARCHAR(64) DEFAULT '', total_amount DECIMAL(14,2) NOT NULL DEFAULT 0, remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_purchases_owner (business_owner_id), INDEX idx_purchases_vendor (vendor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS purchase_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    purchase_id INT NOT NULL, stock_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 0, purchase_price DECIMAL(14,2) NOT NULL DEFAULT 0,
    total DECIMAL(14,2) NOT NULL DEFAULT 0,
    INDEX idx_pitems_owner (business_owner_id), INDEX idx_pitems_purchase (purchase_id), INDEX idx_pitems_stock (stock_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS vendor_ledger (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    vendor_id INT NOT NULL, transaction_type VARCHAR(32) NOT NULL, reference_id INT DEFAULT NULL,
    reference_type VARCHAR(32) DEFAULT NULL, debit DECIMAL(14,2) NOT NULL DEFAULT 0,
    credit DECIMAL(14,2) NOT NULL DEFAULT 0, balance DECIMAL(14,2) NOT NULL DEFAULT 0,
    transaction_date DATE NOT NULL, description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vledger_owner (business_owner_id), INDEX idx_vledger_vendor (vendor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS customer_ledger (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    customer_id INT NOT NULL, transaction_type VARCHAR(32) NOT NULL, reference_id INT DEFAULT NULL,
    reference_type VARCHAR(32) DEFAULT NULL, debit DECIMAL(14,2) NOT NULL DEFAULT 0,
    credit DECIMAL(14,2) NOT NULL DEFAULT 0, balance DECIMAL(14,2) NOT NULL DEFAULT 0,
    transaction_date DATE NOT NULL, description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cledger_owner (business_owner_id), INDEX idx_cledger_customer (customer_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS company_ledger (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    account_name VARCHAR(255) NOT NULL, account_type VARCHAR(64) NOT NULL, transaction_type VARCHAR(32) NOT NULL,
    reference_id INT DEFAULT NULL, reference_type VARCHAR(32) DEFAULT NULL,
    debit DECIMAL(14,2) NOT NULL DEFAULT 0, credit DECIMAL(14,2) NOT NULL DEFAULT 0,
    balance DECIMAL(14,2) NOT NULL DEFAULT 0, transaction_date DATE NOT NULL,
    description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_compledger_owner (business_owner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS purchase_returns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    purchase_id INT DEFAULT NULL,
    return_date DATE NOT NULL, total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    reason TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_preturns_owner (business_owner_id), INDEX idx_preturns_purchase (purchase_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS purchase_return_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    purchase_return_id INT NOT NULL, stock_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 0, price DECIMAL(14,2) NOT NULL DEFAULT 0,
    total DECIMAL(14,2) NOT NULL DEFAULT 0,
    INDEX idx_pritems_owner (business_owner_id), INDEX idx_pritems_return (purchase_return_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS sales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    customer_id INT DEFAULT NULL,
    sale_date DATE NOT NULL,
    gate_pass_no VARCHAR(64) DEFAULT '', bill_no VARCHAR(64) DEFAULT '',
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0, remarks TEXT,
    sale_type VARCHAR(32) DEFAULT 'INVOICE', customer_name VARCHAR(255) DEFAULT '',
    payment_method VARCHAR(32) DEFAULT 'CASH', bank_account_id INT DEFAULT NULL,
    amount_paid DECIMAL(14,2) DEFAULT 0, change_amount DECIMAL(14,2) DEFAULT 0,
    discount_total DECIMAL(14,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sales_owner (business_owner_id), INDEX idx_sales_customer (customer_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS sale_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    sale_id INT NOT NULL, stock_id INT NOT NULL,
    item_code VARCHAR(64) DEFAULT '', product_name VARCHAR(255) DEFAULT '',
    product_rate DECIMAL(14,2) NOT NULL DEFAULT 0, product_qty INT NOT NULL DEFAULT 0,
    total DECIMAL(14,2) NOT NULL DEFAULT 0,
    description TEXT, discount DECIMAL(14,2) DEFAULT 0,
    qty_ctn INT DEFAULT 0, qty_loose_pieces INT DEFAULT 0, pieces_per_ctn INT DEFAULT 1,
    INDEX idx_sitems_owner (business_owner_id), INDEX idx_sitems_sale (sale_id), INDEX idx_sitems_stock (stock_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS sale_returns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    sale_id INT DEFAULT NULL,
    return_date DATE NOT NULL, total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    reason TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sreturns_owner (business_owner_id), INDEX idx_sreturns_sale (sale_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS sale_return_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    sale_return_id INT NOT NULL, stock_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 0, price DECIMAL(14,2) NOT NULL DEFAULT 0,
    total DECIMAL(14,2) NOT NULL DEFAULT 0,
    INDEX idx_sritems_owner (business_owner_id), INDEX idx_sritems_return (sale_return_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    vendor_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL, product_description TEXT,
    packing_unit VARCHAR(32) DEFAULT 'CTN', pieces_per_ctn INT DEFAULT 1,
    purchase_price DECIMAL(14,2) DEFAULT 0, sale_price DECIMAL(14,2) DEFAULT 0,
    product_code VARCHAR(64) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_products_owner (business_owner_id), INDEX idx_products_vendor (vendor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(64) DEFAULT '', role VARCHAR(64) DEFAULT '', base_salary DECIMAL(14,2) DEFAULT 0,
    ot_rate DECIMAL(14,2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_employees_owner (business_owner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS employee_ledger (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    employee_id INT NOT NULL,
    date DATE NOT NULL, transaction_type VARCHAR(32) NOT NULL, description TEXT,
    debit DECIMAL(14,2) DEFAULT 0, credit DECIMAL(14,2) DEFAULT 0, balance DECIMAL(14,2) DEFAULT 0,
    ot_hours DECIMAL(10,2) DEFAULT 0, gatepass_number VARCHAR(64) DEFAULT '', customer_name VARCHAR(255) DEFAULT '',
    bank_account_id INT DEFAULT NULL, payment_method VARCHAR(32) DEFAULT 'CASH',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_eledger_owner (business_owner_id), INDEX idx_eledger_employee (employee_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS gate_pass_staff (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    name VARCHAR(255) NOT NULL, type VARCHAR(32) NOT NULL,
    mobile VARCHAR(64) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_gpstaff_owner (business_owner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS gate_passes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    ogp_number INT, ogp_date TEXT,
    customer_id INT, sale_rep VARCHAR(255) DEFAULT '', delivery_man VARCHAR(255) DEFAULT '',
    total_qty DECIMAL(14,3) DEFAULT 0, total_amount DECIMAL(14,2) DEFAULT 0, remarks TEXT,
    delivery_date VARCHAR(32) DEFAULT '', mobile VARCHAR(64) DEFAULT '',
    delivery_sale_man VARCHAR(255) DEFAULT '', area VARCHAR(255) DEFAULT '',
    status VARCHAR(32) DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_gp_owner (business_owner_id), INDEX idx_gp_customer (customer_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS gate_pass_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    gate_pass_id INT NOT NULL,
    stock_id INT, item_code VARCHAR(64) DEFAULT '', item_description TEXT,
    quantity DECIMAL(14,3) DEFAULT 0, rate DECIMAL(14,2) DEFAULT 0, total DECIMAL(14,2) DEFAULT 0,
    INDEX idx_gpitems_owner (business_owner_id), INDEX idx_gpitems_gp (gate_pass_id), INDEX idx_gpitems_stock (stock_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS ogp_areas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ogpareas_owner_name (business_owner_id, name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS booking_order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    gate_pass_id INT NOT NULL,
    customer_id INT, shop_name VARCHAR(255) DEFAULT '', stock_id INT,
    brand VARCHAR(255) DEFAULT '', item_code VARCHAR(64) DEFAULT '', item_description TEXT,
    qty_ctn DECIMAL(14,3) DEFAULT 0, qty_pieces DECIMAL(14,3) DEFAULT 0, rate DECIMAL(14,2) DEFAULT 0,
    amount DECIMAL(14,2) DEFAULT 0, discount DECIMAL(14,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_boi_owner (business_owner_id), INDEX idx_boi_gp (gate_pass_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS gate_pass_returns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    gate_pass_id INT NOT NULL,
    customer_id INT, shop_name VARCHAR(255) DEFAULT '', return_date VARCHAR(32) DEFAULT '',
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_gpr_owner (business_owner_id), INDEX idx_gpr_gp (gate_pass_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS gate_pass_return_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    return_id INT NOT NULL,
    stock_id INT, item_code VARCHAR(64) DEFAULT '',
    item_description TEXT, brand VARCHAR(255) DEFAULT '',
    qty_ctn DECIMAL(14,3) DEFAULT 0, qty_pieces DECIMAL(14,3) DEFAULT 0,
    rate DECIMAL(14,2) DEFAULT 0, amount DECIMAL(14,2) DEFAULT 0, net DECIMAL(14,2) DEFAULT 0,
    INDEX idx_gpri_owner (business_owner_id), INDEX idx_gpri_return (return_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS bank_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(32) NOT NULL DEFAULT 'CASH', bank_name VARCHAR(255) DEFAULT '',
    account_number VARCHAR(64) DEFAULT '', opening_balance DECIMAL(14,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bank_owner (business_owner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS cash_bank_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    transaction_date DATE NOT NULL,
    account_id INT NOT NULL, transaction_type VARCHAR(32) NOT NULL, reference_id INT,
    reference_type VARCHAR(32) DEFAULT '', debit DECIMAL(14,2) DEFAULT 0, credit DECIMAL(14,2) DEFAULT 0,
    balance DECIMAL(14,2) DEFAULT 0, description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cbt_owner (business_owner_id), INDEX idx_cbt_account (account_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS receipts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    receipt_no VARCHAR(64) NOT NULL,
    receipt_date DATE NOT NULL,
    customer_id INT NOT NULL,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0, payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH',
    bank_account_id INT,
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_receipts_owner (business_owner_id), INDEX idx_receipts_customer (customer_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS vendor_payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    payment_no VARCHAR(64) NOT NULL,
    payment_date DATE NOT NULL,
    vendor_id INT NOT NULL,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0, payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH',
    bank_account_id INT,
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vpay_owner (business_owner_id), INDEX idx_vpay_vendor (vendor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS company_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    name VARCHAR(255) DEFAULT '', tagline VARCHAR(255) DEFAULT '', address TEXT,
    city VARCHAR(255) DEFAULT '', phone VARCHAR(64) DEFAULT '', mobile VARCHAR(64) DEFAULT '',
    email VARCHAR(191) DEFAULT '', website VARCHAR(255) DEFAULT '', ntn VARCHAR(64) DEFAULT '',
    strn VARCHAR(64) DEFAULT '', delete_password_hash VARCHAR(255) DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_company_settings_owner (business_owner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  await q(`CREATE TABLE IF NOT EXISTS expenses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_owner_id INT NOT NULL,
    expense_no VARCHAR(64) NOT NULL, expense_date DATE NOT NULL,
    category VARCHAR(128) NOT NULL, description TEXT,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0, payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH',
    bank_account_id INT,
    notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_expenses_owner (business_owner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);
}

// One-time per-tenant seed data (mirrors what initBusinessTables used to seed
// into each fresh per-file sql.js database).
async function seedTenantDefaults(tenantId) {
  const [[{ c: bankCount }]] = await pool.query(
    'SELECT COUNT(*) as c FROM bank_accounts WHERE business_owner_id = ?', [tenantId]
  );
  if (bankCount === 0) {
    await pool.execute(
      `INSERT INTO bank_accounts (business_owner_id, account_name, account_type, opening_balance) VALUES (?, 'Cash in Hand', 'CASH', 0)`,
      [tenantId]
    );
  }
  const [[{ c: settingsCount }]] = await pool.query(
    'SELECT COUNT(*) as c FROM company_settings WHERE business_owner_id = ?', [tenantId]
  );
  if (settingsCount === 0) {
    await pool.execute('INSERT INTO company_settings (business_owner_id) VALUES (?)', [tenantId]);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
const db = {
  authDb: null,

  async initialize() {
    await initAuthTables();
    await initBusinessTables();
    db.authDb = new DbWrapper(null);

    const [[{ c: userCount }]] = await pool.query('SELECT COUNT(*) as c FROM users');
    if (userCount === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await pool.execute(
        'INSERT INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)',
        ['hafizluqman', 'hafizluqman@distribookerp.local', hash, 'Hafiz Luqman', 'admin']
      );
      console.log('Default admin user created (hafizluqman / admin123)');
    }
  },

  async getBusinessDb(ownerId) {
    const id = Number(ownerId);
    if (bizDbCache.has(id)) return bizDbCache.get(id);
    const wrapper = new DbWrapper(id);
    await seedTenantDefaults(id);
    bizDbCache.set(id, wrapper);
    return wrapper;
  },

  setContext(wrapper, callback) {
    return storage.run(wrapper, callback);
  },

  // No-op kept for interface compatibility (sql.js file reload after backup
  // restore doesn't apply to MySQL — restore now works at the row level, see
  // routes/backup.js).
  async reload() {},

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

  pool,               // exposed for the one-off migration script and health checks
  TENANT_TABLES,      // exposed for routes/backup.js (JSON export/import) and the migration script
};

module.exports = db;
