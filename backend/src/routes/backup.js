const express = require('express');
const router = express.Router();
const db = require('../db/db');

// ── Backup format (v3) ───────────────────────────────────────────────────────
// The old sql.js-based backup shipped raw SQLite file bytes. That approach
// doesn't exist anymore now that every tenant's data lives as rows in a
// single shared MySQL database, so backups are now a row-level JSON dump of
// every business table, scoped to the current tenant only — never other
// accounts' data, and never the shared `users` (auth) table.
//
// The envelope shape `{ version, createdAt, files: { <name>: <base64> } }` is
// kept as close as possible to the old one so the frontend (frontend/src/pages/Backup.jsx)
// doesn't need to change: it only checks that `backup.files` is a truthy object
// before uploading it back verbatim on import, and displays `Object.keys(files).length`.
// The base64 payload behind that single "file" is now a JSON blob of table rows
// instead of raw SQLite bytes.

async function resolveTenantId(req) {
  const userRow = await db.authDb.prepare(
    'SELECT id, business_owner_id FROM users WHERE id = ?'
  ).get(req.user.userId);
  if (!userRow) throw new Error('User not found');
  return Number(userRow.business_owner_id ?? userRow.id);
}

// ── Restore: foreign-key remapping ──────────────────────────────────────────
// `id` is a single AUTO_INCREMENT counter shared by every tenant in this
// database (there's no per-tenant file anymore), so a restore can never reuse
// a backup's original row ids — some other tenant may already own that id.
// Every foreign-key-shaped column must instead be remapped from the backup's
// old id to whatever new id MySQL assigns during restore. FK_COLUMNS lists the
// ordinary (single-target) ones; REFERENCE_TYPE_TABLE resolves the polymorphic
// (reference_id, reference_type) pairs used by the ledger tables.
const FK_COLUMNS = {
  products: { vendor_id: 'vendors' },
  purchases: { vendor_id: 'vendors' },
  sales: { customer_id: 'customers', bank_account_id: 'bank_accounts' },
  gate_passes: { customer_id: 'customers' },
  receipts: { customer_id: 'customers', bank_account_id: 'bank_accounts' },
  vendor_payments: { vendor_id: 'vendors', bank_account_id: 'bank_accounts' },
  expenses: { bank_account_id: 'bank_accounts' },
  purchase_items: { purchase_id: 'purchases', stock_id: 'stocks' },
  purchase_returns: { purchase_id: 'purchases' },
  sale_items: { sale_id: 'sales', stock_id: 'stocks' },
  sale_returns: { sale_id: 'sales' },
  employee_ledger: { employee_id: 'employees', bank_account_id: 'bank_accounts' },
  gate_pass_items: { gate_pass_id: 'gate_passes', stock_id: 'stocks' },
  booking_order_items: { gate_pass_id: 'gate_passes', customer_id: 'customers', stock_id: 'stocks' },
  gate_pass_returns: { gate_pass_id: 'gate_passes', customer_id: 'customers' },
  purchase_return_items: { purchase_return_id: 'purchase_returns', stock_id: 'stocks' },
  sale_return_items: { sale_return_id: 'sale_returns', stock_id: 'stocks' },
  gate_pass_return_items: { return_id: 'gate_pass_returns', stock_id: 'stocks' },
  vendor_ledger: { vendor_id: 'vendors' },
  customer_ledger: { customer_id: 'customers' },
  cash_bank_transactions: { account_id: 'bank_accounts' },
};

const REFERENCE_TABLES = new Set(['vendor_ledger', 'customer_ledger', 'company_ledger', 'cash_bank_transactions']);
const REFERENCE_TYPE_TABLE = {
  sale: 'sales', purchase: 'purchases', purchase_return: 'purchase_returns',
  sale_return: 'sale_returns', gate_pass: 'gate_passes', receipt: 'receipts',
  vendor_payment: 'vendor_payments', expense: 'expenses',
};

// Every table must be restored after every table it points to, so that
// table's old-id -> new-id map already exists by the time it's needed.
const RESTORE_ORDER = [
  'stocks', 'customers', 'vendors', 'employees', 'gate_pass_staff', 'ogp_areas', 'bank_accounts', 'company_settings',
  'products', 'purchases', 'sales', 'gate_passes', 'receipts', 'vendor_payments', 'expenses',
  'purchase_items', 'purchase_returns', 'sale_items', 'sale_returns', 'employee_ledger',
  'gate_pass_items', 'booking_order_items', 'gate_pass_returns',
  'purchase_return_items', 'sale_return_items', 'gate_pass_return_items',
  'vendor_ledger', 'customer_ledger', 'company_ledger', 'cash_bank_transactions',
];

// ── Export Backup ─────────────────────────────────────────────────────────────
// GET /api/backup/export — dumps only the current user's own tenant data.
router.get('/export', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    const wrapper = await db.getBusinessDb(tenantId);

    const dump = {};
    for (const table of db.TENANT_TABLES) {
      dump[table] = await wrapper.prepare(`SELECT * FROM ${table}`).all();
    }

    const payload = Buffer.from(JSON.stringify(dump)).toString('base64');

    res.json({
      version: '3.0',
      createdAt: new Date().toISOString(),
      tenantId,
      files: { 'business-data.json': payload },
    });
  } catch (err) {
    console.error('Backup export failed:', err);
    res.status(500).json({ error: 'Failed to create backup: ' + err.message });
  }
});

// ── Import Backup ─────────────────────────────────────────────────────────────
// POST /api/backup/import — restores a backup's data into the CURRENT user's own
// tenant, replacing all of that tenant's existing business data. Restoring
// always means "replace my data with this backup" — regardless of which
// account originally exported it.
router.post('/import', async (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.files || typeof backup.files !== 'object') {
      return res.status(400).json({ error: 'Invalid backup file format.' });
    }

    const entry = backup.files['business-data.json'] || Object.values(backup.files)[0];
    if (!entry) {
      return res.status(400).json({ error: 'Backup contains no database file.' });
    }

    let dump;
    try {
      const json = Buffer.from(entry, 'base64').toString('utf8');
      dump = JSON.parse(json);
    } catch {
      return res.status(400).json({
        error: 'This backup file is in an old, unsupported format (raw database file). '
          + 'Backups created before the MySQL migration cannot be restored automatically — contact support.',
      });
    }

    const tenantId = await resolveTenantId(req);
    const wrapper = await db.getBusinessDb(tenantId);

    await wrapper.transaction(async () => {
      // Wipe this tenant's existing rows first.
      for (const table of db.TENANT_TABLES) {
        await wrapper.prepare(`DELETE FROM ${table}`).run();
      }

      // Re-insert everything from the backup. `id` and `business_owner_id` are
      // never copied from the backup: business_owner_id is re-stamped
      // automatically by the tenant-aware wrapper, and `id` is left for MySQL
      // to assign fresh — reusing the backup's original ids would eventually
      // collide with another tenant's row, since every tenant shares the same
      // AUTO_INCREMENT counter per table. Every foreign-key column is remapped
      // from the backup's old id to the newly-assigned one, in dependency
      // order (RESTORE_ORDER), so a parent row's new id is always known by the
      // time a child row needs it.
      const idMaps = {}; // table -> Map(oldId -> newId)
      for (const table of RESTORE_ORDER) {
        idMaps[table] = new Map();
        const rows = Array.isArray(dump[table]) ? dump[table] : [];
        const fkCols = FK_COLUMNS[table] || {};
        for (const row of rows) {
          const oldId = row.id;
          const cols = Object.keys(row).filter(c => c !== 'id' && c !== 'business_owner_id');
          // Falls back to the original id (not null) when no mapping exists —
          // e.g. the referenced row was deleted before this backup was taken.
          // This schema has no real database-level FK constraints, so a
          // leftover dangling id just matches existing app behavior; nulling
          // it out here would instead crash the whole restore on any NOT NULL
          // FK column (e.g. sale_items.stock_id) whenever this edge case hits.
          const values = cols.map((c) => {
            const v = row[c];
            if (fkCols[c] && v != null) return idMaps[fkCols[c]]?.get(v) ?? v;
            return v;
          });
          if (REFERENCE_TABLES.has(table) && row.reference_id != null && row.reference_type) {
            const refTable = REFERENCE_TYPE_TABLE[String(row.reference_type).toLowerCase()];
            const idx = cols.indexOf('reference_id');
            if (refTable && idx !== -1) values[idx] = idMaps[refTable]?.get(row.reference_id) ?? row.reference_id;
          }
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => '?').join(', ');
          const result = await wrapper.prepare(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
          ).run(...values);
          if (oldId != null) idMaps[table].set(oldId, result.lastInsertRowid);
        }
      }
    })();

    res.json({
      success: true,
      message: 'Backup restored successfully. Your data is now active.',
    });
  } catch (err) {
    console.error('Backup import failed:', err);
    res.status(500).json({ error: 'Failed to restore backup: ' + err.message });
  }
});

module.exports = router;
