const db = require('../db/db');

exports.getAll = (req, res) => {
  try {
    res.json(db.prepare(
      `SELECT pr.*, p.invoice_no FROM purchase_returns pr
       LEFT JOIN purchases p ON pr.purchase_id = p.id ORDER BY pr.return_date DESC`
    ).all());
  } catch (error) {
    res.status(500).json({ error: 'Purchase return operation failed' });
  }
};

exports.getById = (req, res) => {
  try {
    const record = db.prepare('SELECT * FROM purchase_returns WHERE id = ?').get(req.params.id);
    if (!record) return res.status(404).json({ error: 'Purchase return not found' });
    const items = db.prepare(
      `SELECT pri.*, s.product_name FROM purchase_return_items pri
       LEFT JOIN stocks s ON pri.stock_id = s.id WHERE pri.purchase_return_id = ?`
    ).all(req.params.id);
    res.json({ ...record, items });
  } catch (error) {
    res.status(500).json({ error: 'Purchase return operation failed' });
  }
};

exports.create = (req, res) => {
  try {
    const { purchaseId, returnDate, items, reason } = req.body;
    if (!purchaseId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing purchase or items' });
    }
    const invalidItem = items.find(i => !i.stockId || Number(i.stockId) === 0);
    if (invalidItem) return res.status(400).json({ error: 'All items must have a valid stock reference' });
    const run = db.transaction(() => {
      // Validate return quantities before inserting anything
      for (const item of items) {
        const orig = db.prepare(
          'SELECT quantity FROM purchase_items WHERE purchase_id = ? AND stock_id = ?'
        ).get(purchaseId, item.stockId);
        if (!orig) throw new Error(`Item not found in original purchase`);

        const alreadyReturned = db.prepare(
          `SELECT COALESCE(SUM(pri.quantity), 0) as qty
           FROM purchase_return_items pri
           JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
           WHERE pr.purchase_id = ? AND pri.stock_id = ?`
        ).get(purchaseId, item.stockId).qty || 0;

        const available = orig.quantity - alreadyReturned;
        if (item.quantity > available) {
          throw new Error(`Cannot return ${item.quantity} â€” only ${available} available to return for this item`);
        }
      }

      const pr = db.prepare(
        `INSERT INTO purchase_returns (purchase_id, return_date, total_amount, reason) VALUES (?, ?, 0, ?)`
      ).run(purchaseId, returnDate || new Date().toISOString().split('T')[0], reason || '');
      const returnId = pr.lastInsertRowid;
      let totalAmount = 0;
      for (const item of items) {
        const itemTotal = item.quantity * item.price;
        totalAmount += itemTotal;
        db.prepare(
          `INSERT INTO purchase_return_items (purchase_return_id, stock_id, quantity, price, total) VALUES (?, ?, ?, ?, ?)`
        ).run(returnId, item.stockId, item.quantity, item.price, itemTotal);
        const stockInfo = db.prepare('SELECT pieces_per_ctn FROM stocks WHERE id = ?').get(item.stockId);
        const piecesPerCtn = stockInfo?.pieces_per_ctn || 1;
        db.prepare('UPDATE stocks SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.quantity * piecesPerCtn, item.stockId);
      }
      db.prepare('UPDATE purchase_returns SET total_amount = ? WHERE id = ?').run(totalAmount, returnId);

      const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
      const vendorId = purchase.vendor_id;
      const prevBalance = db.prepare(
        'SELECT COALESCE(SUM(debit - credit), 0) as bal FROM vendor_ledger WHERE vendor_id = ?'
      ).get(vendorId).bal || 0;
      db.prepare(
        `INSERT INTO vendor_ledger (vendor_id, transaction_type, reference_id, reference_type, debit, credit, balance, description)
         VALUES (?, 'PURCHASE_RETURN', ?, 'purchase_return', 0, ?, ?, ?)`
      ).run(vendorId, returnId, totalAmount, prevBalance + totalAmount, `Purchase Return #${returnId}`);

      return db.prepare('SELECT * FROM purchase_returns WHERE id = ?').get(returnId);
    });
    res.status(201).json(run());
  } catch (error) {
    res.status(500).json({ error: 'Purchase return operation failed' });
  }
};

exports.delete = (req, res) => {
  try {
    const run = db.transaction(() => {
      const { id } = req.params;
      const items = db.prepare('SELECT stock_id, quantity FROM purchase_return_items WHERE purchase_return_id = ?').all(id);
      for (const item of items) {
        const stockInfo = db.prepare('SELECT pieces_per_ctn FROM stocks WHERE id = ?').get(item.stock_id);
        const piecesPerCtn = stockInfo?.pieces_per_ctn || 1;
        db.prepare('UPDATE stocks SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.quantity * piecesPerCtn, item.stock_id);
      }
      db.prepare('DELETE FROM purchase_return_items WHERE purchase_return_id = ?').run(id);
      const row = db.prepare('SELECT * FROM purchase_returns WHERE id = ?').get(id);
      if (!row) return null;
      db.prepare('DELETE FROM vendor_ledger WHERE reference_id = ? AND reference_type = ?').run(id, 'purchase_return');
      db.prepare('DELETE FROM purchase_returns WHERE id = ?').run(id);
      return row;
    });
    const deleted = run();
    if (!deleted) return res.status(404).json({ error: 'Purchase return not found' });
    res.json({ message: 'Purchase return deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Purchase return operation failed' });
  }
};
