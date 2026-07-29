const db = require('../db/db');
const { recordOpeningBalance } = require('../services/ledgerService');

exports.getAll = async (req, res) => {
  try {
    res.json(await db.prepare('SELECT * FROM vendors ORDER BY company_name').all());
  } catch (error) {
    res.status(500).json({ error: 'Vendor operation failed' });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Vendor not found' });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Vendor operation failed' });
  }
};

exports.create = async (req, res) => {
  try {
    const { companyName, representativeName, openingBalance, address, email, phone } = req.body;
    if (!companyName) return res.status(400).json({ error: 'Missing required fields' });
    const maxRow = await db.prepare('SELECT MAX(CAST(company_code AS UNSIGNED)) as mx FROM vendors').get();
    const autoCode = String((maxRow.mx || 0) + 1).padStart(3, '0');
    const result = await db.prepare(
      `INSERT INTO vendors (company_code, company_name, representative_name, opening_balance, address, email, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(autoCode, companyName, representativeName || '', openingBalance || 0, address || '', email || '', phone || '');
    const vendor = await db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid);
    if (openingBalance && openingBalance !== 0) {
      await recordOpeningBalance(vendor.id, null, openingBalance, 'vendor');
    }
    res.status(201).json(vendor);
  } catch (error) {
    res.status(500).json({ error: 'Vendor operation failed' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyCode, companyName, representativeName, openingBalance, address, email, phone } = req.body;
    const existing = await db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Vendor not found' });
    await db.prepare(
      `UPDATE vendors SET company_code=?, company_name=?, representative_name=?, opening_balance=?,
       address=?, email=?, phone=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(
      companyCode ?? existing.company_code,
      companyName ?? existing.company_name,
      representativeName ?? existing.representative_name,
      openingBalance ?? existing.opening_balance,
      address ?? existing.address,
      email ?? existing.email,
      phone ?? existing.phone,
      id
    );
    res.json(await db.prepare('SELECT * FROM vendors WHERE id = ?').get(id));
  } catch (error) {
    res.status(500).json({ error: 'Vendor operation failed' });
  }
};

exports.delete = async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Vendor not found' });
    await db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
    res.json({ message: 'Vendor deleted successfully', vendor: row });
  } catch (error) {
    res.status(500).json({ error: 'Vendor operation failed' });
  }
};
