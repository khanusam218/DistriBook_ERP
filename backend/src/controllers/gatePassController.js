const db = require('../db/db');

// â”€â”€ Staff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.getStaff = (req, res) => {
  try { res.json(db.prepare('SELECT * FROM gate_pass_staff ORDER BY type, name').all()); }
  catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.addStaff = (req, res) => {
  try {
    const { name, type, mobile } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Name and type required' });
    const r = db.prepare('INSERT INTO gate_pass_staff (name, type, mobile) VALUES (?, ?, ?)').run(name.trim(), type, mobile || '');
    res.status(201).json(db.prepare('SELECT * FROM gate_pass_staff WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.updateStaff = (req, res) => {
  try {
    const { name, mobile } = req.body;
    db.prepare('UPDATE gate_pass_staff SET name = ?, mobile = ? WHERE id = ?').run(name || '', mobile || '', req.params.staffId);
    res.json(db.prepare('SELECT * FROM gate_pass_staff WHERE id = ?').get(req.params.staffId));
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

// â”€â”€ Areas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.getAreas = (req, res) => {
  try { res.json(db.prepare('SELECT * FROM ogp_areas ORDER BY name').all()); }
  catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.addArea = (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const r = db.prepare('INSERT INTO ogp_areas (name) VALUES (?)').run(name.trim());
    res.status(201).json(db.prepare('SELECT * FROM ogp_areas WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.deleteArea = (req, res) => {
  try {
    db.prepare('DELETE FROM ogp_areas WHERE id = ?').run(req.params.areaId);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.deleteStaff = (req, res) => {
  try {
    db.prepare('DELETE FROM gate_pass_staff WHERE id = ?').run(req.params.staffId);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

// â”€â”€ Gate Pass list / detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.getAll = (req, res) => {
  try {
    const passes = db.prepare(
      `SELECT gp.*, c.shop_name FROM gate_passes gp
       LEFT JOIN customers c ON gp.customer_id = c.id
       ORDER BY gp.ogp_number DESC`
    ).all();
    const allItems = db.prepare(
      `SELECT gpi.*, s.company_name as brand FROM gate_pass_items gpi
       LEFT JOIN stocks s ON gpi.stock_id = s.id`
    ).all();
    const itemMap = {};
    for (const item of allItems) {
      if (!itemMap[item.gate_pass_id]) itemMap[item.gate_pass_id] = [];
      itemMap[item.gate_pass_id].push(item);
    }
    res.json(passes.map(gp => ({ ...gp, items: itemMap[gp.id] || [] })));
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.getById = (req, res) => {
  try {
    const gp = db.prepare(
      `SELECT gp.*, c.shop_name, c.customer_name FROM gate_passes gp
       LEFT JOIN customers c ON gp.customer_id = c.id WHERE gp.id = ?`
    ).get(req.params.id);
    if (!gp) return res.status(404).json({ error: 'Gate pass not found' });
    const items = db.prepare(
      `SELECT gpi.*, s.product_name, s.company_name as brand FROM gate_pass_items gpi
       LEFT JOIN stocks s ON gpi.stock_id = s.id WHERE gpi.gate_pass_id = ?`
    ).all(req.params.id);
    res.json({ ...gp, items });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.getNextOgpNumber = (req, res) => {
  try {
    const row = db.prepare('SELECT COALESCE(MAX(ogp_number), 0) as mx FROM gate_passes').get();
    res.json({ ogpNumber: (row.mx || 0) + 1 });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

// â”€â”€ Create OGP (header only â€” items handled via booking-items endpoint) â”€â”€â”€â”€â”€â”€â”€

exports.create = (req, res) => {
  try {
    const {
      customerId, ogpDate, ogpNumber,
      deliveryDate, mobile, saleRep, deliverySaleMan, deliveryMan, area, remarks
    } = req.body;

    const run = db.transaction(() => {
      let nextNum;
      if (ogpNumber && Number(ogpNumber) > 0) {
        nextNum = Number(ogpNumber);
        const existing = db.prepare('SELECT id FROM gate_passes WHERE ogp_number = ?').get(nextNum);
        if (existing) throw new Error(`OGP #${nextNum} already exists`);
      } else {
        const row = db.prepare('SELECT COALESCE(MAX(ogp_number), 0) as mx FROM gate_passes').get();
        nextNum = (row.mx || 0) + 1;
      }

      const result = db.prepare(
        `INSERT INTO gate_passes
           (ogp_number, ogp_date, delivery_date, mobile, customer_id,
            sale_rep, delivery_sale_man, delivery_man, area, total_qty, total_amount, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
      ).run(
        nextNum,
        ogpDate || new Date().toISOString().split('T')[0],
        deliveryDate || '',
        mobile || '',
        customerId || null,
        saleRep || '',
        deliverySaleMan || '',
        deliveryMan || '',
        area || '',
        remarks || ''
      );

      return db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(result.lastInsertRowid);
    });

    res.status(201).json(run());
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

// â”€â”€ Booking order items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.getBookingItems = (req, res) => {
  try {
    const items = db.prepare(
      `SELECT boi.*, s.pieces_per_ctn FROM booking_order_items boi
       LEFT JOIN stocks s ON boi.stock_id = s.id
       WHERE boi.gate_pass_id = ? ORDER BY boi.id`
    ).all(req.params.id);
    res.json(items);
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.saveBookingItems = (req, res) => {
  try {
    const { id } = req.params;
    const { items = [] } = req.body;

    const gp = db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(id);
    if (!gp) return res.status(404).json({ error: 'Gate pass not found' });

    db.transaction(() => {
      // 1. Restore stock from existing consolidated items
      const oldItems = db.prepare(
        'SELECT stock_id, quantity FROM gate_pass_items WHERE gate_pass_id = ?'
      ).all(id);
      for (const item of oldItems) {
        if (item.stock_id) {
          db.prepare('UPDATE stocks SET quantity = quantity + ? WHERE id = ?')
            .run(item.quantity, item.stock_id);
        }
      }

      // 2. Clear old data
      db.prepare('DELETE FROM gate_pass_items WHERE gate_pass_id = ?').run(id);
      db.prepare('DELETE FROM booking_order_items WHERE gate_pass_id = ?').run(id);

      // 3. Save raw booking items
      for (const item of items) {
        db.prepare(
          `INSERT INTO booking_order_items
             (gate_pass_id, customer_id, shop_name, stock_id, brand,
              item_code, item_description, qty_ctn, qty_pieces, rate, amount, discount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          item.customer_id || null,
          item.shop_name || '',
          item.stock_id || null,
          item.brand || '',
          item.item_code || '',
          item.item_description || '',
          Number(item.qty_ctn) || 0,
          Number(item.qty_pieces) || 0,
          Number(item.rate) || 0,
          Number(item.amount) || 0,
          Number(item.discount) || 0
        );
      }

      // 4. Consolidate â†’ gate_pass_items
      //    Rule: same brand + same item_code + same rate â†’ combine
      //    Rule: same brand + same item_code + different rate â†’ separate lines
      const consolidated = {};
      for (const item of items) {
        const key = `${item.brand}||${item.item_code}||${Number(item.rate || 0).toFixed(4)}`;
        if (!consolidated[key]) {
          consolidated[key] = {
            stock_id: item.stock_id || null,
            item_code: item.item_code || '',
            item_description: item.item_description || '',
            brand: item.brand || '',
            qty_ctn: 0,
            qty_pieces: 0,
            rate: Number(item.rate) || 0,
            total: 0,
          };
        }
        consolidated[key].qty_ctn += Number(item.qty_ctn) || 0;
        consolidated[key].qty_pieces += Number(item.qty_pieces) || 0;
        consolidated[key].total += Number(item.amount) || 0;
      }

      let gpTotalQty = 0, gpTotalAmount = 0;
      for (const c of Object.values(consolidated)) {
        db.prepare(
          `INSERT INTO gate_pass_items
             (gate_pass_id, stock_id, item_code, item_description, quantity, rate, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(id, c.stock_id, c.item_code, c.item_description, c.qty_ctn, c.rate, c.total);

        if (c.stock_id) {
          db.prepare('UPDATE stocks SET quantity = quantity - ? WHERE id = ?')
            .run(c.qty_ctn, c.stock_id);
        }
        gpTotalQty += c.qty_ctn;
        gpTotalAmount += c.total;
      }

      // 5. Update totals on gate pass
      db.prepare('UPDATE gate_passes SET total_qty = ?, total_amount = ? WHERE id = ?')
        .run(gpTotalQty, gpTotalAmount, id);
    })();

    res.json({ success: true, gatePass: db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(id) });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

// â”€â”€ Consolidated items for Print GP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Returns gate_pass_items sorted by brand (vendor) then alphabetically

exports.getConsolidated = (req, res) => {
  try {
    const items = db.prepare(
      `SELECT gpi.*, s.company_name as brand FROM gate_pass_items gpi
       LEFT JOIN stocks s ON gpi.stock_id = s.id
       WHERE gpi.gate_pass_id = ?
       ORDER BY LOWER(s.company_name) ASC, LOWER(gpi.item_description) ASC`
    ).all(req.params.id);
    const gp = db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(req.params.id);
    res.json({ gatePass: gp, items });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

// â”€â”€ Bill data for Bulk Invoice PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Returns booking items grouped by shop

exports.getBillData = (req, res) => {
  try {
    const gp = db.prepare(
      `SELECT gp.*, c.shop_name as customer_shop FROM gate_passes gp
       LEFT JOIN customers c ON gp.customer_id = c.id WHERE gp.id = ?`
    ).get(req.params.id);
    if (!gp) return res.status(404).json({ error: 'Not found' });

    const items = db.prepare(
      `SELECT boi.* FROM booking_order_items boi
       WHERE boi.gate_pass_id = ?
       ORDER BY boi.shop_name ASC, boi.brand ASC, boi.item_description ASC`
    ).all(req.params.id);

    const shopMap = {};
    for (const item of items) {
      const key = item.shop_name || 'Unknown';
      if (!shopMap[key]) shopMap[key] = { shop_name: key, customer_id: item.customer_id, items: [] };
      shopMap[key].items.push(item);
    }

    res.json({ gatePass: gp, shops: Object.values(shopMap) });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

// â”€â”€ Update OGP header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.update = (req, res) => {
  try {
    const { id } = req.params;
    const { ogpNumber, deliveryDate, mobile, deliveryMan, deliverySaleMan, area, remarks } = req.body;
    // Check duplicate OGP number (excluding self)
    if (ogpNumber) {
      const existing = db.prepare('SELECT id FROM gate_passes WHERE ogp_number = ? AND id != ?').get(Number(ogpNumber), id);
      if (existing) return res.status(400).json({ error: `OGP #${ogpNumber} already exists` });
    }
    db.prepare(
      `UPDATE gate_passes SET
         ogp_number = COALESCE(?, ogp_number),
         delivery_date = ?,
         mobile = ?,
         delivery_man = ?,
         delivery_sale_man = ?,
         area = ?,
         remarks = ?
       WHERE id = ?`
    ).run(
      ogpNumber ? Number(ogpNumber) : null,
      deliveryDate || '',
      mobile || '',
      deliveryMan || '',
      deliverySaleMan || '',
      area || '',
      remarks || '',
      id
    );
    res.json(db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(id));
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

// â”€â”€ Gate Pass Returns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.getReturns = (req, res) => {
  try {
    const returns = db.prepare(
      `SELECT r.*, GROUP_CONCAT(ri.id) as item_ids
       FROM gate_pass_returns r
       LEFT JOIN gate_pass_return_items ri ON ri.return_id = r.id
       WHERE r.gate_pass_id = ?
       GROUP BY r.id
       ORDER BY r.created_at DESC`
    ).all(req.params.id);

    const result = returns.map(r => ({
      ...r,
      items: db.prepare(
        'SELECT * FROM gate_pass_return_items WHERE return_id = ? ORDER BY id'
      ).all(r.id),
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.createReturn = (req, res) => {
  try {
    const { id } = req.params;
    const { customer_id, shop_name, return_date, notes, items = [] } = req.body;

    const validItems = items.filter(i => (Number(i.qty_ctn) || 0) > 0 || (Number(i.qty_pieces) || 0) > 0);
    if (!validItems.length) return res.status(400).json({ error: `No items to return — received ${items.length} items, qty_pieces=[${items.map(i=>i.qty_pieces).join(',')}], qty_ctn=[${items.map(i=>i.qty_ctn).join(',')}]` });

    const gp = db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(id);
    if (!gp) return res.status(404).json({ error: 'Gate pass not found' });

    let returnId;
    db.transaction(() => {
      // 1. Save return header
      const r = db.prepare(
        `INSERT INTO gate_pass_returns (gate_pass_id, customer_id, shop_name, return_date, notes)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, customer_id || null, shop_name || '', return_date || '', notes || '');
      returnId = r.lastInsertRowid;

      for (const item of validItems) {
        const qty = Number(item.qty_ctn) || 0;
        const qtyPcs = Number(item.qty_pieces) || 0;
        const usePieces = qty === 0 && qtyPcs > 0;
        const rate = Number(item.rate) || 0;
        // A return can mix CTN + loose pieces for the same item (e.g. "1 CTN + 3 pcs") —
        // pricing only the CTN portion silently dropped the pieces' value.
        const stock = item.stock_id
          ? db.prepare('SELECT pieces_per_ctn FROM stocks WHERE id = ?').get(item.stock_id)
          : null;
        const piecesPerCtn = Number(stock?.pieces_per_ctn) || 1;
        const amount = (qty * piecesPerCtn + qtyPcs) * rate;
        const net = amount;

        // 2. Save return item
        db.prepare(
          `INSERT INTO gate_pass_return_items
             (return_id, stock_id, item_code, item_description, brand, qty_ctn, qty_pieces, rate, amount, net)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          returnId,
          item.stock_id || null,
          item.item_code || '',
          item.item_description || '',
          item.brand || '',
          qty,
          qtyPcs,
          rate, amount, net
        );

        // 3. Restore stock (skip — stock was never deducted for piece-only items with qty_ctn=0)
        if (item.stock_id && !usePieces && qty > 0) {
          db.prepare('UPDATE stocks SET quantity = quantity + ? WHERE id = ?')
            .run(qty, item.stock_id);
        }

        // 4. Subtract from booking_order_items — by customer if provided, else gate-pass-wide FIFO
        if (item.stock_id) {
          if (usePieces) {
            // Piece-based return: deduct from qty_pieces column
            let remaining = qtyPcs;
            const boiRows = customer_id
              ? db.prepare(`SELECT * FROM booking_order_items WHERE gate_pass_id = ? AND stock_id = ? AND customer_id = ? AND qty_pieces > 0 ORDER BY id`).all(id, item.stock_id, customer_id)
              : db.prepare(`SELECT * FROM booking_order_items WHERE gate_pass_id = ? AND stock_id = ? AND qty_pieces > 0 ORDER BY id`).all(id, item.stock_id);
            for (const boi of boiRows) {
              if (remaining <= 0) break;
              const deduct = Math.min(remaining, boi.qty_pieces);
              const newPcs = boi.qty_pieces - deduct;
              const newAmount = newPcs * boi.rate;
              if (newPcs <= 0 && (boi.qty_ctn || 0) <= 0) {
                db.prepare('DELETE FROM booking_order_items WHERE id = ?').run(boi.id);
              } else {
                db.prepare('UPDATE booking_order_items SET qty_pieces = ?, amount = ? WHERE id = ?').run(newPcs, newAmount, boi.id);
              }
              remaining -= deduct;
            }
          } else {
            // CTN-based return: deduct from qty_ctn column
            let remaining = qty;
            const boiRows = customer_id
              ? db.prepare(`SELECT * FROM booking_order_items WHERE gate_pass_id = ? AND stock_id = ? AND customer_id = ? AND qty_ctn > 0 ORDER BY id`).all(id, item.stock_id, customer_id)
              : db.prepare(`SELECT * FROM booking_order_items WHERE gate_pass_id = ? AND stock_id = ? AND qty_ctn > 0 ORDER BY id`).all(id, item.stock_id);
            for (const boi of boiRows) {
              if (remaining <= 0) break;
              const deduct = Math.min(remaining, boi.qty_ctn);
              const newQty = boi.qty_ctn - deduct;
              if (newQty <= 0) {
                db.prepare('DELETE FROM booking_order_items WHERE id = ?').run(boi.id);
              } else {
                const newAmount = newQty * boi.rate;
                db.prepare('UPDATE booking_order_items SET qty_ctn = ?, amount = ? WHERE id = ?').run(newQty, newAmount, boi.id);
              }
              remaining -= deduct;
            }
          }
        }
      }

      // 5. Re-consolidate gate_pass_items from updated booking_order_items
      //    (no stock changes â€” stock already adjusted above)
      db.prepare('DELETE FROM gate_pass_items WHERE gate_pass_id = ?').run(id);
      const allBoi = db.prepare(
        'SELECT * FROM booking_order_items WHERE gate_pass_id = ?'
      ).all(id);

      const consolidated = {};
      for (const boi of allBoi) {
        const key = `${boi.brand}||${boi.item_code}||${Number(boi.rate || 0).toFixed(4)}`;
        if (!consolidated[key]) {
          consolidated[key] = {
            stock_id: boi.stock_id || null,
            item_code: boi.item_code || '',
            item_description: boi.item_description || '',
            qty_ctn: 0,
            total: 0,
            rate: Number(boi.rate) || 0,
          };
        }
        consolidated[key].qty_ctn += Number(boi.qty_ctn) || 0;
        consolidated[key].total += Number(boi.amount) || 0;
      }

      let gpTotalQty = 0, gpTotalAmount = 0;
      for (const c of Object.values(consolidated)) {
        gpTotalAmount += c.total; // include piece-only items in amount total
        if (c.qty_ctn <= 0) continue;
        db.prepare(
          `INSERT INTO gate_pass_items
             (gate_pass_id, stock_id, item_code, item_description, quantity, rate, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(id, c.stock_id, c.item_code, c.item_description, c.qty_ctn, c.rate, c.total);
        gpTotalQty += c.qty_ctn;
      }

      // 6. Update gate pass totals
      db.prepare('UPDATE gate_passes SET total_qty = ?, total_amount = ? WHERE id = ?')
        .run(gpTotalQty, gpTotalAmount, id);
    })();

    res.status(201).json({
      success: true,
      return: db.prepare('SELECT * FROM gate_pass_returns WHERE id = ?').get(returnId),
    });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.deleteReturn = (req, res) => {
  try {
    const { id, returnId } = req.params;

    const ret = db.prepare(
      'SELECT * FROM gate_pass_returns WHERE id = ? AND gate_pass_id = ?'
    ).get(returnId, id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });

    const returnItems = db.prepare(
      'SELECT * FROM gate_pass_return_items WHERE return_id = ?'
    ).all(returnId);

    db.transaction(() => {
      for (const item of returnItems) {
        const qty = Number(item.qty_ctn) || 0;
        const qtyPcs = Number(item.qty_pieces) || 0;
        const usePieces = qty === 0 && qtyPcs > 0;

        if (!usePieces && qty <= 0) continue;

        if (!usePieces) {
          // CTN return undo: re-deduct stock that was restored when return was created
          if (item.stock_id) {
            db.prepare('UPDATE stocks SET quantity = quantity - ? WHERE id = ?')
              .run(qty, item.stock_id);
          }
        }
        // Piece-only returns never touched stock, so no stock undo needed

        // Restore qty back to booking_order_items
        if (item.stock_id) {
          if (usePieces) {
            // Restore pieces: find the first matching row (gate-pass-wide or by customer)
            const existing = ret.customer_id
              ? db.prepare(
                  `SELECT * FROM booking_order_items WHERE gate_pass_id = ? AND stock_id = ? AND customer_id = ? ORDER BY id LIMIT 1`
                ).get(id, item.stock_id, ret.customer_id)
              : db.prepare(
                  `SELECT * FROM booking_order_items WHERE gate_pass_id = ? AND stock_id = ? ORDER BY id LIMIT 1`
                ).get(id, item.stock_id);

            if (existing) {
              const newPcs = existing.qty_pieces + qtyPcs;
              db.prepare('UPDATE booking_order_items SET qty_pieces = ?, amount = ? WHERE id = ?')
                .run(newPcs, newPcs * existing.rate, existing.id);
            } else {
              db.prepare(
                `INSERT INTO booking_order_items
                   (gate_pass_id, customer_id, shop_name, stock_id, brand,
                    item_code, item_description, qty_ctn, qty_pieces, rate, amount, discount)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).run(
                id, ret.customer_id || null, ret.shop_name || '',
                item.stock_id, item.brand, item.item_code, item.item_description,
                0, qtyPcs, item.rate, qtyPcs * item.rate, 0
              );
            }
          } else {
            // CTN return undo: restore qty_ctn
            const existing = ret.customer_id
              ? db.prepare(
                  `SELECT * FROM booking_order_items WHERE gate_pass_id = ? AND stock_id = ? AND customer_id = ? ORDER BY id LIMIT 1`
                ).get(id, item.stock_id, ret.customer_id)
              : db.prepare(
                  `SELECT * FROM booking_order_items WHERE gate_pass_id = ? AND stock_id = ? ORDER BY id LIMIT 1`
                ).get(id, item.stock_id);

            if (existing) {
              const newQty = existing.qty_ctn + qty;
              db.prepare('UPDATE booking_order_items SET qty_ctn = ?, amount = ? WHERE id = ?')
                .run(newQty, newQty * existing.rate, existing.id);
            } else {
              db.prepare(
                `INSERT INTO booking_order_items
                   (gate_pass_id, customer_id, shop_name, stock_id, brand,
                    item_code, item_description, qty_ctn, qty_pieces, rate, amount, discount)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).run(
                id, ret.customer_id || null, ret.shop_name || '',
                item.stock_id, item.brand, item.item_code, item.item_description,
                qty, 0, item.rate, qty * item.rate, 0
              );
            }
          }
        }
      }

      // Re-consolidate gate_pass_items from updated booking_order_items
      db.prepare('DELETE FROM gate_pass_items WHERE gate_pass_id = ?').run(id);
      const allBoi = db.prepare(
        'SELECT * FROM booking_order_items WHERE gate_pass_id = ?'
      ).all(id);

      const consolidated = {};
      for (const boi of allBoi) {
        const key = `${boi.brand}||${boi.item_code}||${Number(boi.rate || 0).toFixed(4)}`;
        if (!consolidated[key]) {
          consolidated[key] = {
            stock_id: boi.stock_id || null,
            item_code: boi.item_code || '',
            item_description: boi.item_description || '',
            qty_ctn: 0, total: 0,
            rate: Number(boi.rate) || 0,
          };
        }
        consolidated[key].qty_ctn += Number(boi.qty_ctn) || 0;
        consolidated[key].total  += Number(boi.amount)  || 0;
      }

      let gpTotalQty = 0, gpTotalAmount = 0;
      for (const c of Object.values(consolidated)) {
        gpTotalAmount += c.total; // include piece-only items in amount total
        if (c.qty_ctn <= 0) continue;
        db.prepare(
          `INSERT INTO gate_pass_items
             (gate_pass_id, stock_id, item_code, item_description, quantity, rate, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(id, c.stock_id, c.item_code, c.item_description, c.qty_ctn, c.rate, c.total);
        gpTotalQty += c.qty_ctn;
      }

      db.prepare('UPDATE gate_passes SET total_qty = ?, total_amount = ? WHERE id = ?')
        .run(gpTotalQty, gpTotalAmount, id);

      // Delete return items then header
      db.prepare('DELETE FROM gate_pass_return_items WHERE return_id = ?').run(returnId);
      db.prepare('DELETE FROM gate_pass_returns WHERE id = ?').run(returnId);
    })();

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};


exports.updateBookingItemRates = (req, res) => {
  try {
    const { id } = req.params;
    const { items = [] } = req.body;

    const gp = db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(id);
    if (!gp) return res.status(404).json({ error: 'Gate pass not found' });

    db.transaction(() => {
      for (const item of items) {
        const rate = Number(item.rate) || 0;
        const existing = db.prepare(
          'SELECT * FROM booking_order_items WHERE id = ? AND gate_pass_id = ?'
        ).get(item.id, id);
        if (!existing) continue;
        // qty_ctn is a carton count, qty_pieces is the loose remainder — both must be
        // converted to a piece total before pricing, or amount silently drops the
        // remainder whenever the booked quantity isn't an exact multiple of carton size.
        const stock = existing.stock_id
          ? db.prepare('SELECT pieces_per_ctn FROM stocks WHERE id = ?').get(existing.stock_id)
          : null;
        const piecesPerCtn = Number(stock?.pieces_per_ctn) || 1;
        const totalPieces = Number(existing.qty_ctn) * piecesPerCtn + Number(existing.qty_pieces);
        const amount = totalPieces * rate;
        db.prepare('UPDATE booking_order_items SET rate = ?, amount = ? WHERE id = ?')
          .run(rate, amount, item.id);
      }

      // Re-consolidate gate_pass_items (without touching stock)
      db.prepare('DELETE FROM gate_pass_items WHERE gate_pass_id = ?').run(id);
      const allBoi = db.prepare('SELECT * FROM booking_order_items WHERE gate_pass_id = ?').all(id);

      const consolidated = {};
      for (const boi of allBoi) {
        const key = `${boi.brand}||${boi.item_code}||${Number(boi.rate || 0).toFixed(4)}`;
        if (!consolidated[key]) {
          consolidated[key] = {
            stock_id: boi.stock_id || null,
            item_code: boi.item_code || '',
            item_description: boi.item_description || '',
            qty_ctn: 0, total: 0,
            rate: Number(boi.rate) || 0,
          };
        }
        consolidated[key].qty_ctn += Number(boi.qty_ctn) || 0;
        consolidated[key].total += Number(boi.amount) || 0;
      }

      let gpTotalQty = 0, gpTotalAmount = 0;
      for (const c of Object.values(consolidated)) {
        // Items booked as loose pieces only (qty_ctn = 0) must still be kept — skipping them
        // here silently dropped them from Print GP / Small DO / totals after any rate edit.
        if (c.qty_ctn <= 0 && c.total <= 0) continue;
        db.prepare(
          `INSERT INTO gate_pass_items
             (gate_pass_id, stock_id, item_code, item_description, quantity, rate, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(id, c.stock_id, c.item_code, c.item_description, c.qty_ctn, c.rate, c.total);
        gpTotalQty += c.qty_ctn;
        gpTotalAmount += c.total;
      }

      db.prepare('UPDATE gate_passes SET total_qty = ?, total_amount = ? WHERE id = ?')
        .run(gpTotalQty, gpTotalAmount, id);
    })();

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};


exports.getPayments = (req, res) => {
  try {
    const gpId = Number(req.params.id);
    const gp = db.prepare('SELECT ogp_number FROM gate_passes WHERE id = ?').get(gpId);

    // Bank/cash payments
    const bankRows = db.prepare(`
      SELECT cbt.id, cbt.debit AS amount, cbt.description, cbt.transaction_date AS date,
             ba.account_name, ba.account_type, cbt.account_id AS bank_account_id,
             'bank' AS source
      FROM cash_bank_transactions cbt
      LEFT JOIN bank_accounts ba ON cbt.account_id = ba.id
      WHERE cbt.reference_id = ? AND cbt.reference_type = 'gate_pass'
      ORDER BY cbt.transaction_date, cbt.id
    `).all(gpId);

    // Employee/REP payments (RECOVERY entries linked to this OGP's gatepass_number)
    let empRows = [];
    if (gp) {
      empRows = db.prepare(`
        SELECT el.id, el.credit AS amount, el.description, el.date,
               e.name AS account_name, 'REP' AS account_type, NULL AS bank_account_id,
               'employee' AS source, el.employee_id
        FROM employee_ledger el
        JOIN employees e ON el.employee_id = e.id
        WHERE el.transaction_type = 'RECOVERY' AND el.gatepass_number = ?
        ORDER BY el.date, el.id
      `).all(String(gp.ogp_number));
    }

    res.json([...bankRows, ...empRows]);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch payments' }); }
};

exports.recordPayment = (req, res) => {
  try {
    const { id } = req.params;
    const { amount, bankAccountId, employeeId, date, description } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Amount required' });

    const gp = db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(id);
    if (!gp) return res.status(404).json({ error: 'Gate pass not found' });

    db.transaction(() => {
      const payDate = date || new Date().toISOString().split('T')[0];
      const amt = Math.round(Number(amount) * 100) / 100;
      const desc = description || `Payment for OGP #${gp.ogp_number}`;

      // Credit employee ledger (RECOVERY — money received from field, reduces employee balance)
      if (employeeId) {
        const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
        if (emp) {
          const rows = db.prepare(
            'SELECT balance FROM employee_ledger WHERE employee_id = ? ORDER BY date ASC, id ASC'
          ).all(employeeId);
          const lastBal = rows.length ? rows[rows.length - 1].balance : 0;
          const newBal = Math.round((lastBal - amt) * 100) / 100;
          db.prepare(
            `INSERT INTO employee_ledger
               (employee_id, date, transaction_type, description, debit, credit, balance, gatepass_number)
             VALUES (?, ?, 'RECOVERY', ?, 0, ?, ?, ?)`
          ).run(employeeId, payDate, desc, amt, newBal, String(gp.ogp_number));
        }
      }

      // Debit cash/bank account (money received into account)
      if (bankAccountId) {
        const acc = db.prepare('SELECT opening_balance FROM bank_accounts WHERE id = ?').get(bankAccountId);
        const txn = db.prepare(
          'SELECT COALESCE(SUM(debit - credit), 0) as txn FROM cash_bank_transactions WHERE account_id = ?'
        ).get(bankAccountId);
        const runningBal = Math.round(((acc?.opening_balance || 0) + (txn?.txn || 0) + amt) * 100) / 100;
        db.prepare(
          `INSERT INTO cash_bank_transactions
             (account_id, transaction_type, reference_id, reference_type, debit, credit, balance, description, transaction_date)
           VALUES (?, 'RECEIPT', ?, 'gate_pass', ?, 0, ?, ?, ?)`
        ).run(bankAccountId, Number(id), amt, runningBal, desc, payDate);
      }
    })();

    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.deletePayment = (req, res) => {
  try {
    const payId = Number(req.params.paymentId);
    const source = req.query.source || 'bank'; // 'bank' or 'employee'

    if (source === 'employee') {
      const el = db.prepare('SELECT * FROM employee_ledger WHERE id = ?').get(payId);
      if (!el) return res.status(404).json({ error: 'Payment not found' });
      db.prepare('DELETE FROM employee_ledger WHERE id = ?').run(payId);
    } else {
      const txn = db.prepare('SELECT * FROM cash_bank_transactions WHERE id = ?').get(payId);
      if (!txn) return res.status(404).json({ error: 'Payment not found' });
      db.transaction(() => {
        // Also remove linked employee_ledger RECOVERY if any
        const gp = db.prepare('SELECT ogp_number FROM gate_passes WHERE id = ?').get(req.params.id);
        if (gp) {
          db.prepare(
            `DELETE FROM employee_ledger WHERE transaction_type = 'RECOVERY' AND gatepass_number = ? AND credit = ? AND date = ?`
          ).run(String(gp.ogp_number), txn.debit, txn.transaction_date);
        }
        db.prepare('DELETE FROM cash_bank_transactions WHERE id = ?').run(payId);
      })();
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete payment' }); }
};

exports.updatePayment = (req, res) => {
  try {
    const payId = Number(req.params.paymentId);
    const source = req.query.source || 'bank';
    const { amount, date, description } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Amount required' });
    const amt = Math.round(Number(amount) * 100) / 100;

    if (source === 'employee') {
      const el = db.prepare('SELECT * FROM employee_ledger WHERE id = ?').get(payId);
      if (!el) return res.status(404).json({ error: 'Payment not found' });
      const payDate = date || el.date;
      const desc = description || el.description;
      db.prepare(
        `UPDATE employee_ledger SET credit = ?, date = ?, description = ? WHERE id = ?`
      ).run(amt, payDate, desc, payId);
    } else {
      const txn = db.prepare('SELECT * FROM cash_bank_transactions WHERE id = ?').get(payId);
      if (!txn) return res.status(404).json({ error: 'Payment not found' });
      const payDate = date || txn.transaction_date;
      const desc = description || txn.description;
      db.transaction(() => {
        db.prepare(
          `UPDATE cash_bank_transactions SET debit = ?, transaction_date = ?, description = ? WHERE id = ?`
        ).run(amt, payDate, desc, payId);
        // Also update linked employee_ledger RECOVERY if any
        const gp = db.prepare('SELECT ogp_number FROM gate_passes WHERE id = ?').get(req.params.id);
        if (gp) {
          db.prepare(
            `UPDATE employee_ledger SET credit = ?, date = ?, description = ? WHERE transaction_type = 'RECOVERY' AND gatepass_number = ? AND credit = ? AND date = ?`
          ).run(amt, payDate, desc, String(gp.ogp_number), txn.debit, txn.transaction_date);
        }
      })();
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to update payment' }); }
};

exports.closeGatePass = (req, res) => {
  try {
    const gp = db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(req.params.id);
    if (!gp) return res.status(404).json({ error: 'Gate pass not found' });
    db.prepare("UPDATE gate_passes SET status = 'CLOSED' WHERE id = ?").run(req.params.id);
    res.json({ success: true, status: 'CLOSED' });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

exports.reopenGatePass = (req, res) => {
  try {
    const gp = db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(req.params.id);
    if (!gp) return res.status(404).json({ error: 'Gate pass not found' });
    db.prepare("UPDATE gate_passes SET status = 'OPEN' WHERE id = ?").run(req.params.id);
    res.json({ success: true, status: 'OPEN' });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};

// â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.delete = (req, res) => {
  try {
    db.transaction(() => {
      const { id } = req.params;
      const gp = db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(id);
      if (!gp) throw new Error('Gate pass not found');

      // Restore stock
      const items = db.prepare(
        'SELECT stock_id, quantity FROM gate_pass_items WHERE gate_pass_id = ?'
      ).all(id);
      for (const item of items) {
        if (item.stock_id) {
          db.prepare('UPDATE stocks SET quantity = quantity + ? WHERE id = ?')
            .run(item.quantity, item.stock_id);
        }
      }

      db.prepare('DELETE FROM gate_pass_items WHERE gate_pass_id = ?').run(id);
      db.prepare('DELETE FROM booking_order_items WHERE gate_pass_id = ?').run(id);
      db.prepare('DELETE FROM customer_ledger WHERE reference_id = ? AND reference_type = ?').run(id, 'gate_pass');
      db.prepare('DELETE FROM gate_passes WHERE id = ?').run(id);
    })();

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Gate pass operation failed' }); }
};
