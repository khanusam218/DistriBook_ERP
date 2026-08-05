import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { toast } from '../components/Toast'
import { ExportBar, exportPDF, exportExcel, printTable, h } from '../utils/exportUtils'
import { DEVELOPER_CREDIT_LINE1, DEVELOPER_CREDIT_LINE2 } from '../utils/companyInfo'

const todayStr = () => new Date().toISOString().split('T')[0]
const fmt = n => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })

// ─── Print GP Report ─────────────────────────────────────────────────────────
// Sorted: primary = brand (vendor), secondary = item description alphabetically

function printGpReport(gp, items, companyName) {
  const sorted = [...items].sort((a, b) => {
    const bA = (a.brand || '').toLowerCase()
    const bB = (b.brand || '').toLowerCase()
    if (bA !== bB) return bA.localeCompare(bB)
    return (a.item_description || '').toLowerCase().localeCompare((b.item_description || '').toLowerCase())
  })
  const totalQty = sorted.reduce((s, i) => s + Number(i.quantity || 0), 0)
  const totalAmt = sorted.reduce((s, i) => s + Number(i.total || 0), 0)

  let lastBrand = null
  let sr = 1
  const rows = sorted.map(item => {
    const brand = item.brand || ''
    let hdr = ''
    if (brand !== lastBrand) {
      hdr = `<tr style="background:#eee"><td colspan="5" style="border:1px solid #000;padding:5px 8px;font-weight:bold;font-size:12pt">${h(brand)}</td></tr>`
      lastBrand = brand
    }
    return `${hdr}<tr>
      <td style="border:1px solid #000;padding:5px 8px">${sr++}</td>
      <td style="border:1px solid #000;padding:5px 8px">${h(item.item_code || '')}</td>
      <td style="border:1px solid #000;padding:5px 8px">${h(item.item_description || '')}</td>
      <td style="border:1px solid #000;padding:5px 8px;text-align:right">${Number(item.quantity || 0)}</td>
      <td style="border:1px solid #000;padding:5px 8px;text-align:right">Rs. ${fmt(item.total)}</td>
    </tr>`
  })

  const w = window.open('', '_blank')
  w.document.write(`<!DOCTYPE html><html><head><title>OGP #${h(gp.ogp_number)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13pt}.page{padding:15mm 18mm}
@page{margin:0;size:A4}@media print{@page{margin:0}}</style></head><body><div class="page">
<div style="font-size:20pt;font-weight:bold;margin-bottom:28px">${h(companyName || 'YOUR COMPANY')}</div>
<table style="border-collapse:collapse;margin-bottom:10px;font-size:13pt"><tbody>
<tr><td style="width:150px;padding:4px 0">OGP Number</td><td style="width:160px;padding:4px 0;font-weight:bold">${h(gp.ogp_number)}</td>
    <td style="width:150px;padding:4px 0">Delivery Man</td><td style="padding:4px 0">${h(gp.delivery_man || '')}</td></tr>
<tr><td style="padding:4px 0">OGP Date</td><td style="padding:4px 0">${h(gp.ogp_date || '')}</td>
    <td style="padding:4px 0">Sale Man</td><td style="padding:4px 0">${h(gp.delivery_sale_man || '')}</td></tr>
<tr><td style="padding:4px 0">Delivery Date</td><td style="padding:4px 0">${h(gp.delivery_date || '')}</td>
    <td style="padding:4px 0">Area</td><td style="padding:4px 0">${h(gp.area || '')}</td></tr>
<tr><td style="padding:4px 0">Mobile</td><td style="padding:4px 0">${h(gp.mobile || '')}</td><td></td><td></td></tr>
</tbody></table>
<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13pt">
<thead><tr>
  <th style="border:1px solid #000;padding:6px 8px;text-align:left;width:40px">Sr #</th>
  <th style="border:1px solid #000;padding:6px 8px;text-align:left;width:120px">Item Code</th>
  <th style="border:1px solid #000;padding:6px 8px;text-align:left">Item Description</th>
  <th style="border:1px solid #000;padding:6px 8px;text-align:right;width:70px">Qty</th>
  <th style="border:1px solid #000;padding:6px 8px;text-align:right;width:110px">Amount</th>
</tr></thead>
<tbody>${rows.join('')}</tbody>
<tfoot><tr>
  <td colspan="3" style="border:1px solid #000;padding:5px 8px;font-weight:bold">Total</td>
  <td style="border:1px solid #000;padding:5px 8px;text-align:right;font-weight:bold">${totalQty}</td>
  <td style="border:1px solid #000;padding:5px 8px;text-align:right;font-weight:bold">Rs. ${fmt(totalAmt)}</td>
</tr></tfoot></table>
<div style="margin-top:20px;font-size:9pt;font-weight:bold;color:#64748b;text-align:center">${h(DEVELOPER_CREDIT_LINE1)} | ${h(DEVELOPER_CREDIT_LINE2)}</div>
</div></body></html>`)
  w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 300)
}

// ─── Bill Delivery Order — one page per shop ─────────────────────────────────

function printBillDO(gp, shops, companyName) {
  const pages = shops.map((shop, idx) => {
    const shopTotal = shop.items.reduce((s, i) => s + Number(i.amount || 0), 0)
    const shopDisc = shop.items.reduce((s, i) => s + Number(i.discount || 0), 0)
    const shopNet = shopTotal - shopDisc
    const rows = shop.items.map((item, i) => `<tr>
      <td style="border:1px solid #000;padding:5px 7px">${i + 1}</td>
      <td style="border:1px solid #000;padding:5px 7px">${h(item.item_description || '')}</td>
      <td style="border:1px solid #000;padding:5px 7px">${h(item.brand || '')}</td>
      <td style="border:1px solid #000;padding:5px 7px;text-align:right">${item.qty_ctn}</td>
      <td style="border:1px solid #000;padding:5px 7px;text-align:right">${item.qty_pieces || 0}</td>
      <td style="border:1px solid #000;padding:5px 7px;text-align:right">Rs.${fmt(item.rate)}</td>
      <td style="border:1px solid #000;padding:5px 7px;text-align:right">Rs.${fmt(item.amount)}</td>
      <td style="border:1px solid #000;padding:5px 7px;text-align:right">Rs.${fmt(item.discount)}</td>
      <td style="border:1px solid #000;padding:5px 7px;text-align:right;font-weight:bold">Rs.${fmt(Number(item.amount) - Number(item.discount))}</td>
    </tr>`).join('')
    return `<div class="page"${idx > 0 ? ' style="page-break-before:always"' : ''}>
<div style="font-size:20pt;font-weight:bold;margin-bottom:18px">${h(companyName || 'YOUR COMPANY')}</div>
<table style="border-collapse:collapse;margin-bottom:10px;font-size:13pt"><tbody>
<tr><td style="width:120px;padding:4px 0">OGP #</td><td style="width:160px;padding:4px 0;font-weight:bold">${h(gp.ogp_number)}</td>
    <td style="width:90px;padding:4px 0">Bill To</td><td style="padding:4px 0;font-weight:bold;font-size:13pt">${h(shop.shop_name)}</td></tr>
<tr><td style="padding:4px 0">Date</td><td style="padding:4px 0">${h(gp.ogp_date || '')}</td>
    <td style="padding:4px 0">Delivery</td><td style="padding:4px 0">${h(gp.delivery_date || '')}</td></tr>
<tr><td style="padding:4px 0">Area</td><td style="padding:4px 0">${h(gp.area || '')}</td>
    <td style="padding:4px 0">Delivery Man</td><td style="padding:4px 0">${h(gp.delivery_man || '')}</td></tr>
</tbody></table>
<table style="width:100%;border-collapse:collapse;font-size:12pt">
<thead><tr style="background:#f5f5f5">
  <th style="border:1px solid #000;padding:5px 7px;width:32px">Sr</th>
  <th style="border:1px solid #000;padding:5px 7px;text-align:left">Item Description</th>
  <th style="border:1px solid #000;padding:5px 7px;width:75px">Brand</th>
  <th style="border:1px solid #000;padding:5px 7px;width:48px;text-align:right">Ctn</th>
  <th style="border:1px solid #000;padding:5px 7px;width:48px;text-align:right">Pcs</th>
  <th style="border:1px solid #000;padding:5px 7px;width:85px;text-align:right">Rate</th>
  <th style="border:1px solid #000;padding:5px 7px;width:95px;text-align:right">Amount</th>
  <th style="border:1px solid #000;padding:5px 7px;width:78px;text-align:right">Disc</th>
  <th style="border:1px solid #000;padding:5px 7px;width:95px;text-align:right">Net</th>
</tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr>
  <td colspan="6" style="border:1px solid #000;padding:5px 7px;font-weight:bold;text-align:right">Totals</td>
  <td style="border:1px solid #000;padding:5px 7px;text-align:right;font-weight:bold">Rs.${fmt(shopTotal)}</td>
  <td style="border:1px solid #000;padding:5px 7px;text-align:right;font-weight:bold">Rs.${fmt(shopDisc)}</td>
  <td style="border:1px solid #000;padding:5px 7px;text-align:right;font-weight:bold">Rs.${fmt(shopNet)}</td>
</tr></tfoot></table>
<p style="margin-top:14px;font-size:13pt">Grand Total: <strong>Rs. ${fmt(shopNet)}</strong></p>
<div style="margin-top:28px;font-size:13pt">Authorised Signature: _______________________</div>
<div style="margin-top:20px;font-size:9pt;font-weight:bold;color:#64748b;text-align:center">${h(DEVELOPER_CREDIT_LINE1)} | ${h(DEVELOPER_CREDIT_LINE2)}</div>
</div>`
  })
  const w = window.open('', '_blank')
  w.document.write(`<!DOCTYPE html><html><head><title>Bill DO — OGP #${h(gp.ogp_number)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13pt}
.page{padding:12mm 16mm}@page{margin:0;size:A4}@media print{@page{margin:0}}</style>
</head><body>${pages.join('')}</body></html>`)
  w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 400)
}

// ─── OGP Print Preview modal ──────────────────────────────────────────────────

function OgpPrint({ gp, companyName, onClose }) {
  const items = gp.items || []
  const totalQty = items.reduce((s, i) => s + Number(i.quantity), 0)
  const totalAmt = items.reduce((s, i) => s + Number(i.total), 0)

  const doPrint = () => printGpReport(gp, items.map(i => ({ ...i, brand: i.brand || '' })), companyName)

  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: 760, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <span className="font-bold" style={{ fontSize: 16 }}>OGP #{gp.ogp_number} — Preview</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={doPrint} className="btn btn-primary btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print / PDF
            </button>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ fontSize: 20, lineHeight: 1, padding: '2px 8px' }}>&times;</button>
          </div>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, background: '#f3f4f6' }}>
          <div className="bg-white shadow mx-auto p-8" style={{ width: 680, fontFamily: 'Arial,sans-serif', fontSize: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 28 }}>{companyName || 'YOUR COMPANY NAME'}</div>
            <table style={{ borderCollapse: 'collapse', marginBottom: 10 }}><tbody>
              <tr>
                <td style={{ width: 130, padding: '2px 0' }}>OGP Number</td>
                <td style={{ width: 150, padding: '2px 0', fontWeight: 'bold' }}>{gp.ogp_number}</td>
                <td style={{ width: 130, padding: '2px 0' }}>Delivery Man</td>
                <td style={{ padding: '2px 0' }}>{gp.delivery_man || ''}</td>
              </tr>
              <tr>
                <td style={{ padding: '2px 0' }}>OGP Date</td>
                <td style={{ padding: '2px 0' }}>{gp.ogp_date || ''}</td>
                <td style={{ padding: '2px 0' }}>Sale Man</td>
                <td style={{ padding: '2px 0' }}>{gp.delivery_sale_man || ''}</td>
              </tr>
              <tr>
                <td style={{ padding: '2px 0' }}>Delivery Date</td>
                <td style={{ padding: '2px 0' }}>{gp.delivery_date || ''}</td>
                <td style={{ padding: '2px 0' }}>Area</td>
                <td style={{ padding: '2px 0' }}>{gp.area || ''}</td>
              </tr>
              <tr>
                <td style={{ padding: '2px 0' }}>Mobile</td>
                <td style={{ padding: '2px 0' }}>{gp.mobile || ''}</td>
                <td /><td />
              </tr>
            </tbody></table>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr>
                  {['Sr #', 'Item Code', 'Item Description', 'Qty', 'Amt'].map((h, i) => (
                    <th key={h} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id}>
                    <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{i + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{item.item_code || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{item.item_description || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{Number(item.quantity)}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>Rs. {fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 'bold' }}>Total</td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 'bold' }}>{totalQty}</td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 'bold' }}>Rs. {fmt(totalAmt)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Staff Panel ──────────────────────────────────────────────────────────────


function StaffPanel({ title, type, staff, onAdd, onDelete }) {
  const [name, setName] = useState('')
  const list = staff.filter(s => s.type === type)
  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontWeight: 600, color: '#374151', marginBottom: 12, fontSize: 14 }}>{title}</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onAdd(name.trim(), type); setName('') } }}
          placeholder="Enter name and press Enter"
          className="db-input" style={{ flex: 1 }} />
        <button onClick={() => { if (name.trim()) { onAdd(name.trim(), type); setName('') } }}
          className="btn btn-primary btn-sm">Add</button>
      </div>
      {list.length === 0
        ? <p style={{ fontSize: 12, color: '#9ca3af' }}>No {title.toLowerCase()} added yet.</p>
        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {list.map(s => (
              <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f3f4f6', color: '#374151', fontSize: 12, padding: '3px 10px', borderRadius: 999 }}>
                {s.name}
                <button onClick={() => onDelete(s.id)} style={{ color: '#9ca3af', marginLeft: 2, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
                  onMouseOver={e => e.currentTarget.style.color='#ef4444'}
                  onMouseOut={e => e.currentTarget.style.color='#9ca3af'}>&times;</button>
              </span>
            ))}
          </div>
      }
    </div>
  )
}

// ─── Success Dialog ───────────────────────────────────────────────────────────

function SuccessDialog({ ogp, onBooking, onList }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{ marginBottom: 16 }}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" style={{ margin: '0 auto' }}><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>OGP Created Successfully</h2>
        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>OGP #{ogp?.ogp_number} has been saved.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onList} className="btn btn-secondary">
            Back to List
          </button>
          <button onClick={onBooking} className="btn btn-primary">
            Start Booking →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── LIST_COLS for Export ─────────────────────────────────────────────────────

const LIST_COLS = [
  { header: 'OGP #', accessor: r => r.ogp_number },
  { header: 'Date', accessor: r => r.ogp_date },
  { header: 'Delivery Date', accessor: r => r.delivery_date || '' },
  { header: 'Items', accessor: r => (r.items || []).map(i => `${i.item_description || i.product_name} ×${Number(i.quantity)}`).join(', ') || '-' },
  { header: 'Customer', accessor: r => r.shop_name || '-' },
  { header: 'Area', accessor: r => r.area || '' },
  { header: 'Total Qty', accessor: r => r.total_qty },
  { header: 'Total Amount', accessor: r => `Rs. ${Number(r.total_amount).toFixed(2)}` },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GatePass() {
  const [gatePasses, setGatePasses] = useState([])
  const [customers, setCustomers] = useState([])
  const [stocks, setStocks] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  // view: 'list' | 'new' | 'booking' | 'edit-gp'
  const [view, setView] = useState('list')

  // List state
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [saleRepFilter, setSaleRepFilter] = useState('')
  const [deliveryManFilter, setDeliveryManFilter] = useState('')
  const [printGpModal, setPrintGpModal] = useState(null)
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('ogp_company_name') || '')
  const [editingCompany, setEditingCompany] = useState(false)
  const [companyDraft, setCompanyDraft] = useState('')

  // OGP form state
  const [ogpForm, setOgpForm] = useState({
    ogpNumber: '', ogpDate: todayStr(), deliveryDate: todayStr(),
    mobile: '', deliveryMan: '', deliverySaleMan: '', area: '', customerId: '', remarks: ''
  })
  const [ogpSaving, setOgpSaving] = useState(false)
  const [successOgp, setSuccessOgp] = useState(null)

  // Booking state
  const [bookingOgp, setBookingOgp] = useState(null)
  const [bookingItems, setBookingItems] = useState([])
  const [bookingSaving, setBookingSaving] = useState(false)
  const [bookingError, setBookingError] = useState('')

  // Edit GP state
  const [editGp, setEditGp] = useState(null)
  const [editGpItems, setEditGpItems] = useState([])
  const [editGpSaving, setEditGpSaving] = useState(false)
  const [editGpError, setEditGpError] = useState('')

  // Quick-add form
  const [qBrand, setQBrand] = useState('')
  const [qShopSearch, setQShopSearch] = useState('')
  const [qShopSuggs, setQShopSuggs] = useState([])
  const [qShop, setQShop] = useState(null)
  const [qItemSearch, setQItemSearch] = useState('')
  const [qItemSuggs, setQItemSuggs] = useState([])
  const [qItem, setQItem] = useState(null)
  const [qCtn, setQCtn] = useState('')
  const [qPcs, setQPcs] = useState('0')
  const [qRate, setQRate] = useState('')
  const [qAmount, setQAmount] = useState('')
  const [qDisc, setQDisc] = useState('0')
  const [qError, setQError] = useState('')

  const shopRef = useRef(null)
  const itemRef = useRef(null)
  const ctnRef = useRef(null)

  // ── Load data ──

  const loadAll = () => Promise.all([
    api.get('/gate-passes'),
    api.get('/customers'),
    api.get('/stocks'),
    api.get('/gate-passes/staff'),
  ]).then(([g, c, s, st]) => {
    setGatePasses(g.data)
    setCustomers(c.data)
    setStocks(s.data)
    setStaff(st.data)
    setLoading(false)
  })

  useEffect(() => { loadAll() }, [])

  // ── Derived ──

  const brands = [...new Set(stocks.map(s => s.company_name).filter(Boolean))].sort()
  const saleReps = staff.filter(s => s.type === 'SALE_REP')
  const deliveryMen = staff.filter(s => s.type === 'DELIVERY_MAN')

  // ── Staff helpers ──

  const addStaff = async (name, type) => {
    try { await api.post('/gate-passes/staff', { name, type }); await loadAll() }
    catch (e) { toast(e.response?.data?.error || 'Error') }
  }
  const deleteStaff = async (id) => {
    try { await api.delete(`/gate-passes/staff/${id}`); await loadAll() }
    catch (e) { toast(e.response?.data?.error || 'Error') }
  }

  // ── Company name ──

  const saveCompanyName = () => {
    localStorage.setItem('ogp_company_name', companyDraft)
    setCompanyName(companyDraft)
    setEditingCompany(false)
  }

  // ── Open new OGP form ──

  const openNew = async () => {
    const r = await api.get('/gate-passes/next-ogp')
    setOgpForm({
      ogpNumber: String(r.data.ogpNumber),
      ogpDate: todayStr(), deliveryDate: todayStr(),
      mobile: '', deliveryMan: '', deliverySaleMan: '', area: '', customerId: '', remarks: ''
    })
    setSuccessOgp(null)
    setView('new')
  }

  // ── Save OGP header ──

  const saveOgp = async () => {
    if (!ogpForm.ogpNumber) { toast('OGP number required'); return }
    setOgpSaving(true)
    try {
      const r = await api.post('/gate-passes', {
        ogpNumber: Number(ogpForm.ogpNumber),
        ogpDate: ogpForm.ogpDate,
        deliveryDate: ogpForm.deliveryDate,
        mobile: ogpForm.mobile,
        deliveryMan: ogpForm.deliveryMan,
        deliverySaleMan: ogpForm.deliverySaleMan,
        area: ogpForm.area,
        customerId: ogpForm.customerId || null,
        remarks: ogpForm.remarks,
      })
      await loadAll()
      setSuccessOgp(r.data)
    } catch (e) {
      toast(e.response?.data?.error || 'Error creating OGP')
    }
    setOgpSaving(false)
  }

  // ── Open booking for an OGP ──

  const openBooking = async (gp) => {
    setBookingOgp(gp)
    setBookingError('')
    setQBrand(''); setQShopSearch(''); setQShop(null)
    setQItemSearch(''); setQItem(null)
    setQCtn(''); setQPcs('0'); setQRate(''); setQAmount(''); setQDisc('0')
    setQError('')
    try {
      const r = await api.get(`/gate-passes/${gp.id}/booking-items`)
      setBookingItems(r.data.map(i => ({ ...i, _key: `db-${i.id}` })))
    } catch {
      setBookingItems([])
    }
    setView('booking')
  }

  // ── Quick-add: shop search ──

  const handleShopSearch = val => {
    setQShopSearch(val); setQShop(null)
    if (!val.trim()) { setQShopSuggs([]); return }
    const q = val.toLowerCase()
    setQShopSuggs(customers.filter(c =>
      c.shop_name?.toLowerCase().includes(q) || c.customer_code?.toLowerCase().includes(q)
    ).slice(0, 8))
  }

  const selectShop = c => {
    setQShop(c); setQShopSearch(c.shop_name); setQShopSuggs([])
    setTimeout(() => itemRef.current?.focus(), 30)
  }

  // ── Quick-add: item search (filtered by brand) ──

  const filteredStocks = stocks.filter(s => !qBrand || s.company_name === qBrand)

  const handleItemSearch = val => {
    setQItemSearch(val); setQItem(null); setQRate(''); setQAmount('')
    if (!val.trim()) { setQItemSuggs([]); return }
    const q = val.toLowerCase()
    setQItemSuggs(filteredStocks.filter(s =>
      s.product_name?.toLowerCase().includes(q) ||
      String(s.id).includes(q)
    ).slice(0, 8))
  }

  const selectItem = s => {
    setQItem(s); setQItemSearch(s.product_name); setQItemSuggs([])
    setQRate(String(s.sale_price))
    const qty = parseFloat(qCtn) || 0
    setQAmount(String((qty * s.sale_price).toFixed(2)))
    setTimeout(() => ctnRef.current?.focus(), 30)
  }

  // ── Auto-recalc amount ──

  const handleCtnChange = val => {
    setQCtn(val)
    const qty = parseFloat(val) || 0
    const rate = parseFloat(qRate) || 0
    setQAmount(String((qty * rate).toFixed(2)))
  }

  const handleRateChange = val => {
    setQRate(val)
    const qty = parseFloat(qCtn) || 0
    const rate = parseFloat(val) || 0
    setQAmount(String((qty * rate).toFixed(2)))
  }

  // ── Add line to booking ──

  const addLine = () => {
    if (!qShop) { setQError('Select a shop'); return }
    if (!qItem) { setQError('Select an item'); return }
    const ctn = parseFloat(qCtn) || 0
    if (ctn <= 0) { setQError('Enter Ctn quantity'); return }
    setQError('')
    const amount = parseFloat(qAmount) || 0
    const disc = parseFloat(qDisc) || 0
    setBookingItems(prev => [...prev, {
      _key: Date.now(),
      customer_id: qShop.id,
      shop_name: qShop.shop_name,
      customer_code: qShop.customer_code,
      stock_id: qItem.id,
      brand: qItem.company_name,
      item_code: `P${String(qItem.id).padStart(10, '0')}`,
      item_description: qItem.product_name,
      qty_ctn: ctn,
      qty_pieces: parseFloat(qPcs) || 0,
      pieces_per_ctn: qItem.pieces_per_ctn,
      rate: parseFloat(qRate) || 0,
      amount,
      discount: disc,
    }])
    // Keep shop, clear item/qty for next line
    setQItemSearch(''); setQItem(null)
    setQCtn(''); setQPcs('0'); setQRate(''); setQAmount(''); setQDisc('0')
    setTimeout(() => itemRef.current?.focus(), 30)
  }

  // ── Save booking ──

  const saveBooking = async () => {
    if (!bookingOgp) return
    setBookingSaving(true); setBookingError('')
    try {
      await api.post(`/gate-passes/${bookingOgp.id}/booking-items`, { items: bookingItems })
      await loadAll()
      setBookingError('✓ Booking saved successfully')
    } catch (e) {
      setBookingError(e.response?.data?.error || 'Error saving booking')
    }
    setBookingSaving(false)
  }

  // ── Print GP from booking screen ──

  const handlePrintGp = async () => {
    if (!bookingOgp) return
    try {
      const r = await api.get(`/gate-passes/${bookingOgp.id}/consolidated`)
      printGpReport(r.data.gatePass || bookingOgp, r.data.items, companyName)
    } catch { toast('Error loading items') }
  }

  // ── Bill Delivery Order from booking screen ──

  const handleBillDO = async () => {
    if (!bookingOgp) return
    try {
      const r = await api.get(`/gate-passes/${bookingOgp.id}/bill-data`)
      if (!r.data.shops.length) { toast('No booking items saved yet — save the booking first'); return }
      printBillDO(r.data.gatePass, r.data.shops, companyName)
    } catch { toast('Error loading bill data') }
  }

  // ── List helpers ──

  const filtered = gatePasses.filter(g => {
    if (customerFilter && String(g.customer_id) !== customerFilter) return false
    if (dateFrom && g.ogp_date < dateFrom) return false
    if (dateTo && g.ogp_date > dateTo) return false
    return true
  })

  const openEditGp = async (gp) => {
    setEditGp(gp)
    setEditGpError('')
    try {
      const r = await api.get(`/gate-passes/${gp.id}/booking-items`)
      setEditGpItems(r.data.map(i => ({ ...i, returnQty: 0, origRate: Number(i.rate) })))
    } catch {
      setEditGpItems([])
    }
    setView('edit-gp')
  }

  const saveEditGp = async () => {
    if (!editGp) return
    setEditGpSaving(true); setEditGpError('')
    try {
      // Update rates for changed items
      const rateChanges = editGpItems.filter(i => Number(i.rate) !== Number(i.origRate))
      if (rateChanges.length > 0) {
        await api.patch(`/gate-passes/${editGp.id}/booking-item-rates`, {
          items: rateChanges.map(i => ({ id: i.id, rate: Number(i.rate) }))
        })
      }

      // Process returns grouped by customer
      const returnItems = editGpItems.filter(i => Number(i.returnQty) > 0)
      if (returnItems.length > 0) {
        const byCustomer = {}
        for (const item of returnItems) {
          const key = String(item.customer_id || 'unknown')
          if (!byCustomer[key]) byCustomer[key] = { customer_id: item.customer_id, shop_name: item.shop_name, items: [] }
          byCustomer[key].items.push({
            stock_id: item.stock_id,
            item_code: item.item_code,
            item_description: item.item_description,
            brand: item.brand,
            qty_ctn: Number(item.returnQty),
            qty_pieces: 0,
            rate: Number(item.rate),
          })
        }
        for (const group of Object.values(byCustomer)) {
          await api.post(`/gate-passes/${editGp.id}/returns`, {
            customer_id: group.customer_id,
            shop_name: group.shop_name,
            return_date: todayStr(),
            items: group.items,
          })
        }
      }

      await loadAll()
      setEditGpError('✓ Changes saved successfully')
      setTimeout(() => { setView('list'); setEditGp(null); setEditGpItems([]) }, 1200)
    } catch (e) {
      setEditGpError(e.response?.data?.error || 'Error saving changes')
    }
    setEditGpSaving(false)
  }

  const delGp = async (id) => {
    if (!confirm('Delete this gate pass? Stock quantities will be restored.')) return
    try { await api.delete(`/gate-passes/${id}`); await loadAll() }
    catch (e) { toast(e.response?.data?.error || 'Error') }
  }

  const openPrint = async (id) => {
    const r = await api.get(`/gate-passes/${id}`)
    setPrintGpModal(r.data)
  }

  // ── Booking totals ──

  const bTotalQty = bookingItems.reduce((s, i) => s + Number(i.qty_ctn), 0)
  const bTotalAmt = bookingItems.reduce((s, i) => s + Number(i.amount), 0)
  const bTotalDisc = bookingItems.reduce((s, i) => s + Number(i.discount), 0)
  const bGrandTotal = bTotalAmt - bTotalDisc

  if (loading) return <div style={{ padding: 32, color: '#6b7280' }}>Loading…</div>

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: NEW OGP FORM
  // ════════════════════════════════════════════════════════════════════════════

  if (view === 'new') return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      {successOgp && (
        <SuccessDialog
          ogp={successOgp}
          onList={() => { setSuccessOgp(null); setView('list') }}
          onBooking={() => {
            setSuccessOgp(null)
            const fresh = gatePasses.find(g => g.id === successOgp.id) || successOgp
            openBooking(fresh)
          }}
        />
      )}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Create Outward Gate Pass (OGP)</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Fill in delivery details and save to create the OGP</p>
        </div>
        <button onClick={() => setView('list')} className="btn btn-ghost btn-sm">← Back to List</button>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {/* OGP Number */}
          <div>
            <label className="form-label">OGP Number *</label>
            <input type="number" onWheel={e => e.target.blur()} value={ogpForm.ogpNumber || ''} autoFocus
              placeholder="Auto-generated"
              onChange={e => setOgpForm(f => ({ ...f, ogpNumber: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveOgp()}
              className="db-input" style={{ width: '100%' }} />
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Auto-generated, editable</p>
          </div>
          {/* OGP Date */}
          <div>
            <label className="form-label">OGP Date</label>
            <input type="date" value={ogpForm.ogpDate}
              onChange={e => setOgpForm(f => ({ ...f, ogpDate: e.target.value }))}
              className="db-input" style={{ width: '100%' }} />
          </div>
          {/* Delivery Date */}
          <div>
            <label className="form-label">Delivery Date</label>
            <input type="date" value={ogpForm.deliveryDate}
              onChange={e => setOgpForm(f => ({ ...f, deliveryDate: e.target.value }))}
              className="db-input" style={{ width: '100%' }} />
          </div>
          {/* Delivery Man */}
          <div>
            <label className="form-label">Delivery Man</label>
            <select value={ogpForm.deliveryMan}
              onChange={e => setOgpForm(f => ({ ...f, deliveryMan: e.target.value }))}
              className="db-input db-select" style={{ width: '100%' }}>
              <option value="">— Select —</option>
              {deliveryMen.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          {/* Mobile */}
          <div>
            <label className="form-label">Mobile #</label>
            <input type="text" value={ogpForm.mobile} placeholder="03XX-XXXXXXX"
              onChange={e => setOgpForm(f => ({ ...f, mobile: e.target.value }))}
              className="db-input" style={{ width: '100%' }} />
          </div>
          {/* Delivery Sale Man */}
          <div>
            <label className="form-label">Delivery Sale Man</label>
            <select value={ogpForm.deliverySaleMan}
              onChange={e => setOgpForm(f => ({ ...f, deliverySaleMan: e.target.value }))}
              className="db-input db-select" style={{ width: '100%' }}>
              <option value="">— Select —</option>
              {saleReps.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          {/* Area */}
          <div>
            <label className="form-label">Area</label>
            <input type="text" value={ogpForm.area} placeholder="e.g. Gulshan, SITE"
              onChange={e => setOgpForm(f => ({ ...f, area: e.target.value }))}
              className="db-input" style={{ width: '100%' }} />
          </div>
          {/* Customer */}
          <div>
            <label className="form-label">Customer / Trader (optional)</label>
            <select value={ogpForm.customerId}
              onChange={e => setOgpForm(f => ({ ...f, customerId: e.target.value }))}
              className="db-input db-select" style={{ width: '100%' }}>
              <option value="">— Direct Dispatch —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.shop_name} ({c.customer_type})</option>)}
            </select>
          </div>
          {/* Remarks */}
          <div>
            <label className="form-label">Remarks</label>
            <input type="text" value={ogpForm.remarks} placeholder="Optional notes"
              onChange={e => setOgpForm(f => ({ ...f, remarks: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveOgp()}
              className="db-input" style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={saveOgp} disabled={ogpSaving} className="btn btn-primary" style={{ minWidth: 160 }}>
            {ogpSaving ? 'Saving…' : 'Save (OGP Create)'}
          </button>
        </div>
      </div>

      {/* Staff panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <StaffPanel title="Sale Representatives" type="SALE_REP" staff={staff} onAdd={addStaff} onDelete={deleteStaff} />
        <StaffPanel title="Delivery Men" type="DELIVERY_MAN" staff={staff} onAdd={addStaff} onDelete={deleteStaff} />
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: EDIT GATE PASS
  // ════════════════════════════════════════════════════════════════════════════

  if (view === 'edit-gp') {
    // Group items by customer for display
    const gpGroups = []
    const gpGroupMap = {}
    for (const item of editGpItems) {
      const key = String(item.customer_id || '__no_cust__')
      if (!gpGroupMap[key]) {
        const g = { customer_id: item.customer_id, shop_name: item.shop_name || 'Unknown Shop', rows: [] }
        gpGroupMap[key] = g
        gpGroups.push(g)
      }
      gpGroupMap[key].rows.push(item)
    }

    const updateRate = (itemId, val) => {
      setEditGpItems(prev => prev.map(i => i.id === itemId ? { ...i, rate: val } : i))
    }
    const updateReturnQty = (itemId, val) => {
      setEditGpItems(prev => prev.map(i => i.id === itemId ? { ...i, returnQty: val } : i))
    }

    return (
      <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h1 className="page-title">Edit Gate Pass</h1>
            <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: '#6b7280', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: '#1d4ed8' }}>OGP #{editGp?.ogp_number}</span>
              {editGp?.ogp_date && <span>Date: {editGp.ogp_date}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveEditGp} disabled={editGpSaving} className="btn btn-primary">
              {editGpSaving ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={() => { setView('list'); setEditGp(null); setEditGpItems([]) }}
              className="btn btn-ghost btn-sm">← Back to List</button>
          </div>
        </div>

        {editGpError && (
          <div className={editGpError.startsWith('✓') ? 'alert alert-success' : 'alert alert-error'} style={{ marginBottom: 16 }}>
            {editGpError}
          </div>
        )}

        {editGpItems.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
            No booking items found for this gate pass. Use the Booking view to add items first.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {gpGroups.map(group => (
              <div key={group.customer_id || '__nc__'} className="card" style={{ overflow: 'hidden', padding: 0 }}>
                <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '8px 16px' }}>
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{group.shop_name}</span>
                </div>
                <table className="db-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th>Brand</th>
                      <th style={{ textAlign: 'right', width: 80 }}>Qty CTN</th>
                      <th style={{ textAlign: 'right', width: 130 }}>Rate (Rs.)</th>
                      <th style={{ textAlign: 'right', width: 110 }}>Amount</th>
                      <th style={{ textAlign: 'right', width: 130 }}>Return Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((item, idx) => {
                      const rate = parseFloat(item.rate) || 0
                      const qty = parseFloat(item.qty_ctn) || 0
                      const amount = qty * rate
                      const retQty = parseFloat(item.returnQty) || 0
                      const rateChanged = Number(item.rate) !== Number(item.origRate)
                      return (
                        <tr key={item.id} style={rateChanged ? { background: '#fefce8' } : {}}>
                          <td style={{ color: '#9ca3af' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 500, color: '#1f2937' }}>{item.item_description}</td>
                          <td style={{ color: '#6b7280', fontSize: 12 }}>{item.brand}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{qty}</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number" onWheel={e => e.target.blur()}
                              value={item.rate || ''}
                              onChange={e => updateRate(item.id, e.target.value)}
                              className="db-input"
                              style={{ width: 96, textAlign: 'right' }}
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                            />
                          </td>
                          <td style={{ textAlign: 'right', color: '#374151' }}>Rs. {amount.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number" onWheel={e => e.target.blur()}
                              value={item.returnQty || ''}
                              onChange={e => updateReturnQty(item.id, e.target.value)}
                              className="db-input"
                              style={{ width: 96, textAlign: 'right', ...(retQty > 0 ? { borderColor: '#f87171', background: '#fff1f2' } : {}) }}
                              min="0"
                              max={qty}
                              step="1"
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f9fafb', fontWeight: 600, fontSize: 13 }}>
                      <td colSpan={3} style={{ color: '#6b7280' }}>Total</td>
                      <td style={{ textAlign: 'right' }}>{group.rows.reduce((s, i) => s + (parseFloat(i.qty_ctn) || 0), 0)}</td>
                      <td></td>
                      <td style={{ textAlign: 'right' }}>Rs. {group.rows.reduce((s, i) => s + ((parseFloat(i.qty_ctn) || 0) * (parseFloat(i.rate) || 0)), 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>
                        {group.rows.reduce((s, i) => s + (parseFloat(i.returnQty) || 0), 0) > 0
                          ? `-${group.rows.reduce((s, i) => s + (parseFloat(i.returnQty) || 0), 0)} CTN returned`
                          : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span><span className="badge badge-amber" style={{ marginRight: 4 }}>Yellow rows</span> = rate changed from original</span>
          <span><span style={{ display: 'inline-block', background: '#fff1f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 4, padding: '1px 8px', marginRight: 4, fontSize: 11 }}>Red input</span> = return qty entered (stock will be restored)</span>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: BOOKING DELIVERY ORDER
  // ════════════════════════════════════════════════════════════════════════════

  if (view === 'booking') return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Booking Delivery Order</h1>
          <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: '#6b7280', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: '#1d4ed8' }}>OGP #{bookingOgp?.ogp_number}</span>
            {bookingOgp?.ogp_date && <span>Date: {bookingOgp.ogp_date}</span>}
            {bookingOgp?.delivery_date && <span>Delivery: {bookingOgp.delivery_date}</span>}
            {bookingOgp?.delivery_man && <span>DM: {bookingOgp.delivery_man}</span>}
            {bookingOgp?.delivery_sale_man && <span>SM: {bookingOgp.delivery_sale_man}</span>}
            {bookingOgp?.area && <span>Area: {bookingOgp.area}</span>}
          </div>
        </div>
        <button onClick={() => setView('list')} className="btn btn-ghost btn-sm">← Back to List</button>
      </div>

      {/* Brand filter */}
      <div className="card" style={{ padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#4b5563', whiteSpace: 'nowrap' }}>Select Brand:</span>
        <select value={qBrand} onChange={e => { setQBrand(e.target.value); setQItemSearch(''); setQItem(null) }}
          className="db-input db-select" style={{ minWidth: 180 }}>
          <option value="">All Brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {qBrand && <span className="badge badge-blue">{qBrand} selected</span>}
      </div>

      {/* Quick add form */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Add Line Item</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Shop */}
          <div style={{ position: 'relative', minWidth: 200 }}>
            <label className="form-label">Shop</label>
            <input ref={shopRef} type="text" value={qShopSearch} autoComplete="off" autoFocus
              onChange={e => handleShopSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && qShopSuggs.length) selectShop(qShopSuggs[0]); if (e.key === 'Escape') setQShopSuggs([]) }}
              placeholder="Code or name…"
              className="db-input" style={{ width: '100%' }} />
            {qShopSuggs.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4, maxHeight: 192, overflowY: 'auto' }}>
                {qShopSuggs.map(c => (
                  <button key={c.id} onMouseDown={() => selectShop(c)}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, display: 'flex', gap: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background='#eff6ff'}
                    onMouseOut={e => e.currentTarget.style.background='none'}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', width: 56, flexShrink: 0 }}>{c.customer_code}</span>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.shop_name}</span>
                  </button>
                ))}
              </div>
            )}
            {qShop && <p style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>✓ {qShop.shop_name}</p>}
          </div>

          {/* Item */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <label className="form-label">Item {qBrand && <span style={{ color: '#3b82f6' }}>({qBrand})</span>}</label>
            <input ref={itemRef} type="text" value={qItemSearch} autoComplete="off"
              onChange={e => handleItemSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && qItemSuggs.length) selectItem(qItemSuggs[0]); if (e.key === 'Escape') setQItemSuggs([]) }}
              placeholder="Code or name…"
              className="db-input" style={{ width: '100%' }} />
            {qItemSuggs.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4, maxHeight: 192, overflowY: 'auto' }}>
                {qItemSuggs.map(s => (
                  <button key={s.id} onMouseDown={() => selectItem(s)}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background='#eff6ff'}
                    onMouseOut={e => e.currentTarget.style.background='none'}>
                    <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.product_name}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{s.company_name}</span>
                    <span style={{ fontSize: 11, color: '#d1d5db', flexShrink: 0 }}>Qty:{s.quantity}</span>
                  </button>
                ))}
              </div>
            )}
            {qItem && <p style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>✓ {qItem.product_name} · Rs.{fmt(qItem.sale_price)}</p>}
          </div>

          {/* Qty Ctn */}
          <div style={{ width: 80 }}>
            <label className="form-label">Ctn</label>
            <input ref={ctnRef} type="number" onWheel={e => e.target.blur()} value={qCtn || ''} min="0" step="1"
              onChange={e => handleCtnChange(e.target.value)}
              placeholder="0"
              className="db-input" style={{ width: '100%' }} />
          </div>

          {/* Qty Pcs */}
          <div style={{ width: 70 }}>
            <label className="form-label">Pcs</label>
            <input type="number" onWheel={e => e.target.blur()} value={qPcs || ''} min="0" step="1"
              onChange={e => setQPcs(e.target.value)}
              placeholder="0"
              className="db-input" style={{ width: '100%' }} />
          </div>

          {/* Rate */}
          <div style={{ width: 90 }}>
            <label className="form-label">Rate</label>
            <input type="number" onWheel={e => e.target.blur()} value={qRate || ''} min="0" step="0.01"
              onChange={e => handleRateChange(e.target.value)}
              placeholder="0.00"
              className="db-input" style={{ width: '100%' }} />
          </div>

          {/* Amount */}
          <div style={{ width: 100 }}>
            <label className="form-label">Amount</label>
            <input type="number" onWheel={e => e.target.blur()} value={qAmount || ''} min="0" step="0.01"
              onChange={e => setQAmount(e.target.value)}
              placeholder="0.00"
              className="db-input" style={{ width: '100%' }} />
          </div>

          {/* Discount */}
          <div style={{ width: 90 }}>
            <label className="form-label">Disc</label>
            <input type="number" onWheel={e => e.target.blur()} value={qDisc || ''} min="0" step="0.01"
              onChange={e => setQDisc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addLine() }}
              placeholder="0.00"
              className="db-input" style={{ width: '100%' }} />
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <button onClick={addLine} className="btn btn-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Line
            </button>
          </div>
        </div>
        {qError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{qError}</p>}
      </div>

      {/* Line items grid */}
      {bookingItems.length > 0 && (
        <div className="card" style={{ marginBottom: 16, overflow: 'hidden', padding: 0 }}>
          <table className="db-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                {['#', 'Shop', 'Item', 'Brand', 'Ctn', 'Pcs', 'Rate', 'Amount', 'Disc', 'Net', ''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookingItems.map((item, i) => (
                <tr key={item._key}>
                  <td style={{ color: '#9ca3af', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{item.shop_name}</td>
                  <td>{item.item_description}</td>
                  <td style={{ fontSize: 12, color: '#6b7280' }}>{item.brand}</td>
                  <td style={{ textAlign: 'center' }}>{item.qty_ctn}</td>
                  <td style={{ textAlign: 'center', color: '#6b7280' }}>{item.qty_pieces || 0}</td>
                  <td>
                    <input type="number" onWheel={e => e.target.blur()} value={item.rate || ''} min="0" step="0.01"
                      placeholder="0.00"
                      onChange={e => setBookingItems(prev => prev.map((x, j) => j === i
                        ? { ...x, rate: parseFloat(e.target.value) || 0, amount: (parseFloat(e.target.value) || 0) * x.qty_ctn }
                        : x))}
                      className="db-input" style={{ width: 76, textAlign: 'right' }} />
                  </td>
                  <td>
                    <input type="number" onWheel={e => e.target.blur()} value={item.amount || ''} min="0" step="0.01"
                      placeholder="0.00"
                      onChange={e => setBookingItems(prev => prev.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                      className="db-input" style={{ width: 90, textAlign: 'right' }} />
                  </td>
                  <td>
                    <input type="number" onWheel={e => e.target.blur()} value={item.discount || ''} min="0" step="0.01"
                      placeholder="0.00"
                      onChange={e => setBookingItems(prev => prev.map((x, j) => j === i ? { ...x, discount: parseFloat(e.target.value) || 0 } : x))}
                      className="db-input" style={{ width: 76, textAlign: 'right' }} />
                  </td>
                  <td style={{ fontWeight: 600, color: '#15803d', fontSize: 12, whiteSpace: 'nowrap' }}>
                    Rs. {fmt(Number(item.amount) - Number(item.discount))}
                  </td>
                  <td>
                    <button onClick={() => setBookingItems(prev => prev.filter((_, j) => j !== i))}
                      className="btn btn-ghost btn-sm" style={{ color: '#ef4444', padding: '2px 6px' }}
                      title="Remove row">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      {bookingItems.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          {[
            { label: 'Total Book Qty', value: bTotalQty + ' Ctns', bg: '#eff6ff', color: '#1e40af' },
            { label: 'Total Amount', value: 'Rs. ' + fmt(bTotalAmt), bg: '#f9fafb', color: '#1f2937' },
            { label: 'Total Discount', value: 'Rs. ' + fmt(bTotalDisc), bg: '#fff7ed', color: '#9a3412' },
            { label: 'Grand Total', value: 'Rs. ' + fmt(bGrandTotal), bg: '#f0fdf4', color: '#15803d' },
          ].map(t => (
            <div key={t.label} style={{ borderRadius: 12, padding: 16, background: t.bg }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: t.color, opacity: 0.7 }}>{t.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: t.color }}>{t.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={saveBooking} disabled={bookingSaving || !bookingItems.length} className="btn btn-primary" style={{ background: '#16a34a' }}>
          {bookingSaving ? 'Saving…' : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save Booking</>
          )}
        </button>
        <button onClick={handlePrintGp} className="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print GP
        </button>
        <button onClick={handleBillDO} className="btn btn-secondary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Bill Delivery Order
        </button>
        {bookingError && (
          <span className={bookingError.startsWith('✓') ? 'alert alert-success' : 'alert alert-error'} style={{ padding: '6px 12px', fontSize: 13 }}>
            {bookingError}
          </span>
        )}
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: LIST
  // ════════════════════════════════════════════════════════════════════════════

  const printMeta = [
    saleRepFilter ? `Sale Representative: ${saleRepFilter}` : '',
    deliveryManFilter ? `Delivery Man: ${deliveryManFilter}` : '',
  ].filter(Boolean).join('  |  ')

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Gate Pass (OGP)</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Outgoing Gate Pass — deducts stock, independent of sales</p>
        </div>
        <button onClick={openNew} className="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Gate Pass
        </button>
      </div>

      {/* Company name for print */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#1e40af', whiteSpace: 'nowrap' }}>Company Name (printed on OGP):</span>
        {editingCompany ? (
          <>
            <input autoFocus type="text" value={companyDraft} onChange={e => setCompanyDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveCompanyName(); if (e.key === 'Escape') setEditingCompany(false) }}
              placeholder="Enter company name"
              className="db-input" style={{ flex: 1 }} />
            <button onClick={saveCompanyName} className="btn btn-primary btn-sm">Save</button>
            <button onClick={() => setEditingCompany(false)} className="btn btn-ghost btn-sm">Cancel</button>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 700, color: '#1e3a8a', fontSize: 13 }}>
              {companyName || <span style={{ color: '#ef4444', fontStyle: 'italic' }}>Not set — click Edit</span>}
            </span>
            <button onClick={() => { setCompanyDraft(companyName); setEditingCompany(true) }}
              className="btn btn-ghost btn-sm" style={{ color: '#2563eb' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
          </>
        )}
      </div>

      {/* Staff panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <StaffPanel title="Sale Representatives" type="SALE_REP" staff={staff} onAdd={addStaff} onDelete={deleteStaff} />
        <StaffPanel title="Delivery Men" type="DELIVERY_MAN" staff={staff} onAdd={addStaff} onDelete={deleteStaff} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8, alignItems: 'center' }}>
        <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}
          className="db-input db-select">
          <option value="">All Customers</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.shop_name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="db-input" title="From" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="db-input" title="To" />
        {(dateFrom || dateTo || customerFilter) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setCustomerFilter('') }}
            className="btn btn-ghost btn-sm" style={{ color: '#6b7280' }}>Clear Filters</button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>For print header:</span>
        <select value={saleRepFilter} onChange={e => setSaleRepFilter(e.target.value)}
          className="db-input db-select">
          <option value="">— Sale Representative —</option>
          {saleReps.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select value={deliveryManFilter} onChange={e => setDeliveryManFilter(e.target.value)}
          className="db-input db-select">
          <option value="">— Delivery Man —</option>
          {deliveryMen.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <ExportBar
          onPDF={() => exportPDF('Gate Pass Report', LIST_COLS, filtered, 'gate_passes', printMeta)}
          onExcel={() => exportExcel('Gate Pass Report', LIST_COLS, filtered, 'gate_passes')}
          onPrint={() => printTable('Gate Pass Report', LIST_COLS, filtered, printMeta)}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <table className="db-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 80 }}>OGP #</th>
              <th style={{ width: 110 }}>Date</th>
              <th>Items</th>
              <th style={{ width: 96 }}>Total Qty</th>
              <th style={{ width: 130 }}>Total Amount</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>No gate passes found</td></tr>
            ) : filtered.map(g => {
              const expanded = expandedRows.has(g.id)
              const toggleExpand = () => setExpandedRows(prev => {
                const next = new Set(prev)
                next.has(g.id) ? next.delete(g.id) : next.add(g.id)
                return next
              })
              return (
                <>
                  <tr key={g.id} style={{ cursor: 'pointer', ...(expanded ? { background: '#eff6ff' } : {}) }}
                    onClick={toggleExpand}>
                    <td>
                      <span style={{ fontWeight: 700, color: '#1d4ed8' }}>#{g.ogp_number}</span>
                      <span style={{ marginLeft: 4, color: '#9ca3af', fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
                    </td>
                    <td style={{ color: '#4b5563' }}>
                      {g.ogp_date}
                      {g.delivery_date && <div style={{ fontSize: 11, color: '#9ca3af' }}>Del: {g.delivery_date}</div>}
                      {g.shop_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>For: {g.shop_name}</div>}
                    </td>
                    <td>
                      {(g.items || []).length === 0 ? (
                        <span style={{ color: '#d1d5db', fontSize: 12, fontStyle: 'italic' }}>No items yet</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(g.items || []).map((item, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f3f4f6', color: '#374151', fontSize: 11, padding: '2px 8px', borderRadius: 999 }}>
                              <span style={{ fontWeight: 500 }}>{item.item_description || item.product_name}</span>
                              <span style={{ color: '#9ca3af' }}>×{Number(item.quantity)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ color: '#374151' }}>{g.total_qty}</td>
                    <td style={{ fontWeight: 600 }}>Rs. {Number(g.total_amount).toFixed(2)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => openBooking(g)} className="btn btn-primary btn-sm">
                          Booking
                        </button>
                        <button onClick={() => openEditGp(g)} className="btn btn-secondary btn-sm">
                          Edit GP
                        </button>
                        <button onClick={() => openPrint(g.id)} className="btn btn-ghost btn-sm" title="Print" style={{ color: '#16a34a' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </button>
                        <button onClick={() => delGp(g.id)} className="btn btn-ghost btn-sm" title="Delete" style={{ color: '#ef4444' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr key={`${g.id}-exp`} style={{ background: '#eff6ff' }}>
                      <td colSpan={6} style={{ padding: '12px 24px' }}>
                        <table className="db-table" style={{ width: '100%', fontSize: 12 }}>
                          <thead>
                            <tr>
                              {['Sr #', 'Item Code', 'Description', 'Qty', 'Rate', 'Amount'].map(hdr => (
                                <th key={hdr}>{hdr}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(g.items || []).map((item, i) => (
                              <tr key={i}>
                                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                                <td style={{ fontFamily: 'monospace', color: '#6b7280' }}>{item.item_code || '—'}</td>
                                <td style={{ fontWeight: 500, color: '#1f2937' }}>{item.item_description || item.product_name}</td>
                                <td style={{ fontWeight: 600 }}>{Number(item.quantity)}</td>
                                <td style={{ color: '#4b5563' }}>Rs. {Number(item.rate).toFixed(2)}</td>
                                <td style={{ fontWeight: 600, color: '#1f2937' }}>Rs. {Number(item.total).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                              <td colSpan={3} style={{ color: '#6b7280' }}>Total</td>
                              <td>{g.total_qty}</td>
                              <td></td>
                              <td>Rs. {Number(g.total_amount).toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {printGpModal && (
        <OgpPrint gp={printGpModal} companyName={companyName} onClose={() => setPrintGpModal(null)} />
      )}
    </div>
  )
}
