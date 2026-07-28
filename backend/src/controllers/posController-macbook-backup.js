const db = require('../db/db');
const { createCustomerLedgerEntry } = require('../services/ledgerService');

function nextBillNo() {
  const last = db.prepare(
    `SELECT bill_no FROM sales WHERE bill_no LIKE 'POS-%' ORDER BY id DESC LIMIT 1`
  ).get();
  const n = last?.bill_no ? parseInt(last.bill_no.replace('POS-', ''), 10) : 0;
  return `POS-${String(isNaN(n) ? 1 : n + 1).padStart(4, '0')}`;
}

function postCashBank(accountId, txnType, refId, amount, description, date) {
  const acc = db.prepare('SELECT opening_balance FROM bank_accounts WHERE id = ?').get(accountId);
  const row = db.prepare('SELECT COALESCE(SUM(debit - credit), 0) as t FROM cash_bank_transactions WHERE account_id = ?').get(accountId);
  const balance = (acc?.opening_balance || 0) + (row?.t || 0) + amount;
  db.prepare(
    `INSERT INTO cash_bank_transactions
       (account_id, transaction_type, reference_id, reference_type, debit, credit, balance, description, transaction_date)
     VALUES (?, ?, ?, 'pos_sale', ?, 0, ?, ?, ?)`
  ).run(accountId, txnType, refId, amount, balance, description, date);
}

exports.getProducts = (req, res) => {
  try {
    const { search, barcode } = req.query;
    let sql = 'SELECT * FROM stocks';
    const params = [];
    if (barcode) {
      sql += ' WHERE barcode = ?';
      params.push(barcode);
    } else if (search) {
      sql += ' WHERE (product_name LIKE ? OR company_name LIKE ? OR barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY company_name, product_name';
    res.json(db.prepare(sql).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getBills = (req, res) => {
  try {
    const bills = db.prepare(
      `SELECT s.*, c.shop_name as customer_shop
       FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.sale_type = 'POS'
       ORDER BY s.created_at DESC LIMIT 100`
    ).all();
    res.json(bills);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getBill = (req, res) => {
  try {
    const sale = db.prepare(
      `SELECT s.*, c.shop_name as customer_shop
       FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.id = ?`
    ).get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Bill not found' });
    const items = db.prepare(
      `SELECT si.*, st.company_name, st.packing_unit FROM sale_items si
       LEFT JOIN stocks st ON si.stock_id = st.id
       WHERE si.sale_id = ?`
    ).all(req.params.id);
    res.json({ sale, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createSale = (req, res) => {
  try {
    const {
      items,
      customerName,
      customerId,
      paymentMethod,
      bankAccountId,
      amountPaid,
      discountTotal,
      date,
    } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ error: 'Cart is empty' });

    // Validate item fields before touching the DB
    for (const item of items) {
      const qty = Number(item.qty);
      const rate = Number(item.rate);
      const itemDisc = Number(item.discount) || 0;
      if (!Number.isInteger(qty) || qty <= 0)
        return res.status(400).json({ error: 'Item quantity must be a positive integer' });
      if (!isFinite(rate) || rate < 0)
        return res.status(400).json({ error: 'Item rate must be a non-negative number' });
      if (itemDisc < 0)
        return res.status(400).json({ error: 'Item discount cannot be negative' });
    }

    // Validate stock availability
    for (const item of items) {
      const stock = db.prepare('SELECT quantity, product_name FROM stocks WHERE id = ?').get(item.stock_id);
      if (!stock) return res.status(400).json({ error: `Product not found (id: ${item.stock_id})` });
      if (stock.quantity < item.qty)
        return res.status(400).json({ error: `Insufficient stock for "${stock.product_name}". Available: ${stock.quantity}` });
    }

    const saleDate = date || new Date().toISOString().split('T')[0];
    const disc = Math.round((Number(discountTotal) || 0) * 100) / 100;

    const run = db.transaction(() => {
      // Calculate totals
      let lineSubtotal = 0;
      for (const item of items) {
        lineSubtotal += (Number(item.qty) * Number(item.rate)) - (Number(item.discount) || 0);
      }
      const totalAmount = Math.round((lineSubtotal - disc) * 100) / 100;
      const paid = Math.round((Number(amountPaid) || totalAmount) * 100) / 100;
      const change = Math.max(0, Math.round((paid - totalAmount) * 100) / 100);

      const billNo = nextBillNo();

      // Insert sale
      const saleRes = db.prepare(
        `INSERT INTO sales
           (customer_id, sale_date, bill_no, total_amount, remarks,
            sale_type, customer_name, payment_method, bank_account_id, amount_paid, change_amount, discount_total)
         VALUES (?, ?, ?, ?, '', 'POS', ?, ?, ?, ?, ?, ?)`
      ).run(
        customerId || null,
        saleDate,
        billNo,
        totalAmount,
        customerName || '',
        paymentMethod || 'CASH',
        bankAccountId || null,
        paid,
        change,
        disc
      );
      const saleId = saleRes.lastInsertRowid;

      // Sale items + stock deduction
      for (const item of items) {
        const stock = db.prepare('SELECT * FROM stocks WHERE id = ?').get(item.stock_id);
        const lineTotal = Math.round(((Number(item.qty) * Number(item.rate)) - (Number(item.discount) || 0)) * 100) / 100;
        db.prepare(
          `INSERT INTO sale_items
             (sale_id, stock_id, item_code, product_name, product_rate, product_qty, total, discount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(saleId, item.stock_id, stock.barcode || '', stock.product_name, item.rate, item.qty, lineTotal, item.discount || 0);
        db.prepare('UPDATE stocks SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.qty, item.stock_id);
      }

      // Customer ledger for wholesaler
      if (customerId) {
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
        if (customer?.customer_type === 'WHOLESALER') {
          createCustomerLedgerEntry(
            customerId, 'POS_SALE', saleId, 'pos_sale',
            totalAmount, 0,
            `POS Sale — ${billNo}`
          );
        }
      }

      // Cash & Bank impact
      if (bankAccountId) {
        const custLabel = customerName || (customerId ? db.prepare('SELECT shop_name FROM customers WHERE id = ?').get(customerId)?.shop_name : '') || 'Walk-in';
        postCashBank(bankAccountId, 'POS_SALE', saleId, totalAmount, `POS Sale ${billNo} — ${custLabel}`, saleDate);
      }

      return saleId;
    });

    const saleId = run();

    // Return complete bill
    const sale = db.prepare(
      `SELECT s.*, c.shop_name as customer_shop
       FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ?`
    ).get(saleId);
    const saleItems = db.prepare(
      `SELECT si.*, st.company_name, st.packing_unit FROM sale_items si
       LEFT JOIN stocks st ON si.stock_id = st.id WHERE si.sale_id = ?`
    ).all(saleId);

    res.status(201).json({ sale, items: saleItems });
  } catch (e) { console.error('POS createSale error:', e); res.status(500).json({ error: 'Failed to create sale' }); }
};
