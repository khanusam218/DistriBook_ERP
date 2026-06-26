const db = require('../db/db');

exports.getByVendor = (req, res) => {
  try {
    const { vendorId } = req.params;
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    // Fetch all non-opening entries in ASC order to compute running balance
    const entries = db.prepare(
      `SELECT vl.*, v.company_name FROM vendor_ledger vl
       LEFT JOIN vendors v ON vl.vendor_id = v.id
       WHERE vl.vendor_id = ? AND vl.transaction_type != 'OPENING_BALANCE'
       ORDER BY vl.transaction_date ASC, vl.id ASC`
    ).all(vendorId);

    const openingBalance = Number(vendor.opening_balance) || 0;
    let runningBalance = openingBalance;
    const ledger = [];

    // Inject virtual opening balance row when vendor has one
    if (openingBalance !== 0) {
      const createdDate = vendor.created_at
        ? vendor.created_at.toString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      ledger.push({
        id: 'OPENING',
        vendor_id: Number(vendorId),
        company_name: vendor.company_name,
        transaction_date: createdDate,
        transaction_type: 'OPENING',
        description: 'Opening Balance',
        debit: openingBalance,
        credit: 0,
        balance: openingBalance,
        reference_type: null,
        reference_id: null,
      });
    }

    // Append each entry with freshly computed running balance
    for (const entry of entries) {
      runningBalance = runningBalance + Number(entry.debit) - Number(entry.credit);
      ledger.push({ ...entry, balance: runningBalance });
    }

    // Reverse to show most-recent first
    ledger.reverse();

    res.json({ ledger, balance: runningBalance, vendor });
  } catch (error) {
    res.status(500).json({ error: 'Vendor ledger operation failed' });
  }
};

exports.getAll = (req, res) => {
  try {
    res.json(db.prepare(
      `SELECT vl.*, v.company_name FROM vendor_ledger vl
       LEFT JOIN vendors v ON vl.vendor_id = v.id ORDER BY vl.transaction_date DESC`
    ).all());
  } catch (error) {
    res.status(500).json({ error: 'Vendor ledger operation failed' });
  }
};
