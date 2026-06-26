import { useState, useEffect } from 'react'
import api from '../api'
import { exportPDF, exportExcel, printTable, ExportBar } from '../utils/exportUtils'
import { Btn, Input, NumInput, Select, Modal, Card, Badge, Alert, Empty, ConfirmModal, Table, FormGrid, PageHeader, StatCard, SectionLabel, Icon, Spinner, Combobox } from '../components/ui'

const LIST_COLS = [
  { header: 'Date', accessor: r => r.purchase_date },
  { header: 'Invoice #', accessor: r => r.invoice_no || '-' },
  { header: 'Vendor', accessor: r => r.company_name },
  { header: 'Total Amount', accessor: r => `Rs. ${Number(r.total_amount).toFixed(2)}` },
]

export default function Purchases() {
  const [purchases, setPurchases] = useState([])
  const [vendors, setVendors] = useState([])
  const [stocks, setStocks] = useState([])
  const [vendorProducts, setVendorProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({ vendorId: '', purchaseDate: today(), invoiceNo: '', remarks: '' })
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  function today() { return new Date().toISOString().split('T')[0] }

  const load = () => Promise.all([
    api.get('/purchases'),
    api.get('/vendors'),
    api.get('/stocks'),
  ]).then(([p, v, s]) => { setPurchases(p.data); setVendors(v.data); setStocks(s.data); setLoading(false) })

  useEffect(() => { load() }, [])

  const loadVendorProducts = async (vendorId) => {
    if (!vendorId) { setVendorProducts([]); return }
    try {
      const r = await api.get(`/products/by-vendor/${vendorId}`)
      setVendorProducts(r.data)
    } catch { setVendorProducts([]) }
  }

  const selectedVendor = vendors.find(v => String(v.id) === String(form.vendorId))
  const vendorStocks = selectedVendor
    ? stocks.filter(s => s.company_name === selectedVendor.company_name)
    : []

  const catalogNames = new Set(vendorProducts.map(p => p.product_name))
  const extraStocks = vendorStocks.filter(s => !catalogNames.has(s.product_name))

  const dropdownOptions = [
    ...vendorProducts.map(p => ({ key: `p-${p.id}`, label: p.product_name, productId: p.id, stockId: null, price: p.purchase_price, piecesPerCtn: p.pieces_per_ctn || 1 })),
    ...extraStocks.map(s => ({ key: `s-${s.id}`, label: `${s.product_name} (in stock)`, productId: null, stockId: s.id, price: s.purchase_price, piecesPerCtn: s.pieces_per_ctn || 1 })),
  ]

  const addItem = () => setItems(i => [...i, { stockId: '', productId: '', productName: '', quantity: '', purchasePrice: '', piecesPerCtn: 1 }])
  const removeItem = (idx) => setItems(i => i.filter((_, j) => j !== idx))
  const updateItem = (idx, key, val) => setItems(i => i.map((item, j) => j === idx ? { ...item, [key]: val } : item))
  const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.piecesPerCtn) || 1) * (Number(i.purchasePrice) || 0), 0)

  // Auto-focus the last added item's product search for keyboard-only workflow
  useEffect(() => {
    if (items.length > 0) {
      const lastIdx = items.length - 1
      setTimeout(() => { document.getElementById(`purchase-product-${lastIdx}`)?.focus() }, 0)
    }
  }, [items.length])

  const openNew = () => {
    setEditingId(null)
    setForm({ vendorId: '', purchaseDate: today(), invoiceNo: '', remarks: '' })
    setItems([])
    setView('new')
  }

  const openEdit = async (purchase) => {
    const r = await api.get(`/purchases/${purchase.id}`)
    const d = r.data
    setEditingId(purchase.id)
    setForm({
      vendorId: String(d.vendor_id),
      purchaseDate: d.purchase_date,
      invoiceNo: d.invoice_no || '',
      remarks: d.remarks || '',
    })
    await loadVendorProducts(d.vendor_id)
    setItems((d.items || []).map(i => ({
      stockId: i.stock_id,
      productId: '',
      productName: i.product_name,
      quantity: i.quantity,
      purchasePrice: i.purchase_price,
      piecesPerCtn: i.pieces_per_ctn || 1,
    })))
    setView('new')
  }

  const save = async () => {
    if (!form.vendorId) return alert('Select a vendor')
    if (items.length === 0) return alert('Add at least one item')
    const unselected = items.find(i => (!i.stockId || Number(i.stockId) === 0) && (!i.productId || Number(i.productId) === 0))
    if (unselected) return alert('Please select a product for all items')
    setSaving(true)
    try {
      const payload = {
        ...form,
        items: items.map(i => ({
          stockId: Number(i.stockId) || 0,
          productId: Number(i.productId) || 0,
          quantity: Number(i.quantity),
          purchasePrice: Number(i.purchasePrice),
          piecesPerCtn: Number(i.piecesPerCtn) || 1,
        }))
      }
      if (editingId) {
        await api.put(`/purchases/${editingId}`, payload)
      } else {
        await api.post('/purchases', payload)
      }
      await load(); setView('list')
    } catch (e) { alert(e.response?.data?.error || 'Error saving') }
    setSaving(false)
  }

  const openDetail = async (id) => {
    const r = await api.get(`/purchases/${id}`)
    setDetail(r.data); setView('detail')
  }

  const printDetail = (d) => {
    const detailCols = [
      { header: 'Product', accessor: r => r.product_name },
      { header: 'Qty (CTN)', accessor: r => r.quantity },
      { header: 'Price', accessor: r => `Rs. ${Number(r.purchase_price).toFixed(2)}` },
      { header: 'Total', accessor: r => `Rs. ${Number(r.total).toFixed(2)}` },
    ]
    printTable(`Purchase — ${d.company_name} | Invoice: ${d.invoice_no || d.id} | ${d.purchase_date}`, detailCols, d.items || [])
  }

  const del = async (id) => {
    try { await api.delete(`/purchases/${id}`); await load() }
    catch (e) { alert(e.response?.data?.error || 'Cannot delete') }
  }

  const filtered = purchases.filter(p => {
    const matchVendor = !vendorFilter || String(p.vendor_id) === vendorFilter
    const matchFrom = !dateFrom || p.purchase_date >= dateFrom
    const matchTo = !dateTo || p.purchase_date <= dateTo
    return matchVendor && matchFrom && matchTo
  })

  const totalAmount = filtered.reduce((s, p) => s + Number(p.total_amount), 0)

  if (loading) return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b' }}>
        <Spinner /> Loading purchases…
      </div>
    </div>
  )

  if (view === 'detail' && detail) return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ marginBottom: 20 }}>
        <Btn variant="ghost" icon={<Icon.Back style={{ width: 14, height: 14 }} />} onClick={() => setView('list')}>
          Back to list
        </Btn>
      </div>
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Purchase Details</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{detail.company_name} · {detail.purchase_date}</p>
          </div>
          <Btn variant="secondary" icon={<Icon.Print style={{ width: 14, height: 14 }} />} onClick={() => printDetail(detail)}>
            Print
          </Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24, fontSize: 13 }}>
          <div><span style={{ color: '#64748b' }}>Vendor:</span> <span style={{ fontWeight: 600 }}>{detail.company_name}</span></div>
          <div><span style={{ color: '#64748b' }}>Invoice #:</span> <span style={{ fontWeight: 600 }}>{detail.invoice_no || '-'}</span></div>
          <div><span style={{ color: '#64748b' }}>Date:</span> <span style={{ fontWeight: 600 }}>{detail.purchase_date}</span></div>
          {detail.remarks && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#64748b' }}>Remarks:</span> <span style={{ fontWeight: 600 }}>{detail.remarks}</span></div>}
        </div>
        <Table>
          <thead>
            <tr>
              {['Product', 'Qty (CTN)', 'Price', 'Total'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {detail.items?.map((item, i) => (
              <tr key={i}>
                <td>{item.product_name}</td>
                <td>{item.quantity}</td>
                <td>Rs. {Number(item.purchase_price).toFixed(2)}</td>
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
        title={editingId ? 'Edit Purchase' : 'New Purchase'}
        actions={
          <Btn variant="ghost" icon={<Icon.Back style={{ width: 14, height: 14 }} />} onClick={() => setView('list')}>
            Cancel
          </Btn>
        }
      />
      <Card style={{ marginTop: 20 }}>
        <SectionLabel>Purchase Details</SectionLabel>
        <div style={{ marginTop: 16 }}>
          <FormGrid cols={2}>
            <Select
              label="Vendor"
              required
              value={form.vendorId}
              onChange={e => { setForm(f => ({ ...f, vendorId: e.target.value })); setItems([]); loadVendorProducts(e.target.value) }}
              autoFocus
            >
              <option value="">Select vendor…</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.company_name}</option>)}
            </Select>
            <Input
              label="Purchase Date"
              type="date"
              value={form.purchaseDate}
              onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))}
            />
            <Input
              label="Invoice No."
              placeholder="e.g. INV-001"
              value={form.invoiceNo}
              onChange={e => setForm(f => ({ ...f, invoiceNo: e.target.value }))}
            />
            <Input
              label="Remarks"
              placeholder="Optional remarks"
              value={form.remarks}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
            />
          </FormGrid>
        </div>

        <div style={{ marginTop: 28 }}>
          <SectionLabel>Items</SectionLabel>
          {!form.vendorId && (
            <div style={{ marginTop: 12 }}>
              <Alert type="warning">Select a vendor above to see their products.</Alert>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Table>
              <thead>
                <tr>
                  <th>Product (Vendor Items)</th>
                  <th style={{ width: 110 }}>Qty (CTN)</th>
                  <th style={{ width: 80 }}>Pcs/CTN</th>
                  <th style={{ width: 140 }}>Purchase Price</th>
                  <th style={{ width: 130 }}>Total</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>No items added yet</td></tr>
                ) : items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <Combobox
                        inputId={`purchase-product-${idx}`}
                        options={dropdownOptions.map(o => ({ value: o.key, label: o.label }))}
                        value={item.stockId ? `s-${item.stockId}` : item.productId ? `p-${item.productId}` : ''}
                        onSelect={(val) => {
                          const opt = dropdownOptions.find(o => o.key === val)
                          setItems(prev => prev.map((it, j) => j === idx
                            ? { ...it, stockId: opt?.stockId || '', productId: opt?.productId || '', productName: opt?.label || '', purchasePrice: opt?.price || '', piecesPerCtn: opt?.piecesPerCtn || 1 }
                            : it))
                        }}
                        placeholder="Search product…"
                        style={{ fontSize: 13 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        className="db-input"
                        value={item.quantity || ''}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        placeholder="0"
                        style={{ fontSize: 13 }}
                      />
                    </td>
                    <td style={{ textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                      {item.piecesPerCtn || 1}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="db-input"
                        value={item.purchasePrice || ''}
                        onChange={e => updateItem(idx, 'purchasePrice', e.target.value)}
                        placeholder="0"
                        style={{ fontSize: 13 }}
                      />
                    </td>
                    <td style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, background: '#f8fafc' }}>
                      Rs. {((Number(item.quantity) || 0) * (Number(item.piecesPerCtn) || 1) * (Number(item.purchasePrice) || 0)).toFixed(2)}
                    </td>
                    <td>
                      <button onClick={() => removeItem(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Remove">
                        <Icon.Trash style={{ width: 14, height: 14 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn
              variant="ghost"
              icon={<Icon.Plus style={{ width: 14, height: 14 }} />}
              onClick={addItem}
              disabled={!form.vendorId}
            >
              Add Item
            </Btn>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
            Total: Rs. {total.toFixed(2)}
          </div>
          <Btn onClick={save} disabled={saving} icon={saving ? <Spinner size={14} /> : <Icon.Save style={{ width: 14, height: 14 }} />}>
            {saving ? 'Saving…' : editingId ? 'Update Purchase' : 'Save Purchase'}
          </Btn>
        </div>
      </Card>
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader
        title="Purchases"
        subtitle="Manage vendor purchases and inventory receipts"
        actions={
          <Btn icon={<Icon.Plus style={{ width: 14, height: 14 }} />} onClick={openNew}>
            New Purchase
          </Btn>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, margin: '24px 0' }}>
        <StatCard
          label="Total Purchases"
          value={`Rs. ${totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`}
          sub={`${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
          accent="#3b82f6"
          icon={<Icon.Download style={{ width: 16, height: 16 }} />}
        />
        <StatCard
          label="Vendors"
          value={vendors.length}
          sub="Active vendors"
          accent="#8b5cf6"
          icon={<Icon.User style={{ width: 16, height: 16 }} />}
        />
        <StatCard
          label="This View"
          value={filtered.length}
          sub={dateFrom || dateTo || vendorFilter ? 'Filtered results' : 'All purchases'}
          accent="#10b981"
          icon={<Icon.Filter style={{ width: 16, height: 16 }} />}
        />
      </div>

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
          <Select
            value={vendorFilter}
            onChange={e => setVendorFilter(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.company_name}</option>)}
          </Select>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="db-input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="db-input" />
          </div>
          {(dateFrom || dateTo || vendorFilter) && (
            <Btn variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setVendorFilter('') }}>
              Clear
            </Btn>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <ExportBar
              onPDF={() => exportPDF('Purchases Report', LIST_COLS, filtered, 'purchases')}
              onExcel={() => exportExcel('Purchases Report', LIST_COLS, filtered, 'purchases')}
              onPrint={() => printTable('Purchases Report', LIST_COLS, filtered)}
            />
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              {['Date', 'Invoice #', 'Vendor', 'Total Amount', 'Actions'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 0 }}><Empty message="No purchases found" hint="Add your first purchase using the button above" /></td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td style={{ color: '#64748b' }}>{p.purchase_date}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#3b82f6' }}>{p.invoice_no || '-'}</td>
                <td style={{ fontWeight: 600 }}>{p.company_name}</td>
                <td style={{ fontWeight: 700, color: '#0f172a' }}>Rs. {Number(p.total_amount).toFixed(2)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" size="sm" icon={<Icon.Eye style={{ width: 13, height: 13 }} />} onClick={() => openDetail(p.id)}>View</Btn>
                    <Btn variant="ghost" size="sm" icon={<Icon.Edit style={{ width: 13, height: 13 }} />} onClick={() => openEdit(p)}>Edit</Btn>
                    <Btn variant="danger" size="sm" icon={<Icon.Trash style={{ width: 13, height: 13 }} />} onClick={() => setDeleteId(p.id)}>Delete</Btn>
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
        title="Delete Purchase"
        message="Delete this purchase? This will reverse stock quantities."
        danger
      />
    </div>
  )
}
