import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { isValidPhone } from '../utils/validation'
import { exportPDF, exportExcel, printTable, ExportBar } from '../utils/exportUtils'
import { getCompanyInfo } from '../utils/companyInfo'
import { Btn, Input, Select, Card, Alert, Empty, ConfirmModal, Table, FormGrid, PageHeader, SectionLabel, Icon, Spinner, Badge, Combobox } from '../components/ui'

const LIST_COLS = [
  { header: 'Date', accessor: r => r.sale_date },
  { header: 'Gate Pass #', accessor: r => r.gate_pass_no || '-' },
  { header: 'Bill #', accessor: r => r.bill_no || '-' },
  { header: 'Customer', accessor: r => r.shop_name || 'Direct Sale' },
  { header: 'Total', accessor: r => `Rs. ${Number(r.total_amount).toFixed(2)}` },
]

const emptyCustomer = { customerCode: '', shopName: '', customerName: '', customerType: 'RETAILER', address: '', email: '', phone: '', openingBalance: 0 }

function numberToWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function convert(n) {
    if (n === 0) return ''
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '')
  }
  const rupees = Math.floor(Math.abs(amount))
  const paise = Math.round((Math.abs(amount) - rupees) * 100)
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only'
  let result = 'Rupees ' + convert(rupees)
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise'
  return result + ' Only'
}

function PrintInvoice({ sale, onClose }) {
  const printRef = useRef()
  const hasDiscount = sale.items?.some(i => Number(i.discount) > 0)
  const hasDescription = sale.items?.some(i => i.description)
  const co = getCompanyInfo()
  const colSpan = 4 + (hasDescription ? 1 : 0) + (hasDiscount ? 1 : 0)

  const print = () => {
    const content = printRef.current.innerHTML
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${sale.bill_no || sale.id}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Arial', sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 32px; }
      .inv-wrap { max-width: 750px; margin: 0 auto; }
      /* Header */
      .inv-header { text-align: center; border-bottom: 3px double #1e293b; padding-bottom: 14px; margin-bottom: 18px; }
      .inv-header h1 { font-size: 22px; font-weight: 800; color: #1e293b; letter-spacing: 1px; margin-bottom: 3px; }
      .inv-header .tagline { font-size: 11px; color: #555; margin: 2px 0; }
      .inv-header .contact { font-size: 10px; color: #666; margin: 2px 0; }
      .inv-title { text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #475569; text-transform: uppercase; margin-bottom: 18px; }
      /* Info grid */
      .inv-info { display: flex; justify-content: space-between; margin-bottom: 18px; gap: 16px; }
      .inv-info-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; background: #f8fafc; }
      .inv-info-box .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px; }
      .inv-info-box .val { font-size: 13px; font-weight: 700; color: #1e293b; }
      .inv-info-box .sub { font-size: 10px; color: #64748b; margin-top: 2px; }
      /* Table */
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      thead tr { background: #1e293b; color: #fff; }
      thead th { padding: 9px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
      thead th.r { text-align: right; }
      tbody tr { border-bottom: 1px solid #e2e8f0; }
      tbody tr:nth-child(even) { background: #f8fafc; }
      tbody td { padding: 8px 10px; font-size: 11.5px; color: #334155; }
      tbody td.r { text-align: right; }
      tbody td.num { font-variant-numeric: tabular-nums; }
      /* Totals */
      .inv-total-row { background: #1e293b !important; }
      .inv-total-row td { padding: 10px 10px; font-size: 13px; font-weight: 800; color: #fff !important; }
      /* Words */
      .inv-words { font-size: 10.5px; font-style: italic; color: #475569; margin: 8px 0 24px; }
      /* Footer */
      .inv-footer { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 12px; border-top: 1px dashed #cbd5e1; }
      .inv-footer .sig { text-align: center; min-width: 160px; }
      .inv-footer .sig-line { border-top: 1.5px solid #334155; margin-bottom: 6px; }
      .inv-footer .sig-label { font-size: 11px; color: #475569; font-weight: 600; }
      .inv-stamp { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px; }
      @media print { body { padding: 16px; } }
    </style></head><body>
    <div class="inv-wrap">${content}</div>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(() => { w.print() }, 300)
  }

  const fmt = n => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })

  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: 720, maxHeight: '92vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 15 }}>Invoice Preview</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={print} icon={<Icon.Print style={{ width: 14, height: 14 }} />}>Print / PDF</Btn>
            <button className="modal-close" onClick={onClose}><Icon.X style={{ width: 14, height: 14 }} /></button>
          </div>
        </div>

        <div ref={printRef} style={{ padding: '28px 36px', background: '#fff' }}>
          {/* Company Header */}
          <div className="inv-header" style={{ textAlign: 'center', borderBottom: '3px double #1e293b', paddingBottom: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', letterSpacing: 1 }}>{co.name || 'SALE INVOICE'}</div>
            {co.tagline && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{co.tagline}</div>}
            {co.address && <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{[co.address, co.city].filter(Boolean).join(', ')}</div>}
            {(co.phone || co.mobile) && <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{[co.phone && `Ph: ${co.phone}`, co.mobile && `Mob: ${co.mobile}`].filter(Boolean).join('   |   ')}</div>}
            {(co.ntn || co.strn) && <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{[co.ntn && `NTN: ${co.ntn}`, co.strn && `STRN: ${co.strn}`].filter(Boolean).join('   |   ')}</div>}
          </div>

          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: '#475569', textTransform: 'uppercase', marginBottom: 18 }}>Sale Invoice</div>

          {/* Info boxes */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 2, border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 4 }}>Bill To</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{sale.shop_name || sale.customer_name || 'Direct Sale'}</div>
              {sale.customer_name && sale.shop_name && sale.customer_name !== sale.shop_name && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sale.customer_name}</div>
              )}
            </div>
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 4 }}>Bill No</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{sale.bill_no || '—'}</div>
            </div>
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 4 }}>Date</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{sale.sale_date}</div>
            </div>
            {sale.gate_pass_no && (
              <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 4 }}>Gate Pass #</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{sale.gate_pass_no}</div>
              </div>
            )}
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead>
              <tr style={{ background: '#1e293b' }}>
                <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'left', width: 36 }}>#</th>
                <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'left' }}>Product Name</th>
                {hasDescription && <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'left' }}>Description</th>}
                <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'right', width: 100 }}>Rate</th>
                <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'right', width: 60 }}>Qty</th>
                {hasDiscount && <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'right', width: 70 }}>Disc %</th>}
                <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'right', width: 110 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 1 ? '#f8fafc' : '#fff' }}>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#94a3b8', textAlign: 'left' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#1e293b', fontWeight: 500 }}>{item.product_name}</td>
                  {hasDescription && <td style={{ padding: '8px 10px', fontSize: 11, color: '#64748b' }}>{item.description || '—'}</td>}
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#334155', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>Rs. {fmt(item.product_rate)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#334155', textAlign: 'right', fontWeight: 600 }}>{item.product_qty}</td>
                  {hasDiscount && <td style={{ padding: '8px 10px', fontSize: 12, color: '#334155', textAlign: 'right' }}>{Number(item.discount) > 0 ? `${item.discount}%` : '—'}</td>}
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#1e293b', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Rs. {fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#1e293b' }}>
                <td colSpan={colSpan} style={{ padding: '11px 10px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#fff' }}>Grand Total</td>
                <td style={{ padding: '11px 10px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>Rs. {fmt(sale.total_amount)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Amount in words */}
          <div style={{ fontSize: 11, fontStyle: 'italic', color: '#475569', marginBottom: 32 }}>
            {numberToWords(Number(sale.total_amount))}
          </div>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 12, borderTop: '1px dashed #cbd5e1' }}>
            <div style={{ textAlign: 'center', minWidth: 160 }}>
              <div style={{ borderTop: '1.5px solid #334155', marginBottom: 6 }} />
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>Received By</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: 160 }}>
              <div style={{ borderTop: '1.5px solid #334155', marginBottom: 6 }} />
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>Authorized Signature</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: 9, color: '#94a3b8', marginTop: 20 }}>
            Generated by {co.name || 'DistriBooks'} — {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddCustomerModal({ onSave, onClose, saving }) {
  const [form, setForm] = useState(emptyCustomer)
  const change = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2>Quick Add Customer</h2>
          <button className="modal-close" onClick={onClose}><Icon.X style={{ width: 14, height: 14 }} /></button>
        </div>
        <div className="modal-body">
          <FormGrid cols={2}>
            <Select label="Customer Type" value={form.customerType} onChange={e => change('customerType', e.target.value)}>
              <option value="RETAILER">RETAILER</option>
              <option value="WHOLESALER">WHOLESALER</option>
            </Select>
            <Input label="Phone" placeholder="e.g. 0300-1234567" type="text" value={form.phone} onChange={e => change('phone', e.target.value)} />
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Shop Name" required placeholder="Shop name" value={form.shopName} onChange={e => change('shopName', e.target.value)} autoFocus />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Customer Name" placeholder="Owner / contact name" value={form.customerName} onChange={e => change('customerName', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Address" placeholder="Full address" value={form.address} onChange={e => change('address', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Opening Balance" type="number" step="any" placeholder="0" value={form.openingBalance || ''} onChange={e => change('openingBalance', Number(e.target.value))} />
            </div>
          </FormGrid>
        </div>
        <div className="modal-footer">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => onSave(form)} disabled={saving} icon={saving ? <Spinner size={13} /> : null}>
            {saving ? 'Saving…' : 'Add Customer'}
          </Btn>
        </div>
      </div>
    </div>
  )
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
    if (!customerForm.shopName) return alert('Shop name is required')
    if (!isValidPhone(customerForm.phone)) return alert('Invalid phone number. Use a format like 0300-1234567.')
    setSavingCustomer(true)
    try {
      const r = await api.post('/customers', customerForm)
      const updated = await api.get('/customers')
      setCustomers(updated.data)
      setForm(f => ({ ...f, customerId: String(r.data.id) }))
      setShowAddCustomer(false)
    } catch (e) { alert(e.response?.data?.error || 'Error adding customer') }
    setSavingCustomer(false)
  }

  const save = async () => {
    if (items.length === 0) return alert('Add at least one item')
    const unselected = items.find(i => !i.stockId || Number(i.stockId) === 0)
    if (unselected) return alert('Please select a product for all items')
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
    } catch (e) { alert(e.response?.data?.error || 'Error saving') }
    setSaving(false)
  }

  const saveAndPrint = async () => {
    if (items.length === 0) return alert('Add at least one item')
    const unselected = items.find(i => !i.stockId || Number(i.stockId) === 0)
    if (unselected) return alert('Please select a product for all items')
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
    } catch (e) { alert(e.response?.data?.error || 'Error saving') }
    setSaving(false)
  }

  const openPrint = async (id) => {
    const r = await api.get(`/sales/${id}`)
    setPrintSale(r.data)
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
      setItems((s.items || []).map(i => ({
        stockId: String(i.stock_id),
        itemCode: i.item_code || '',
        productName: i.product_name || '',
        description: i.description || '',
        productRate: String(i.product_rate || ''),
        qtyCtn: '',
        qtyPieces: String(i.product_qty || ''),
        piecesPerCtn: stList.find(st => st.id === i.stock_id)?.pieces_per_ctn || 1,
        discount: i.discount ? String(i.discount) : '',
      })))
      setView('new')
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to load sale for editing')
    }
  }

  const openReceipt = async (sale) => {
    try {
      setReceiptSale(sale)
      setReceiptForm({ amount: '', method: 'CASH', date: new Date().toISOString().split('T')[0], notes: '' })
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
    } catch (e) { alert('Failed to open receipt: ' + (e.message || '')) }
  }

  const saveReceipt = async () => {
    if (!receiptSale) return
    const amt = parseFloat(receiptForm.amount)
    if (!amt || amt <= 0) { alert('Enter a valid amount'); return }
    if (!receiptSale.customer_id) { alert('This sale has no customer. Cannot create a receipt.'); return }
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
      alert('Receipt saved successfully!')
    } catch (e) { alert(e.response?.data?.error || 'Failed to save receipt') }
    setReceiptSaving(false)
  }

  const del = async (id) => {
    try { await api.delete(`/sales/${id}`); await load() }
    catch (e) { alert(e.response?.data?.error || 'Cannot delete') }
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
                      <th style={{ width: 110 }}>Rate / Pc</th>
                      <th style={{ width: 80 }}>CTN</th>
                      <th style={{ width: 80 }}>Pieces</th>
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
                              options={stocks.map(s => ({ value: String(s.id), label: `${s.product_name} (${s.company_name}) — Qty: ${s.quantity}` }))}
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
                              type="number"
                              min="0"
                              step="any"
                              className="db-input"
                              value={item.productRate && item.piecesPerCtn ? +(Number(item.productRate) * Number(item.piecesPerCtn)).toFixed(4) : (item.productRate || '')}
                              onChange={e => updateItem(idx, 'productRate', Number(item.piecesPerCtn) > 0 ? Number(e.target.value) / Number(item.piecesPerCtn) : e.target.value)}
                              placeholder="0"
                              style={{ fontSize: 12 }}
                            />
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <input
                              type="number"
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
                              type="number"
                              min="0"
                              className="db-input"
                              value={item.qtyPieces || ''}
                              onChange={e => updateItem(idx, 'qtyPieces', e.target.value)}
                              placeholder="0"
                              style={{ fontSize: 12 }}
                            />
                          </td>
                          {opts.discount && (
                            <td style={{ padding: '8px 6px' }}>
                              <input
                                type="number"
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

      {printSale && <PrintInvoice sale={printSale} onClose={() => setPrintSale(null)} />}
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
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

      {printSale && <PrintInvoice sale={printSale} onClose={() => setPrintSale(null)} />}

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
                  Rs. {Number(receiptBalance).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
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
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Amount Received <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="number"
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
              <button onClick={saveReceipt} disabled={receiptSaving}
                style={{ background: '#f59e0b', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: receiptSaving ? 'not-allowed' : 'pointer', opacity: receiptSaving ? 0.7 : 1 }}>
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
