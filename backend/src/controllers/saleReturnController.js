const db = require('../db/db');
const { createCustomerLedgerEntry, getCustomerBalance } = require('../services/ledgerService');

exports.getAll = async (req, res) => {
  try {
    res.json(await db.prepare(
      `SELECT sr.*, s.bill_no FROM sale_returns sr
       LEFT JOIN sales s ON sr.sale_id = s.id ORDER BY sr.return_date DESC`
    ).all());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const record = await db.prepare('SELECT * FROM sale_returns WHERE id = ?').get(req.params.id);
    if (!record) return res.status(404).json({ error: 'Sale return not found' });
    const items = await db.prepare(
      `SELECT sri.*, s.product_name FROM sale_return_items sri
       LEFT JOIN stocks s ON sri.stock_id = s.id WHERE sri.sale_return_id = ?`
    ).all(req.params.id);
    res.json({ ...record, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { saleId, returnDate, items, reason } = req.body;
    if (!saleId || !items || items.length === 0) return res.status(400).json({ error: 'Missing sale or items' });

    // Validate quantities and prices
    for (const item of items) {
      const qty = Number(item.quantity);
      const price = Number(item.price);
      if (!Number.isInteger(qty) || qty <= 0)
        return res.status(400).json({ error: 'Return quantity must be a positive integer' });
      if (!isFinite(price) || price < 0)
        return res.status(400).json({ error: 'Return price must be a non-negative number' });
    }

    // Verify all returned stock items belong to the original sale
    const saleItemRows = await db.prepare('SELECT stock_id FROM sale_items WHERE sale_id = ?').all(saleId);
    const saleStockIds = new Set(saleItemRows.map(r => r.stock_id));
    for (const item of items) {
      if (!saleStockIds.has(Number(item.stockId)))
        return res.status(400).json({ error: `Item (stock id: ${item.stockId}) does not belong to this sale` });
    }

    const run = db.transaction(async () => {
      const sr = await db.prepare(
        `INSERT INTO sale_returns (sale_id, return_date, total_amount, reason) VALUES (?, ?, 0, ?)`
      ).run(saleId, returnDate || new Date().toISOString().split('T')[0], reason || '');
      const returnId = sr.lastInsertRowid;
      let totalAmount = 0;
      for (const item of items) {
        const itemTotal = item.quantity * item.price;
        totalAmount += itemTotal;
        await db.prepare(
          `INSERT INTO sale_return_items (sale_return_id, stock_id, quantity, price, total) VALUES (?, ?, ?, ?, ?)`
        ).run(returnId, item.stockId, item.quantity, item.price, itemTotal);
        await db.prepare('UPDATE stocks SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.quantity, item.stockId);
      }
      await db.prepare('UPDATE sale_returns SET total_amount = ? WHERE id = ?').run(totalAmount, returnId);

      // Post customer ledger credit (reduces what customer owes us)
      const sale = await db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
      if (sale?.customer_id) {
        const customer = await db.prepare('SELECT customer_type FROM customers WHERE id = ?').get(sale.customer_id);
        if (customer?.customer_type === 'WHOLESALER') {
          await createCustomerLedgerEntry(
            sale.customer_id, 'SALE_RETURN', returnId, 'sale_return',
            0, totalAmount,
            `Sale Return — ${sale.bill_no || saleId}`
          );
        }
      }

      return db.prepare('SELECT * FROM sale_returns WHERE id = ?').get(returnId);
    });
    res.status(201).json(await run());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const run = db.transaction(async () => {
      const { id } = req.params;
      const items = await db.prepare('SELECT stock_id, quantity FROM sale_return_items WHERE sale_return_id = ?').all(id);
      for (const item of items) {
        await db.prepare('UPDATE stocks SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.quantity, item.stock_id);
      }
      await db.prepare('DELETE FROM sale_return_items WHERE sale_return_id = ?').run(id);
      const row = await db.prepare('SELECT * FROM sale_returns WHERE id = ?').get(id);
      if (!row) return null;
      await db.prepare('DELETE FROM sale_returns WHERE id = ?').run(id);
      return row;
    });
    const deleted = await run();
    if (!deleted) return res.status(404).json({ error: 'Sale return not found' });
    res.json({ message: 'Sale return deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
