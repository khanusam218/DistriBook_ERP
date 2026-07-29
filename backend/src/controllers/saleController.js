const db = require('../db/db');

exports.getAll = async (req, res) => {
  try {
    res.json(await db.prepare(
      `SELECT s.*, c.shop_name FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id ORDER BY s.sale_date DESC`
    ).all());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const sale = await db.prepare(
      `SELECT s.*, c.shop_name, c.customer_name, c.customer_type FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ?`
    ).get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    const items = await db.prepare('SELECT si.* FROM sale_items si WHERE si.sale_id = ?').all(req.params.id);
    res.json({ ...sale, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getNextNumbers = async (req, res) => {
  try {
    const gpRow = await db.prepare(`SELECT MAX(CAST(REPLACE(gate_pass_no,'GP-','') AS UNSIGNED)) as mx FROM sales WHERE gate_pass_no LIKE 'GP-%'`).get();
    const billRow = await db.prepare(`SELECT MAX(CAST(REPLACE(bill_no,'BILL-','') AS UNSIGNED)) as mx FROM sales WHERE bill_no LIKE 'BILL-%'`).get();
    res.json({
      gatePassNo: `GP-${String((gpRow.mx || 0) + 1).padStart(4, '0')}`,
      billNo: `BILL-${String((billRow.mx || 0) + 1).padStart(4, '0')}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { customerId, saleDate, gatePassNo, billNo, items, remarks } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'Missing items' });
    const invalidItem = items.find(i => !i.stockId || Number(i.stockId) === 0);
    if (invalidItem) return res.status(400).json({ error: 'All items must have a product selected' });

    // Validate all item quantities, prices, and discounts before starting the transaction
    for (const item of items) {
      const qty = Number(item.productQty);
      const rate = Number(item.productRate);
      const discount = Number(item.discount) || 0;
      if (!Number.isInteger(qty) || qty <= 0)
        return res.status(400).json({ error: 'Item quantity must be a positive integer' });
      if (!isFinite(rate) || rate < 0)
        return res.status(400).json({ error: 'Item rate must be a non-negative number' });
      if (discount < 0 || discount > 100)
        return res.status(400).json({ error: 'Discount must be between 0 and 100' });
    }

    // Check stock availability before committing
    for (const item of items) {
      const stock = await db.prepare('SELECT quantity, product_name FROM stocks WHERE id = ?').get(item.stockId);
      if (!stock) return res.status(400).json({ error: `Product not found (id: ${item.stockId})` });
      if (stock.quantity < Number(item.productQty))
        return res.status(400).json({ error: `Insufficient stock for "${stock.product_name}". Available: ${stock.quantity}` });
    }

    const run = db.transaction(async () => {
      const gpRow = await db.prepare(`SELECT MAX(CAST(REPLACE(gate_pass_no,'GP-','') AS UNSIGNED)) as mx FROM sales WHERE gate_pass_no LIKE 'GP-%'`).get();
      const billRow = await db.prepare(`SELECT MAX(CAST(REPLACE(bill_no,'BILL-','') AS UNSIGNED)) as mx FROM sales WHERE bill_no LIKE 'BILL-%'`).get();
      const autoGP = gatePassNo || `GP-${String((gpRow.mx || 0) + 1).padStart(4, '0')}`;
      const autoBill = billNo || `BILL-${String((billRow.mx || 0) + 1).padStart(4, '0')}`;

      const sr = await db.prepare(
        `INSERT INTO sales (customer_id, sale_date, gate_pass_no, bill_no, total_amount, remarks)
         VALUES (?, ?, ?, ?, 0, ?)`
      ).run(customerId || null, saleDate || new Date().toISOString().split('T')[0], autoGP, autoBill, remarks || '');
      const saleId = sr.lastInsertRowid;

      let totalAmount = 0;
      for (const item of items) {
        const discount = Number(item.discount) || 0;
        const itemTotal = Math.round(item.productQty * item.productRate * (1 - discount / 100) * 100) / 100;
        totalAmount += itemTotal;
        await db.prepare(
          `INSERT INTO sale_items (sale_id, stock_id, item_code, product_name, product_rate, product_qty, total, description, discount, qty_ctn, qty_loose_pieces, pieces_per_ctn)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(saleId, item.stockId, item.itemCode || '', item.productName, item.productRate, item.productQty, itemTotal, item.description || '', discount, Number(item.qtyCtn) || 0, Number(item.qtyPieces) || 0, Number(item.piecesPerCtn) || 1);
        await db.prepare('UPDATE stocks SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.productQty, item.stockId);
      }

      await db.prepare('UPDATE sales SET total_amount = ? WHERE id = ?').run(Math.round(totalAmount * 100) / 100, saleId);

      if (customerId) {
        const customer = await db.prepare('SELECT customer_type FROM customers WHERE id = ?').get(customerId);
        if (customer && customer.customer_type === 'WHOLESALER') {
          const prevBalRow = await db.prepare('SELECT COALESCE(SUM(debit - credit), 0) as bal FROM customer_ledger WHERE customer_id = ?').get(customerId);
          const prevBal = prevBalRow.bal || 0;
          await db.prepare(
            `INSERT INTO customer_ledger (customer_id, transaction_type, reference_id, reference_type, debit, credit, balance, description)
             VALUES (?, 'SALE', ?, 'sale', ?, 0, ?, ?)`
          ).run(customerId, saleId, totalAmount, prevBal + totalAmount, `Sale Invoice ${billNo || saleId}`);
        }
      }

      return db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    });

    res.status(201).json(await run());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId, saleDate, gatePassNo, billNo, remarks, items } = req.body;
    const existing = await db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Sale not found' });

    if (!items || items.length === 0) return res.status(400).json({ error: 'Missing items' });
    const invalidItem = items.find(i => !i.stockId || Number(i.stockId) === 0);
    if (invalidItem) return res.status(400).json({ error: 'All items must have a product selected' });

    const run = db.transaction(async () => {
      // Restore stock for old items
      const oldItems = await db.prepare('SELECT stock_id, product_qty FROM sale_items WHERE sale_id = ?').all(id);
      for (const oi of oldItems) {
        await db.prepare('UPDATE stocks SET quantity = quantity + ? WHERE id = ?').run(oi.product_qty, oi.stock_id);
      }
      // Delete old items and ledger entry
      await db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
      await db.prepare("DELETE FROM customer_ledger WHERE reference_id = ? AND reference_type = 'sale'").run(id);

      // Insert new items and deduct stock
      let totalAmount = 0;
      for (const item of items) {
        const discount = Number(item.discount) || 0;
        const itemTotal = Math.round(item.productQty * item.productRate * (1 - discount / 100) * 100) / 100;
        totalAmount += itemTotal;
        await db.prepare(
          `INSERT INTO sale_items (sale_id, stock_id, item_code, product_name, product_rate, product_qty, total, description, discount, qty_ctn, qty_loose_pieces, pieces_per_ctn)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, item.stockId, item.itemCode || '', item.productName, item.productRate, item.productQty, itemTotal, item.description || '', discount, Number(item.qtyCtn) || 0, Number(item.qtyPieces) || 0, Number(item.piecesPerCtn) || 1);
        await db.prepare('UPDATE stocks SET quantity = quantity - ? WHERE id = ?').run(item.productQty, item.stockId);
      }

      const effCustomerId = customerId !== undefined ? (customerId || null) : existing.customer_id;
      await db.prepare(
        'UPDATE sales SET customer_id=?, sale_date=?, gate_pass_no=?, bill_no=?, total_amount=?, remarks=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
      ).run(effCustomerId, saleDate ?? existing.sale_date, gatePassNo ?? existing.gate_pass_no, billNo ?? existing.bill_no, Math.round(totalAmount * 100) / 100, remarks ?? existing.remarks, id);

      // Re-add ledger entry if wholesaler
      if (effCustomerId) {
        const customer = await db.prepare('SELECT customer_type FROM customers WHERE id = ?').get(effCustomerId);
        if (customer && customer.customer_type === 'WHOLESALER') {
          const prevBalRow = await db.prepare('SELECT COALESCE(SUM(debit - credit), 0) as bal FROM customer_ledger WHERE customer_id = ?').get(effCustomerId);
          const prevBal = prevBalRow.bal || 0;
          await db.prepare(
            `INSERT INTO customer_ledger (customer_id, transaction_type, reference_id, reference_type, debit, credit, balance, description)
             VALUES (?, 'SALE', ?, 'sale', ?, 0, ?, ?)`
          ).run(effCustomerId, id, totalAmount, prevBal + totalAmount, `Sale Invoice ${billNo || id}`);
        }
      }

      return db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    });

    res.json(await run());
  } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.delete = async (req, res) => {
  try {
    const run = db.transaction(async () => {
      const { id } = req.params;
      const items = await db.prepare('SELECT stock_id, product_qty FROM sale_items WHERE sale_id = ?').all(id);
      for (const item of items) {
        await db.prepare('UPDATE stocks SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.product_qty, item.stock_id);
      }
      await db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
      await db.prepare("DELETE FROM customer_ledger WHERE reference_id = ? AND reference_type = 'sale'").run(id);
      const row = await db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
      if (!row) return null;
      await db.prepare('DELETE FROM sales WHERE id = ?').run(id);
      return row;
    });
    const deleted = await run();
    if (!deleted) return res.status(404).json({ error: 'Sale not found' });
    res.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
