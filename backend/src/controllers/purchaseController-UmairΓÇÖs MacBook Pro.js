const db = require('../db/db');

exports.getAll = (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT p.*, v.company_name FROM purchases p
       LEFT JOIN vendors v ON p.vendor_id = v.id
       ORDER BY p.purchase_date DESC`
    ).all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getById = (req, res) => {
  try {
    const purchase = db.prepare(
      `SELECT p.*, v.company_name FROM purchases p
       LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?`
    ).get(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    const items = db.prepare(
      `SELECT pi.*, s.product_name,
       COALESCE((SELECT SUM(pri.quantity) FROM purchase_return_items pri
                 JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
                 WHERE pr.purchase_id = pi.purchase_id AND pri.stock_id = pi.stock_id), 0) as returned_qty
       FROM purchase_items pi
       LEFT JOIN stocks s ON pi.stock_id = s.id WHERE pi.purchase_id = ?`
    ).all(req.params.id);
    res.json({ ...purchase, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = (req, res) => {
  try {
    const { vendorId, purchaseDate, invoiceNo, items, remarks } = req.body;
    if (!vendorId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing vendor or items' });
    }
    const invalidItem = items.find(i => (!i.stockId || Number(i.stockId) === 0) && (!i.productId || Number(i.productId) === 0));
    if (invalidItem) return res.status(400).json({ error: 'All items must have a product selected' });

    for (const item of items) {
      const qty = Number(item.quantity);
      const price = Number(item.purchasePrice);
      if (!Number.isInteger(qty) || qty <= 0)
        return res.status(400).json({ error: 'Item quantity must be a positive integer' });
      if (!isFinite(price) || price < 0)
        return res.status(400).json({ error: 'Item purchase price must be a non-negative number' });
    }

    const run = db.transaction(() => {
      const pr = db.prepare(
        `INSERT INTO purchases (vendor_id, purchase_date, invoice_no, total_amount, remarks)
         VALUES (?, ?, ?, 0, ?)`
      ).run(vendorId, purchaseDate || new Date().toISOString().split('T')[0], invoiceNo || '', remarks || '');
      const purchaseId = pr.lastInsertRowid;

      let totalAmount = 0;
      for (const item of items) {
        // Resolve stockId: direct reference OR look up / create via productId
        let stockId = Number(item.stockId) || 0;

        if (!stockId && item.productId) {
          const product = db.prepare(
            `SELECT p.*, v.company_name FROM products p
             LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?`
          ).get(item.productId);

          if (product) {
            const existing = db.prepare(
              'SELECT id FROM stocks WHERE product_name = ? AND company_name = ?'
            ).get(product.product_name, product.company_name);

            if (existing) {
              stockId = existing.id;
            } else {
              // Auto-create a stock entry for this product
              const ns = db.prepare(
                `INSERT INTO stocks (company_name, product_name, product_description, packing_unit, pieces_per_ctn, purchase_price, sale_price, quantity)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
              ).run(
                product.company_name,
                product.product_name,
                product.product_description || '',
                product.packing_unit || 'CTN',
                product.pieces_per_ctn || 1,
                item.purchasePrice || product.purchase_price || 0,
                product.sale_price || 0
              );
              stockId = ns.lastInsertRowid;
            }
          }
        }

        if (!stockId) continue; // skip unresolvable items

        const itemTotal = item.quantity * item.purchasePrice;
        totalAmount += itemTotal;
        db.prepare(
          `INSERT INTO purchase_items (purchase_id, stock_id, quantity, purchase_price, total)
           VALUES (?, ?, ?, ?, ?)`
        ).run(purchaseId, stockId, item.quantity, item.purchasePrice, itemTotal);
        db.prepare('UPDATE stocks SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.quantity, stockId);
      }

      db.prepare('UPDATE purchases SET total_amount = ? WHERE id = ?').run(totalAmount, purchaseId);

      const prevBalance = db.prepare('SELECT COALESCE(SUM(credit - debit), 0) as bal FROM vendor_ledger WHERE vendor_id = ?').get(vendorId).bal || 0;
      db.prepare(
        `INSERT INTO vendor_ledger (vendor_id, transaction_type, reference_id, reference_type, debit, credit, balance, description)
         VALUES (?, 'PURCHASE', ?, 'purchase', ?, 0, ?, ?)`
      ).run(vendorId, purchaseId, totalAmount, prevBalance + totalAmount, `Purchase Invoice ${invoiceNo || purchaseId}`);

      return db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    });

    res.status(201).json(run());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update = (req, res) => {
  try {
    const { id } = req.params;
    const { purchaseDate, invoiceNo, remarks } = req.body;
    const existing = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Purchase not found' });
    db.prepare('UPDATE purchases SET purchase_date=?, invoice_no=?, remarks=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(purchaseDate ?? existing.purchase_date, invoiceNo ?? existing.invoice_no, remarks ?? existing.remarks, id);
    res.json(db.prepare('SELECT * FROM purchases WHERE id = ?').get(id));
  } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.delete = (req, res) => {
  try {
    const run = db.transaction(() => {
      const { id } = req.params;
      const items = db.prepare('SELECT stock_id, quantity FROM purchase_items WHERE purchase_id = ?').all(id);
      for (const item of items) {
        db.prepare('UPDATE stocks SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.quantity, item.stock_id);
      }
      db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);
      const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
      if (!row) return null;
      db.prepare('DELETE FROM purchases WHERE id = ?').run(id);
      return row;
    });
    const deleted = run();
    if (!deleted) return res.status(404).json({ error: 'Purchase not found' });
    res.json({ message: 'Purchase deleted successfully', purchase: deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
