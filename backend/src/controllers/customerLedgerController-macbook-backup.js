const db = require('../db/db');

exports.getByCustomer = (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (customer.customer_type !== 'WHOLESALER') {
      return res.status(403).json({ error: 'Ledger only available for wholesaler customers' });
    }

    const openingBalance = Number(customer.opening_balance) || 0;

    // Fetch non-opening entries in ASC order for running balance calculation
    const entries = db.prepare(
      `SELECT cl.*, c.shop_name FROM customer_ledger cl
       LEFT JOIN customers c ON cl.customer_id = c.id
       WHERE cl.customer_id = ? AND cl.transaction_type != 'OPENING_BALANCE'
       ORDER BY cl.transaction_date ASC, cl.id ASC`
    ).all(customerId);

    // Positive running balance = customer owes us (DR). Sales increase it, receipts decrease it.
    let runningBalance = openingBalance;
    const ledger = [];

    if (openingBalance !== 0) {
      const createdDate = customer.created_at
        ? customer.created_at.toString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      ledger.push({
        id: 'OPENING',
        customer_id: Number(customerId),
        shop_name: customer.shop_name,
        transaction_date: createdDate,
        transaction_type: 'OPENING',
        description: 'Opening Balance',
        debit: 0,
        credit: openingBalance,
        balance: openingBalance,
        reference_type: null,
        reference_id: null,
      });
    }

    for (const entry of entries) {
      runningBalance = runningBalance + Number(entry.debit) - Number(entry.credit);
      ledger.push({ ...entry, balance: runningBalance });
    }

    // Reverse to show most-recent first
    ledger.reverse();

    res.json({ ledger, balance: runningBalance, customer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAll = (req, res) => {
  try {
    res.json(db.prepare(
      `SELECT cl.*, c.shop_name FROM customer_ledger cl
       LEFT JOIN customers c ON cl.customer_id = c.id
       WHERE c.customer_type = 'WHOLESALER' ORDER BY cl.transaction_date DESC`
    ).all());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
