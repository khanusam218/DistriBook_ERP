const db = require('../db/db');
const ledgerService = require('../services/ledgerService');
const { createCashBankEntry, resolveCashAccountId } = require('./bankAccountController');

async function getNextReceiptNo() {
  const year = new Date().getFullYear();
  const row = await db.prepare(
    `SELECT MAX(CAST(SUBSTR(receipt_no, 11) AS UNSIGNED)) as maxNo FROM receipts WHERE receipt_no LIKE 'RCPT-${year}-%'`
  ).get();
  return `RCPT-${year}-${String((row?.maxNo || 0) + 1).padStart(4, '0')}`;
}

// Matches customerLedgerController's calculation exactly (opening_balance column + non-opening
// entries). NOT the same as ledgerService.getCustomerBalance(), which sums every ledger row
// including the OPENING_BALANCE entry — that entry is stored with inverted debit/credit signs
// relative to the opening_balance column, so summing it in would give the wrong total.
async function getCustomerOutstanding(customer) {
  const opening = Number(customer.opening_balance) || 0;
  const row = await db.prepare(
    `SELECT COALESCE(SUM(debit - credit), 0) as total FROM customer_ledger WHERE customer_id = ? AND transaction_type != 'OPENING_BALANCE'`
  ).get(customer.id);
  return opening + Number(row.total || 0);
}

async function postReceipt(r) {
  const { customer_id, amount, payment_method, notes, receipt_date } = r;
  if (!customer_id || !amount || amount <= 0) return null;
  if (payment_method && payment_method !== 'CASH' && !r.bank_account_id) return null;
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
  if (!customer) return null;
  if (customer.customer_type === 'WHOLESALER' && (await getCustomerOutstanding(customer)) <= 0) return null;

  const bank_account_id = await resolveCashAccountId(payment_method, r.bank_account_id);
  const receipt_no = await getNextReceiptNo();
  const date = receipt_date || new Date().toISOString().split('T')[0];

  const result = await db.prepare(`
    INSERT INTO receipts (receipt_no, receipt_date, customer_id, amount, payment_method, bank_account_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(receipt_no, date, customer_id, amount, payment_method || 'CASH', bank_account_id, notes || '');

  const receiptId = result.lastInsertRowid;

  if (customer.customer_type === 'WHOLESALER') {
    await ledgerService.createCustomerLedgerEntry(
      customer_id, 'PAYMENT', receiptId, 'receipt',
      0, amount, `Receipt ${receipt_no}${notes ? ' — ' + notes : ''}`
    );
  }

  if (bank_account_id) {
    await createCashBankEntry(bank_account_id, 'RECEIPT', receiptId, 'receipt', amount, 0, `Receipt ${receipt_no} — ${customer.shop_name}`, date);
  }

  return { receipt_no, customer_id, shop_name: customer.shop_name, amount };
}

exports.getAll = async (req, res) => {
  try {
    const receipts = await db.prepare(`
      SELECT r.*, c.shop_name, c.customer_name, c.customer_code, ba.account_name
      FROM receipts r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN bank_accounts ba ON r.bank_account_id = ba.id
      ORDER BY r.receipt_date DESC, r.id DESC
    `).all();
    res.json(receipts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.bulkCreate = async (req, res) => {
  try {
    const { receipts } = req.body;
    if (!Array.isArray(receipts) || receipts.length === 0) {
      return res.status(400).json({ error: 'No receipts provided' });
    }
    const created = await db.transaction(async () => {
      const results = [];
      for (const r of receipts) {
        const posted = await postReceipt(r);
        if (posted) results.push(posted);
      }
      return results;
    })();
    res.json({ success: true, count: created.length, receipts: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const created = await db.transaction(async () => await postReceipt(req.body))();
    if (!created) return res.status(400).json({ error: 'Invalid receipt data' });
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const receipt = await db.prepare('SELECT * FROM receipts WHERE id = ?').get(id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });

    const customer = await db.prepare('SELECT customer_type FROM customers WHERE id = ?').get(receipt.customer_id);
    if (customer?.customer_type === 'WHOLESALER') {
      await ledgerService.createCustomerLedgerEntry(
        receipt.customer_id, 'PAYMENT_REVERSAL', id, 'receipt',
        receipt.amount, 0, `Reversal of Receipt ${receipt.receipt_no}`
      );
    }
    if (receipt.bank_account_id) {
      await createCashBankEntry(receipt.bank_account_id, 'REVERSAL', id, 'receipt', 0, receipt.amount, `Reversal of ${receipt.receipt_no}`, receipt.receipt_date);
    }
    await db.prepare('DELETE FROM receipts WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
