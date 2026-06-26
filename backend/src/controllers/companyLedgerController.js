const db = require('../db/db');

exports.getAll = (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM company_ledger ORDER BY transaction_date DESC').all());
  } catch (error) {
    res.status(500).json({ error: 'Company ledger operation failed' });
  }
};

exports.getByAccount = (req, res) => {
  try {
    const { accountName } = req.params;
    const entries = db.prepare('SELECT * FROM company_ledger WHERE account_name = ? ORDER BY transaction_date DESC').all(accountName);
    const bal = db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN debit > 0 THEN debit ELSE 0 END), 0) as totalDebits,
              COALESCE(SUM(CASE WHEN credit > 0 THEN credit ELSE 0 END), 0) as totalCredits
       FROM company_ledger WHERE account_name = ?`
    ).get(accountName);
    res.json({ entries, balance: { debits: bal.totalDebits, credits: bal.totalCredits } });
  } catch (error) {
    res.status(500).json({ error: 'Company ledger operation failed' });
  }
};

exports.create = (req, res) => {
  try {
    const { accountName, accountType, transactionType, referenceId, referenceType, debit, credit, description } = req.body;
    const result = db.prepare(
      `INSERT INTO company_ledger (account_name, account_type, transaction_type, reference_id, reference_type, debit, credit, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(accountName, accountType, transactionType, referenceId || null, referenceType || null, debit || 0, credit || 0, description || '');
    res.status(201).json(db.prepare('SELECT * FROM company_ledger WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) {
    res.status(500).json({ error: 'Company ledger operation failed' });
  }
};
