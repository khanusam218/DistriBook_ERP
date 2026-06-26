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
