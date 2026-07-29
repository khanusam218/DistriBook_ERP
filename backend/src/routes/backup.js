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
      // Wipe this tenant's existing rows, then reinsert everything from the
      // backup — re-stamped with the CURRENT tenant id so a backup can be
      // restored into a different account than it was exported from.
      for (const table of db.TENANT_TABLES) {
        await wrapper.prepare(`DELETE FROM ${table}`).run();
      }
      for (const table of db.TENANT_TABLES) {
        const rows = Array.isArray(dump[table]) ? dump[table] : [];
        for (const row of rows) {
          // business_owner_id is re-stamped automatically by the tenant-aware
          // wrapper (see db.js rewriteInsert) — never include it explicitly here,
          // or it would be added twice.
          const cols = Object.keys(row).filter(c => c !== 'business_owner_id');
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => '?').join(', ');
          const values = cols.map(c => row[c]);
          await wrapper.prepare(
            `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
          ).run(...values);
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
