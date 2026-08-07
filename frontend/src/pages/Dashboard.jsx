import { useEffect, useState } from 'react'
import api from '../api'
import { Card, StatCard, PageHeader, Spinner, Badge, Alert, Empty } from '../components/ui'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const rsShort = (n) => {
  n = Number(n || 0)
  return `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const pct = (current, prev) => {
  if (!prev || prev === 0) return null
  return ((current - prev) / prev * 100).toFixed(1)
}

const MONTH = new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })
const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ fontWeight: 600, color: '#334155', marginBottom: 6 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, margin: 0 }}>
          {p.name}: {rsShort(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [trendDays, setTrendDays] = useState(30)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    api.get('/dashboard/overview')
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: '48px 32px', display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8' }}>
      <Spinner size={20} /> Loading dashboard…
    </div>
  )

  if (!data) return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <Alert type="error">Failed to load dashboard data.</Alert>
    </div>
  )

  const s = data.stats || {}
  const revenueChange  = pct(s.thisMonthSales, s.lastMonthSales)
  const purchaseChange = pct(s.thisMonthPurchases, s.lastMonthPurchases)
  const profitChange   = pct(s.grossProfit, s.lastMonthGrossProfit)

  const trendData = trendDays === 7
    ? (data.trend || []).slice(-7)
    : (data.trend || [])

  const pctChange = (change) => {
    if (change === null || change === undefined) return null
    const up = Number(change) > 0
    const down = Number(change) < 0
    return (
      <span style={{ fontSize: 11, fontWeight: 600, color: up ? '#10b981' : down ? '#ef4444' : '#94a3b8' }}>
        {up ? '▲' : down ? '▼' : '—'} {Math.abs(change)}% vs last month
      </span>
    )
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>

      <PageHeader
        title="Business Dashboard"
        subtitle={`Welcome back, ${user.fullName || user.username} · ${MONTH}`}
        actions={
          <>
            <Badge color="blue">{s.totalStocks} Stocks</Badge>
            <Badge color="green">{s.totalCustomers} Customers</Badge>
            <Badge color="purple">{s.totalVendors} Vendors</Badge>
            <Badge color="amber">{s.openGatePasses} Open OGPs</Badge>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard
          label="Revenue"
          value={rsShort(s.thisMonthSales)}
          sub={pctChange(revenueChange) || `${s.thisMonthSalesCount} invoices`}
          accent="#10b981"
        />
        <StatCard
          label="Purchases"
          value={rsShort(s.thisMonthPurchases)}
          sub={pctChange(purchaseChange) || `${s.thisMonthPurchasesCount} orders`}
          accent="#ef4444"
        />
        <StatCard
          label="Gross Profit"
          value={rsShort(s.grossProfit)}
          sub={s.thisMonthSales > 0 ? `${((s.grossProfit / s.thisMonthSales) * 100).toFixed(1)}% margin` : 'No sales yet'}
          accent={s.grossProfit >= 0 ? '#3b82f6' : '#ef4444'}
        />
        <StatCard
          label="Receivables"
          value={rsShort(s.receivablesTotal)}
          sub={`${s.receivablesCount} customers pending`}
          accent="#f59e0b"
        />
        <StatCard
          label="Payables"
          value={rsShort(s.payablesTotal)}
          sub={`${s.payablesCount} vendors pending`}
          accent="#8b5cf6"
        />
        <StatCard
          label="Cash & Bank"
          value={rsShort(s.cashBankTotal)}
          sub={`${(data.cashBankAccounts || []).length} accounts`}
          accent="#0d9488"
        />
      </div>

      {(s.lowStockCount > 0 || s.receivablesTotal > 0 || s.payablesTotal > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {s.lowStockCount > 0 && (
            <Alert type="warning">
              <strong>Low Stock Alert</strong> — {s.lowStockCount} items at or below 10 units
            </Alert>
          )}
          {s.receivablesTotal > 0 && (
            <Alert type="info">
              <strong>Outstanding Receivables</strong> — {rs(s.receivablesTotal)} owed by {s.receivablesCount} customers
            </Alert>
          )}
          {s.payablesTotal > 0 && (
            <Alert type="warning">
              <strong>Outstanding Payables</strong> — {rs(s.payablesTotal)} owed to {s.payablesCount} vendors
            </Alert>
          )}
        </div>
      )}

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Stock Value</p>
            <p style={{ fontSize: 11, color: '#cbd5e1', margin: '2px 0 0' }}>For stock-take check &amp; balance — value of everything currently in stock</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 1.4fr', gap: 14 }}>
          <StatCard label="Total Quantity" value={Number(s.totalStockQty || 0).toLocaleString('en-PK')} sub="units across all items" accent="#0d9488" />
          <StatCard label="Stock Value (Cost)" value={rsShort(s.stockValueCost)} sub="what you paid for it" accent="#3b82f6" />
          <StatCard label="Stock Value (Retail)" value={rsShort(s.stockValueRetail)} sub="if sold at listed price" accent="#10b981" />
          <Card style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Top Value Items</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 92, overflowY: 'auto' }}>
              {(data.topStockByValue || []).length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>No stock value yet</p>
              ) : (data.topStockByValue || []).slice(0, 4).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ color: '#334155', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.product_name} <span style={{ color: '#94a3b8' }}>({item.company_name})</span>
                  </span>
                  <span style={{ fontWeight: 700, color: '#3b82f6' }}>{rsShort(item.value)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Sales &amp; Purchases Trend</p>
              <p style={{ fontSize: 11, color: '#cbd5e1', margin: '2px 0 0' }}>Daily totals</p>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[7, 30].map(d => (
                <button key={d} onClick={() => setTrendDays(d)} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500, border: 'none', cursor: 'pointer',
                  background: trendDays === d ? '#1e293b' : '#f1f5f9',
                  color: trendDays === d ? '#fff' : '#64748b',
                }}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                interval={trendDays === 30 ? 4 : 0} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                tickFormatter={v => rsShort(v).replace('Rs. ', '')} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="sales" name="Sales" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="purchases" name="Purchases" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 5 }} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Cash &amp; Bank Accounts</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(data.cashBankAccounts || []).length === 0 ? (
              <Empty message="No accounts found" />
            ) : (data.cashBankAccounts || []).map((acc, i) => {
              const maxBal = Math.max(...(data.cashBankAccounts || []).map(a => Math.abs(a.balance)), 1)
              const pctBar = Math.min((Math.abs(acc.balance) / maxBal) * 100, 100)
              return (
                <div key={acc.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#334155', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.account_name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: acc.balance >= 0 ? '#0d9488' : '#ef4444' }}>{rs(acc.balance)}</span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, width: `${pctBar}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </div>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{acc.account_type}</p>
                </div>
              )
            })}
          </div>
          {(data.cashBankAccounts || []).length > 0 && (
            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 14, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: s.cashBankTotal >= 0 ? '#0d9488' : '#ef4444' }}>{rs(s.cashBankTotal)}</span>
            </div>
          )}
        </Card>
      </div>

      {(data.topCustomers || []).length > 0 && (
        <Card style={{ padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Top Companies by Revenue (All Time)</p>
          <ResponsiveContainer width="100%" height={Math.max(160, (data.topCustomers || []).length * 52)}>
            <BarChart data={data.topCustomers} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" onWheel={e => e.target.blur()} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                tickFormatter={v => rsShort(v).replace('Rs. ', '')} />
              <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11, fill: '#334155' }}
                tickLine={false} axisLine={false}
                tickFormatter={v => v.length > 24 ? v.slice(0, 24) + '…' : v} />
              <Tooltip formatter={(v, n) => [rs(v), n === 'revenue' ? 'Revenue' : n]} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {(data.topCustomers || []).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Recent Sales</p>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>All time: {rsShort(s.totalSalesAmount)}</span>
          </div>
          <table className="db-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Customer</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(data.recentSales || []).length === 0 ? (
                <tr><td colSpan={4}><Empty message="No recent sales" /></td></tr>
              ) : (data.recentSales || []).map(sale => (
                <tr key={sale.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563eb', fontWeight: 600 }}>{sale.bill_no || `#${sale.id}`}</td>
                  <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sale.customer}</td>
                  <td style={{ color: '#94a3b8', fontSize: 11 }}>{sale.sale_date?.slice(0, 10)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: 11 }}>{rsShort(sale.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Recent Purchases</p>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>All time: {rsShort(s.totalPurchasesAmount)}</span>
          </div>
          <table className="db-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Vendor</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(data.recentPurchases || []).length === 0 ? (
                <tr><td colSpan={4}><Empty message="No recent purchases" /></td></tr>
              ) : (data.recentPurchases || []).map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>{p.invoice_no || `#${p.id}`}</td>
                  <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.company_name}</td>
                  <td style={{ color: '#94a3b8', fontSize: 11 }}>{p.purchase_date?.slice(0, 10)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444', fontSize: 11 }}>{rsShort(p.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <Card style={{ padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Top Customers</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data.topCustomers || []).length === 0 ? <Empty message="No data yet" /> : (data.topCustomers || []).map((c, i) => {
              const maxRev = data.topCustomers[0]?.revenue || 1
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#334155', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>{rsShort(c.revenue)}</span>
                  </div>
                  <div style={{ height: 5, background: '#f1f5f9', borderRadius: 4 }}>
                    <div style={{ height: '100%', background: '#10b981', borderRadius: 4, width: `${(c.revenue / maxRev) * 100}%` }} />
                  </div>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{c.orders} orders</p>
                </div>
              )
            })}
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Top Vendors</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data.topVendors || []).length === 0 ? <Empty message="No data yet" /> : (data.topVendors || []).map((v, i) => {
              const maxAmt = data.topVendors[0]?.total || 1
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#334155', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>{rsShort(v.total)}</span>
                  </div>
                  <div style={{ height: 5, background: '#f1f5f9', borderRadius: 4 }}>
                    <div style={{ height: '100%', background: '#ef4444', borderRadius: 4, width: `${(v.total / maxAmt) * 100}%` }} />
                  </div>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{v.orders} orders</p>
                </div>
              )
            })}
          </div>
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: s.lowStockCount > 0 ? '#fef2f2' : 'transparent' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {s.lowStockCount > 0 ? 'Low Stock Items' : 'Stock Levels OK'}
            </span>
            <Badge color={s.lowStockCount > 0 ? 'red' : 'green'}>{s.lowStockCount} items</Badge>
          </div>
          {s.lowStockCount === 0 ? (
            <div style={{ padding: 24 }}><Empty message="All stock items above 10 units" /></div>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {(data.lowStock || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#334155', margin: 0 }}>{item.product_name}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{item.company_name}</p>
                  </div>
                  <Badge color={item.quantity <= 0 ? 'red' : 'amber'}>
                    {item.quantity} {item.packing_unit || 'pcs'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

    </div>
  )
}
