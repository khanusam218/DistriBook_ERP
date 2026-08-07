const db = require('../db/db');

exports.getOverview = async (req, res) => {
  try {
    // Date boundaries computed in JS (not DB-specific functions like MySQL's
    // DATE_FORMAT/DATE_SUB/CURDATE, which don't exist in SQLite) so this query
    // set works identically against either database engine.
    const now = new Date();
    const fmtDate = (d) => d.toISOString().slice(0, 10);
    const thisMonthStart = fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const nextMonthStart = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    const lastMonthStart = fmtDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    // ── Monthly KPIs ──────────────────────────────────────────────────────────
    const thisMonthSales = await db.prepare(
      `SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM sales WHERE sale_date >= ? AND sale_date < ?`
    ).get(thisMonthStart, nextMonthStart);
    const lastMonthSales = await db.prepare(
      `SELECT COALESCE(SUM(total_amount),0) as total FROM sales WHERE sale_date >= ? AND sale_date < ?`
    ).get(lastMonthStart, thisMonthStart);
    const thisMonthPurchases = await db.prepare(
      `SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM purchases WHERE purchase_date >= ? AND purchase_date < ?`
    ).get(thisMonthStart, nextMonthStart);
    const lastMonthPurchases = await db.prepare(
      `SELECT COALESCE(SUM(total_amount),0) as total FROM purchases WHERE purchase_date >= ? AND purchase_date < ?`
    ).get(lastMonthStart, thisMonthStart);

    // ── All-time totals ──────────────────────────────────────────────────────
    const totalStocks    = (await db.prepare('SELECT COUNT(*) as c FROM stocks').get()).c;
    const totalCustomers = (await db.prepare('SELECT COUNT(*) as c FROM customers').get()).c;
    const totalVendors   = (await db.prepare('SELECT COUNT(*) as c FROM vendors').get()).c;
    const totalSales     = await db.prepare('SELECT COUNT(*) as c, COALESCE(SUM(total_amount),0) as t FROM sales').get();
    const totalPurchases = await db.prepare('SELECT COUNT(*) as c, COALESCE(SUM(total_amount),0) as t FROM purchases').get();

    // ── Cash & Bank ───────────────────────────────────────────────────────────
    const cashBankAccounts = await db.prepare(`
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

    // ── Receivables (customers who owe us) ───────────────────────────────────
    const receivablesRows = await db.prepare(`
      SELECT c.id, c.opening_balance + COALESCE(
        (SELECT SUM(debit - credit) FROM customer_ledger
         WHERE customer_id = c.id AND transaction_type != 'OPENING_BALANCE'), 0
      ) as bal FROM customers c
    `).all();
    const receivablesTotal = receivablesRows.filter(r => r.bal > 0).reduce((s, r) => s + r.bal, 0);
    const receivablesCount = receivablesRows.filter(r => r.bal > 0).length;

    // ── Payables (we owe vendors) ────────────────────────────────────────────
    const payablesRows = await db.prepare(`
      SELECT v.id, v.opening_balance + COALESCE(
        (SELECT SUM(debit - credit) FROM vendor_ledger
         WHERE vendor_id = v.id AND transaction_type != 'OPENING_BALANCE'), 0
      ) as bal FROM vendors v
    `).all();
    const payablesTotal = payablesRows.filter(r => r.bal > 0).reduce((s, r) => s + r.bal, 0);
    const payablesCount = payablesRows.filter(r => r.bal > 0).length;

    // ── 30-day daily trend ────────────────────────────────────────────────────
    const trendCutoff = fmtDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    const salesTrendRaw = await db.prepare(`
      SELECT DATE(sale_date) as day, COALESCE(SUM(total_amount),0) as sales
      FROM sales WHERE sale_date >= ?
      GROUP BY day ORDER BY day
    `).all(trendCutoff);
    const purchaseTrendRaw = await db.prepare(`
      SELECT DATE(purchase_date) as day, COALESCE(SUM(total_amount),0) as purchases
      FROM purchases WHERE purchase_date >= ?
      GROUP BY day ORDER BY day
    `).all(trendCutoff);

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
    salesTrendRaw.forEach(r => { const key = String(r.day).slice(0, 10); if (trendMap[key]) trendMap[key].sales = Math.round(r.sales); });
    purchaseTrendRaw.forEach(r => { const key = String(r.day).slice(0, 10); if (trendMap[key]) trendMap[key].purchases = Math.round(r.purchases); });
    const trend = Object.values(trendMap);

    // ── Top products by revenue ──────────────────────────────────────────────
    const topProducts = await db.prepare(`
      SELECT st.product_name as name, st.company_name as brand,
        COALESCE(SUM(si.total), 0) as revenue,
        COALESCE(SUM(si.product_qty), 0) as qty
      FROM sale_items si JOIN stocks st ON si.stock_id = st.id
      GROUP BY si.stock_id ORDER BY revenue DESC LIMIT 6
    `).all();

    // ── Top customers ─────────────────────────────────────────────────────────
    const topCustomers = await db.prepare(`
      SELECT COALESCE(c.shop_name, s.customer_name, 'Walk-in') as name,
        COALESCE(SUM(s.total_amount), 0) as revenue, COUNT(*) as orders
      FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
      GROUP BY COALESCE(c.id, s.customer_name)
      ORDER BY revenue DESC LIMIT 6
    `).all();

    // ── Top vendors by purchase ──────────────────────────────────────────────
    const topVendors = await db.prepare(`
      SELECT v.company_name as name,
        COALESCE(SUM(p.total_amount), 0) as total, COUNT(*) as orders
      FROM purchases p JOIN vendors v ON p.vendor_id = v.id
      GROUP BY p.vendor_id ORDER BY total DESC LIMIT 6
    `).all();

    // ── Low stock items ───────────────────────────────────────────────────────
    const lowStock = await db.prepare(`
      SELECT company_name, product_name, quantity, packing_unit
      FROM stocks WHERE quantity <= 10 ORDER BY quantity ASC LIMIT 10
    `).all();

    // ── Stock value (for check & balance / stocktake reconciliation) ────────
    const allStockRows = await db.prepare(
      'SELECT company_name, product_name, quantity, purchase_price, sale_price, packing_unit FROM stocks'
    ).all();
    const totalStockQty = allStockRows.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const stockValueCost = allStockRows.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.purchase_price || 0), 0);
    const stockValueRetail = allStockRows.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.sale_price || 0), 0);
    const topStockByValue = allStockRows
      .map(r => ({
        company_name: r.company_name,
        product_name: r.product_name,
        quantity: r.quantity,
        packing_unit: r.packing_unit,
        value: Number(r.quantity || 0) * Number(r.purchase_price || 0),
      }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // ── Open gate passes ──────────────────────────────────────────────────────
    const openGatePasses = (await db.prepare(
      `SELECT COUNT(*) as c FROM gate_passes WHERE status = 'OPEN' OR status IS NULL`
    ).get()).c;

    // ── Recent transactions ───────────────────────────────────────────────────
    const recentSales = await db.prepare(`
      SELECT s.id, s.sale_date, s.bill_no, s.total_amount, s.sale_type,
        COALESCE(c.shop_name, s.customer_name, 'Walk-in') as customer
      FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.id DESC LIMIT 6
    `).all();

    const recentPurchases = await db.prepare(`
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
        totalStockQty, stockValueCost, stockValueRetail,
      },
      cashBankAccounts,
      trend,
      topProducts,
      topCustomers,
      topVendors,
      lowStock,
      topStockByValue,
      recentSales,
      recentPurchases,
    });
  } catch (error) {
    console.error('dashboard getOverview error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};
