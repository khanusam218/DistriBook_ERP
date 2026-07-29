const db = require('../db/db');
const { createCashBankEntry, resolveCashAccountId } = require('./bankAccountController');

const CATEGORIES = [
  'Rent', 'Salaries', 'Utilities', 'Transport', 'Fuel',
  'Office Supplies', 'Repair & Maintenance', 'Marketing',
  'Insurance', 'Taxes & Fees', 'Miscellaneous',
];

async function getNextExpenseNo() {
  const year = new Date().getFullYear();
  const row = await db.prepare(
    `SELECT MAX(CAST(SUBSTR(expense_no, 10) AS UNSIGNED)) as mx FROM expenses WHERE expense_no LIKE 'EXP-${year}-%'`
  ).get();
  return `EXP-${year}-${String((row?.mx || 0) + 1).padStart(4, '0')}`;
}

exports.getCategories = async (_req, res) => res.json(CATEGORIES);

exports.getAll = async (req, res) => {
  try {
    const rows = await db.prepare(
      `SELECT e.*, ba.account_name FROM expenses e
       LEFT JOIN bank_accounts ba ON e.bank_account_id = ba.id
       ORDER BY e.expense_date DESC, e.id DESC`
    ).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { expense_date, category, description, amount, payment_method, notes } = req.body;
    if (!category || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Category and amount are required' });
    }
    const bank_account_id = await resolveCashAccountId(payment_method, req.body.bank_account_id);
    const expense_no = await getNextExpenseNo();
    const date = expense_date || new Date().toISOString().split('T')[0];

    const result = await db.prepare(
      `INSERT INTO expenses (expense_no, expense_date, category, description, amount, payment_method, bank_account_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(expense_no, date, category, description || '', Number(amount), payment_method || 'CASH', bank_account_id, notes || '');

    if (bank_account_id) {
      await createCashBankEntry(
        bank_account_id, 'EXPENSE', result.lastInsertRowid, 'expense',
        0, Number(amount),
        `Expense ${expense_no} — ${category}${description ? ': ' + description : ''}`,
        date
      );
    }

    const row = await db.prepare(
      `SELECT e.*, ba.account_name FROM expenses e LEFT JOIN bank_accounts ba ON e.bank_account_id = ba.id WHERE e.id = ?`
    ).get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Expense not found' });

    const { expense_date, category, description, amount, payment_method, bank_account_id, notes } = req.body;
    const newDate = expense_date ?? existing.expense_date;
    const newCat = category ?? existing.category;
    const newAmt = amount != null ? Number(amount) : existing.amount;
    const newMethod = payment_method ?? existing.payment_method;
    const newBankId = bank_account_id !== undefined
      ? await resolveCashAccountId(newMethod, bank_account_id)
      : existing.bank_account_id;
    const newDesc = description ?? existing.description;
    const newNotes = notes ?? existing.notes;

    // Reverse old cash/bank entry if any
    if (existing.bank_account_id) {
      await createCashBankEntry(
        existing.bank_account_id, 'REVERSAL', id, 'expense',
        existing.amount, 0,
        `Reversal of ${existing.expense_no}`,
        existing.expense_date
      );
    }

    await db.prepare(
      `UPDATE expenses SET expense_date=?, category=?, description=?, amount=?, payment_method=?, bank_account_id=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(newDate, newCat, newDesc, newAmt, newMethod, newBankId, newNotes, id);

    if (newBankId) {
      await createCashBankEntry(
        newBankId, 'EXPENSE', id, 'expense',
        0, newAmt,
        `Expense ${existing.expense_no} — ${newCat}${newDesc ? ': ' + newDesc : ''}`,
        newDate
      );
    }

    const row = await db.prepare(
      `SELECT e.*, ba.account_name FROM expenses e LEFT JOIN bank_accounts ba ON e.bank_account_id = ba.id WHERE e.id = ?`
    ).get(id);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Expense not found' });

    if (row.bank_account_id) {
      await createCashBankEntry(
        row.bank_account_id, 'REVERSAL', id, 'expense',
        row.amount, 0,
        `Reversal of ${row.expense_no}`,
        row.expense_date
      );
    }

    await db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
