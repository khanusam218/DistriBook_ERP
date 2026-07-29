const db = require('../db/db');

exports.getAll = async (req, res) => {
  try {
    const rows = await db.prepare(
      `SELECT p.*, v.company_name FROM purchases p
       LEFT JOIN vendors v ON p.vendor_id = v.id
       ORDER BY p.purchase_date DESC`
    ).all();
    res.json(rows);
  } catch (error) {
    console.error('getAll purchases error:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
};

exports.getById = async (req, res) => {
  try {
    const purchase = await db.prepare(
      `SELECT p.*, v.company_name FROM purchases p
       LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?`
    ).get(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    const items = await db.prepare(
      `SELECT pi.*, s.product_name, s.pieces_per_ctn,
       COALESCE((SELECT SUM(pri.quantity) FROM purchase_return_items pri
                 JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
                 WHERE pr.purchase_id = pi.purchase_id AND pri.stock_id = pi.stock_id), 0) as returned_qty
       FROM purchase_items pi
       LEFT JOIN stocks s ON pi.stock_id = s.id WHERE pi.purchase_id = ?`
    ).all(req.params.id);
    res.json({ ...purchase, items });
  } catch (error) {
    console.error('getById purchase error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
};

exports.create = async (req, res) => {
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
      if (!isFinite(qty) || qty <= 0)
        return res.status(400).json({ error: 'Item quantity must be a positive number' });
      if (!isFinite(price) || price < 0)
        return res.status(400).json({ error: 'Item purchase price must be a non-negative number' });
    }

    const run = db.transaction(async () => {
      const pr = await db.prepare(
        `INSERT INTO purchases (vendor_id, purchase_date, invoice_no, total_amount, remarks)
         VALUES (?, ?, ?, 0, ?)`
      ).run(vendorId, purchaseDate || new Date().toISOString().split('T')[0], invoiceNo || '', remarks || '');
      const purchaseId = pr.lastInsertRowid;

      let totalAmount = 0;
      for (const item of items) {
        let stockId = Number(item.stockId) || 0;

        if (!stockId && item.productId) {
          const product = await db.prepare(
            `SELECT p.*, v.company_name FROM products p
             LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?`
          ).get(item.productId);

          if (product) {
            const existing = await db.prepare(
              'SELECT id FROM stocks WHERE product_name = ? AND company_name = ?'
            ).get(product.product_name, product.company_name);

            if (existing) {
              stockId = existing.id;
            } else {
              const ns = await db.prepare(
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

        if (!stockId) continue;

        const stockInfo = await db.prepare('SELECT pieces_per_ctn FROM stocks WHERE id = ?').get(stockId);
        const piecesPerCtn = stockInfo?.pieces_per_ctn || item.piecesPerCtn || 1;
        const itemTotal = Math.round(item.quantity * piecesPerCtn * item.purchasePrice * 100) / 100;
        totalAmount += itemTotal;
        await db.prepare(
          `INSERT INTO purchase_items (purchase_id, stock_id, quantity, purchase_price, total)
           VALUES (?, ?, ?, ?, ?)`
        ).run(purchaseId, stockId, item.quantity, item.purchasePrice, itemTotal);
        await db.prepare('UPDATE stocks SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.quantity * piecesPerCtn, stockId);
      }

      await db.prepare('UPDATE purchases SET total_amount = ? WHERE id = ?').run(Math.round(totalAmount * 100) / 100, purchaseId);

      const prevBalanceRow = await db.prepare('SELECT COALESCE(SUM(debit - credit), 0) as bal FROM vendor_ledger WHERE vendor_id = ?').get(vendorId);
      const prevBalance = prevBalanceRow.bal || 0;
      await db.prepare(
        `INSERT INTO vendor_ledger (vendor_id, transaction_type, reference_id, reference_type, debit, credit, balance, description)
         VALUES (?, 'PURCHASE', ?, 'purchase', ?, 0, ?, ?)`
      ).run(vendorId, purchaseId, totalAmount, prevBalance + totalAmount, `Purchase Invoice ${invoiceNo || purchaseId}`);

      return db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    });

    res.status(201).json(await run());
  } catch (error) {
    console.error('create purchase error:', error);
    res.status(500).json({ error: 'Failed to create purchase' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId, purchaseDate, invoiceNo, remarks, items } = req.body;
    const existing = await db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Purchase not found' });

    if (!items || items.length === 0) {
      await db.prepare('UPDATE purchases SET purchase_date=?, invoice_no=?, remarks=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(purchaseDate ?? existing.purchase_date, invoiceNo ?? existing.invoice_no, remarks ?? existing.remarks, id);
      return res.json(await db.prepare('SELECT * FROM purchases WHERE id = ?').get(id));
    }

    for (const item of items) {
      const qty = Number(item.quantity);
      const price = Number(item.purchasePrice);
      if (!isFinite(qty) || qty <= 0)
        return res.status(400).json({ error: 'Item quantity must be a positive number' });
      if (!isFinite(price) || price < 0)
        return res.status(400).json({ error: 'Item purchase price must be a non-negative number' });
    }

    const run = db.transaction(async () => {
      const effectiveVendorId = vendorId ?? existing.vendor_id;

      // Reverse stock for old items
      const oldItems = await db.prepare('SELECT stock_id, quantity FROM purchase_items WHERE purchase_id = ?').all(id);
      for (const old of oldItems) {
        const oldStockInfo = await db.prepare('SELECT pieces_per_ctn FROM stocks WHERE id = ?').get(old.stock_id);
        const oldPiecesPerCtn = oldStockInfo?.pieces_per_ctn || 1;
        await db.prepare('UPDATE stocks SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(old.quantity * oldPiecesPerCtn, old.stock_id);
      }
      await db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);
      await db.prepare("DELETE FROM vendor_ledger WHERE reference_id = ? AND reference_type = 'purchase'").run(id);

      await db.prepare('UPDATE purchases SET vendor_id=?, purchase_date=?, invoice_no=?, remarks=?, total_amount=0, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(effectiveVendorId, purchaseDate ?? existing.purchase_date, invoiceNo ?? existing.invoice_no, remarks ?? existing.remarks, id);

      let totalAmount = 0;
      for (const item of items) {
        let stockId = Number(item.stockId) || 0;

        if (!stockId && item.productId) {
          const product = await db.prepare(
            `SELECT p.*, v.company_name FROM products p LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?`
          ).get(item.productId);
          if (product) {
            const ex = await db.prepare('SELECT id FROM stocks WHERE product_name = ? AND company_name = ?').get(product.product_name, product.company_name);
            if (ex) {
              stockId = ex.id;
            } else {
              const ns = await db.prepare(
                `INSERT INTO stocks (company_name, product_name, product_description, packing_unit, pieces_per_ctn, purchase_price, sale_price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
              ).run(product.company_name, product.product_name, product.product_description || '', product.packing_unit || 'CTN', product.pieces_per_ctn || 1, item.purchasePrice || product.purchase_price || 0, product.sale_price || 0);
              stockId = ns.lastInsertRowid;
            }
          }
        }

        if (!stockId) continue;

        const stockInfo = await db.prepare('SELECT pieces_per_ctn FROM stocks WHERE id = ?').get(stockId);
        const piecesPerCtn = stockInfo?.pieces_per_ctn || item.piecesPerCtn || 1;
        const itemTotal = Math.round(item.quantity * piecesPerCtn * item.purchasePrice * 100) / 100;
        totalAmount += itemTotal;
        await db.prepare(`INSERT INTO purchase_items (purchase_id, stock_id, quantity, purchase_price, total) VALUES (?, ?, ?, ?, ?)`)
          .run(id, stockId, item.quantity, item.purchasePrice, itemTotal);
        await db.prepare('UPDATE stocks SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.quantity * piecesPerCtn, stockId);
      }

      await db.prepare('UPDATE purchases SET total_amount = ? WHERE id = ?').run(Math.round(totalAmount * 100) / 100, id);

      const prevBalanceRow = await db.prepare("SELECT COALESCE(SUM(debit - credit), 0) as bal FROM vendor_ledger WHERE vendor_id = ?").get(effectiveVendorId);
      const prevBalance = prevBalanceRow.bal || 0;
      await db.prepare(`INSERT INTO vendor_ledger (vendor_id, transaction_type, reference_id, reference_type, debit, credit, balance, description) VALUES (?, 'PURCHASE', ?, 'purchase', ?, 0, ?, ?)`)
        .run(effectiveVendorId, id, totalAmount, prevBalance + totalAmount, `Purchase Invoice ${invoiceNo || id}`);

      return db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
    });

    res.json(await run());
  } catch (error) {
    console.error('update purchase error:', error);
    res.status(500).json({ error: 'Failed to update purchase' });
  }
};

exports.delete = async (req, res) => {
  try {
    const run = db.transaction(async () => {
      const { id } = req.params;
      const items = await db.prepare('SELECT stock_id, quantity FROM purchase_items WHERE purchase_id = ?').all(id);
      for (const item of items) {
        const stockInfo = await db.prepare('SELECT pieces_per_ctn FROM stocks WHERE id = ?').get(item.stock_id);
        const piecesPerCtn = stockInfo?.pieces_per_ctn || 1;
        await db.prepare('UPDATE stocks SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.quantity * piecesPerCtn, item.stock_id);
      }
      await db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);
      await db.prepare("DELETE FROM vendor_ledger WHERE reference_id = ? AND reference_type = 'purchase'").run(id);
      const row = await db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
      if (!row) return null;
      await db.prepare('DELETE FROM purchases WHERE id = ?').run(id);
      return row;
    });
    const deleted = await run();
    if (!deleted) return res.status(404).json({ error: 'Purchase not found' });
    res.json({ message: 'Purchase deleted successfully', purchase: deleted });
  } catch (error) {
    console.error('delete purchase error:', error);
    res.status(500).json({ error: 'Failed to delete purchase' });
  }
};
