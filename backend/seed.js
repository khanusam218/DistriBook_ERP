const db = require('./src/db/db');
const bcrypt = require('bcryptjs');

db.initialize().then(async () => {
  console.log('Seeding database...');

  db.exec(`
    DELETE FROM sale_return_items;
    DELETE FROM sale_returns;
    DELETE FROM sale_items;
    DELETE FROM sales;
    DELETE FROM purchase_return_items;
    DELETE FROM purchase_returns;
    DELETE FROM purchase_items;
    DELETE FROM purchases;
    DELETE FROM customer_ledger;
    DELETE FROM vendor_ledger;
    DELETE FROM company_ledger;
    DELETE FROM stocks;
    DELETE FROM customers;
    DELETE FROM vendors;
    DELETE FROM users;
  `);

  // ── Users ──────────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('admin123', 10);
  db.prepare('INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)').run('admin', 'admin@thok.com', hash, 'Administrator');

  // ── Vendors (10) ───────────────────────────────────────────────────────────
  const vendorRows = [
    { code: 'NES-001', name: 'Nestle Pakistan Ltd',         rep: 'Ahmed Khan',     phone: '0300-1234567', email: 'ahmed@nestle.com.pk',      address: 'Plot 22, Industrial Area, Lahore',   ob: 50000 },
    { code: 'UNI-001', name: 'Unilever Pakistan Ltd',       rep: 'Sara Ali',       phone: '0321-7654321', email: 'sara@unilever.com.pk',      address: 'SITE Area, Karachi',                 ob: 30000 },
    { code: 'PG-001',  name: 'P&G Pakistan',                rep: 'Bilal Shah',     phone: '0333-9876543', email: 'bilal@pg.com.pk',           address: 'Korangi Industrial, Karachi',        ob: 20000 },
    { code: 'COL-001', name: 'Colgate-Palmolive Pakistan',  rep: 'Zara Hussain',   phone: '0345-1112233', email: 'zara@colgate.com.pk',       address: 'F-7, Islamabad',                    ob: 15000 },
    { code: 'HAJ-001', name: 'Haji Bhai Traders',           rep: 'Haji Rafiq',     phone: '0300-9998877', email: 'rafiq@hajibhai.com',        address: 'Jodia Bazar, Karachi',               ob:     0 },
    { code: 'MAS-001', name: 'Masnoon Products Pvt Ltd',    rep: 'Yasir Masood',   phone: '0321-5554433', email: 'yasir@masnoon.com',         address: 'Gulshan-e-Iqbal, Karachi',           ob: 12000 },
    { code: 'GUL-001', name: 'Gul Ahmed Traders',           rep: 'Gul Zaman',      phone: '0333-6665544', email: 'gul@gulahmed.pk',           address: 'Faisalabad Road, Lahore',            ob:     0 },
    { code: 'ENG-001', name: 'English Biscuit Mfrs',        rep: 'Daniel Hymas',   phone: '0345-3332211', email: 'sales@ebm.com.pk',          address: 'F.B. Area, Karachi',                 ob:  8000 },
    { code: 'NAT-001', name: 'National Foods Ltd',          rep: 'Arif Habib',     phone: '0300-7776655', email: 'arif@nationalfoods.com.pk', address: 'Korangi Creek, Karachi',             ob: 25000 },
    { code: 'REC-001', name: 'Reckitt Benckiser Pakistan',  rep: 'Mohsin Raza',    phone: '0321-8889977', email: 'mohsin@rb.com',             address: 'DHA, Lahore',                        ob: 18000 },
  ];
  const vId = {};
  for (const v of vendorRows) {
    const r = db.prepare('INSERT INTO vendors (company_code, company_name, representative_name, phone, email, address, opening_balance) VALUES (?,?,?,?,?,?,?)').run(v.code, v.name, v.rep, v.phone, v.email, v.address, v.ob);
    vId[v.code] = r.lastInsertRowid;
    if (v.ob > 0) {
      db.prepare('INSERT INTO vendor_ledger (vendor_id, transaction_type, debit, credit, balance, description) VALUES (?,?,0,?,?,?)').run(r.lastInsertRowid, 'OPENING_BALANCE', v.ob, v.ob, 'Opening Balance');
    }
  }

  // ── Customers (10) ─────────────────────────────────────────────────────────
  const customerRows = [
    { code: 'C-001', shop: 'Metro Cash & Carry',       name: 'Imran Malik',    type: 'WHOLESALER', phone: '0300-5556677', email: 'imran@metro.com',       address: 'Main Boulevard, Lahore',   ob: 25000 },
    { code: 'C-002', shop: 'Al-Fatah Department Store',name: 'Fahad Qureshi',  type: 'WHOLESALER', phone: '0321-4445566', email: 'fahad@alfatah.com',     address: 'Liberty Market, Lahore',   ob: 18000 },
    { code: 'C-003', shop: 'City Mart',                name: 'Nasir Javed',    type: 'WHOLESALER', phone: '0333-2223344', email: 'nasir@citymart.com',    address: 'DHA Phase 5, Karachi',     ob: 10000 },
    { code: 'C-004', shop: 'Corner Store Hassan',      name: 'Hassan Raza',    type: 'RETAILER',   phone: '0345-8889900', email: '',                      address: 'Gulberg III, Lahore',      ob:     0 },
    { code: 'C-005', shop: 'Daily Needs Shop',         name: 'Usman Tariq',    type: 'RETAILER',   phone: '0301-1122334', email: '',                      address: 'Model Town, Lahore',       ob:     0 },
    { code: 'C-006', shop: 'Hyperstar',                name: 'Kamran Siddiqui',type: 'WHOLESALER', phone: '0300-2233445', email: 'kamran@hyperstar.com',  address: 'Packages Mall, Lahore',    ob: 15000 },
    { code: 'C-007', shop: 'Chase Up',                 name: 'Faisal Mirza',   type: 'WHOLESALER', phone: '0321-3344556', email: 'faisal@chaseup.pk',     address: 'Dolmen Mall, Karachi',     ob:  8000 },
    { code: 'C-008', shop: 'D-Watson Pharmacy',        name: 'Naila Fatima',   type: 'WHOLESALER', phone: '0333-4455667', email: 'naila@dwatson.pk',      address: 'Clifton, Karachi',         ob:  5000 },
    { code: 'C-009', shop: 'Village General Store',    name: 'Shafiq Ahmad',   type: 'RETAILER',   phone: '0345-5566778', email: '',                      address: 'Gujranwala Road, Sialkot', ob:     0 },
    { code: 'C-010', shop: 'Quick Shop',               name: 'Tariq Mehmood',  type: 'RETAILER',   phone: '0300-6677889', email: '',                      address: 'Saddar, Rawalpindi',       ob:     0 },
  ];
  const cId = {};
  for (const c of customerRows) {
    const r = db.prepare('INSERT INTO customers (customer_code, shop_name, customer_name, customer_type, phone, email, address, opening_balance) VALUES (?,?,?,?,?,?,?,?)').run(c.code, c.shop, c.name, c.type, c.phone, c.email, c.address, c.ob);
    cId[c.code] = r.lastInsertRowid;
    if (c.type === 'WHOLESALER' && c.ob > 0) {
      db.prepare('INSERT INTO customer_ledger (customer_id, transaction_type, debit, credit, balance, transaction_date, description) VALUES (?,?,?,0,?,?,?)').run(r.lastInsertRowid, 'OPENING_BALANCE', c.ob, c.ob, '2026-01-01', 'Opening Balance');
    }
  }

  // ── Stocks (10) ────────────────────────────────────────────────────────────
  const stockRows = [
    { company: 'Nestle Pakistan Ltd',        name: 'Nescafe Classic 50g',      desc: 'Instant Coffee',            unit: 'CTN', pcs: 24, buy: 850,  sell: 950,  qty: 0 },
    { company: 'Nestle Pakistan Ltd',        name: 'Milo 400g',                desc: 'Chocolate Malt Drink',      unit: 'CTN', pcs: 12, buy: 1200, sell: 1350, qty: 0 },
    { company: 'Nestle Pakistan Ltd',        name: 'Nestle Pure Life 1.5L',    desc: 'Mineral Water',             unit: 'CTN', pcs: 12, buy: 180,  sell: 220,  qty: 0 },
    { company: 'Unilever Pakistan Ltd',      name: 'Surf Excel 1kg',           desc: 'Washing Powder',            unit: 'CTN', pcs: 12, buy: 750,  sell: 850,  qty: 0 },
    { company: 'Unilever Pakistan Ltd',      name: 'Lipton Yellow Label 200g', desc: 'Black Tea',                 unit: 'CTN', pcs: 24, buy: 480,  sell: 550,  qty: 0 },
    { company: 'Unilever Pakistan Ltd',      name: 'Sunsilk Shampoo 180ml',    desc: 'Hair Shampoo',              unit: 'CTN', pcs: 24, buy: 280,  sell: 320,  qty: 0 },
    { company: 'P&G Pakistan',              name: 'Ariel 1kg',                desc: 'Detergent Powder',          unit: 'CTN', pcs: 12, buy: 820,  sell: 920,  qty: 0 },
    { company: 'P&G Pakistan',              name: 'Head & Shoulders 185ml',   desc: 'Anti-Dandruff Shampoo',     unit: 'CTN', pcs: 24, buy: 320,  sell: 370,  qty: 0 },
    { company: 'Colgate-Palmolive Pakistan', name: 'Colgate Max Fresh 150g',   desc: 'Toothpaste',                unit: 'CTN', pcs: 36, buy: 175,  sell: 210,  qty: 0 },
    { company: 'Colgate-Palmolive Pakistan', name: 'Palmolive Soap 135g',      desc: 'Bath Soap',                 unit: 'CTN', pcs: 48, buy: 95,   sell: 115,  qty: 0 },
  ];
  const sId = {};
  for (const s of stockRows) {
    const r = db.prepare('INSERT INTO stocks (company_name, product_name, product_description, packing_unit, pieces_per_ctn, purchase_price, sale_price, quantity) VALUES (?,?,?,?,?,?,?,?)').run(s.company, s.name, s.desc, s.unit, s.pcs, s.buy, s.sell, s.qty);
    sId[s.name] = r.lastInsertRowid;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const createPurchase = (vendorId, date, invoiceNo, items) => {
    const r = db.prepare('INSERT INTO purchases (vendor_id, purchase_date, invoice_no, total_amount) VALUES (?,?,?,0)').run(vendorId, date, invoiceNo);
    const pid = r.lastInsertRowid;
    let total = 0;
    for (const item of items) {
      const lineTotal = item.qty * item.price;
      total += lineTotal;
      db.prepare('INSERT INTO purchase_items (purchase_id, stock_id, quantity, purchase_price, total) VALUES (?,?,?,?,?)').run(pid, item.stockId, item.qty, item.price, lineTotal);
      db.prepare('UPDATE stocks SET quantity = quantity + ? WHERE id = ?').run(item.qty, item.stockId);
    }
    db.prepare('UPDATE purchases SET total_amount = ? WHERE id = ?').run(total, pid);
    const prevBal = db.prepare('SELECT COALESCE(SUM(credit-debit),0) as b FROM vendor_ledger WHERE vendor_id=?').get(vendorId).b || 0;
    db.prepare('INSERT INTO vendor_ledger (vendor_id, transaction_type, reference_id, reference_type, debit, credit, balance, transaction_date, description) VALUES (?,?,?,?,?,0,?,?,?)').run(vendorId, 'PURCHASE', pid, 'purchase', total, prevBal + total, date, `Purchase Invoice ${invoiceNo}`);
    return pid;
  };

  const createSale = (customerId, date, gatePass, billNo, items) => {
    const r = db.prepare('INSERT INTO sales (customer_id, sale_date, gate_pass_no, bill_no, total_amount) VALUES (?,?,?,?,0)').run(customerId, date, gatePass, billNo);
    const sid = r.lastInsertRowid;
    let total = 0;
    for (const item of items) {
      const lineTotal = item.qty * item.price;
      total += lineTotal;
      db.prepare('INSERT INTO sale_items (sale_id, stock_id, item_code, product_name, product_rate, product_qty, total) VALUES (?,?,?,?,?,?,?)').run(sid, item.stockId, `P${item.stockId}`, item.name, item.price, item.qty, lineTotal);
      db.prepare('UPDATE stocks SET quantity = quantity - ? WHERE id = ?').run(item.qty, item.stockId);
    }
    db.prepare('UPDATE sales SET total_amount = ? WHERE id = ?').run(total, sid);
    if (customerId) {
      const cust = db.prepare('SELECT customer_type FROM customers WHERE id=?').get(customerId);
      if (cust && cust.customer_type === 'WHOLESALER') {
        const prevBal = db.prepare('SELECT COALESCE(SUM(debit-credit),0) as b FROM customer_ledger WHERE customer_id=?').get(customerId).b || 0;
        db.prepare('INSERT INTO customer_ledger (customer_id, transaction_type, reference_id, reference_type, debit, credit, balance, transaction_date, description) VALUES (?,?,?,?,?,0,?,?,?)').run(customerId, 'SALE', sid, 'sale', total, prevBal + total, date, `Sale Invoice ${billNo}`);
      }
    }
    return sid;
  };

  const createPurchaseReturn = (purchaseId, date, reason, items) => {
    let total = 0;
    for (const i of items) total += i.qty * i.price;
    const r = db.prepare('INSERT INTO purchase_returns (purchase_id, return_date, total_amount, reason) VALUES (?,?,?,?)').run(purchaseId, date, total, reason);
    const prid = r.lastInsertRowid;
    for (const i of items) {
      db.prepare('INSERT INTO purchase_return_items (purchase_return_id, stock_id, quantity, price, total) VALUES (?,?,?,?,?)').run(prid, i.stockId, i.qty, i.price, i.qty * i.price);
      db.prepare('UPDATE stocks SET quantity = quantity - ? WHERE id = ?').run(i.qty, i.stockId);
    }
    return prid;
  };

  const createSaleReturn = (saleId, date, reason, items) => {
    let total = 0;
    for (const i of items) total += i.qty * i.price;
    const r = db.prepare('INSERT INTO sale_returns (sale_id, return_date, total_amount, reason) VALUES (?,?,?,?)').run(saleId, date, total, reason);
    const srid = r.lastInsertRowid;
    for (const i of items) {
      db.prepare('INSERT INTO sale_return_items (sale_return_id, stock_id, quantity, price, total) VALUES (?,?,?,?,?)').run(srid, i.stockId, i.qty, i.price, i.qty * i.price);
      db.prepare('UPDATE stocks SET quantity = quantity + ? WHERE id = ?').run(i.qty, i.stockId);
    }
    return srid;
  };

  const S = sId;
  const NES = vId['NES-001'], UNI = vId['UNI-001'], PG = vId['PG-001'],  COL = vId['COL-001'],
        HAJ = vId['HAJ-001'], MAS = vId['MAS-001'], GUL = vId['GUL-001'], ENG = vId['ENG-001'],
        NAT = vId['NAT-001'], REC = vId['REC-001'];

  // ── Purchases (10) ─────────────────────────────────────────────────────────
  // P1
  const p1 = createPurchase(NES, '2026-03-01', 'NES-INV-001', [
    { stockId: S['Nescafe Classic 50g'],      qty: 100, price: 850  },
    { stockId: S['Milo 400g'],                qty:  60, price: 1200 },
    { stockId: S['Nestle Pure Life 1.5L'],    qty: 200, price: 180  },
  ]);
  // P2
  const p2 = createPurchase(UNI, '2026-03-05', 'UNI-INV-001', [
    { stockId: S['Surf Excel 1kg'],           qty:  80, price: 750 },
    { stockId: S['Lipton Yellow Label 200g'], qty: 120, price: 480 },
    { stockId: S['Sunsilk Shampoo 180ml'],    qty: 100, price: 280 },
  ]);
  // P3
  const p3 = createPurchase(PG, '2026-03-08', 'PG-INV-001', [
    { stockId: S['Ariel 1kg'],               qty: 70, price: 820 },
    { stockId: S['Head & Shoulders 185ml'],  qty: 90, price: 320 },
  ]);
  // P4
  const p4 = createPurchase(COL, '2026-03-12', 'COL-INV-001', [
    { stockId: S['Colgate Max Fresh 150g'],  qty: 160, price: 175 },
    { stockId: S['Palmolive Soap 135g'],     qty: 200, price:  95 },
  ]);
  // P5
  const p5 = createPurchase(NES, '2026-03-15', 'NES-INV-002', [
    { stockId: S['Nescafe Classic 50g'],     qty: 50, price: 860  },
    { stockId: S['Milo 400g'],               qty: 40, price: 1210 },
  ]);
  // P6
  const p6 = createPurchase(HAJ, '2026-03-18', 'HAJ-INV-001', [
    { stockId: S['Lipton Yellow Label 200g'], qty: 50, price: 485 },
    { stockId: S['Sunsilk Shampoo 180ml'],    qty: 50, price: 285 },
  ]);
  // P7
  const p7 = createPurchase(MAS, '2026-03-22', 'MAS-INV-001', [
    { stockId: S['Surf Excel 1kg'],          qty: 40, price: 755 },
    { stockId: S['Ariel 1kg'],               qty: 30, price: 825 },
  ]);
  // P8
  const p8 = createPurchase(GUL, '2026-03-25', 'GUL-INV-001', [
    { stockId: S['Head & Shoulders 185ml'], qty: 40, price: 325 },
    { stockId: S['Sunsilk Shampoo 180ml'],  qty: 30, price: 285 },
  ]);
  // P9
  const p9 = createPurchase(ENG, '2026-03-28', 'ENG-INV-001', [
    { stockId: S['Colgate Max Fresh 150g'], qty:  80, price: 178 },
    { stockId: S['Palmolive Soap 135g'],    qty: 100, price:  97 },
  ]);
  // P10
  const p10 = createPurchase(NAT, '2026-04-01', 'NAT-INV-001', [
    { stockId: S['Nescafe Classic 50g'],   qty: 30, price: 855 },
    { stockId: S['Nestle Pure Life 1.5L'], qty: 80, price: 182 },
  ]);

  // ── Purchase Returns (10) ──────────────────────────────────────────────────
  createPurchaseReturn(p1, '2026-03-03', 'Damaged in transit', [
    { stockId: S['Nescafe Classic 50g'], qty: 5, price: 850 },
  ]);
  createPurchaseReturn(p1, '2026-03-04', 'Near expiry date', [
    { stockId: S['Milo 400g'], qty: 3, price: 1200 },
  ]);
  createPurchaseReturn(p2, '2026-03-07', 'Wrong variant supplied', [
    { stockId: S['Surf Excel 1kg'], qty: 4, price: 750 },
  ]);
  createPurchaseReturn(p2, '2026-03-08', 'Packaging damaged', [
    { stockId: S['Lipton Yellow Label 200g'], qty: 5, price: 480 },
  ]);
  createPurchaseReturn(p3, '2026-03-10', 'Quality issue on inspection', [
    { stockId: S['Ariel 1kg'], qty: 3, price: 820 },
  ]);
  createPurchaseReturn(p4, '2026-03-14', 'Wrong flavor sent', [
    { stockId: S['Colgate Max Fresh 150g'], qty: 10, price: 175 },
  ]);
  createPurchaseReturn(p5, '2026-03-17', 'Excess stock adjustment', [
    { stockId: S['Nescafe Classic 50g'], qty: 5, price: 860 },
  ]);
  createPurchaseReturn(p6, '2026-03-20', 'Leaking bottles', [
    { stockId: S['Sunsilk Shampoo 180ml'], qty: 4, price: 285 },
  ]);
  createPurchaseReturn(p7, '2026-03-24', 'Damaged cartons', [
    { stockId: S['Surf Excel 1kg'], qty: 3, price: 755 },
  ]);
  createPurchaseReturn(p8, '2026-03-27', 'Color variant mismatch', [
    { stockId: S['Head & Shoulders 185ml'], qty: 3, price: 325 },
  ]);

  // Stock levels after purchases & purchase returns:
  // Nescafe: 100+50+30 -5-5 = 170 | Milo: 60+40-3 = 97 | Water: 200+80 = 280
  // Surf Excel: 80+40-4-3 = 113   | Lipton: 120+50-5 = 165 | Sunsilk: 100+50+30-4 = 176
  // Ariel: 70+30-3 = 97            | H&S: 90+40-3 = 127 | Colgate: 160+80-10 = 230
  // Palmolive: 200+100 = 300

  const metro    = cId['C-001'], alfatah  = cId['C-002'], citymart  = cId['C-003'],
        corner   = cId['C-004'], daily    = cId['C-005'], hyperstar = cId['C-006'],
        chaseup  = cId['C-007'], dwatson  = cId['C-008'], village   = cId['C-009'],
        quickshop= cId['C-010'];

  // ── Sales (10) ─────────────────────────────────────────────────────────────
  const s1 = createSale(metro, '2026-04-02', 'GP-001', 'BILL-001', [
    { stockId: S['Nescafe Classic 50g'], name: 'Nescafe Classic 50g', qty: 20, price: 950  },
    { stockId: S['Milo 400g'],           name: 'Milo 400g',           qty: 15, price: 1350 },
  ]); // Nescafe 170-20=150, Milo 97-15=82

  const s2 = createSale(alfatah, '2026-04-05', 'GP-002', 'BILL-002', [
    { stockId: S['Surf Excel 1kg'],           name: 'Surf Excel 1kg',           qty: 15, price: 850 },
    { stockId: S['Lipton Yellow Label 200g'], name: 'Lipton Yellow Label 200g', qty: 20, price: 550 },
  ]); // Surf 113-15=98, Lipton 165-20=145

  const s3 = createSale(corner, '2026-04-08', 'GP-003', 'BILL-003', [
    { stockId: S['Palmolive Soap 135g'],     name: 'Palmolive Soap 135g',     qty: 30, price: 115 },
    { stockId: S['Head & Shoulders 185ml'], name: 'Head & Shoulders 185ml', qty: 10, price: 370 },
  ]); // Palmolive 300-30=270, H&S 127-10=117

  const s4 = createSale(citymart, '2026-04-10', 'GP-004', 'BILL-004', [
    { stockId: S['Nescafe Classic 50g'],   name: 'Nescafe Classic 50g',   qty: 15, price: 950 },
    { stockId: S['Nestle Pure Life 1.5L'], name: 'Nestle Pure Life 1.5L', qty: 40, price: 220 },
    { stockId: S['Sunsilk Shampoo 180ml'], name: 'Sunsilk Shampoo 180ml', qty: 20, price: 320 },
  ]); // Nescafe 150-15=135, Water 280-40=240, Sunsilk 176-20=156

  const s5 = createSale(null, '2026-04-12', 'GP-005', 'BILL-005', [
    { stockId: S['Colgate Max Fresh 150g'], name: 'Colgate Max Fresh 150g', qty: 30, price: 210 },
    { stockId: S['Palmolive Soap 135g'],    name: 'Palmolive Soap 135g',    qty: 25, price: 115 },
  ]); // Colgate 230-30=200, Palmolive 270-25=245

  const s6 = createSale(metro, '2026-04-15', 'GP-006', 'BILL-006', [
    { stockId: S['Milo 400g'],              name: 'Milo 400g',              qty: 20, price: 1360 },
    { stockId: S['Ariel 1kg'],              name: 'Ariel 1kg',              qty: 15, price:  925 },
    { stockId: S['Head & Shoulders 185ml'], name: 'Head & Shoulders 185ml', qty: 20, price:  375 },
  ]); // Milo 82-20=62, Ariel 97-15=82, H&S 117-20=97

  const s7 = createSale(daily, '2026-04-18', 'GP-007', 'BILL-007', [
    { stockId: S['Surf Excel 1kg'],           name: 'Surf Excel 1kg',           qty:  8, price: 855 },
    { stockId: S['Lipton Yellow Label 200g'], name: 'Lipton Yellow Label 200g', qty: 12, price: 555 },
  ]); // Surf 98-8=90, Lipton 145-12=133

  const s8 = createSale(hyperstar, '2026-04-22', 'GP-008', 'BILL-008', [
    { stockId: S['Nescafe Classic 50g'],   name: 'Nescafe Classic 50g',   qty: 25, price: 955 },
    { stockId: S['Sunsilk Shampoo 180ml'], name: 'Sunsilk Shampoo 180ml', qty: 20, price: 325 },
    { stockId: S['Colgate Max Fresh 150g'],name: 'Colgate Max Fresh 150g', qty: 30, price: 212 },
  ]); // Nescafe 135-25=110, Sunsilk 156-20=136, Colgate 200-30=170

  const s9 = createSale(chaseup, '2026-04-26', 'GP-009', 'BILL-009', [
    { stockId: S['Lipton Yellow Label 200g'], name: 'Lipton Yellow Label 200g', qty: 15, price: 555 },
    { stockId: S['Ariel 1kg'],               name: 'Ariel 1kg',               qty: 10, price: 928 },
    { stockId: S['Nestle Pure Life 1.5L'],   name: 'Nestle Pure Life 1.5L',   qty: 30, price: 222 },
  ]); // Lipton 133-15=118, Ariel 82-10=72, Water 240-30=210

  const s10 = createSale(dwatson, '2026-04-30', 'GP-010', 'BILL-010', [
    { stockId: S['Milo 400g'],              name: 'Milo 400g',              qty: 10, price: 1365 },
    { stockId: S['Colgate Max Fresh 150g'], name: 'Colgate Max Fresh 150g', qty: 20, price:  212 },
    { stockId: S['Head & Shoulders 185ml'], name: 'Head & Shoulders 185ml', qty: 15, price:  378 },
  ]); // Milo 62-10=52, Colgate 170-20=150, H&S 97-15=82

  // ── Sale Returns (10) ──────────────────────────────────────────────────────
  createSaleReturn(s1, '2026-04-04', 'Customer returned wrong order', [
    { stockId: S['Nescafe Classic 50g'], qty: 2, price: 950 },
  ]);
  createSaleReturn(s2, '2026-04-07', 'Wrong product packed by mistake', [
    { stockId: S['Surf Excel 1kg'], qty: 2, price: 850 },
  ]);
  createSaleReturn(s3, '2026-04-10', 'Near expiry — customer refused', [
    { stockId: S['Palmolive Soap 135g'], qty: 5, price: 115 },
  ]);
  createSaleReturn(s4, '2026-04-12', 'Leaking water bottles', [
    { stockId: S['Nestle Pure Life 1.5L'], qty: 5, price: 220 },
  ]);
  createSaleReturn(s5, '2026-04-15', 'Seal broken on delivery', [
    { stockId: S['Colgate Max Fresh 150g'], qty: 3, price: 210 },
  ]);
  createSaleReturn(s6, '2026-04-17', 'Customer not satisfied with variant', [
    { stockId: S['Head & Shoulders 185ml'], qty: 2, price: 375 },
  ]);
  createSaleReturn(s7, '2026-04-20', 'Wrong tea flavor', [
    { stockId: S['Lipton Yellow Label 200g'], qty: 2, price: 555 },
  ]);
  createSaleReturn(s8, '2026-04-24', 'Wrong shampoo variant', [
    { stockId: S['Sunsilk Shampoo 180ml'], qty: 3, price: 325 },
  ]);
  createSaleReturn(s9, '2026-04-28', 'Damaged boxes on arrival', [
    { stockId: S['Ariel 1kg'], qty: 2, price: 928 },
  ]);
  createSaleReturn(s10, '2026-05-02', 'Customer changed mind', [
    { stockId: S['Milo 400g'], qty: 2, price: 1365 },
  ]);

  console.log('');
  console.log('✅ Sample data seeded successfully!');
  console.log('   Vendors: 10  | Customers: 10 | Products: 10');
  console.log('   Purchases: 10 | Purchase Returns: 10');
  console.log('   Sales: 10    | Sale Returns: 10');
  console.log('   Login: admin / admin123');
}).catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
