/**
 * Comprehensive Demo Data Seeder — 30+ entries per module
 * Run: node seed-demo.js
 */
const db = require('./src/db/db');
const bcrypt = require('bcryptjs');

db.initialize().then(async () => {
  console.log('Seeding demo data (30+ entries per module)...\n');

  // ── Clear existing data ──
  db.exec(`
    DELETE FROM sale_return_items; DELETE FROM sale_returns;
    DELETE FROM sale_items; DELETE FROM sales;
    DELETE FROM purchase_return_items; DELETE FROM purchase_returns;
    DELETE FROM purchase_items; DELETE FROM purchases;
    DELETE FROM gate_pass_return_items; DELETE FROM gate_pass_returns;
    DELETE FROM booking_order_items; DELETE FROM gate_pass_items; DELETE FROM gate_passes;
    DELETE FROM customer_ledger; DELETE FROM vendor_ledger; DELETE FROM company_ledger;
    DELETE FROM employee_ledger;
    DELETE FROM cash_bank_transactions;
    DELETE FROM receipts; DELETE FROM vendor_payments; DELETE FROM expenses;
    DELETE FROM stocks; DELETE FROM products;
    DELETE FROM customers; DELETE FROM vendors; DELETE FROM employees;
    DELETE FROM bank_accounts; DELETE FROM ogp_areas; DELETE FROM gate_pass_staff;
    DELETE FROM company_settings;
  `);

  // Preserve users — only delete test users, keep admin
  db.run("DELETE FROM users WHERE username NOT IN ('hafizluqman','usama')");

  // ── Helpers ──
  const now = () => new Date().toISOString().slice(0, 10);
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ── Company Settings ──
  console.log('[1/12] Company Settings...');
  db.run(`INSERT OR REPLACE INTO company_settings (id, name, tagline, address, city, phone, mobile, email, website, ntn, strn)
    VALUES (1, 'DistriBooks Demo Corp', 'Wholesale Distribution Made Easy',
    'Plot 45, Main Boulevard', 'Lahore', '042-111-222-333', '0300-1234567',
    'info@distribooks.com', 'www.distribooks.com', 'NTN-1234567-8', 'STRN-9876543-2')`);

  // ── Bank Accounts ──
  console.log('[2/12] Bank Accounts...');
  const banks = [
    { name: 'Cash in Hand', type: 'CASH', bank: '', acc: '', ob: 500000 },
    { name: 'HBL Current', type: 'BANK', bank: 'Habib Bank Ltd', acc: '1234-567890-001', ob: 2000000 },
    { name: 'MCB Savings', type: 'BANK', bank: 'MCB Bank', acc: '9876-543210-002', ob: 1500000 },
    { name: 'UBL Business', type: 'BANK', bank: 'United Bank Ltd', acc: '5555-111222-003', ob: 800000 },
  ];
  const bankIds = {};
  for (const b of banks) {
    const r = db.prepare('INSERT INTO bank_accounts (account_name, account_type, bank_name, account_number, opening_balance) VALUES (?,?,?,?,?)').run(b.name, b.type, b.bank, b.acc, b.ob);
    bankIds[b.name] = r.lastInsertRowid;
  }

  // ── Vendors (35) ──
  console.log('[3/12] Vendors...');
  const vendorData = [
    ['V-001','Nestle Pakistan Ltd','Ahmed Khan','0300-1111111','ahmed@nestle.com.pk','Lahore',50000],
    ['V-002','Unilever Pakistan','Sara Ali','0321-2222222','sara@unilever.pk','Karachi',30000],
    ['V-003','P&G Pakistan','Bilal Shah','0333-3333333','bilal@pg.com.pk','Karachi',20000],
    ['V-004','Colgate-Palmolive','Zara Hussain','0345-4444444','zara@colgate.pk','Islamabad',15000],
    ['V-005','National Foods','Arif Habib','0300-5555555','arif@natfoods.pk','Karachi',25000],
    ['V-006','Reckitt Benckiser','Mohsin Raza','0321-6666666','mohsin@rb.com','Lahore',18000],
    ['V-007','Engro Foods','Farhan Malik','0333-7777777','farhan@engro.com','Sukkur',35000],
    ['V-008','Shan Foods','Sikander Shah','0345-8888888','sikander@shan.com','Karachi',12000],
    ['V-009','Dalda Foods','Kamran Ali','0300-9999999','kamran@dalda.pk','Karachi',22000],
    ['V-010','Coca-Cola Pakistan','Ali Raza','0321-1010101','ali@coke.pk','Lahore',40000],
    ['V-011','PepsiCo Pakistan','Hassan Shah','0333-2020202','hassan@pepsico.pk','Multan',38000],
    ['V-012','Tapal Tea','Owais Tapal','0345-3030303','owais@tapal.com','Karachi',16000],
    ['V-013','Mitchells Fruit Farms','Usman Ali','0300-4040404','usman@mitchells.pk','Renala',9000],
    ['V-014','Murree Brewery','Tariq Khan','0321-5050505','tariq@murree.com','Rawalpindi',28000],
    ['V-015','Rafhan Maize','Hamza Butt','0333-6060606','hamza@rafhan.com','Faisalabad',19000],
    ['V-016','Ismail Industries','Asif Ismail','0345-7070707','asif@ismail.pk','Karachi',15000],
    ['V-017','Mondelez Pakistan','Danish Khan','0300-8080808','danish@mondelez.pk','Karachi',32000],
    ['V-018','IGI General Insurance','Saad Ahmed','0321-9090909','saad@igi.com','Lahore',0],
    ['V-019','Bata Pakistan','Junaid Bata','0333-1212121','junaid@bata.pk','Lahore',11000],
    ['V-020','Service Industries','Imran Service','0345-2323232','imran@service.pk','Gujrat',8000],
    ['V-021','Atlas Honda','Zubair Ali','0300-3434343','zubair@honda.pk','Sheikhupura',45000],
    ['V-022','Toyota Indus','Omar Farooq','0321-4545454','omar@toyota.pk','Karachi',60000],
    ['V-023','Pak Suzuki','Fahad Riaz','0333-5656565','fahad@suzuki.pk','Karachi',55000],
    ['V-024','Hilal Foods','Noman Hilal','0345-6767676','noman@hilal.pk','Karachi',14000],
    ['V-025','Tullo Foods','Bilal Tullo','0300-7878787','bilal@tullo.pk','Lahore',7000],
    ['V-026','Gourmet Foods','Chaudhry Aslam','0321-8989898','aslam@gourmet.pk','Lahore',10000],
    ['V-027','Shezan International','Adeel Shezan','0333-9898989','adeel@shezan.pk','Lahore',17000],
    ['V-028','Fauji Foods','Haris Fauji','0345-0101010','haris@fauji.pk','Rawalpindi',21000],
    ['V-029','Bunnys Limited','Bilawal Bunny','0300-1110001','bilawal@bunnys.pk','Karachi',13000],
    ['V-030','Youngs Foods','Asad Youngs','0321-2220002','asad@youngs.pk','Gujranwala',6000],
    ['V-031','Dawn Foods','Salman Dawn','0333-3330003','salman@dawnfoods.pk','Lahore',11000],
    ['V-032','K&Ns Foods','Khalil K&Ns','0345-4440004','khalil@kandns.pk','Raiwind',25000],
    ['V-033','Mehran Spices','Ahsan Mehran','0300-5550005','ahsan@mehran.pk','Karachi',16000],
    ['V-034','Shangrila Foods','Usama Shangrila','0321-6660006','usama@shangrila.pk','Karachi',9000],
    ['V-035','OMORE Ice Cream','Naveed Omore','0333-7770007','naveed@omore.pk','Lahore',20000],
  ];
  const vId = {};
  for (const v of vendorData) {
    const r = db.prepare('INSERT INTO vendors (company_code,company_name,representative_name,phone,email,address,opening_balance) VALUES (?,?,?,?,?,?,?)').run(v[0],v[1],v[2],v[3],v[4],v[5],v[6]);
    vId[v[0]] = r.lastInsertRowid;
    if (v[6] > 0) {
      db.prepare('INSERT INTO vendor_ledger (vendor_id,transaction_type,debit,credit,balance,description) VALUES (?,?,0,?,?,?)').run(r.lastInsertRowid,'OPENING_BALANCE',v[6],v[6],'Opening Balance');
    }
  }

  // ── Customers (35) ──
  console.log('[4/12] Customers...');
  const custData = [
    ['C-01','Metro Cash & Carry','Imran Malik','WHOLESALER','0300-1110001','imran@metro.com','Lahore',25000],
    ['C-02','Al-Fatah Store','Fahad Qureshi','WHOLESALER','0321-2220002','fahad@alfatah.com','Lahore',18000],
    ['C-03','City Mart','Nasir Javed','WHOLESALER','0333-3330003','nasir@citymart.com','Karachi',10000],
    ['C-04','Hyperstar','Kamran Siddiqui','WHOLESALER','0345-4440004','kamran@hyperstar.com','Lahore',15000],
    ['C-05','Chase Up','Faisal Mirza','WHOLESALER','0300-5550005','faisal@chaseup.pk','Karachi',8000],
    ['C-06','D-Watson Pharmacy','Naila Fatima','WHOLESALER','0321-6660006','naila@dwatson.pk','Karachi',5000],
    ['C-07','Corner Store','Hassan Raza','RETAILER','0345-8889900','','Lahore',0],
    ['C-08','Daily Needs','Usman Tariq','RETAILER','0301-1122334','','Lahore',0],
    ['C-09','Mini Mart','Shafiq Ahmad','RETAILER','0300-2233445','','Gujranwala',0],
    ['C-10','Quick Shop','Tariq Mehmood','RETAILER','0321-3344556','','Rawalpindi',0],
    ['C-11','Green Supermarket','Ali Hassan','WHOLESALER','0333-4455667','ali@green.com','Multan',12000],
    ['C-12','Bismillah Store','Javed Iqbal','RETAILER','0345-5566778','','Faisalabad',0],
    ['C-13','City Super','Asif Nadeem','WHOLESALER','0300-6677889','asif@citysuper.pk','Sialkot',7000],
    ['C-14','Madina Mart','Naeem Akhtar','RETAILER','0321-7788990','','Hyderabad',0],
    ['C-15','Al-Makkah Traders','Zubair Makkah','WHOLESALER','0333-8899001','zubair@almakkah.com','Peshawar',9000],
    ['C-16','Jinnah Super','Rashid Jinnah','RETAILER','0345-9900112','','Quetta',0],
    ['C-17','Faisal Mart','Faisal Khan','RETAILER','0300-0011223','','Islamabad',0],
    ['C-18','Pak Mart','Babar Azam','WHOLESALER','0321-1122334','babar@pakmart.pk','Lahore',6000],
    ['C-19','Lahore General','Shahid Afridi','WHOLESALER','0333-2233445','shahid@lahoregen.pk','Lahore',11000],
    ['C-20','Peoples Store','Younis Khan','RETAILER','0345-3344556','','Mardan',0],
    ['C-21','Shaheen Chemist','Shoaib Akhtar','WHOLESALER','0300-4455667','shoaib@shaheen.pk','Rawalpindi',4000],
    ['C-22','Zam Zam Mart','Inzamam Ul Haq','RETAILER','0321-5566778','','Multan',0],
    ['C-23','Royal Traders','Misbah Ul Haq','WHOLESALER','0333-6677889','misbah@royal.pk','Faisalabad',13000],
    ['C-24','Ideal Mart','Waqar Younis','RETAILER','0345-7788990','','Bahawalpur',0],
    ['C-25','Sultan Store','Wasim Akram','RETAILER','0300-8899001','','Sahiwal',0],
    ['C-26','Apna Mart','Saqlain Mushtaq','WHOLESALER','0321-9900112','saqlain@apnamart.pk','Okara',3000],
    ['C-27','Sadiq Traders','Sadiq Muhammad','WHOLESALER','0333-0011223','sadiq@sadiq.pk','Sheikhupura',5000],
    ['C-28','Hamza Store','Hamza Ali','RETAILER','0345-1122334','','Kasur',0],
    ['C-29','Awan Mart','Bilal Awan','RETAILER','0300-2233445','','Jhelum',0],
    ['C-30','Pakwan Center','Aslam Pakwan','WHOLESALER','0321-3344556','aslam@pakwan.pk','Gujrat',2000],
    ['C-31','Zainab General Store','Zainab Bibi','RETAILER','0333-4455667','','Rahim Yar Khan',0],
    ['C-32','Rehmat Store','Rehmat Ali','RETAILER','0345-5566778','','Dera Ghazi Khan',0],
    ['C-33','Kisan Mart','Kisan Khan','WHOLESALER','0300-6677889','kisan@kisan.pk','Vehari',1000],
    ['C-34','Noor Store','Noor Muhammad','RETAILER','0321-7788990','','Mianwali',0],
    ['C-35','Pakiza Traders','Pakiza Bibi','WHOLESALER','0333-8899001','pakiza@pakiza.pk','Lahore',7000],
  ];
  const cId = {};
  for (const c of custData) {
    const r = db.prepare('INSERT INTO customers (customer_code,shop_name,customer_name,customer_type,phone,email,address,opening_balance) VALUES (?,?,?,?,?,?,?,?)').run(c[0],c[1],c[2],c[3],c[4],c[5],c[6],c[7]);
    cId[c[0]] = r.lastInsertRowid;
    if (c[3] === 'WHOLESALER' && c[7] > 0) {
      db.prepare('INSERT INTO customer_ledger (customer_id,transaction_type,debit,credit,balance,transaction_date,description) VALUES (?,?,?,0,?,?,?)').run(r.lastInsertRowid,'OPENING_BALANCE',c[7],c[7],'2026-01-01','Opening Balance');
    }
  }

  // ── Stocks / Products (35) ──
  console.log('[5/12] Stocks & Products...');
  const stockData = [
    ['Nestle Pakistan Ltd','Nescafe Classic 50g','Instant Coffee','CTN',24,850,950],
    ['Nestle Pakistan Ltd','Milo 400g','Chocolate Drink','CTN',12,1200,1350],
    ['Nestle Pakistan Ltd','Nestle Water 1.5L','Mineral Water','CTN',12,180,220],
    ['Nestle Pakistan Ltd','Everyday Tea 200g','Milk Tea','CTN',24,350,420],
    ['Unilever Pakistan','Surf Excel 1kg','Washing Powder','CTN',12,750,850],
    ['Unilever Pakistan','Lipton Tea 200g','Black Tea','CTN',24,480,550],
    ['Unilever Pakistan','Sunsilk 180ml','Hair Shampoo','CTN',24,280,320],
    ['Unilever Pakistan','Lux Soap 150g','Beauty Soap','CTN',48,85,105],
    ['Unilever Pakistan','Closeup 150g','Toothpaste','CTN',36,160,195],
    ['P&G Pakistan','Ariel 1kg','Detergent','CTN',12,820,920],
    ['P&G Pakistan','Head Shoulder 185ml','Shampoo','CTN',24,320,370],
    ['P&G Pakistan','Pampers Jumbo 60pcs','Diapers','CTN',8,1850,2100],
    ['P&G Pakistan','Gillette Razor 4pc','Razors','CTN',24,420,500],
    ['Colgate-Palmolive','Colgate Max 150g','Toothpaste','CTN',36,175,210],
    ['Colgate-Palmolive','Palmolive Soap 135g','Bath Soap','CTN',48,95,115],
    ['National Foods','National Kheer Mix 150g','Dessert Mix','CTN',36,120,150],
    ['National Foods','Achar Gosht Masala 50g','Spice Mix','CTN',48,85,110],
    ['National Foods','Chicken Biryani 60g','Biryani Masala','CTN',48,95,125],
    ['Reckitt Benckiser','Dettol Liquid 500ml','Antiseptic','CTN',24,380,450],
    ['Reckitt Benckiser','Harpic 500ml','Toilet Cleaner','CTN',24,220,270],
    ['Reckitt Benckiser','Mortein Coil 10pc','Mosquito Coil','CTN',36,180,220],
    ['Engro Foods','Olpers Milk 1L','UHT Milk','CTN',12,1440,1680],
    ['Engro Foods','Tarzan Milk 250ml','Flavored Milk','CTN',24,480,580],
    ['Shan Foods','Shan Biryani 60g','Biryani Masala','CTN',48,90,115],
    ['Shan Foods','Shan Nihari 50g','Nihari Masala','CTN',48,95,120],
    ['Dalda Foods','Dalda Ghee 1kg','Cooking Oil','CTN',12,1800,2100],
    ['Dalda Foods','Dalda Oil 5L','Cooking Oil','CTN',4,2200,2600],
    ['Coca-Cola Pakistan','CocaCola 1.5L','Soft Drink','CTN',12,480,580],
    ['Coca-Cola Pakistan','Sprite 500ml','Soft Drink','CTN',24,480,570],
    ['PepsiCo Pakistan','Pepsi 1.5L','Soft Drink','CTN',12,470,560],
    ['PepsiCo Pakistan','Lays Classic 50g','Potato Chips','CTN',48,60,85],
    ['Tapal Tea','Tapal Danedar 400g','Black Tea','CTN',24,520,620],
    ['Mitchells','Mitchells Mango 250ml','Fruit Juice','CTN',24,300,370],
    ['K&Ns Foods','K&Ns Nuggets 500g','Frozen Food','CTN',18,650,780],
    ['Shangrila Foods','Shangrila Ketchup 800g','Tomato Ketchup','CTN',12,900,1100],
  ];
  const sId = {};
  for (const s of stockData) {
    const r = db.prepare('INSERT INTO stocks (company_name,product_name,product_description,packing_unit,pieces_per_ctn,purchase_price,sale_price,quantity) VALUES (?,?,?,?,?,?,?,?)').run(s[0],s[1],s[2],s[3],s[4],s[5],s[6],rand(50,200));
    sId[s[1]] = r.lastInsertRowid;
    // Also create product entries for products module
    const vi = Object.entries(vId).find(([k]) => vendorData.find(v=>v[0]===k && v[1]===s[0]));
    db.prepare('INSERT OR IGNORE INTO products (vendor_id,product_name,product_description,packing_unit,pieces_per_ctn,purchase_price,sale_price) VALUES (?,?,?,?,?,?,?)').run(vi?.[1]||1,s[1],s[2],s[3],s[4],s[5],s[6]);
  }

  // ── Employees (30) ──
  console.log('[6/12] Employees...');
  const empData = [
    ['Ahmed Raza','0300-1110001','Sales Manager',85000,350],
    ['Bilal Khan','0321-2220002','Accountant',60000,250],
    ['Danish Ali','0333-3330003','Sales Rep',35000,200],
    ['Ehsan Malik','0345-4440004','Sales Rep',35000,200],
    ['Faisal Qureshi','0300-5550005','Delivery Man',30000,150],
    ['Ghulam Mustafa','0321-6660006','Delivery Man',30000,150],
    ['Hamza Butt','0333-7770007','Warehouse Keeper',40000,180],
    ['Imran Haider','0345-8880008','Sales Rep',35000,200],
    ['Junaid Akram','0300-9990009','Driver',28000,140],
    ['Kamran Yousaf','0321-1010001','Driver',28000,140],
    ['Luqman Ali','0333-2020002','Sales Rep',35000,200],
    ['Muhammad Asif','0345-3030003','Delivery Man',32000,160],
    ['Naveed Ahmed','0300-4040004','HR Manager',70000,300],
    ['Omar Farooq','0321-5050005','IT Support',50000,220],
    ['Pervaiz Iqbal','0333-6060006','Sales Rep',35000,200],
    ['Qasim Javed','0345-7070007','Warehouse Helper',25000,120],
    ['Rashid Mehmood','0300-8080008','Driver',28000,140],
    ['Saad Hussain','0321-9090009','Sales Rep',35000,200],
    ['Tariq Aziz','0333-1110001','Delivery Man',32000,160],
    ['Usman Ghani','0345-2220002','Sales Manager',80000,350],
    ['Vaqas Ahmed','0300-3330003','Accountant',55000,250],
    ['Waqar Hassan','0321-4440004','Sales Rep',35000,200],
    ['Yasir Nawaz','0333-5550005','Warehouse Keeper',40000,180],
    ['Zahid Ali','0345-6660006','Driver',28000,140],
    ['Adeel Anwar','0300-7770007','Sales Rep',35000,200],
    ['Babar Sattar','0321-8880008','Delivery Man',32000,160],
    ['Daniyal Sheikh','0333-9990009','IT Support',48000,210],
    ['Ehtisham Ul Haq','0345-0001111','Sales Rep',35000,200],
    ['Faizan Mustafa','0300-1112222','Helper',22000,100],
    ['Gohar Rasheed','0321-2223333','Security Guard',25000,0],
  ];
  const empId = {};
  for (const e of empData) {
    const r = db.prepare('INSERT INTO employees (name,mobile,role,base_salary,ot_rate) VALUES (?,?,?,?,?)').run(e[0],e[1],e[2],e[3],e[4]);
    empId[e[0]] = r.lastInsertRowid;
  }

  // ── Gate Pass Staff ──
  db.prepare("INSERT INTO gate_pass_staff (name,type,mobile) VALUES ('Ashraf Delivery','DELIVERY_MAN','0300-1112233')").run();
  db.prepare("INSERT INTO gate_pass_staff (name,type,mobile) VALUES ('Zahid Sales','SALE_REP','0321-2223344')").run();
  // OGP Areas
  ['North Lahore','South Lahore','DHA','Gulberg','Model Town','Cantt','Shahdara','Township'].forEach(a => db.prepare('INSERT INTO ogp_areas (name) VALUES (?)').run(a));

  // ── Purchases (35) ──
  console.log('[7/12] Purchases...');
  const purchaseCreate = (vendorId, date, inv, items) => {
    const r = db.prepare('INSERT INTO purchases (vendor_id,purchase_date,invoice_no,total_amount) VALUES (?,?,?,0)').run(vendorId,date,inv);
    const pid = r.lastInsertRowid; let total = 0;
    for (const i of items) {
      const lt = i.qty * i.price;
      total += lt;
      db.prepare('INSERT INTO purchase_items (purchase_id,stock_id,quantity,purchase_price,total) VALUES (?,?,?,?,?)').run(pid,i.sid,i.qty,i.price,lt);
      db.prepare('UPDATE stocks SET quantity = quantity + ? WHERE id = ?').run(i.qty,i.sid);
    }
    db.prepare('UPDATE purchases SET total_amount = ? WHERE id = ?').run(total,pid);
    const pb = db.prepare('SELECT COALESCE(SUM(credit-debit),0) as b FROM vendor_ledger WHERE vendor_id=?').get(vendorId).b||0;
    db.prepare('INSERT INTO vendor_ledger (vendor_id,transaction_type,reference_id,reference_type,debit,credit,balance,transaction_date,description) VALUES (?,?,?,?,?,0,?,?,?)').run(vendorId,'PURCHASE',pid,'purchase',total,pb+total,date,`Invoice ${inv}`);
    // Cash outflow
    const cashId = bankIds['Cash in Hand'];
    const cb = db.prepare('SELECT COALESCE(SUM(debit-credit),0) as b FROM cash_bank_transactions WHERE account_id=?').get(cashId).b||0;
    db.prepare('INSERT INTO cash_bank_transactions (account_id,transaction_date,transaction_type,reference_id,reference_type,credit,balance,description) VALUES (?,?,?,?,?,?,?,?)').run(cashId,date,'PURCHASE',pid,'purchase',total,cb-total,`Purchase ${inv}`);
    return pid;
  };

  const allVIds = Object.values(vId);
  const allSIds = Object.values(sId);
  const stockNames = Object.keys(sId);
  for (let i = 1; i <= 35; i++) {
    const vid = pick(allVIds);
    const date = `2026-${String(rand(1,6)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}`;
    const items = [];
    for (let j = 0; j < rand(2,5); j++) {
      items.push({ sid: pick(allSIds), qty: rand(10,150), price: rand(80,2500) });
    }
    purchaseCreate(vid, date, `PUR-${String(i).padStart(4,'0')}`, items);
  }

  // ── Sales (35) ──
  console.log('[8/12] Sales...');
  const saleCreate = (custId, date, gp, bill, items) => {
    const r = db.prepare('INSERT INTO sales (customer_id,sale_date,gate_pass_no,bill_no,total_amount,sale_type,payment_method) VALUES (?,?,?,?,0,?,?)').run(custId,date,gp,bill,'INVOICE',pick(['CASH','CREDIT']));
    const sid = r.lastInsertRowid; let total = 0;
    for (const i of items) {
      const lt = i.qty * i.price;
      total += lt;
      db.prepare('INSERT INTO sale_items (sale_id,stock_id,item_code,product_name,product_rate,product_qty,total) VALUES (?,?,?,?,?,?,?)').run(sid,i.sid,`P${i.sid}`,pick(stockNames),i.price,i.qty,lt);
      db.prepare('UPDATE stocks SET quantity = MAX(0, quantity - ?) WHERE id = ?').run(i.qty,i.sid);
    }
    db.prepare('UPDATE sales SET total_amount = ? WHERE id = ?').run(total,sid);
    if (custId) {
      const cust = db.prepare('SELECT customer_type FROM customers WHERE id=?').get(custId);
      if (cust?.customer_type === 'WHOLESALER') {
        const pb = db.prepare('SELECT COALESCE(SUM(debit-credit),0) as b FROM customer_ledger WHERE customer_id=?').get(custId).b||0;
        db.prepare('INSERT INTO customer_ledger (customer_id,transaction_type,reference_id,reference_type,debit,credit,balance,transaction_date,description) VALUES (?,?,?,?,?,0,?,?,?)').run(custId,'SALE',sid,'sale',total,pb+total,date,`Sale ${bill}`);
      }
    }
    // Cash inflow
    const cashId = bankIds['Cash in Hand'];
    const cb = db.prepare('SELECT COALESCE(SUM(debit-credit),0) as b FROM cash_bank_transactions WHERE account_id=?').get(cashId).b||0;
    db.prepare('INSERT INTO cash_bank_transactions (account_id,transaction_date,transaction_type,reference_id,reference_type,debit,balance,description) VALUES (?,?,?,?,?,?,?,?)').run(cashId,date,'SALE',sid,'sale',total,cb+total,`Sale ${bill}`);
    return sid;
  };

  const allCIds = Object.values(cId);
  for (let i = 1; i <= 35; i++) {
    const cid = pick(allCIds);
    const date = `2026-${String(rand(3,6)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}`;
    const items = [];
    for (let j = 0; j < rand(2,6); j++) {
      items.push({ sid: pick(allSIds), qty: rand(1,30), price: rand(100,3500) });
    }
    saleCreate(cid, date, `GP-${String(i).padStart(4,'0')}`, `BILL-${String(i).padStart(4,'0')}`, items);
  }

  // ── Purchase Returns (5) ──
  console.log('[9/12] Purchase Returns...');
  for (let i = 1; i <= 5; i++) {
    const pid = rand(1,35);
    const date = `2026-${String(rand(4,6)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}`;
    const items = [{sid: pick(allSIds), qty: rand(2,15), price: rand(100,1500)}];
    const total = items.reduce((s,i)=>s+i.qty*i.price,0);
    const r = db.prepare('INSERT INTO purchase_returns (purchase_id,return_date,total_amount,reason) VALUES (?,?,?,?)').run(pid,date,total,'Damaged goods');
    for (const i of items) {
      db.prepare('INSERT INTO purchase_return_items (purchase_return_id,stock_id,quantity,price,total) VALUES (?,?,?,?,?)').run(r.lastInsertRowid,i.sid,i.qty,i.price,i.qty*i.price);
      db.prepare('UPDATE stocks SET quantity = MAX(0, quantity - ?) WHERE id = ?').run(i.qty,i.sid);
    }
  }

  // ── Sale Returns (5) ──
  for (let i = 1; i <= 5; i++) {
    const sid = rand(1,35);
    const date = `2026-${String(rand(4,6)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}`;
    const items = [{sid: pick(allSIds), qty: rand(1,10), price: rand(150,2000)}];
    const total = items.reduce((s,i)=>s+i.qty*i.price,0);
    const r = db.prepare('INSERT INTO sale_returns (sale_id,return_date,total_amount,reason) VALUES (?,?,?,?)').run(sid,date,total,'Customer rejected');
    for (const i of items) {
      db.prepare('INSERT INTO sale_return_items (sale_return_id,stock_id,quantity,price,total) VALUES (?,?,?,?,?)').run(r.lastInsertRowid,i.sid,i.qty,i.price,i.qty*i.price);
      db.prepare('UPDATE stocks SET quantity = quantity + ? WHERE id = ?').run(i.qty,i.sid);
    }
  }

  // ── Receipts (15) ──
  console.log('[10/12] Receipts...');
  for (let i = 1; i <= 15; i++) {
    const cid = pick(allCIds);
    const date = `2026-${String(rand(4,6)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}`;
    const amt = rand(2000,50000);
    const bankId = pick(Object.values(bankIds));
    db.prepare('INSERT INTO receipts (receipt_no,receipt_date,customer_id,amount,payment_method,bank_account_id,notes) VALUES (?,?,?,?,?,?,?)').run(`RCP-${String(i).padStart(4,'0')}`,date,cid,amt,'CASH',bankId,`Payment received`);
    // Cash inflow
    const cb = db.prepare('SELECT COALESCE(SUM(debit-credit),0) as b FROM cash_bank_transactions WHERE account_id=?').get(bankId).b||0;
    db.prepare('INSERT INTO cash_bank_transactions (account_id,transaction_date,transaction_type,reference_id,reference_type,debit,balance,description) VALUES (?,?,?,?,?,?,?,?)').run(bankId,date,'RECEIPT',i,'receipt',amt,cb+amt,`Receipt RCP-${String(i).padStart(4,'0')}`);
  }

  // ── Vendor Payments (12) ──
  for (let i = 1; i <= 12; i++) {
    const vid = pick(allVIds);
    const date = `2026-${String(rand(4,6)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}`;
    const amt = rand(5000,60000);
    const bankId = pick(Object.values(bankIds));
    db.prepare('INSERT INTO vendor_payments (payment_no,payment_date,vendor_id,amount,payment_method,bank_account_id,notes) VALUES (?,?,?,?,?,?,?)').run(`VPM-${String(i).padStart(4,'0')}`,date,vid,amt,'CASH',bankId,`Vendor payment`);
    const cb = db.prepare('SELECT COALESCE(SUM(debit-credit),0) as b FROM cash_bank_transactions WHERE account_id=?').get(bankId).b||0;
    db.prepare('INSERT INTO cash_bank_transactions (account_id,transaction_date,transaction_type,reference_id,reference_type,credit,balance,description) VALUES (?,?,?,?,?,?,?,?)').run(bankId,date,'VENDOR_PAYMENT',i,'vendor_payment',amt,cb-amt,`Payment VPM-${String(i).padStart(4,'0')}`);
  }

  // ── Expenses (30) ──
  console.log('[11/12] Expenses...');
  const expenseCategories = ['Rent','Utilities','Salaries','Transport','Marketing','Office Supplies','Maintenance','Insurance','Internet','Phone','Travel','Entertainment','Training','Miscellaneous'];
  for (let i = 1; i <= 30; i++) {
    const cat = pick(expenseCategories);
    const date = `2026-${String(rand(1,6)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}`;
    const amt = rand(500,25000);
    const bankId = pick(Object.values(bankIds));
    db.prepare('INSERT INTO expenses (expense_no,expense_date,category,description,amount,payment_method,bank_account_id,notes) VALUES (?,?,?,?,?,?,?,?)').run(`EXP-${String(i).padStart(4,'0')}`,date,cat,`${cat} expense`,amt,'CASH',bankId,`Monthly ${cat.toLowerCase()} payment`);
    const cb = db.prepare('SELECT COALESCE(SUM(debit-credit),0) as b FROM cash_bank_transactions WHERE account_id=?').get(bankId).b||0;
    db.prepare('INSERT INTO cash_bank_transactions (account_id,transaction_date,transaction_type,reference_id,reference_type,credit,balance,description) VALUES (?,?,?,?,?,?,?,?)').run(bankId,date,'EXPENSE',i,'expense',amt,cb-amt,`Expense EXP-${String(i).padStart(4,'0')}`);
  }

  // ── Gate Passes / OGP (15) ──
  console.log('[12/12] Gate Passes...');
  for (let i = 1; i <= 15; i++) {
    const cid = pick(allCIds);
    const date = `2026-${String(rand(4,6)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}`;
    const r = db.prepare("INSERT INTO gate_passes (ogp_number,ogp_date,customer_id,sale_rep,delivery_man,total_qty,total_amount,remarks,status,area) VALUES (?,?,?,?,?,?,?,?,?,?)").run(i,date,cid,'Zahid Sales','Ashraf Delivery',rand(5,50),rand(5000,100000),pick(['Urgent','Normal','']),pick(['OPEN','CLOSED','OPEN']),pick(['North Lahore','DHA','Gulberg','Model Town']));
    // Add items
    for (let j = 0; j < rand(1,4); j++) {
      const sid = pick(allSIds);
      db.prepare('INSERT INTO gate_pass_items (gate_pass_id,stock_id,item_code,item_description,quantity,rate,total) VALUES (?,?,?,?,?,?,?)').run(r.lastInsertRowid,sid,`P${sid}`,pick(stockNames),rand(1,20),rand(100,2000),rand(500,5000));
    }
  }

  console.log('\n✅ Demo data seeded successfully!');
  console.log('   Vendors: 35 | Customers: 35 | Stocks: 35 | Employees: 30');
  console.log('   Purchases: 35 | Sales: 35 | Purchase Returns: 5 | Sale Returns: 5');
  console.log('   Receipts: 15 | Vendor Payments: 12 | Expenses: 30 | Gate Passes: 15');
  console.log('   Bank Accounts: 4');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
