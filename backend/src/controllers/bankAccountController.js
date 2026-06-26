const db = require('../db/db');

function getAccountBalance(accountId) {
  const acc = db.prepare('SELECT opening_balance FROM bank_accounts WHERE id = ?').get(accountId);
  const row = db.prepare('SELECT COALESCE(SUM(debit - credit), 0) as txn FROM cash_bank_transactions WHERE account_id = ?').get(accountId);
  return (acc?.opening_balance || 0) + (row?.txn || 0);
}

exports.createCashBankEntry = function (accountId, transactionType, referenceId, referenceType, debit, credit, description, date) {
  const balance = getAccountBalance(accountId) + debit - credit;
  db.prepare(`
    INSERT INTO cash_bank_transactions (account_id, transaction_type, reference_id, reference_type, debit, credit, balance, description, transaction_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(accountId, transactionType, referenceId, referenceType, debit, credit, balance, description, date || new Date().toISOString().split('T')[0]);
};

exports.getAll = (req, res) => {
  try {
    const accounts = db.prepare('SELECT * FROM bank_accounts ORDER BY account_type, account_name').all();
    const withBalances = accounts.map(acc => ({
      ...acc,
      balance: getAccountBalance(acc.id),
    }));
    res.json(withBalances);
  } catch (err) {
    res.status(500).json({ error: 'Bank account operation failed' });
  }
};

exports.create = (req, res) => {
  try {
    const { account_name, account_type, bank_name, account_number, opening_balance } = req.body;
    if (!account_name) return res.status(400).json({ error: 'Account name required' });
    const result = db.prepare(`
      INSERT INTO bank_accounts (account_name, account_type, bank_name, account_number, opening_balance)
      VALUES (?, ?, ?, ?, ?)
    `).run(account_name, account_type || 'CASH', bank_name || '', account_number || '', opening_balance || 0);
    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(result.lastInsertRowid);
    res.json({ ...account, balance: getAccountBalance(account.id) });
  } catch (err) {
    res.status(500).json({ error: 'Bank account operation failed' });
  }
};

exports.update = (req, res) => {
  try {
    const { id } = req.params;
    const { account_name, account_type, bank_name, account_number, opening_balance } = req.body;
    db.prepare(`
      UPDATE bank_accounts SET account_name=?, account_type=?, bank_name=?, account_number=?, opening_balance=? WHERE id=?
    `).run(account_name, account_type, bank_name || '', account_number || '', opening_balance || 0, id);
    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id);
    res.json({ ...account, balance: getAccountBalance(id) });
  } catch (err) {
    res.status(500).json({ error: 'Bank account operation failed' });
  }
};

exports.delete = (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Bank account operation failed' });
  }
};

exports.getTransactions = (req, res) => {
  try {
    const { id } = req.params;
    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    const entries = db.prepare(
      'SELECT * FROM cash_bank_transactions WHERE account_id = ? ORDER BY transaction_date ASC, id ASC'
    ).all(id);
    let balance = account.opening_balance || 0;
    const transactions = entries.map(t => {
      balance = balance + (t.debit || 0) - (t.credit || 0);
      return { ...t, balance };
    });
    transactions.reverse();
    res.json({ account: { ...account, balance: getAccountBalance(id) }, transactions });
  } catch (err) {
    res.status(500).json({ error: 'Bank account operation failed' });
  }
};
