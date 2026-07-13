const db = require('../db/db');

exports.getOverview = (req, res) => {
  try {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);

    // â”€â”€ Monthly KPIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const thisMonthSales = db.prepare(
      `SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM sales WHERE strftime('%Y-%m', sale_date) = ?`
    ).get(thisMonth);
    const lastMonthSales = db.prepare(
      `SELECT COALESCE(SUM(total_amount),0) as total FROM sales WHERE strftime('%Y-%m', sale_date) = ?`
    ).get(lastMonth);
    const thisMonthPurchases = db.prepare(
      `SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM purchases WHERE strftime('%Y-%m', purchase_date) = ?`
    ).get(thisMonth);
    const lastMonthPurchases = db.prepare(
      `SELECT COALESCE(SUM(total_amount),0) as total FROM purchases WHERE strftime('%Y-%m', purchase_date) = ?`
    ).get(lastMonth);

    // â”€â”€ All-time totals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const totalStocks    = db.prepare('SELECT COUNT(*) as c FROM stocks').get().c;
    const totalCustomers = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
    const totalVendors   = db.prepare('SELECT COUNT(*) as c FROM vendors').get().c;
    const totalSales     = db.prepare('SELECT COUNT(*) as c, COALESCE(SUM(total_amount),0) as t FROM sales').get();
    const totalPurchases = db.prepare('SELECT COUNT(*) as c, COALESCE(SUM(total_amount),0) as t FROM purchases').get();

    // â”€â”€ Cash & Bank â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const cashBankAccounts = db.prepare(`
      SELECT b.id, b.account_name, b.account_type,
        ROUND(b.opening_balance + COALESCE(t.net, 0), 2) as balance
      FROM bank_accounts b
      LEFT JOIN (
        SELECT account_id, SUM(debit) - SUM(credit) as net
        FROM cash_bank_transactions GROUP BY account_id
      ) t ON t.account_id = b.id
      ORDER BY b.account_type, b.account_name
    `).all();
    const cashBankTotal = cashBankAccounts.reduce((s, a) => s + (a.balance || 0), 0);

    // â”€â”€ Receivables (customers who owe us) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const receivablesRows = db.prepare(`
      SELECT c.id, c.opening_balance + COALESCE(
        (SELECT SUM(debit - credit) FROM customer_ledger
         WHERE customer_id = c.id AND transaction_type != 'OPENING_BALANCE'), 0
      ) as bal FROM customers c
    `).all();
    const receivablesTotal = receivablesRows.filter(r => r.bal > 0).reduce((s, r) => s + r.bal, 0);
    const receivablesCount = receivablesRows.filter(r => r.bal > 0).length;

    // â”€â”€ Payables (we owe vendors) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const payablesRows = db.prepare(`
      SELECT v.id, v.opening_balance + COALESCE(
        (SELECT SUM(debit - credit) FROM vendor_ledger
         WHERE vendor_id = v.id AND transaction_type != 'OPENING_BALANCE'), 0
      ) as bal FROM vendors v
    `).all();
    const payablesTotal = payablesRows.filter(r => r.bal > 0).reduce((s, r) => s + r.bal, 0);
    const payablesCount = payablesRows.filter(r => r.bal > 0).length;

    // â”€â”€ 30-day daily trend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const salesTrendRaw = db.prepare(`
      SELECT date(sale_date) as day, COALESCE(SUM(total_amount),0) as sales
      FROM sales WHERE sale_date >= date('now','-29 days')
      GROUP BY day ORDER BY day
    `).all();
    const purchaseTrendRaw = db.prepare(`
      SELECT date(purchase_date) as day, COALESCE(SUM(total_amount),0) as purchases
      FROM purchases WHERE purchase_date >= date('now','-29 days')
      GROUP BY day ORDER BY day
    `).all();

    // Build full 30-day array (zero-fill gaps)
    const trendMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trendMap[key] = {
        day: key,
        label: d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }),
        sales: 0, purchases: 0,
      };
    }
    salesTrendRaw.forEach(r => { if (trendMap[r.day]) trendMap[r.day].sales = Math.round(r.sales); });
    purchaseTrendRaw.forEach(r => { if (trendMap[r.day]) trendMap[r.day].purchases = Math.round(r.purchases); });
    const trend = Object.values(trendMap);

    // â”€â”€ Top products by revenue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const topProducts = db.prepare(`
      SELECT st.product_name as name, st.company_name as brand,
        COALESCE(SUM(si.total), 0) as revenue,
        COALESCE(SUM(si.product_qty), 0) as qty
      FROM sale_items si JOIN stocks st ON si.stock_id = st.id
      GROUP BY si.stock_id ORDER BY revenue DESC LIMIT 6
    `).all();

    // â”€â”€ Top customers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const topCustomers = db.prepare(`
      SELECT COALESCE(c.shop_name, s.customer_name, 'Walk-in') as name,
        COALESCE(SUM(s.total_amount), 0) as revenue, COUNT(*) as orders
      FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
      GROUP BY COALESCE(c.id, s.customer_name)
      ORDER BY revenue DESC LIMIT 6
    `).all();

    // â”€â”€ Top vendors by purchase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const topVendors = db.prepare(`
      SELECT v.company_name as name,
        COALESCE(SUM(p.total_amount), 0) as total, COUNT(*) as orders
      FROM purchases p JOIN vendors v ON p.vendor_id = v.id
      GROUP BY p.vendor_id ORDER BY total DESC LIMIT 6
    `).all();

    // â”€â”€ Low stock items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const lowStock = db.prepare(`
      SELECT company_name, product_name, quantity, packing_unit
      FROM stocks WHERE quantity <= 10 ORDER BY quantity ASC LIMIT 10
    `).all();

    // â”€â”€ Open gate passes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const openGatePasses = db.prepare(
      `SELECT COUNT(*) as c FROM gate_passes WHERE status = 'OPEN' OR status IS NULL`
    ).get().c;

    // â”€â”€ Recent transactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const recentSales = db.prepare(`
      SELECT s.id, s.sale_date, s.bill_no, s.total_amount, s.sale_type,
        COALESCE(c.shop_name, s.customer_name, 'Walk-in') as customer
      FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.id DESC LIMIT 6
    `).all();

    const recentPurchases = db.prepare(`
      SELECT p.id, p.purchase_date, p.invoice_no, p.total_amount, v.company_name
      FROM purchases p JOIN vendors v ON p.vendor_id = v.id
      ORDER BY p.id DESC LIMIT 6
    `).all();

    res.json({
      stats: {
        totalStocks, totalCustomers, totalVendors,
        totalSales: totalSales.c, totalSalesAmount: totalSales.t,
        totalPurchases: totalPurchases.c, totalPurchasesAmount: totalPurchases.t,
        thisMonthSales: thisMonthSales.total,
        thisMonthSalesCount: thisMonthSales.count,
        lastMonthSales: lastMonthSales.total,
        thisMonthPurchases: thisMonthPurchases.total,
        thisMonthPurchasesCount: thisMonthPurchases.count,
        lastMonthPurchases: lastMonthPurchases.total,
        grossProfit: thisMonthSales.total - thisMonthPurchases.total,
        lastMonthGrossProfit: lastMonthSales.total - lastMonthPurchases.total,
        cashBankTotal,
        receivablesTotal, receivablesCount,
        payablesTotal, payablesCount,
        openGatePasses,
        lowStockCount: lowStock.length,
      },
      cashBankAccounts,
      trend,
      topProducts,
      topCustomers,
      topVendors,
      lowStock,
      recentSales,
      recentPurchases,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};
