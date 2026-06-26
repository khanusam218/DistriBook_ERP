import { useState, useEffect } from 'react'
import api from '../api'
import { exportPDF, exportExcel, printTable, ExportBar } from '../utils/exportUtils'
import { Btn, Input, Select, Card, Empty, ConfirmModal, Table, FormGrid, PageHeader, SectionLabel, Icon, Spinner } from '../components/ui'

const LIST_COLS = [
  { header: 'Return Date', accessor: r => r.return_date },
  { header: 'Bill No.', accessor: r => r.bill_no || '-' },
  { header: 'Customer', accessor: r => r.shop_name || 'Direct Sale' },
  { header: 'Total Amount', accessor: r => `Rs. ${Number(r.total_amount).toFixed(2)}` },
  { header: 'Reason', accessor: r => r.reason || '-' },
]

export default function SaleReturns() {
  const [returns, setReturns] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({ saleId: '', returnDate: today(), reason: '' })
  const [saleDetail, setSaleDetail] = useState(null)
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  function today() { return new Date().toISOString().split('T')[0] }

  const load = () => Promise.all([api.get('/sale-returns'), api.get('/sales')])
    .then(([r, s]) => { setReturns(r.data); setSales(s.data); setLoading(false) })

  useEffect(() => { load() }, [])

  const loadSale = async (saleId) => {
    if (!saleId) { setSaleDetail(null); setItems([]); return }
    const r = await api.get(`/sales/${saleId}`)
    setSaleDetail(r.data)
    setItems(r.data.items?.map(i => ({ stockId: i.stock_id, productName: i.product_name, maxQty: i.product_qty, quantity: '', price: i.product_rate })) || [])
  }

  const save = async () => {
    const toReturn = items.filter(i => Number(i.quantity) > 0)
    if (!form.saleId) return alert('Select a sale')
    if (toReturn.length === 0) return alert('Enter quantity for at least one item')
    setSaving(true)
    try {
      await api.post('/sale-returns', { ...form, items: toReturn.map(i => ({ stockId: i.stockId, quantity: Number(i.quantity), price: Number(i.price) })) })
      await load(); setView('list')
    } catch (e) { alert(e.response?.data?.error || 'Error') }
    setSaving(false)
  }

  const openDetail = async (id) => {
    const r = await api.get(`/sale-returns/${id}`)
    setDetail(r.data); setView('detail')
  }

  const del = async (id) => {
    try { await api.delete(`/sale-returns/${id}`); await load() }
    catch (e) { alert(e.response?.data?.error || 'Error') }
  }

  const filtered = returns.filter(r => {
    const matchFrom = !dateFrom || r.return_date >= dateFrom
    const matchTo = !dateTo || r.return_date <= dateTo
    return matchFrom && matchTo
  })

  const totalAmount = filtered.reduce((s, r) => s + Number(r.total_amount), 0)

  if (loading) return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b' }}>
        <Spinner /> Loading…
      </div>
    </div>
  )

  if (view === 'detail' && detail) return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ marginBottom: 20 }}>
        <Btn variant="ghost" icon={<Icon.Back style={{ width: 14, height: 14 }} />} onClick={() => setView('list')}>
          Back
        </Btn>
      </div>
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Sale Return Details</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{detail.return_date}</p>
          </div>
          <Btn variant="secondary" icon={<Icon.Print style={{ width: 14, height: 14 }} />} onClick={() => printTable(
            `Sale Return | Bill: ${detail.bill_no || '-'} | ${detail.return_date}`,
            [{ header: 'Product', accessor: r => r.product_name }, { header: 'Qty', accessor: r => r.quantity }, { header: 'Price', accessor: r => `Rs. ${Number(r.price).toFixed(2)}` }, { header: 'Total', accessor: r => `Rs. ${Number(r.total).toFixed(2)}` }],
            detail.items || []
          )}>
            Print
          </Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24, fontSize: 13 }}>
          <div><span style={{ color: '#64748b' }}>Return Date:</span> <span style={{ fontWeight: 600 }}>{detail.return_date}</span></div>
          <div><span style={{ color: '#64748b' }}>Original Bill:</span> <span style={{ fontWeight: 600 }}>{detail.bill_no || '-'}</span></div>
          <div><span style={{ color: '#64748b' }}>Reason:</span> <span style={{ fontWeight: 600 }}>{detail.reason || '-'}</span></div>
        </div>
        <Table>
          <thead>
            <tr>
              {['Product', 'Qty', 'Price', 'Total'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {detail.items?.map((item, i) => (
              <tr key={i}>
                <td>{item.product_name}</td>
                <td>{item.quantity}</td>
                <td>Rs. {Number(item.price).toFixed(2)}</td>
                <td style={{ fontWeight: 600 }}>Rs. {Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div style={{ textAlign: 'right', marginTop: 16, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
          Total: Rs. {Number(detail.total_amount).toFixed(2)}
        </div>
      </Card>
    </div>
  )

  if (view === 'new') return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader
        title="New Sale Return"
        actions={
          <Btn variant="danger" icon={<Icon.Back style={{ width: 14, height: 14 }} />} onClick={() => setView('list')}>
            Back
          </Btn>
        }
      />
      <Card style={{ marginTop: 20 }}>
        <SectionLabel>Return Details</SectionLabel>
        <div style={{ marginTop: 16 }}>
          <FormGrid cols={3}>
            <div style={{ gridColumn: '1/3' }}>
              <Select
                label="Select Sale"
                required
                value={form.saleId}
                onChange={e => { setForm(f => ({ ...f, saleId: e.target.value })); loadSale(e.target.value) }}
                autoFocus
              >
                <option value="">Select a sale…</option>
                {sales.map(s => <option key={s.id} value={s.id}>{s.bill_no || `#${s.id}`} - {s.shop_name || 'Direct'} ({s.sale_date})</option>)}
              </Select>
            </div>
            <Input
              label="Return Date"
              type="date"
              value={form.returnDate}
              onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))}
            />
            <div style={{ gridColumn: '1/-1' }}>
              <Input
                label="Reason"
                placeholder="Reason for return…"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </FormGrid>
        </div>

        {saleDetail && (
          <div style={{ marginTop: 28 }}>
            <SectionLabel>Items to Return</SectionLabel>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 12 }}>Enter the quantity to return for each item.</p>
            <Table>
              <thead>
                <tr>
                  {['Product', 'Original Qty', 'Return Qty', 'Price', 'Return Total'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{item.productName}</td>
                    <td style={{ color: '#64748b' }}>{item.maxQty}</td>
                    <td style={{ width: 110 }}>
                      <input
                        type="number"
                        min="0"
                        max={item.maxQty}
                        className="db-input"
                        value={item.quantity || ''}
                        placeholder="0"
                        onChange={e => setItems(prev => prev.map((it, j) => j === idx ? { ...it, quantity: e.target.value } : it))}
                        style={{ fontSize: 13 }}
                      />
                    </td>
                    <td style={{ color: '#64748b' }}>Rs. {Number(item.price).toFixed(2)}</td>
                    <td style={{ fontWeight: 600, background: '#f8fafc' }}>Rs. {((Number(item.quantity) || 0) * Number(item.price)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                Return Total: Rs. {items.reduce((s, i) => s + (Number(i.quantity) || 0) * Number(i.price), 0).toFixed(2)}
              </div>
              <Btn onClick={save} disabled={saving} icon={saving ? <Spinner size={14} /> : <Icon.Save style={{ width: 14, height: 14 }} />}>
                {saving ? 'Saving…' : 'Save Return'}
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader
        title="Sale Returns"
        subtitle="Manage goods returned by customers"
        actions={
          <Btn icon={<Icon.Plus style={{ width: 14, height: 14 }} />} onClick={() => { setForm({ saleId: '', returnDate: today(), reason: '' }); setSaleDetail(null); setItems([]); setView('new') }}>
            New Return
          </Btn>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, margin: '24px 0', maxWidth: 600 }}>
        <Card>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Total Returned</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '6px 0 0' }}>Rs. {totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</p>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>{filtered.length} return{filtered.length !== 1 ? 's' : ''}</p>
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="db-input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="db-input" />
          </div>
          {(dateFrom || dateTo) && (
            <Btn variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>Clear</Btn>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <ExportBar
              onPDF={() => exportPDF('Sale Returns Report', LIST_COLS, filtered, 'sale_returns')}
              onExcel={() => exportExcel('Sale Returns Report', LIST_COLS, filtered, 'sale_returns')}
              onPrint={() => printTable('Sale Returns Report', LIST_COLS, filtered)}
            />
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              {['Return Date', 'Bill No.', 'Customer', 'Total Amount', 'Reason', 'Actions'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 0 }}><Empty message="No returns found" /></td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ color: '#64748b' }}>{r.return_date}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#3b82f6' }}>{r.bill_no || '-'}</td>
                <td style={{ fontWeight: 500 }}>{r.shop_name || <span style={{ color: '#94a3b8' }}>Direct Sale</span>}</td>
                <td style={{ fontWeight: 700 }}>Rs. {Number(r.total_amount).toFixed(2)}</td>
                <td style={{ color: '#64748b' }}>{r.reason || '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" size="sm" icon={<Icon.Eye style={{ width: 13, height: 13 }} />} onClick={() => openDetail(r.id)}>View</Btn>
                    <Btn variant="danger" size="sm" icon={<Icon.Trash style={{ width: 13, height: 13 }} />} onClick={() => setDeleteId(r.id)}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => del(deleteId)}
        title="Delete Return"
        message="Delete this sale return?"
        danger
      />
    </div>
  )
}
