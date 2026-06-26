const db = require('../db/db');

function getTrialBalance() {
  const vendors = db.prepare(
    `SELECT v.id, v.company_name as account_name, 'VENDOR' as account_type,
            COALESCE(SUM(CASE WHEN vl.debit > 0 THEN vl.debit ELSE 0 END), 0) as debit,
            COALESCE(SUM(CASE WHEN vl.credit > 0 THEN vl.credit ELSE 0 END), 0) as credit
     FROM vendors v LEFT JOIN vendor_ledger vl ON v.id = vl.vendor_id
     GROUP BY v.id, v.company_name`
  ).all();
  const customers = db.prepare(
    `SELECT c.id, c.shop_name as account_name, 'CUSTOMER' as account_type,
            COALESCE(SUM(CASE WHEN cl.debit > 0 THEN cl.debit ELSE 0 END), 0) as debit,
            COALESCE(SUM(CASE WHEN cl.credit > 0 THEN cl.credit ELSE 0 END), 0) as credit
     FROM customers c LEFT JOIN customer_ledger cl ON c.id = cl.customer_id
     WHERE c.customer_type = 'WHOLESALER' GROUP BY c.id, c.shop_name`
  ).all();
  return { vendors, customers };
}

function getInventoryReport() {
  return db.prepare('SELECT * FROM stocks ORDER BY company_name, product_name').all();
}

function getPurchaseReport(startDate, endDate) {
  return db.prepare(
    `SELECT p.id, p.purchase_date, p.invoice_no, v.company_name, s.product_name,
            pi.quantity, pi.purchase_price, pi.total
     FROM purchases p JOIN vendors v ON p.vendor_id = v.id
     JOIN purchase_items pi ON p.id = pi.purchase_id JOIN stocks s ON pi.stock_id = s.id
     WHERE p.purchase_date BETWEEN ? AND ? ORDER BY p.purchase_date DESC`
  ).all(startDate, endDate);
}

function getSalesReport(startDate, endDate) {
  return db.prepare(
    `SELECT s.id, s.sale_date, s.gate_pass_no, s.bill_no,
            COALESCE(c.shop_name, 'Direct Sale') as customer_name,
            st.product_name, si.product_qty, si.product_rate, si.total
     FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
     JOIN sale_items si ON s.id = si.sale_id JOIN stocks st ON si.stock_id = st.id
     WHERE s.sale_date BETWEEN ? AND ? ORDER BY s.sale_date DESC`
  ).all(startDate, endDate);
}

module.exports = { getTrialBalance, getInventoryReport, getPurchaseReport, getSalesReport };
