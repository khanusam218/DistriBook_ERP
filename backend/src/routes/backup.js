const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db/db');

// Resolve which database file holds the CURRENT user's business data.
// Legacy users (registered before multi-tenancy) share the auth db file for
// both login and business data; every user since then has their own isolated file.
async function resolveUserBusinessDb(req) {
  const userRow = db.authDb.prepare(
    'SELECT id, business_owner_id FROM users WHERE id = ?'
  ).get(req.user.userId);
  if (!userRow) throw new Error('User not found');
  if (userRow.business_owner_id == null) return db.authDb;
  return db.getBusinessDb(Number(userRow.business_owner_id));
}

// ── Export Backup ─────────────────────────────────────────────────────────────
// GET /api/backup/export — backs up only the current user's own business data,
// not every account on the machine.
router.get('/export', async (req, res) => {
  try {
    const wrapper = await resolveUserBusinessDb(req);
    wrapper._saveSync();

    const filename = path.basename(wrapper.filePath);
    const content = fs.readFileSync(wrapper.filePath);

    res.json({
      version: '2.0',
      createdAt: new Date().toISOString(),
      files: { [filename]: content.toString('base64') },
    });
  } catch (err) {
    console.error('Backup export failed:', err);
    res.status(500).json({ error: 'Failed to create backup: ' + err.message });
  }
});

// ── Import Backup ─────────────────────────────────────────────────────────────
// POST /api/backup/import — restores a backup's data into the CURRENT user's own
// business file, regardless of which filename/account the backup was originally
// exported from. This makes "restore" always mean "replace my data with this
// backup", instead of depending on matching internal file/account IDs.
router.post('/import', async (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.files || typeof backup.files !== 'object') {
      return res.status(400).json({ error: 'Invalid backup file format.' });
    }
    const dbFiles = Object.entries(backup.files).filter(([name]) => name.endsWith('.db'));
    if (dbFiles.length === 0) {
      return res.status(400).json({ error: 'Backup contains no database file.' });
    }
    // A backup produced by this app always contains exactly one business database
    // (the exporting user's own). If more than one is present (an older-format
    // whole-instance backup), prefer a non-auth file since thok.db may just be
    // that install's shared/legacy file rather than the intended business data.
    const [, base64Content] = dbFiles.find(([name]) => name !== 'thok.db') || dbFiles[0];
    const buffer = Buffer.from(base64Content, 'base64');

    const userRow = db.authDb.prepare(
      'SELECT id, business_owner_id FROM users WHERE id = ?'
    ).get(req.user.userId);
    if (!userRow) return res.status(404).json({ error: 'User not found' });

    if (userRow.business_owner_id == null) {
      // Legacy: business data shares the auth db file, so overwriting it also
      // replaces the users table — preserve every account that currently exists.
      let savedUsers = [];
      try {
        const stmt = db.authDb.sqliteDb.prepare('SELECT * FROM users');
        while (stmt.step()) savedUsers.push(stmt.getAsObject());
        stmt.free();
      } catch (e) { console.warn('Could not save users before restore:', e.message); }

      fs.writeFileSync(db.authDb.filePath, buffer);
      await db.reload();

      if (savedUsers.length > 0 && db.authDb?.sqliteDb) {
        try {
          db.authDb.sqliteDb.run('DELETE FROM users');
          const insert = db.authDb.sqliteDb.prepare(
            'INSERT INTO users (id, username, email, password, full_name, is_active, role, permissions, business_name, business_owner_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
          );
          for (const u of savedUsers) {
            insert.run([
              u.id, u.username, u.email, u.password, u.full_name,
              u.is_active ?? 1, u.role ?? 'user', u.permissions ?? '{}',
              u.business_name ?? '', u.business_owner_id ?? null,
              u.created_at ?? new Date().toISOString(), u.updated_at ?? new Date().toISOString(),
            ]);
          }
          insert.free();
          db.authDb._save();
        } catch (e) { console.warn('Could not restore users after backup:', e.message); }
      }
    } else {
      // Tenant: business data is fully isolated in its own file — safe to overwrite
      // directly without touching the auth db or any other account.
      const wrapper = await db.getBusinessDb(Number(userRow.business_owner_id));
      fs.writeFileSync(wrapper.filePath, buffer);
      await db.reload();
    }

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
