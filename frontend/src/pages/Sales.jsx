import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { toast } from '../components/Toast'
import { isValidPhone } from '../utils/validation'
import { exportPDF, exportExcel, printTable, ExportBar } from '../utils/exportUtils'
import { Btn, Input, Select, Card, Alert, Empty, ConfirmModal, Table, FormGrid, PageHeader, SectionLabel, Icon, Spinner, Badge, Combobox } from '../components/ui'
import ErrorBoundary from '../components/ErrorBoundary'
import PrintInvoice, { numberToWords } from '../components/InvoicePreview'
import AddCustomerModal from '../components/AddCustomerModal'

const LIST_COLS = [
  { header: 'Date', accessor: r => r.sale_date },
  { header: 'Gate Pass #', accessor: r => r.gate_pass_no || '-' },
  { header: 'Bill #', accessor: r => r.bill_no || '-' },
  { header: 'Customer', accessor: r => r.shop_name || 'Direct Sale' },
  { header: 'Total', accessor: r => `Rs. ${Number(r.total_amount).toFixed(2)}` },
]

// Stock quantity is tracked in pieces; show it as CTN (with fractional cartons, e.g. 3.5) for product selection.
function fmtCtnQty(pieces, piecesPerCtn) {
  const ppc = Number(piecesPerCtn) || 1
  const ctn = Math.round((Number(pieces) || 0) / ppc * 100) / 100
  return ctn.toString()
}

export default function Sales() {
  const navigate = useNavigate()
  const [sales, setSales] = useState([])
  const [customers, setCustomers] = useState([])
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [printSale, setPrintSale] = useState(null)
  const [form, setForm] = useState({ customerId: '', saleDate: today(), gatePassNo: '', billNo: '', remarks: '' })
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropOpen, setCustomerDropOpen] = useState(false)
  const customerInputRef = useRef(null)
  const [opts, setOpts] = useState({ description: false, discount: false, amountInWords: true })
  const [deleteId, setDeleteId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [receiptSale, setReceiptSale] = useState(null)     // sale row for collect payment modal
  const [receiptBalance, setReceiptBalance] = useState(0)  // outstanding balance
  const [receiptForm, setReceiptForm] = useState({ amount: '', method: 'CASH', date: '', notes: '' })
  const [receiptSaving, setReceiptSaving] = useState(false)
  const [bankAccounts, setBankAccounts] = useState([])

  function today() { return new Date().toISOString().split('T')[0] }

  const load = () => Promise.all([api.get('/sales'), api.get('/customers'), api.get('/stocks')])
    .then(([s, c, st]) => { setSales(s.data); setCustomers(c.data); setStocks(st.data); setLoading(false) })

  useEffect(() => { load() }, [])

  const addItem = () => setItems(i => [...i, { stockId: '', itemCode: '', productName: '', description: '', productRate: '', qtyCtn: '', qtyPieces: '', piecesPerCtn: 1, discount: '' }])
  const removeItem = (idx) => setItems(i => i.filter((_, j) => j !== idx))
  const updateItem = (idx, key, val) => setItems(i => i.map((it, j) => j === idx ? { ...it, [key]: val } : it))

  // Auto-focus the last added item's product search for keyboard-only workflow
  useEffect(() => {
    if (items.length > 0) {
      const lastIdx = items.length - 1
      setTimeout(() => { document.getElementById(`sales-product-${lastIdx}`)?.focus() }, 0)
    }
  }, [items.length])

  const getProductQty = (item) => (Number(item.qtyCtn) || 0) * (Number(item.piecesPerCtn) || 1) + (Number(item.qtyPieces) || 0)
  const getItemTotal = (item) => getProductQty(item) * (Number(item.productRate) || 0) * (1 - ((Number(item.discount) || 0) / 100))
  const total = items.reduce((s, i) => s + getItemTotal(i), 0)

  const openNew = async () => {
    setEditId(null)
    setForm({ customerId: '', saleDate: today(), gatePassNo: '', billNo: '', remarks: '' })
    setItems([])
    setView('new')
    try {
      const r = await api.get('/sales/next-numbers')
      setForm(f => ({ ...f, gatePassNo: r.data.gatePassNo, billNo: r.data.billNo }))
    } catch {}
  }

  const handleAddCustomer = async (customerForm) => {
    if (!customerForm.shopName) return toast('Shop name is required')
    if (!isValidPhone(customerForm.phone)) return toast('Invalid phone number. Use a format like 0300-1234567.')
    setSavingCustomer(true)
    try {
      const r = await api.post('/customers', customerForm)
      const updated = await api.get('/customers')
      setCustomers(updated.data)
      setForm(f => ({ ...f, customerId: String(r.data.id) }))
      setShowAddCustomer(false)
    } catch (e) { toast(e.response?.data?.error || 'Error adding customer') }
    setSavingCustomer(false)
  }

  const save = async () => {
    if (items.length === 0) return toast('Add at least one item')
    const unselected = items.find(i => !i.stockId || Number(i.stockId) === 0)
    if (unselected) return toast('Please select a product for all items')
    setSaving(true)
    try {
      const payload = {
        ...form,
        items: items.map(i => ({
          stockId: Number(i.stockId),
          itemCode: i.itemCode,
          productName: i.productName,
          description: opts.description ? i.description : '',
          productRate: Number(i.productRate) || 0,
          productQty: getProductQty(i),
          qtyCtn: Number(i.qtyCtn) || 0,
          qtyPieces: Number(i.qtyPieces) || 0,
          piecesPerCtn: Number(i.piecesPerCtn) || 1,
          discount: opts.discount ? Number(i.discount) || 0 : 0,
        }))
      }
      if (editId) {
        await api.put(`/sales/${editId}`, payload)
      } else {
        await api.post('/sales', payload)
      }
      setEditId(null)
      await load(); setView('list')
    } catch (e) { toast(e.response?.data?.error || 'Error saving') }
    setSaving(false)
  }

  const saveAndPrint = async () => {
    if (items.length === 0) return toast('Add at least one item')
    const unselected = items.find(i => !i.stockId || Number(i.stockId) === 0)
    if (unselected) return toast('Please select a product for all items')
    setSaving(true)
    try {
      const payload = {
        ...form,
        items: items.map(i => ({
          stockId: Number(i.stockId),
          itemCode: i.itemCode,
          productName: i.productName,
          description: opts.description ? i.description : '',
          productRate: Number(i.productRate) || 0,
          productQty: getProductQty(i),
          qtyCtn: Number(i.qtyCtn) || 0,
          qtyPieces: Number(i.qtyPieces) || 0,
          piecesPerCtn: Number(i.piecesPerCtn) || 1,
          discount: opts.discount ? Number(i.discount) || 0 : 0,
        }))
      }
      let savedId
      if (editId) {
        await api.put(`/sales/${editId}`, payload)
        savedId = editId
      } else {
        const r = await api.post('/sales', payload)
        savedId = r.data.id
      }
      setEditId(null)
      await load()
      setView('list')
      // open print after returning to list
      const r = await api.get(`/sales/${savedId}`)
      setPrintSale(r.data)
    } catch (e) { toast(e.response?.data?.error || 'Error saving') }
    setSaving(false)
  }

  const openPrint = async (id) => {
    try {
      const r = await api.get(`/sales/${id}`)
      setPrintSale(r.data)
    } catch (e) {
      toast(e.response?.data?.error || e.message || 'Failed to load invoice for printing')
    }
  }

  const openEdit = async (id) => {
    try {
      const r = await api.get(`/sales/${id}`)
      const s = r.data
      setEditId(id)
      setForm({
        customerId: s.customer_id ? String(s.customer_id) : '',
        saleDate: s.sale_date,
        gatePassNo: s.gate_pass_no || '',
        billNo: s.bill_no || '',
        remarks: s.remarks || '',
      })
      // Load fresh stocks to ensure piecesPerCtn lookup is accurate
      const stList = stocks.length > 0 ? stocks : (await api.get('/stocks')).data
      setItems((s.items || []).map(i => {
        // Older sales saved before CTN/PCS was tracked separately have no qty_ctn —
        // fall back to showing the full quantity as loose pieces, as before.
        const hasSplit = i.qty_ctn != null && (Number(i.qty_ctn) > 0 || Number(i.qty_loose_pieces) > 0)
        return {
          stockId: String(i.stock_id),
          itemCode: i.item_code || '',
          productName: i.product_name || '',
          description: i.description || '',
          productRate: String(i.product_rate || ''),
          qtyCtn: hasSplit ? String(i.qty_ctn || '') : '',
          qtyPieces: hasSplit ? String(i.qty_loose_pieces || '') : String(i.product_qty || ''),
          piecesPerCtn: i.pieces_per_ctn || stList.find(st => st.id === i.stock_id)?.pieces_per_ctn || 1,
          discount: i.discount ? String(i.discount) : '',
        }
      }))
      setView('new')
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to load sale for editing')
    }
  }

  const openReceipt = async (sale) => {
    try {
      setReceiptSale(sale)
      setReceiptForm({ amount: '', method: 'CASH', date: new Date().toISOString().split('T')[0], notes: '' })
      setReceiptBalance(null) // unknown until fetched below — avoids showing a stale/wrong balance from the previously opened invoice
      // load bank accounts if not loaded
      if (bankAccounts.length === 0) {
        const r = await api.get('/bank-accounts')
        setBankAccounts(r.data)
      }
      // load outstanding balance if customer exists
      if (sale.customer_id) {
        try {
          const r = await api.get(`/customer-ledger/${sale.customer_id}`)
          setReceiptBalance(r.data.balance || 0)
        } catch { setReceiptBalance(0) }
      } else {
        setReceiptBalance(0)
      }
    } catch (e) { toast('Failed to open receipt: ' + (e.message || '')) }
  }

  const saveReceipt = async () => {
    if (!receiptSale) return
    const amt = parseFloat(receiptForm.amount)
    if (!amt || amt <= 0) { toast('Enter a valid amount'); return }
    if (!receiptSale.customer_id) { toast('This sale has no customer. Cannot create a receipt.'); return }
    if (receiptBalance === null || receiptBalance <= 0) { toast('No outstanding balance — this account is already fully paid.'); return }
    if (receiptForm.method !== 'CASH' && !receiptForm.bankAccountId) { toast('Select a bank account'); return }
    setReceiptSaving(true)
    try {
      const customer = customers.find(c => c.id === receiptSale.customer_id)
      const accId = receiptForm.bankAccountId ? Number(receiptForm.bankAccountId) : null
      await api.post('/receipts/bulk', {
        receipts: [{
          customer_id: receiptSale.customer_id,
          customer_name: customer?.customer_name || customer?.shop_name || '',
          shop_name: customer?.shop_name || '',
          customer_code: customer?.customer_code || '',
          customer_type: customer?.customer_type || 'WHOLESALER',
          balance: receiptBalance,
          amount: amt,
          payment_method: receiptForm.method,
          bank_account_id: accId,
          account_name: bankAccounts.find(a => a.id === accId)?.account_name || '',
          notes: receiptForm.notes,
          receipt_date: receiptForm.date,
        }]
      })
      setReceiptSale(null)
      toast('Receipt saved successfully!')
    } catch (e) { toast(e.response?.data?.error || 'Failed to save receipt') }
    setReceiptSaving(false)
  }

  const del = async (id) => {
    try { await api.delete(`/sales/${id}`); await load() }
    catch (e) { toast(e.response?.data?.error || 'Cannot delete') }
  }

  const filtered = sales.filter(s => {
    const matchCustomer = !customerFilter || String(s.customer_id) === customerFilter
    const matchFrom = !dateFrom || s.sale_date >= dateFrom
    const matchTo = !dateTo || s.sale_date <= dateTo
    return matchCustomer && matchFrom && matchTo
  })

  if (loading) return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b' }}>
        <Spinner /> Loading sales…
      </div>
    </div>
  )

  if (view === 'new') return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader
        title={editId ? 'Edit Sale Invoice' : 'New Sale Invoice'}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" icon={<Icon.Print style={{ width: 14, height: 14 }} />} onClick={() => {
              const customer = customers.find(c => c.id === Number(form.customerId))
              setPrintSale({
                ...form,
                sale_date: form.saleDate,
                gate_pass_no: form.gatePassNo,
                bill_no: form.billNo,
                shop_name: customer?.shop_name || '',
                customer_name: customer?.customer_name || '',
                total_amount: total,
                items: items.map(i => ({
                  product_name: i.productName,
                  description: i.description,
                  product_rate: Number(i.productRate) || 0,
                  product_qty: getProductQty(i),
                  qty_ctn: Number(i.qtyCtn) || 0,
                  qty_loose_pieces: Number(i.qtyPieces) || 0,
                  pieces_per_ctn: Number(i.piecesPerCtn) || 1,
                  discount: Number(i.discount) || 0,
                  total: getItemTotal(i),
                }))
              })
            }}>
              Print
            </Btn>
            <Btn variant="danger" icon={<Icon.Back style={{ width: 14, height: 14 }} />} onClick={() => { setEditId(null); setView('list') }}>
              Back
            </Btn>
          </div>
        }
      />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card>
            <SectionLabel>Invoice Details</SectionLabel>
            <div style={{ marginTop: 16 }}>
              <FormGrid cols={3}>
                <div style={{ gridColumn: '1/3' }}>
                  <label className="form-label">Customer (optional)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={form.customerId}
                      onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                      className="db-input db-select"
                      style={{ flex: 1 }}
                    >
                      <option value="">Select wholesaler…</option>
                      {customers.filter(c => c.customer_type === 'WHOLESALER').map(c => <option key={c.id} value={c.id}>{c.shop_name}</option>)}
                    </select>
                    <Btn variant="secondary" onClick={() => setShowAddCustomer(true)} title="Quick add customer" style={{ padding: '0 12px', fontSize: 18, lineHeight: 1 }}>+</Btn>
                  </div>
                </div>
                <Input
                  label="Sale Date"
                  type="date"
                  value={form.saleDate}
                  onChange={e => setForm(f => ({ ...f, saleDate: e.target.value }))}
                />
                <Input
                  label="Gate Pass No."
                  placeholder="Auto-generated"
                  value={form.gatePassNo}
                  onChange={e => setForm(f => ({ ...f, gatePassNo: e.target.value }))}
                />
                <Input
                  label="Bill No."
                  placeholder="Auto-generated"
                  value={form.billNo}
                  onChange={e => setForm(f => ({ ...f, billNo: e.target.value }))}
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
              <SectionLabel>Line Items</SectionLabel>
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table className="db-table" style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      {opts.description && <th style={{ width: 120 }}>Description</th>}
                      <th style={{ width: 80 }}>CTN</th>
                      <th style={{ width: 80 }}>Pieces</th>
                      <th style={{ width: 110 }}>Rate / CTN</th>
                      {opts.discount && <th style={{ width: 80 }}>Disc %</th>}
                      <th style={{ width: 130, background: '#f8fafc' }}>Amount</th>
                      <th style={{ width: 44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan={opts.description && opts.discount ? 8 : opts.description || opts.discount ? 7 : 6} style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>No items — click Add Item below</td></tr>
                    ) : items.map((item, idx) => {
                      const productQty = getProductQty(item)
                      const itemTotal = getItemTotal(item)
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 6px' }}>
                            <Combobox
                              inputId={`sales-product-${idx}`}
                              options={stocks.map(s => ({ value: String(s.id), label: `${s.product_name} (${s.company_name}) — Qty: ${fmtCtnQty(s.quantity, s.pieces_per_ctn)} CTN` }))}
                              value={item.stockId}
                              onSelect={(val) => {
                                if (!val) {
                                  setItems(prev => prev.map((it, j) => j === idx ? {
                                    ...it,
                                    stockId: '', productName: '', itemCode: '',
                                    productRate: '', piecesPerCtn: 1,
                                  } : it))
                                  return
                                }
                                const s = stocks.find(s => s.id === Number(val))
                                setItems(prev => prev.map((it, j) => j === idx ? {
                                  ...it,
                                  stockId: val,
                                  productName: s?.product_name || '',
                                  itemCode: s?.id ? `P${s.id}` : '',
                                  productRate: s?.sale_price || '',
                                  piecesPerCtn: s?.pieces_per_ctn || 1,
                                } : it))
                              }}
                              placeholder="Search product…"
                              style={{ fontSize: 12 }}
                            />
                          </td>
                          {opts.description && (
                            <td style={{ padding: '8px 6px' }}>
                              <input
                                type="text"
                                className="db-input"
                                value={item.description}
                                onChange={e => updateItem(idx, 'description', e.target.value)}
                                placeholder="Description"
                                style={{ fontSize: 12 }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '8px 6px' }}>
                            <input
                              type="number" onWheel={e => e.target.blur()}
                              min="0"
                              className="db-input"
                              value={item.qtyCtn || ''}
                              onChange={e => updateItem(idx, 'qtyCtn', e.target.value)}
                              placeholder="0"
                              style={{ fontSize: 12 }}
                            />
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <input
                              type="number" onWheel={e => e.target.blur()}
                              min="0"
                              className="db-input"
                              value={item.qtyPieces || ''}
                              onChange={e => updateItem(idx, 'qtyPieces', e.target.value)}
                              placeholder="0"
                              style={{ fontSize: 12 }}
                            />
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <input
                              type="number" onWheel={e => e.target.blur()}
                              min="0"
                              step="any"
                              className="db-input"
                              value={item.productRate && item.piecesPerCtn ? +(Number(item.productRate) * Number(item.piecesPerCtn)).toFixed(4) : (item.productRate || '')}
                              onChange={e => updateItem(idx, 'productRate', Number(item.piecesPerCtn) > 0 ? Number(e.target.value) / Number(item.piecesPerCtn) : e.target.value)}
                              placeholder="0"
                              style={{ fontSize: 12 }}
                            />
                          </td>
                          {opts.discount && (
                            <td style={{ padding: '8px 6px' }}>
                              <input
                                type="number" onWheel={e => e.target.blur()}
                                min="0"
                                max="100"
                                step="any"
                                className="db-input"
                                value={item.discount || ''}
                                onChange={e => updateItem(idx, 'discount', e.target.value)}
                                placeholder="%"
                                style={{ fontSize: 12 }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '8px 10px', background: '#f8fafc', borderLeft: '1px solid #f1f5f9' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Rs. {itemTotal.toFixed(2)}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{productQty} pcs</div>
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                            <button
                              onClick={() => removeItem(idx)}
                              style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                            >
                              <Icon.Trash style={{ width: 13, height: 13 }} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn variant="ghost" icon={<Icon.Plus style={{ width: 14, height: 14 }} />} onClick={addItem}>
                  Add Item
                </Btn>
              </div>
            </div>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                    Grand Total: Rs. {total.toFixed(2)}
                  </div>
                  {opts.amountInWords && (
                    <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 4 }}>{numberToWords(total)}</div>
                  )}
                </div>
                <Btn onClick={save} disabled={saving} icon={saving ? <Spinner size={14} /> : <Icon.Save style={{ width: 14, height: 14 }} />}>
                  {saving ? 'Saving…' : editId ? 'Update Sale' : 'Save Sale'}
                </Btn>
              </div>
            </div>
          </Card>
        </div>

        <div style={{ width: 200, flexShrink: 0 }}>
          <Card>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Column Options</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'description', label: 'Description', hint: 'Add description per item' },
                { key: 'discount', label: 'Discount', hint: 'Per-item discount %' },
                { key: 'amountInWords', label: 'Total in Words', hint: 'Show amount in words' },
              ].map(({ key, label, hint }) => (
                <label key={key} style={{ display: 'flex', gap: 8, cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={opts[key]}
                    onChange={e => setOpts(o => ({ ...o, [key]: e.target.checked }))}
                    style={{ marginTop: 2, accentColor: '#3b82f6' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {showAddCustomer && (
        <AddCustomerModal
          onSave={handleAddCustomer}
          onClose={() => setShowAddCustomer(false)}
          saving={savingCustomer}
        />
      )}

      {printSale && (
        <ErrorBoundary key={printSale.id || 'new'} onClose={() => setPrintSale(null)}>
          <PrintInvoice sale={printSale} onClose={() => setPrintSale(null)} />
        </ErrorBoundary>
      )}
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader
        title="Sales"
        subtitle="Manage sale invoices and customer orders"
        actions={
          <Btn icon={<Icon.Plus style={{ width: 14, height: 14 }} />} onClick={openNew}>
            New Sale
          </Btn>
        }
      />

      <Card style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Customer</label>
            <input
              ref={customerInputRef}
              type="text"
              value={customerSearch}
              placeholder="All customers…"
              onChange={e => { setCustomerSearch(e.target.value); setCustomerDropOpen(true); setCustomerFilter('') }}
              onFocus={() => { setCustomerDropOpen(true); setCustomerSearch('') }}
              onBlur={() => setTimeout(() => setCustomerDropOpen(false), 160)}
              className="db-input"
              style={{ width: 200 }}
            />
            {customerDropOpen && (() => {
              const wholesalers = customers.filter(c => c.customer_type === 'WHOLESALER')
              const results = customerSearch.trim()
                ? wholesalers.filter(c => c.shop_name?.toLowerCase().includes(customerSearch.toLowerCase()))
                : wholesalers
              if (results.length === 0) return null
              return (
                <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', zIndex: 9999, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.10)', maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
                  <div
                    onMouseDown={() => { setCustomerFilter(''); setCustomerSearch(''); setCustomerDropOpen(false) }}
                    style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: '#94a3b8' }}
                  >
                    All Customers
                  </div>
                  {results.map(c => (
                    <div
                      key={c.id}
                      onMouseDown={() => { setCustomerFilter(String(c.id)); setCustomerSearch(c.shop_name); setCustomerDropOpen(false) }}
                      style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', background: String(c.id) === customerFilter ? '#eff6ff' : undefined, color: String(c.id) === customerFilter ? '#2563eb' : '#1e293b', fontWeight: String(c.id) === customerFilter ? 600 : undefined }}
                    >
                      {c.shop_name}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="db-input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="db-input" />
          </div>
          {(dateFrom || dateTo || customerFilter) && (
            <Btn variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setCustomerFilter('') }}>Clear</Btn>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <ExportBar
              onPDF={() => exportPDF('Sales Report', LIST_COLS, filtered, 'sales')}
              onExcel={() => exportExcel('Sales Report', LIST_COLS, filtered, 'sales')}
              onPrint={() => printTable('Sales Report', LIST_COLS, filtered)}
            />
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              {['Date', 'Gate Pass #', 'Bill #', 'Customer', 'Total', 'Actions'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 0 }}><Empty message="No sales found" hint="Create your first sale invoice using the button above" /></td></tr>
            ) : filtered.map(s => (
              <tr key={s.id}>
                <td style={{ color: '#64748b' }}>{s.sale_date}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#3b82f6' }}>{s.gate_pass_no || '-'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.bill_no || '-'}</td>
                <td style={{ fontWeight: 500 }}>{s.shop_name || <span style={{ color: '#94a3b8' }}>Direct Sale</span>}</td>
                <td style={{ fontWeight: 700, color: '#0f172a' }}>Rs. {Number(s.total_amount).toFixed(2)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                    <Btn variant="ghost" size="sm" icon={<Icon.Print style={{ width: 13, height: 13 }} />} onClick={() => openPrint(s.id)}>Print</Btn>
                    <Btn variant="secondary" size="sm" icon={<Icon.Edit style={{ width: 13, height: 13 }} />} onClick={() => openEdit(s.id)}>Edit</Btn>
                    <Btn variant="secondary" size="sm" icon={<Icon.Check style={{ width: 13, height: 13 }} />} onClick={() => openReceipt(s)}>Receipt</Btn>
                    <Btn variant="danger" size="sm" icon={<Icon.Trash style={{ width: 13, height: 13 }} />} onClick={() => setDeleteId(s.id)}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {printSale && (
        <ErrorBoundary key={printSale.id || 'new'} onClose={() => setPrintSale(null)}>
          <PrintInvoice sale={printSale} onClose={() => setPrintSale(null)} />
        </ErrorBoundary>
      )}

      {/* Collect Payment Modal */}
      {receiptSale && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 420 }}>
            {/* Header */}
            <div style={{ background: '#1e293b', borderRadius: '12px 12px 0 0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Collect Payment</div>
                <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                  {receiptSale.shop_name || receiptSale.customer_name || 'Direct Sale'}
                </div>
              </div>
              <button onClick={() => setReceiptSale(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
                <Icon.X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Outstanding & Cleared chips */}
            <div style={{ background: '#0f172a', padding: '10px 20px', display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, background: '#1e293b', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Outstanding</div>
                <div style={{ color: '#f97316', fontWeight: 800, fontSize: 15, marginTop: 2 }}>
                  {receiptBalance === null ? 'Loading…' : `Rs. ${Number(receiptBalance).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`}
                </div>
                {receiptSale.customer_id && customers.find(c => c.id === receiptSale.customer_id) && (
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                    Customer: <span style={{ color: '#94a3b8' }}>{customers.find(c => c.id === receiptSale.customer_id)?.customer_name}</span>
                  </div>
                )}
              </div>
              <div style={{ flex: 1, background: '#1e293b', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Invoice Total</div>
                <div style={{ color: '#dc2626', fontWeight: 800, fontSize: 15, marginTop: 2 }}>
                  Rs. {Number(receiptSale.total_amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{receiptSale.bill_no || '—'}</div>
              </div>
            </div>

            {/* Form */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {receiptBalance !== null && receiptBalance <= 0 && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>
                  This account has no outstanding balance — payment not required.
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Amount Received <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="number" onWheel={e => e.target.blur()}
                  min="0"
                  step="0.01"
                  className="db-input"
                  style={{ width: '100%' }}
                  value={receiptForm.amount}
                  placeholder="0.00"
                  autoFocus
                  onChange={e => setReceiptForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Payment Method</label>
                <select className="db-input db-select" style={{ width: '100%' }}
                  value={receiptForm.method}
                  onChange={e => setReceiptForm(f => ({ ...f, method: e.target.value, bankAccountId: '' }))}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              {receiptForm.method !== 'CASH' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Bank Account</label>
                  <select className="db-input db-select" style={{ width: '100%' }}
                    value={receiptForm.bankAccountId || ''}
                    onChange={e => setReceiptForm(f => ({ ...f, bankAccountId: e.target.value }))}>
                    <option value="">Select account…</option>
                    {bankAccounts.filter(a => a.account_type === 'BANK').map(a => (
                      <option key={a.id} value={a.id}>{a.account_name}{a.bank_name ? ' — ' + a.bank_name : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Date</label>
                <input type="date" className="db-input" style={{ width: '100%' }}
                  value={receiptForm.date}
                  onChange={e => setReceiptForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Notes (optional)</label>
                <input type="text" className="db-input" style={{ width: '100%' }}
                  value={receiptForm.notes}
                  placeholder="e.g. partial payment"
                  onChange={e => setReceiptForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setReceiptSale(null)}
                style={{ background: 'none', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveReceipt} disabled={receiptSaving || receiptBalance <= 0}
                style={{ background: '#f59e0b', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: (receiptSaving || receiptBalance <= 0) ? 'not-allowed' : 'pointer', opacity: (receiptSaving || receiptBalance <= 0) ? 0.7 : 1 }}>
                {receiptSaving ? 'Saving…' : 'Save Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => del(deleteId)}
        title="Delete Sale"
        message="Delete this sale? Stock will be restored."
        danger
      />
    </div>
  )
}
