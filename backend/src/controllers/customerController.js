const db = require('../db/db');
const { recordOpeningBalance } = require('../services/ledgerService');

exports.getAll = async (req, res) => {
  try {
    res.json(await db.prepare('SELECT * FROM customers ORDER BY customer_type, shop_name').all());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Customer not found' });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getNextCode = async (req, res) => {
  try {
    const row = await db.prepare('SELECT MAX(CAST(customer_code AS UNSIGNED)) as mx FROM customers').get();
    const next = String((row.mx || 0) + 1).padStart(3, '0');
    res.json({ code: next });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { shopName, customerType, openingBalance, address, email, phone } = req.body;
    // Customer Name (the contact person) is optional in the UI — many shops are registered
    // by shop name alone. Fall back to the shop name so downstream displays never show blank.
    const customerName = req.body.customerName || shopName;
    if (!shopName || !customerType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!['RETAILER', 'WHOLESALER', 'CUSTOMER'].includes(customerType)) {
      return res.status(400).json({ error: 'customerType must be RETAILER, CUSTOMER, or WHOLESALER' });
    }
    const maxRow = await db.prepare('SELECT MAX(CAST(customer_code AS UNSIGNED)) as mx FROM customers').get();
    const customerCode = String((maxRow.mx || 0) + 1).padStart(3, '0');
    const result = await db.prepare(
      `INSERT INTO customers (customer_code, shop_name, customer_name, customer_type, opening_balance, address, email, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(customerCode, shopName, customerName, customerType, openingBalance || 0, address || '', email || '', phone || '');
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    if (customerType === 'WHOLESALER' && openingBalance && openingBalance !== 0) {
      await recordOpeningBalance(null, customer.id, openingBalance, 'customer');
    }
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerCode, shopName, customerName, customerType, openingBalance, address, email, phone } = req.body;
    const existing = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Customer not found' });
    await db.prepare(
      `UPDATE customers SET customer_code=?, shop_name=?, customer_name=?, customer_type=?, opening_balance=?,
       address=?, email=?, phone=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(
      customerCode ?? existing.customer_code,
      shopName ?? existing.shop_name,
      customerName ?? existing.customer_name,
      customerType ?? existing.customer_type,
      openingBalance ?? existing.opening_balance,
      address ?? existing.address,
      email ?? existing.email,
      phone ?? existing.phone,
      id
    );
    res.json(await db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Customer not found' });
    await db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ message: 'Customer deleted successfully', customer: row });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getByType = async (req, res) => {
  try {
    res.json(await db.prepare('SELECT * FROM customers WHERE customer_type = ? ORDER BY shop_name').all(req.params.type));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
