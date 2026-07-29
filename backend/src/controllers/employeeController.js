const db = require('../db/db');

async function postCashBankEntry(accountId, txnType, refId, credit, description, date) {
  const acc = await db.prepare('SELECT opening_balance FROM bank_accounts WHERE id = ?').get(accountId);
  const row = await db.prepare('SELECT COALESCE(SUM(debit - credit), 0) as txn FROM cash_bank_transactions WHERE account_id = ?').get(accountId);
  const runningBal = (acc?.opening_balance || 0) + (row?.txn || 0) - credit;
  await db.prepare(
    `INSERT INTO cash_bank_transactions (account_id, transaction_type, reference_id, reference_type, debit, credit, balance, description, transaction_date)
     VALUES (?, ?, ?, 'employee_ledger', 0, ?, ?, ?, ?)`
  ).run(accountId, txnType, refId, credit, runningBal, description, date || new Date().toISOString().split('T')[0]);
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function recalcBalances(employeeId) {
  const entries = await db.prepare(
    'SELECT * FROM employee_ledger WHERE employee_id = ? ORDER BY date ASC, id ASC'
  ).all(employeeId);
  let running = 0;
  for (const entry of entries) {
    running = Math.round((running + entry.debit - entry.credit) * 100) / 100;
    await db.prepare('UPDATE employee_ledger SET balance = ? WHERE id = ?').run(running, entry.id);
  }
}

async function getLastBalance(employeeId) {
  const row = await db.prepare(
    'SELECT balance FROM employee_ledger WHERE employee_id = ? ORDER BY date ASC, id ASC'
  ).all(employeeId);
  return row.length ? row[row.length - 1].balance : 0;
}

// â”€â”€ Employee CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.getAll = async (req, res) => {
  try {
    const employees = await db.prepare('SELECT * FROM employees ORDER BY name').all();
    // Attach current balance to each employee
    const balances = await db.prepare(
      `SELECT employee_id, balance FROM employee_ledger
       WHERE id IN (SELECT MAX(id) FROM employee_ledger GROUP BY employee_id)`
    ).all();
    const balMap = {};
    for (const b of balances) balMap[b.employee_id] = b.balance;
    res.json(employees.map(e => ({ ...e, current_balance: balMap[e.id] ?? 0 })));
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

exports.getById = async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Employee not found' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

exports.create = async (req, res) => {
  try {
    const { name, mobile, role, baseSalary, otRate } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const r = await db.prepare(
      `INSERT INTO employees (name, mobile, role, base_salary, ot_rate)
       VALUES (?, ?, ?, ?, ?)`
    ).run(name.trim(), mobile || '', role || '', Number(baseSalary) || 0, Number(otRate) || 0);
    res.status(201).json(await db.prepare('SELECT * FROM employees WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });
    const { name, mobile, role, baseSalary, otRate } = req.body;
    await db.prepare(
      `UPDATE employees SET name=?, mobile=?, role=?, base_salary=?, ot_rate=?,
       updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(
      name ?? existing.name,
      mobile ?? existing.mobile,
      role ?? existing.role,
      Number(baseSalary) ?? existing.base_salary,
      Number(otRate) ?? existing.ot_rate,
      id
    );
    res.json(await db.prepare('SELECT * FROM employees WHERE id = ?').get(id));
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

exports.delete = async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Employee not found' });
    await db.prepare('DELETE FROM employee_ledger WHERE employee_id = ?').run(req.params.id);
    await db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted', employee: row });
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

// â”€â”€ Ledger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.getLedger = async (req, res) => {
  try {
    const employee = await db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    const entries = await db.prepare(
      'SELECT * FROM employee_ledger WHERE employee_id = ? ORDER BY date ASC, id ASC'
    ).all(req.params.id);
    const balance = entries.length ? entries[entries.length - 1].balance : 0;
    res.json({ employee, entries, balance });
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

exports.addAdvance = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const { date, amount, description, bankAccountId, paymentMethod } = req.body;
    if (!date || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: 'Date and a positive amount are required' });

    const creditAmt = Math.round(Number(amount) * 100) / 100;
    const prevBal = await getLastBalance(id);
    const balance = Math.round((prevBal - creditAmt) * 100) / 100;
    const desc = description || 'Cash Advance';

    // Advance is CREDIT: money paid TO the employee
    const r = await db.prepare(
      `INSERT INTO employee_ledger (employee_id, date, transaction_type, description, debit, credit, balance, bank_account_id, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, date, 'ADVANCE', desc, 0, creditAmt, balance, bankAccountId || null, paymentMethod || 'CASH');

    if (bankAccountId) {
      await postCashBankEntry(bankAccountId, 'ADVANCE', r.lastInsertRowid, creditAmt, `Advance â€” ${employee.name}${desc !== 'Cash Advance' ? ': ' + desc : ''}`, date);
    }

    res.status(201).json(await db.prepare('SELECT * FROM employee_ledger WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

exports.addOvertime = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const { date, hours, description, bankAccountId, paymentMethod } = req.body;
    if (!date || !hours || Number(hours) <= 0)
      return res.status(400).json({ error: 'Date and positive hours are required' });

    const otHours = Number(hours);
    const credit = Math.round(otHours * employee.ot_rate * 100) / 100;
    if (credit <= 0)
      return res.status(400).json({ error: 'OT rate is 0 â€” set OT rate on employee profile first' });

    const prevBal = await getLastBalance(id);
    const balance = Math.round((prevBal - credit) * 100) / 100;
    const desc = description || `OT: ${otHours} hrs Ã— Rs.${employee.ot_rate}`;

    const r = await db.prepare(
      `INSERT INTO employee_ledger
         (employee_id, date, transaction_type, description, debit, credit, balance, ot_hours, bank_account_id, payment_method)
       VALUES (?, ?, 'OVERTIME', ?, 0, ?, ?, ?, ?, ?)`
    ).run(id, date, desc, credit, balance, otHours, bankAccountId || null, paymentMethod || 'CASH');

    if (bankAccountId) {
      await postCashBankEntry(bankAccountId, 'OVERTIME', r.lastInsertRowid, credit, `OT Payment â€” ${employee.name} (${otHours} hrs)`, date);
    }

    res.status(201).json(await db.prepare('SELECT * FROM employee_ledger WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

exports.addShortage = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const { date, amount, gatpassNumber, customerName, description } = req.body;
    if (!date || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: 'Date and a positive amount are required' });

    const gpNum = String(gatpassNumber || '').trim();
    const custName = String(customerName || '').trim();
    const debit = Math.round(Number(amount) * 100) / 100;
    const prevBal = await getLastBalance(id);
    const balance = Math.round((prevBal + debit) * 100) / 100;
    const autoDesc = description || [
      `Shortage on OGP #${gpNum}`,
      custName ? `â€” ${custName}` : ''
    ].filter(Boolean).join(' ');

    const r = await db.prepare(
      `INSERT INTO employee_ledger
         (employee_id, date, transaction_type, description, debit, credit, balance, gatepass_number, customer_name)
       VALUES (?, ?, 'SHORTAGE', ?, ?, 0, ?, ?, ?)`
    ).run(id, date, autoDesc, debit, balance, gpNum, custName);

    res.status(201).json(await db.prepare('SELECT * FROM employee_ledger WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

exports.addRecovery = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const { date, amount, gatpassNumber, customerName, description } = req.body;
    if (!date || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: 'Date and a positive amount are required' });

    const gpNum = String(gatpassNumber || '').trim();
    const custName = String(customerName || '').trim();
    const credit = Math.round(Number(amount) * 100) / 100;
    const prevBal = await getLastBalance(id);
    const balance = Math.round((prevBal - credit) * 100) / 100;
    const autoDesc = description || [
      `Recovery from OGP #${gpNum}`,
      custName ? `â€” ${custName}` : ''
    ].filter(Boolean).join(' ');

    const r = await db.prepare(
      `INSERT INTO employee_ledger
         (employee_id, date, transaction_type, description, debit, credit, balance, gatepass_number, customer_name)
       VALUES (?, ?, 'RECOVERY', ?, 0, ?, ?, ?, ?)`
    ).run(id, date, autoDesc, credit, balance, gpNum, custName);

    res.status(201).json(await db.prepare('SELECT * FROM employee_ledger WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

exports.addSalary = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const { date, amount, period, description, bankAccountId, paymentMethod } = req.body;
    if (!date || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: 'Date and a positive amount are required' });

    const credit = Math.round(Number(amount) * 100) / 100;
    const prevBal = await getLastBalance(id);
    const balance = Math.round((prevBal - credit) * 100) / 100;
    const desc = description || (period ? `Salary â€” ${period}` : 'Salary Payment');

    const r = await db.prepare(
      `INSERT INTO employee_ledger (employee_id, date, transaction_type, description, debit, credit, balance, bank_account_id, payment_method)
       VALUES (?, ?, 'SALARY', ?, 0, ?, ?, ?, ?)`
    ).run(id, date, desc, credit, balance, bankAccountId || null, paymentMethod || 'CASH');

    if (bankAccountId) {
      await postCashBankEntry(bankAccountId, 'SALARY', r.lastInsertRowid, credit, `${desc} â€” ${employee.name}`, date);
    }

    res.status(201).json(await db.prepare('SELECT * FROM employee_ledger WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

exports.addPaymentReceived = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const { date, amount, description, bankAccountId, paymentMethod } = req.body;
    if (!date || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: 'Date and a positive amount are required' });

    const debitAmt = Math.round(Number(amount) * 100) / 100;
    const prevBal = await getLastBalance(id);
    const balance = Math.round((prevBal + debitAmt) * 100) / 100;
    const desc = description || 'Payment Received';

    // Payment received FROM employee is DEBIT — reduces their credit balance
    const r = await db.prepare(
      `INSERT INTO employee_ledger (employee_id, date, transaction_type, description, debit, credit, balance, bank_account_id, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, date, 'PAYMENT_RECEIVED', desc, debitAmt, 0, balance, bankAccountId || null, paymentMethod || 'CASH');

    // Money comes IN to the bank/cash account — record as credit reduction (debit to account)
    if (bankAccountId) {
      const acc = await db.prepare('SELECT opening_balance FROM bank_accounts WHERE id = ?').get(bankAccountId);
      const row = await db.prepare('SELECT COALESCE(SUM(debit - credit), 0) as txn FROM cash_bank_transactions WHERE account_id = ?').get(bankAccountId);
      const runningBal = (acc?.opening_balance || 0) + (row?.txn || 0) + debitAmt;
      await db.prepare(
        `INSERT INTO cash_bank_transactions (account_id, transaction_type, reference_id, reference_type, debit, credit, balance, description, transaction_date)
         VALUES (?, ?, ?, 'employee_ledger', ?, 0, ?, ?, ?)`
      ).run(bankAccountId, 'PAYMENT_RECEIVED', r.lastInsertRowid, debitAmt, runningBal, `Payment from ${employee.name}${desc !== 'Payment Received' ? ': ' + desc : ''}`, date || new Date().toISOString().split('T')[0]);
    }

    res.status(201).json(await db.prepare('SELECT * FROM employee_ledger WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};

exports.deleteEntry = async (req, res) => {
  try {
    const { id, entryId } = req.params;
    const entry = await db.prepare('SELECT * FROM employee_ledger WHERE id = ? AND employee_id = ?').get(entryId, id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    await db.prepare('DELETE FROM employee_ledger WHERE id = ?').run(entryId);
    await recalcBalances(id);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Employee operation failed' }); }
};
