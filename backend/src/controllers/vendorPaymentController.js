const db = require('../db/db');
const ledgerService = require('../services/ledgerService');
const { createCashBankEntry } = require('./bankAccountController');

function getNextPaymentNo() {
  const year = new Date().getFullYear();
  const row = db.prepare(
    `SELECT MAX(CAST(SUBSTR(payment_no, 10) AS INTEGER)) as maxNo FROM vendor_payments WHERE payment_no LIKE 'VPY-${year}-%'`
  ).get();
  return `VPY-${year}-${String((row?.maxNo || 0) + 1).padStart(4, '0')}`;
}

exports.getAll = (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT vp.*, v.company_name, v.representative_name, ba.account_name
      FROM vendor_payments vp
      LEFT JOIN vendors v ON vp.vendor_id = v.id
      LEFT JOIN bank_accounts ba ON vp.bank_account_id = ba.id
      ORDER BY vp.payment_date DESC, vp.id DESC
    `).all();
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: 'Vendor payment operation failed' });
  }
};

exports.create = (req, res) => {
  try {
    const { vendor_id, amount, payment_method, bank_account_id, notes, payment_date } = req.body;
    if (!vendor_id || !amount || amount <= 0) return res.status(400).json({ error: 'Vendor and valid amount required' });
    if (payment_method && payment_method !== 'CASH' && !bank_account_id) return res.status(400).json({ error: 'Select a bank account' });

    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendor_id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const payment_no = getNextPaymentNo();
    const date = payment_date || new Date().toISOString().split('T')[0];

    const result = db.prepare(`
      INSERT INTO vendor_payments (payment_no, payment_date, vendor_id, amount, payment_method, bank_account_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(payment_no, date, vendor_id, amount, payment_method || 'CASH', bank_account_id || null, notes || '');

    const paymentId = result.lastInsertRowid;

    ledgerService.createVendorLedgerEntry(
      vendor_id, 'PAYMENT', paymentId, 'vendor_payment',
      0, amount, `Payment ${payment_no}${notes ? ' — ' + notes : ''}`
    );

    if (bank_account_id) {
      createCashBankEntry(bank_account_id, 'PAYMENT', paymentId, 'vendor_payment', 0, amount, `Payment ${payment_no} — ${vendor.company_name}`, date);
    }

    const payment = db.prepare(`
      SELECT vp.*, v.company_name FROM vendor_payments vp LEFT JOIN vendors v ON vp.vendor_id = v.id WHERE vp.id = ?
    `).get(paymentId);
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: 'Vendor payment operation failed' });
  }
};

exports.delete = (req, res) => {
  try {
    const { id } = req.params;
    const payment = db.prepare('SELECT * FROM vendor_payments WHERE id = ?').get(id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    ledgerService.createVendorLedgerEntry(
      payment.vendor_id, 'PAYMENT_REVERSAL', id, 'vendor_payment',
      payment.amount, 0, `Reversal of Payment ${payment.payment_no}`
    );
    if (payment.bank_account_id) {
      createCashBankEntry(payment.bank_account_id, 'REVERSAL', id, 'vendor_payment', payment.amount, 0, `Reversal of ${payment.payment_no}`, payment.payment_date);
    }
    db.prepare('DELETE FROM vendor_payments WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Vendor payment operation failed' });
  }
};
