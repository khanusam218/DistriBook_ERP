const db = require('../db/db');

exports.getInventory = async (req, res) => {
  try { res.json(await db.prepare('SELECT * FROM stocks ORDER BY company_name, product_name').all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getPurchases = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });
    res.json(await db.prepare(
      `SELECT p.id, p.purchase_date, p.invoice_no, v.company_name, s.product_name,
              pi.quantity, pi.purchase_price, pi.total
       FROM purchases p
       JOIN vendors v ON p.vendor_id = v.id
       JOIN purchase_items pi ON p.id = pi.purchase_id
       JOIN stocks s ON pi.stock_id = s.id
       WHERE p.purchase_date BETWEEN ? AND ? ORDER BY p.purchase_date DESC`
    ).all(startDate, endDate));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSales = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });
    res.json(await db.prepare(
      `SELECT s.id, s.sale_date, s.bill_no, COALESCE(c.shop_name,'Direct Sale') as customer_name,
              st.product_name, si.product_qty, si.product_rate, si.total
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       JOIN sale_items si ON s.id = si.sale_id
       JOIN stocks st ON si.stock_id = st.id
       WHERE s.sale_date BETWEEN ? AND ? ORDER BY s.sale_date DESC`
    ).all(startDate, endDate));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getTrialBalance = async (req, res) => {
  try {
    // ── Cash & Bank Accounts ──────────────────────────────────────────────────
    // Balance = opening_balance + SUM(debit - credit from transactions)
    // Positive balance = asset (DR); negative = unusual (CR)
    const cashBankRows = await db.prepare(
      `SELECT ba.id, ba.account_name, ba.account_type as sub_type,
              COALESCE(ba.opening_balance, 0) as opening_balance,
              COALESCE(SUM(CASE WHEN t.debit > 0 THEN t.debit ELSE 0 END), 0) as txn_debit,
              COALESCE(SUM(CASE WHEN t.credit > 0 THEN t.credit ELSE 0 END), 0) as txn_credit
       FROM bank_accounts ba
       LEFT JOIN cash_bank_transactions t ON ba.id = t.account_id
       GROUP BY ba.id, ba.account_name, ba.account_type, ba.opening_balance`
    ).all();
    const cashBank = cashBankRows.map(a => {
      const balance = a.opening_balance + a.txn_debit - a.txn_credit;
      return {
        id: a.id,
        account_name: a.account_name,
        account_type: 'CASH_BANK',
        sub_type: a.sub_type,
        debit:  balance >= 0 ? balance : 0,
        credit: balance <  0 ? Math.abs(balance) : 0,
        balance,
      };
    });

    // ── Customer Accounts (AR) ────────────────────────────────────────────────
    // Balance = opening_balance + SUM(debit - credit) excluding OPENING_BALANCE txns
    // Positive balance = DR (customer owes us); negative = CR (we owe customer)
    const customerRows = await db.prepare(
      `SELECT c.id, c.shop_name as account_name,
              COALESCE(c.opening_balance, 0) as opening_balance,
              COALESCE(SUM(CASE WHEN cl.debit  > 0 THEN cl.debit  ELSE 0 END), 0) as txn_debit,
              COALESCE(SUM(CASE WHEN cl.credit > 0 THEN cl.credit ELSE 0 END), 0) as txn_credit
       FROM customers c
       LEFT JOIN customer_ledger cl
         ON c.id = cl.customer_id AND cl.transaction_type != 'OPENING_BALANCE'
       WHERE c.customer_type = 'WHOLESALER'
       GROUP BY c.id, c.shop_name, c.opening_balance`
    ).all();
    const customers = customerRows.map(c => {
      const balance = c.opening_balance + c.txn_debit - c.txn_credit;
      return {
        id: c.id,
        account_name: c.account_name,
        account_type: 'CUSTOMER',
        debit:  balance >= 0 ? balance : 0,
        credit: balance <  0 ? Math.abs(balance) : 0,
        balance,
      };
    });

    // ── Vendor Accounts (AP) ──────────────────────────────────────────────────
    // Balance = opening_balance + SUM(credit - debit) excluding OPENING_BALANCE txns
    // Positive balance = CR (we owe vendor); negative = DR (vendor owes us)
    const vendorRows = await db.prepare(
      `SELECT v.id, v.company_name as account_name,
              COALESCE(v.opening_balance, 0) as opening_balance,
              COALESCE(SUM(CASE WHEN vl.debit  > 0 THEN vl.debit  ELSE 0 END), 0) as txn_debit,
              COALESCE(SUM(CASE WHEN vl.credit > 0 THEN vl.credit ELSE 0 END), 0) as txn_credit
       FROM vendors v
       LEFT JOIN vendor_ledger vl
         ON v.id = vl.vendor_id AND vl.transaction_type != 'OPENING_BALANCE'
       GROUP BY v.id, v.company_name, v.opening_balance`
    ).all();
    const vendors = vendorRows.map(v => {
      const balance = v.opening_balance + v.txn_debit - v.txn_credit;
      return {
        id: v.id,
        account_name: v.account_name,
        account_type: 'VENDOR',
        debit:  balance <  0 ? Math.abs(balance) : 0,
        credit: balance >= 0 ? balance : 0,
        balance,
      };
    });

    // ── Employee Accounts ─────────────────────────────────────────────────────
    // Positive balance = DR (employee owes company — advances/shortages)
    // Negative balance = CR (company owes employee — unpaid salary)
    const employeeRows = await db.prepare(
      `SELECT e.id, e.name as account_name,
              COALESCE(SUM(CASE WHEN el.debit  > 0 THEN el.debit  ELSE 0 END), 0) as txn_debit,
              COALESCE(SUM(CASE WHEN el.credit > 0 THEN el.credit ELSE 0 END), 0) as txn_credit
       FROM employees e
       LEFT JOIN employee_ledger el ON e.id = el.employee_id
       GROUP BY e.id, e.name`
    ).all();
    const employees = employeeRows.map(e => {
      const balance = e.txn_debit - e.txn_credit;
      return {
        id: e.id,
        account_name: e.account_name,
        account_type: 'EMPLOYEE',
        debit:  balance >= 0 ? balance : 0,
        credit: balance <  0 ? Math.abs(balance) : 0,
        balance,
      };
    });

    const allAccounts = [...cashBank, ...customers, ...vendors, ...employees];
    const totalDebit  = allAccounts.reduce((s, a) => s + a.debit,  0);
    const totalCredit = allAccounts.reduce((s, a) => s + a.credit, 0);

    res.json({ cashBank, customers, vendors, employees, totalDebit, totalCredit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
