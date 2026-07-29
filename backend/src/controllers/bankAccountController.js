const db = require('../db/db');

async function getAccountBalance(accountId) {
  const acc = await db.prepare('SELECT opening_balance FROM bank_accounts WHERE id = ?').get(accountId);
  const row = await db.prepare('SELECT COALESCE(SUM(debit - credit), 0) as txn FROM cash_bank_transactions WHERE account_id = ?').get(accountId);
  return (acc?.opening_balance || 0) + (row?.txn || 0);
}

exports.createCashBankEntry = async function (accountId, transactionType, referenceId, referenceType, debit, credit, description, date) {
  const balance = (await getAccountBalance(accountId)) + debit - credit;
  await db.prepare(`
    INSERT INTO cash_bank_transactions (account_id, transaction_type, reference_id, reference_type, debit, credit, balance, description, transaction_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(accountId, transactionType, referenceId, referenceType, debit, credit, balance, description, date || new Date().toISOString().split('T')[0]);
};

// Resolves which account a payment should actually post to. If the caller
// explicitly chose one, use that. Otherwise, for CASH payments, fall back to
// the tenant's own CASH-type account (every tenant gets exactly one, seeded
// automatically) — several "Method: Cash" pickers in the UI don't also force
// picking a specific account, and silently skipping the cash-bank entry in
// that case was a real bug: the payment was recorded on the receipt/ledger
// but never reflected in the Cash in Hand balance.
exports.resolveCashAccountId = async function (paymentMethod, bankAccountId) {
  if (bankAccountId) return Number(bankAccountId);
  if (paymentMethod && paymentMethod !== 'CASH') return null;
  const cashAcc = await db.prepare("SELECT id FROM bank_accounts WHERE account_type = 'CASH' ORDER BY id LIMIT 1").get();
  return cashAcc ? cashAcc.id : null;
};

exports.getAll = async (req, res) => {
  try {
    const accounts = await db.prepare('SELECT * FROM bank_accounts ORDER BY account_type, account_name').all();
    const withBalances = [];
    for (const acc of accounts) {
      withBalances.push({
        ...acc,
        balance: await getAccountBalance(acc.id),
      });
    }
    res.json(withBalances);
  } catch (err) {
    res.status(500).json({ error: 'Bank account operation failed' });
  }
};

exports.create = async (req, res) => {
  try {
    const { account_name, account_type, bank_name, account_number, opening_balance } = req.body;
    if (!account_name) return res.status(400).json({ error: 'Account name required' });
    const result = await db.prepare(`
      INSERT INTO bank_accounts (account_name, account_type, bank_name, account_number, opening_balance)
      VALUES (?, ?, ?, ?, ?)
    `).run(account_name, account_type || 'CASH', bank_name || '', account_number || '', opening_balance || 0);
    const account = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(result.lastInsertRowid);
    res.json({ ...account, balance: await getAccountBalance(account.id) });
  } catch (err) {
    res.status(500).json({ error: 'Bank account operation failed' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { account_name, account_type, bank_name, account_number, opening_balance } = req.body;
    await db.prepare(`
      UPDATE bank_accounts SET account_name=?, account_type=?, bank_name=?, account_number=?, opening_balance=? WHERE id=?
    `).run(account_name, account_type, bank_name || '', account_number || '', opening_balance || 0, id);
    const account = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id);
    res.json({ ...account, balance: await getAccountBalance(id) });
  } catch (err) {
    res.status(500).json({ error: 'Bank account operation failed' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Bank account operation failed' });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    const entries = await db.prepare(
      'SELECT * FROM cash_bank_transactions WHERE account_id = ? ORDER BY transaction_date ASC, id ASC'
    ).all(id);
    let balance = account.opening_balance || 0;
    const transactions = entries.map(t => {
      balance = balance + (t.debit || 0) - (t.credit || 0);
      return { ...t, balance };
    });
    transactions.reverse();
    res.json({ account: { ...account, balance: await getAccountBalance(id) }, transactions });
  } catch (err) {
    res.status(500).json({ error: 'Bank account operation failed' });
  }
};
