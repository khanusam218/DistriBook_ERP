const db = require('../db/db');

function getVendorBalance(vendorId) {
  const row = db.prepare('SELECT COALESCE(SUM(debit - credit), 0) as balance FROM vendor_ledger WHERE vendor_id = ?').get(vendorId);
  return row.balance || 0;
}

function getCustomerBalance(customerId) {
  const row = db.prepare('SELECT COALESCE(SUM(debit - credit), 0) as balance FROM customer_ledger WHERE customer_id = ?').get(customerId);
  return row.balance || 0;
}

function createVendorLedgerEntry(vendorId, transactionType, referenceId, referenceType, debit, credit, description) {
  const newBalance = getVendorBalance(vendorId) + credit - debit;
  const result = db.prepare(
    `INSERT INTO vendor_ledger (vendor_id, transaction_type, reference_id, reference_type, debit, credit, balance, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(vendorId, transactionType, referenceId, referenceType, debit, credit, newBalance, description);
  return db.prepare('SELECT * FROM vendor_ledger WHERE id = ?').get(result.lastInsertRowid);
}

function createCustomerLedgerEntry(customerId, transactionType, referenceId, referenceType, debit, credit, description) {
  const newBalance = getCustomerBalance(customerId) + debit - credit;
  const result = db.prepare(
    `INSERT INTO customer_ledger (customer_id, transaction_type, reference_id, reference_type, debit, credit, balance, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(customerId, transactionType, referenceId, referenceType, debit, credit, newBalance, description);
  return db.prepare('SELECT * FROM customer_ledger WHERE id = ?').get(result.lastInsertRowid);
}

function recordOpeningBalance(vendorId, customerId, openingBalance, type) {
  if (type === 'vendor' && vendorId) {
    // Vendor opening balance: DEBIT = we owe vendor this amount
    const debit = openingBalance > 0 ? openingBalance : 0;
    const credit = openingBalance < 0 ? Math.abs(openingBalance) : 0;
    return createVendorLedgerEntry(vendorId, 'OPENING_BALANCE', null, 'opening', debit, credit, 'Opening Balance');
  } else if (type === 'customer' && customerId) {
    // Customer opening balance: CREDIT = customer owes us this amount
    const debit = openingBalance < 0 ? Math.abs(openingBalance) : 0;
    const credit = openingBalance > 0 ? openingBalance : 0;
    return createCustomerLedgerEntry(customerId, 'OPENING_BALANCE', null, 'opening', debit, credit, 'Opening Balance');
  }
}

module.exports = { createVendorLedgerEntry, createCustomerLedgerEntry, getVendorBalance, getCustomerBalance, recordOpeningBalance };
