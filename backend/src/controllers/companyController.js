const bcrypt = require('bcryptjs');
const db = require('../db/db');

exports.get = (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
    res.json(row || {});
  } catch (e) {
    res.status(500).json({ error: 'Company settings operation failed' });
  }
};

exports.update = (req, res) => {
  try {
    const { name, tagline, address, city, phone, mobile, email, website, ntn, strn } = req.body;
    db.prepare(`
      UPDATE company_settings SET
        name = ?, tagline = ?, address = ?, city = ?, phone = ?, mobile = ?,
        email = ?, website = ?, ntn = ?, strn = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      name || '', tagline || '', address || '', city || '',
      phone || '', mobile || '', email || '', website || '',
      ntn || '', strn || ''
    );
    const updated = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Company settings operation failed' });
  }
};

// ── Dedicated delete-confirmation password ──────────────────────────────────
// A separate password (distinct from the login password) admins can require
// when deleting records. If none is set, verifyDeletePassword falls back to
// the requesting user's own login password.

exports.getDeletePasswordStatus = (req, res) => {
  try {
    const row = db.prepare('SELECT delete_password_hash FROM company_settings WHERE id = 1').get();
    res.json({ isSet: !!row?.delete_password_hash });
  } catch (e) {
    res.status(500).json({ error: 'Failed to check delete password status' });
  }
};

exports.setDeletePassword = async (req, res) => {
  try {
    const userRow = db.authDb.prepare('SELECT role, password FROM users WHERE id = ?').get(req.user.userId);
    if (!userRow || userRow.role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Current login password and new delete password are required' });
    if (String(newPassword).trim().length < 4)
      return res.status(400).json({ error: 'Delete password must be at least 4 characters' });

    const validCurrent = await bcrypt.compare(String(currentPassword).trim(), userRow.password);
    if (!validCurrent) return res.status(401).json({ error: 'Your login password is incorrect' });

    const hash = await bcrypt.hash(String(newPassword).trim(), 10);
    db.prepare('UPDATE company_settings SET delete_password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(hash);
    res.json({ success: true });
  } catch (e) {
    console.error('setDeletePassword error:', e);
    res.status(500).json({ error: 'Failed to set delete password' });
  }
};

exports.removeDeletePassword = async (req, res) => {
  try {
    const userRow = db.authDb.prepare('SELECT role, password FROM users WHERE id = ?').get(req.user.userId);
    if (!userRow || userRow.role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });

    const { currentPassword } = req.body;
    if (!currentPassword) return res.status(400).json({ error: 'Current login password is required' });
    const validCurrent = await bcrypt.compare(String(currentPassword).trim(), userRow.password);
    if (!validCurrent) return res.status(401).json({ error: 'Your login password is incorrect' });

    db.prepare('UPDATE company_settings SET delete_password_hash = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
    res.json({ success: true });
  } catch (e) {
    console.error('removeDeletePassword error:', e);
    res.status(500).json({ error: 'Failed to remove delete password' });
  }
};

exports.verifyDeletePassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const settings = db.prepare('SELECT delete_password_hash FROM company_settings WHERE id = 1').get();
    let ok;
    if (settings?.delete_password_hash) {
      ok = await bcrypt.compare(String(password).trim(), settings.delete_password_hash);
    } else {
      const userRow = db.authDb.prepare('SELECT password FROM users WHERE id = ?').get(req.user.userId);
      ok = userRow ? await bcrypt.compare(String(password).trim(), userRow.password) : false;
    }
    if (!ok) return res.status(401).json({ error: 'Incorrect password' });
    res.json({ verified: true });
  } catch (e) {
    console.error('verifyDeletePassword error:', e);
    res.status(500).json({ error: 'Password verification failed' });
  }
};
