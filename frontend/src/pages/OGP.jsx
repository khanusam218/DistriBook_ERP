import { useState, useEffect } from 'react'
import api from '../api'
import { toast } from '../components/Toast'
import { getCompanyInfo } from '../utils/companyInfo'
import { h } from '../utils/exportUtils'
import { isValidPhone } from '../utils/validation'
import AddCustomerModal from '../components/AddCustomerModal'

const todayStr = () => new Date().toISOString().split('T')[0]
const fmt = n => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })

function companyHeaderHTML(c) {
  const name = c.name || 'YOUR COMPANY'
  const addr = [c.address, c.city].filter(Boolean).join(', ')
  const contact = [c.phone && `Ph: ${c.phone}`, c.mobile && `Mob: ${c.mobile}`].filter(Boolean).join('  |  ')
  const tax = [c.ntn && `NTN: ${c.ntn}`, c.strn && `STRN: ${c.strn}`].filter(Boolean).join('  |  ')
  return `
    <div style="font-weight:bold;font-size:20pt;margin-bottom:2px">${h(name)}</div>
    ${c.tagline ? `<div style="font-size:12pt;color:#555;margin-bottom:2px">${h(c.tagline)}</div>` : ''}
    ${addr ? `<div style="font-size:11pt;color:#666">${h(addr)}</div>` : ''}
    ${contact ? `<div style="font-size:11pt;color:#666">${h(contact)}</div>` : ''}
    ${tax ? `<div style="font-size:11pt;color:#888">${h(tax)}</div>` : ''}
    <hr style="border:none;border-top:1.5px solid #000;margin:8px 0"/>
  `
}

// ─── Print Delivery Order (full or small) ─────────────────────────────────────
function printDO(gp, billGroups, _unused, small = false) {
  if (!billGroups.length) { toast('No saved bills to print'); return }
  const fs = small ? '8pt' : '10pt'
  const pad = small ? '6mm 8mm' : '12mm 15mm'
  const titleFs = small ? '12pt' : '15pt'
  const cellPad = small ? '2px 3px' : '3px 6px'

  const pages = billGroups.map((bill, idx) => {
    const billAmt  = bill.lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
    const billDisc = bill.lines.reduce((s, l) => s + (parseFloat(l.discount) || 0), 0)
    const billNet  = bill.lines.reduce((s, l) => s + (l.net != null ? parseFloat(l.net) : (parseFloat(l.amount) - parseFloat(l.discount)) || 0), 0)
    const rows = bill.lines.map((item, i) => {
      const net = item.net != null ? parseFloat(item.net) : (parseFloat(item.amount) - parseFloat(item.discount))
      return `<tr>
        <td style="border:1px solid #000;padding:${cellPad}">${i + 1}</td>
        <td style="border:1px solid #000;padding:${cellPad}">${h(item.item_description || '')}</td>
        <td style="border:1px solid #000;padding:${cellPad}">${h(item.brand || '')}</td>
        <td style="border:1px solid #000;padding:${cellPad};text-align:right">${item.qty_ctn}</td>
        <td style="border:1px solid #000;padding:${cellPad};text-align:right">${item.qty_pieces || 0}</td>
        <td style="border:1px solid #000;padding:${cellPad};text-align:right">${fmt(item.rate)}</td>
        <td style="border:1px solid #000;padding:${cellPad};text-align:right">${fmt(item.amount)}</td>
        <td style="border:1px solid #000;padding:${cellPad};text-align:right">${fmt(item.discount)}</td>
        <td style="border:1px solid #000;padding:${cellPad};text-align:right;font-weight:bold">${fmt(net)}</td>
      </tr>`
    }).join('')
    const co = getCompanyInfo()
    return `<div style="padding:${pad}${idx > 0 ? ';page-break-before:always' : ''}">
      ${companyHeaderHTML(co)}
      <table style="border-collapse:collapse;margin-bottom:${small ? '8px' : '12px'}">
        <tr><td style="width:${small ? '90px' : '120px'};padding:2px 0">OGP #</td><td style="width:130px;padding:2px 0;font-weight:bold">${h(gp.ogp_number)}</td>
            <td style="width:80px;padding:2px 0">Bill To</td><td style="padding:2px 0;font-weight:bold;font-size:${small ? '9pt' : '11pt'}">${h(bill.shop_name)}</td></tr>
        <tr><td style="padding:2px 0">Date</td><td style="padding:2px 0">${h(gp.ogp_date || '')}</td>
            <td style="padding:2px 0">Delivery</td><td style="padding:2px 0">${h(gp.delivery_date || '')}</td></tr>
        <tr><td style="padding:2px 0">Delivery Man</td><td style="padding:2px 0">${h(gp.delivery_man || '')}</td>
            <td style="padding:2px 0">Area</td><td style="padding:2px 0">${h(gp.area || '')}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f0f0f0">
          <th style="border:1px solid #000;padding:${cellPad};width:28px">Sr</th>
          <th style="border:1px solid #000;padding:${cellPad};text-align:left">Item Description</th>
          <th style="border:1px solid #000;padding:${cellPad};width:65px">Brand</th>
          <th style="border:1px solid #000;padding:${cellPad};width:38px;text-align:right">CTN</th>
          <th style="border:1px solid #000;padding:${cellPad};width:35px;text-align:right">Pcs</th>
          <th style="border:1px solid #000;padding:${cellPad};width:70px;text-align:right">Rate</th>
          <th style="border:1px solid #000;padding:${cellPad};width:75px;text-align:right">Amount</th>
          <th style="border:1px solid #000;padding:${cellPad};width:60px;text-align:right">Disc</th>
          <th style="border:1px solid #000;padding:${cellPad};width:80px;text-align:right">Net</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="6" style="border:1px solid #000;padding:${cellPad};font-weight:bold;text-align:right">Totals</td>
          <td style="border:1px solid #000;padding:${cellPad};text-align:right;font-weight:bold">${fmt(billAmt)}</td>
          <td style="border:1px solid #000;padding:${cellPad};text-align:right;font-weight:bold">${fmt(billDisc)}</td>
          <td style="border:1px solid #000;padding:${cellPad};text-align:right;font-weight:bold">${fmt(billNet)}</td>
        </tr></tfoot>
      </table>
      <p style="margin-top:${small ? '8px' : '14px'};font-size:${small ? '9pt' : '11pt'}">Net Payable: <strong>Rs. ${fmt(billNet)}</strong></p>
      <div style="margin-top:${small ? '18px' : '30px'}">Authorised Signature: _______________________</div>
    </div>`
  }).join('')

  const w = window.open('', '_blank')
  w.document.write(`<!DOCTYPE html><html><head><title>${small ? 'Small' : ''} Delivery Order — OGP #${h(gp.ogp_number)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:${fs}}
@page{margin:0;size:A4}@media print{@page{margin:0}}</style></head><body>${pages}</body></html>`)
  w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 400)
}

// ─── Print Gate Pass (consolidated, brand-sorted) ─────────────────────────────
function printGPFromLines(gp, allLines, _unused, returns = []) {
  if (!allLines.length) { toast('No saved items to print'); return }

  // Helper: format qty as "X CTN Y Pcs" or "X CTN"
  const fmtQty = (ctn, pcs) => pcs > 0 ? `${ctn} CTN ${pcs} Pcs` : `${ctn} CTN`

  // Consolidate issued items by brand + item_code + rate
  const map = {}
  for (const item of allLines) {
    const key = `${item.brand}||${item.item_code}||${Number(item.rate || 0).toFixed(4)}`
    if (!map[key]) map[key] = {
      brand: item.brand || '', item_code: item.item_code || '',
      item_description: item.item_description || '',
      rate: Number(item.rate) || 0,
      qty_ctn: 0, qty_pcs: 0, total: 0,
      ret_ctn: 0, ret_pcs: 0,
    }
    map[key].qty_ctn += Number(item.qty_ctn) || 0
    map[key].qty_pcs += Number(item.qty_pieces) || 0
    map[key].total += item.net != null ? Number(item.net) : (Number(item.amount) - Number(item.discount))
  }

  // Aggregate returns by item_code + brand + rate
  for (const ret of returns) {
    for (const ri of (ret.items || [])) {
      const key = `${ri.brand || ''}||${ri.item_code || ''}||${Number(ri.rate || 0).toFixed(4)}`
      if (map[key]) {
        map[key].ret_ctn += Number(ri.qty_ctn) || 0
        map[key].ret_pcs += Number(ri.qty_pieces) || 0
      }
    }
  }

  const hasReturns = returns.length > 0

  const items = Object.values(map).sort((a, b) => {
    const ba = (a.brand || '').toLowerCase(), bb = (b.brand || '').toLowerCase()
    return ba !== bb ? ba.localeCompare(bb) : (a.item_description || '').toLowerCase().localeCompare((b.item_description || '').toLowerCase())
  })

  let lastBrand = null, sr = 1
  const totalCols = hasReturns ? 8 : 7
  const rows = items.map(item => {
    let hdr = ''
    if (item.brand !== lastBrand) {
      hdr = `<tr style="background:#eee"><td colspan="${totalCols}" style="border:1px solid #000;padding:5px 8px;font-weight:bold;font-size:12pt">${h(item.brand)}</td></tr>`
      lastBrand = item.brand
    }
    const retCell = hasReturns
      ? `<td style="border:1px solid #000;padding:5px 8px;text-align:right;color:#c00">${item.ret_ctn > 0 || item.ret_pcs > 0 ? fmtQty(item.ret_ctn, item.ret_pcs) : '—'}</td>`
      : ''
    return `${hdr}<tr>
      <td style="border:1px solid #000;padding:5px 8px">${sr++}</td>
      <td style="border:1px solid #000;padding:5px 8px">${h(item.item_code || '')}</td>
      <td style="border:1px solid #000;padding:5px 8px">${h(item.item_description)}</td>
      <td style="border:1px solid #000;padding:5px 8px;text-align:right">${item.qty_ctn}</td>
      <td style="border:1px solid #000;padding:5px 8px;text-align:right">${item.qty_pcs || 0}</td>
      ${retCell}
      <td style="border:1px solid #000;padding:5px 8px;text-align:right">Rs.${fmt(item.rate)}</td>
      <td style="border:1px solid #000;padding:5px 8px;text-align:right">Rs.${fmt(item.total)}</td>
    </tr>`
  }).join('')

  const totalIssuedCtn = items.reduce((s, i) => s + i.qty_ctn, 0)
  const totalIssuedPcs = items.reduce((s, i) => s + i.qty_pcs, 0)
  const totalRetCtn = items.reduce((s, i) => s + i.ret_ctn, 0)
  const totalRetPcs = items.reduce((s, i) => s + i.ret_pcs, 0)
  const totalAmt = items.reduce((s, i) => s + i.total, 0)

  const retTotalCell = hasReturns
    ? `<td style="border:1px solid #000;padding:5px 8px;text-align:right;font-weight:bold;color:#c00">${totalRetCtn > 0 || totalRetPcs > 0 ? fmtQty(totalRetCtn, totalRetPcs) : '—'}</td>`
    : ''

  const returnHeaderCell = hasReturns
    ? `<th style="border:1px solid #000;padding:6px 8px;text-align:right;width:90px">Stock Return</th>`
    : ''

  const co = getCompanyInfo()
  const w = window.open('', '_blank')
  w.document.write(`<!DOCTYPE html><html><head><title>Gate Pass — OGP #${h(gp.ogp_number)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13pt}
.page{padding:12mm 15mm}@page{margin:0;size:A4}@media print{@page{margin:0}}</style>
</head><body><div class="page">
${companyHeaderHTML(co)}
<table style="border-collapse:collapse;margin-bottom:12px;font-size:13pt"><tbody>
<tr><td style="width:150px;padding:4px 0">OGP Number</td><td style="width:160px;padding:4px 0;font-weight:bold">${h(gp.ogp_number)}</td>
    <td style="width:140px;padding:4px 0">Delivery Man</td><td>${h(gp.delivery_man || '')}</td></tr>
<tr><td style="padding:4px 0">Date</td><td>${h(gp.ogp_date || '')}</td>
    <td style="padding:4px 0">Sale Man</td><td>${h(gp.delivery_sale_man || '')}</td></tr>
<tr><td style="padding:4px 0">Delivery Date</td><td>${h(gp.delivery_date || '')}</td>
    <td style="padding:4px 0">Area</td><td>${h(gp.area || '')}</td></tr>
</tbody></table>
<table style="width:100%;border-collapse:collapse;font-size:13pt">
<thead><tr style="background:#f0f0f0">
  <th style="border:1px solid #000;padding:6px 8px;text-align:left;width:38px">Sr #</th>
  <th style="border:1px solid #000;padding:6px 8px;text-align:left;width:120px">Item Code</th>
  <th style="border:1px solid #000;padding:6px 8px;text-align:left">Item Description</th>
  <th style="border:1px solid #000;padding:6px 8px;text-align:right;width:58px">CTN</th>
  <th style="border:1px solid #000;padding:6px 8px;text-align:right;width:58px">Pcs</th>
  ${returnHeaderCell}
  <th style="border:1px solid #000;padding:6px 8px;text-align:right;width:85px">Rate</th>
  <th style="border:1px solid #000;padding:6px 8px;text-align:right;width:110px">Amount</th>
</tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr>
  <td colspan="3" style="border:1px solid #000;padding:5px 8px;font-weight:bold">Total</td>
  <td style="border:1px solid #000;padding:5px 8px;text-align:right;font-weight:bold">${totalIssuedCtn}</td>
  <td style="border:1px solid #000;padding:5px 8px;text-align:right;font-weight:bold">${totalIssuedPcs}</td>
  ${retTotalCell}
  <td style="border:1px solid #000;padding:5px 8px"></td>
  <td style="border:1px solid #000;padding:5px 8px;text-align:right;font-weight:bold">Rs.${fmt(totalAmt)}</td>
</tr></tfoot></table>
</div></body></html>`)
  w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 350)
}

// ─── Success Dialog ───────────────────────────────────────────────────────────
function SuccessDialog({ ogpNumber, onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{maxWidth:380,textAlign:'center'}}>
        <div className="modal-body">
          <svg style={{width:48,height:48,color:'#16a34a',margin:'0 auto 16px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
          <h2 style={{fontSize:'1.1rem',fontWeight:700,color:'#1e293b',marginBottom:8}}>OGP Created Successfully</h2>
          <p style={{color:'#64748b',fontSize:'0.875rem',marginBottom:24}}>OGP # <span style={{fontWeight:700,color:'#1d4ed8'}}>{ogpNumber}</span> has been saved.</p>
          <button onClick={onClose} className="btn btn-primary" style={{width:'100%'}}>OK</button>
        </div>
      </div>
    </div>
  )
}

// ─── Manage Panel ─────────────────────────────────────────────────────────────
function ManagePanel({ title, items, onAdd, onDelete, onUpdate, withMobile }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [mobileError, setMobileError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [editMobileError, setEditMobileError] = useState('')

  const handleAdd = () => {
    if (!name.trim()) return
    if (!isValidPhone(mobile)) { setMobileError('Invalid mobile number (e.g. 0300-1234567)'); return }
    setMobileError('')
    onAdd(name.trim(), mobile.trim())
    setName(''); setMobile('')
  }

  const startEdit = (item) => {
    setEditId(item.id); setEditName(item.name); setEditMobile(item.mobile || ''); setEditMobileError('')
  }

  const saveEdit = () => {
    if (!isValidPhone(editMobile)) { setEditMobileError('Invalid mobile number (e.g. 0300-1234567)'); return }
    setEditMobileError('')
    onUpdate(editId, editName, editMobile)
    setEditId(null)
  }

  return (
    <div className="card" style={{padding:0,overflow:'hidden'}}>
      <button onClick={() => setOpen(o => !o)}
        style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',background:'#f8fafc',border:'none',cursor:'pointer',fontSize:'0.875rem',fontWeight:600,color:'#374151'}}>
        <span>{title} <span style={{color:'#9ca3af',fontWeight:400}}>({items.length})</span></span>
        <span style={{color:'#9ca3af'}}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{padding:16,background:'white'}}>
          <div style={{display:'flex',gap:8,marginBottom:mobileError ? 4 : 16,flexWrap:'wrap'}}>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Name"
              className="db-input" style={{flex:1}} />
            {withMobile && (
              <input type="text" value={mobile} onChange={e => { setMobile(e.target.value); setMobileError('') }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Mobile #"
                className={`db-input${mobileError ? ' error' : ''}`} style={{width:144}} />
            )}
            <button onClick={handleAdd} className="btn btn-primary btn-sm">Add</button>
          </div>
          {mobileError && <p style={{fontSize:11.5,color:'var(--danger)',marginBottom:12,marginTop:-8}}>{mobileError}</p>}
          {items.length === 0
            ? <p style={{fontSize:'0.75rem',color:'#9ca3af',textAlign:'center',padding:'8px 0'}}>None added yet</p>
            : <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {items.map(item => (
                  <div key={item.id} style={{display:'flex',alignItems:'center',gap:8}}>
                    {editId === item.id ? (
                      <>
                        <input value={editName} onChange={e => setEditName(e.target.value)}
                          className="db-input" style={{flex:1}} />
                        {withMobile && (
                          <div style={{display:'flex',flexDirection:'column',gap:2}}>
                            <input value={editMobile} onChange={e => { setEditMobile(e.target.value); setEditMobileError('') }}
                              placeholder="Mobile #"
                              className={`db-input${editMobileError ? ' error' : ''}`} style={{width:144}} />
                            {editMobileError && <p style={{fontSize:11,color:'var(--danger)',margin:0}}>{editMobileError}</p>}
                          </div>
                        )}
                        <button onClick={saveEdit} className="btn btn-sm" style={{background:'#22c55e',color:'white',border:'none'}}>Save</button>
                        <button onClick={() => setEditId(null)} className="btn btn-ghost btn-sm">Cancel</button>
                      </>
                    ) : (
                      <>
                        <span style={{flex:1,fontSize:'0.875rem',color:'#1e293b'}}>{item.name}</span>
                        {withMobile && (
                          <span style={{fontSize:'0.75rem',color:'#9ca3af',width:144,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.mobile || '—'}</span>
                        )}
                        <button onClick={() => startEdit(item)} className="btn btn-ghost btn-sm" style={{color:'#2563eb'}}>Edit</button>
                        <button onClick={() => onDelete(item.id)} className="btn btn-ghost btn-sm" style={{color:'#ef4444'}}>Remove</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  )
}

// ─── Inline Edit Row (OGP list) ───────────────────────────────────────────────
function EditRow({ gp, deliveryMen, saleReps, areas, onSave, onCancel }) {
  const [form, setForm] = useState({
    ogp_number: gp.ogp_number,
    delivery_date: gp.delivery_date || '',
    delivery_man: gp.delivery_man || '',
    mobile: gp.mobile || '',
    delivery_sale_man: gp.delivery_sale_man || '',
    area: gp.area || '',
  })
  const [mobileErr, setMobileErr] = useState('')

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleDeliveryManChange = (val) => {
    setField('delivery_man', val)
    const dm = deliveryMen.find(d => d.name === val)
    if (dm?.mobile) setField('mobile', dm.mobile)
  }

  return (
    <tr style={{background:'#eff6ff',borderBottom:'1px solid #e2e8f0'}}>
      <td className="py-2 px-3">
        <span style={{fontWeight:700,color:'#1d4ed8',fontSize:'0.875rem'}}>#{form.ogp_number}</span>
      </td>
      <td className="py-2 px-3">
        <input type="date" value={form.delivery_date}
          onChange={e => setField('delivery_date', e.target.value)}
          className="db-input" style={{width:144}} />
      </td>
      <td className="py-2 px-3">
        <select value={form.delivery_man} onChange={e => handleDeliveryManChange(e.target.value)}
          className="db-input db-select" style={{width:'100%'}}>
          <option value="">— None —</option>
          {deliveryMen.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </td>
      <td className="py-2 px-3">
        <input type="text" value={form.mobile} placeholder="Mobile #"
          onChange={e => { setField('mobile', e.target.value); setMobileErr('') }}
          className={`db-input${mobileErr ? ' error' : ''}`} style={{width:128}} />
        {mobileErr && <p style={{fontSize:11,color:'var(--danger)',margin:'2px 0 0'}}>{mobileErr}</p>}
      </td>
      <td className="py-2 px-3">
        <select value={form.delivery_sale_man} onChange={e => setField('delivery_sale_man', e.target.value)}
          className="db-input db-select" style={{width:'100%'}}>
          <option value="">— None —</option>
          {saleReps.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      </td>
      <td className="py-2 px-3">
        <select value={form.area} onChange={e => setField('area', e.target.value)}
          className="db-input db-select" style={{width:'100%'}}>
          <option value="">— None —</option>
          {areas.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
        </select>
      </td>
      <td className="py-2 px-3">
        {gp.status === 'CLOSED' ? <span className="badge badge-slate">Closed</span> : <span className="badge badge-green">Open</span>}
      </td>
      <td className="py-2 px-3">
        <div style={{display:'flex',gap:8}}>
          <button onClick={() => {
            if (!isValidPhone(form.mobile)) { setMobileErr('Invalid mobile number (e.g. 0300-1234567)'); return }
            onSave(form)
          }} className="btn btn-sm" style={{background:'#16a34a',color:'white',border:'none'}}>Save</button>
          <button onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OGP() {
  const [gatePasses, setGatePasses] = useState([])
  const [customers, setCustomers] = useState([])
  const [stocks, setStocks] = useState([])
  const [staff, setStaff] = useState([])
  const [employees, setEmployees] = useState([])
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)

  const [companyName] = useState(() => localStorage.getItem('ogp_company_name') || '')

  // view: 'main' | 'delivery' | 'booking'
  const [view, setView] = useState('main')

  // OGP creation form
  const [form, setForm] = useState({
    ogpNumber: '', deliveryDate: todayStr(),
    deliveryMan: '', mobile: '', deliverySaleMan: '', area: ''
  })
  const [saving, setSaving] = useState(false)
  const [successOgp, setSuccessOgp] = useState(null)

  // OGP list edit/delete
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  // Delivery screen
  const [deliverySearch, setDeliverySearch] = useState('')

  // Booking DO
  const [bookingOgp, setBookingOgp] = useState(null)
  const [allSavedLines, setAllSavedLines] = useState([]) // lines committed to DB for this OGP
  const [currentBillLines, setCurrentBillLines] = useState([]) // lines for the bill being entered right now
  const [bookingSaving, setBookingSaving] = useState(false)
  const [bookingMsg, setBookingMsg] = useState('')
  const [billsView, setBillsView] = useState(false) // show all bills screen

  // Return modal
  const [returnBill, setReturnBill] = useState(null) // { customer_id, shop_name, lines[] }
  const [returnLines, setReturnLines] = useState([]) // editable return quantities
  const [returnDate, setReturnDate] = useState(todayStr())
  const [returnNotes, setReturnNotes] = useState('')
  const [returnSaving, setReturnSaving] = useState(false)
  const [returnMsg, setReturnMsg] = useState('')
  const [ogpReturns, setOgpReturns] = useState([]) // all returns for current OGP
  const [returnsView, setReturnsView] = useState(false) // show returns list

  // Edit GP state
  const [editGpOgp, setEditGpOgp] = useState(null)
  const [editGpItems, setEditGpItems] = useState([])
  const [editGpSaving, setEditGpSaving] = useState(false)
  const [editGpError, setEditGpError] = useState('')
  const [editGpBankAccounts, setEditGpBankAccounts] = useState([])
  const [editGpSavedPayments, setEditGpSavedPayments] = useState([])
  const [editGpPaymentRows, setEditGpPaymentRows] = useState([])
  const [editGpPaySaving, setEditGpPaySaving] = useState(false)
  const [editGpPayMsg, setEditGpPayMsg] = useState('')
  const [payDeleteId, setPayDeleteId] = useState(null)   // { id, source }
  const [payEditRow, setPayEditRow] = useState(null)      // { id, source, amount, date, description }

  // Quick-add form for booking
  const [qShop, setQShop] = useState('')
  const [qShopSearch, setQShopSearch] = useState('')
  const [qShopOpen, setQShopOpen] = useState(false)
  const [qShopHighlight, setQShopHighlight] = useState(-1)
  const [qItem, setQItem] = useState(null)
  const [qItemSearch, setQItemSearch] = useState('')
  const [qItemOpen, setQItemOpen] = useState(false)
  const [qItemHighlight, setQItemHighlight] = useState(-1)
  const [qCtn, setQCtn] = useState('')
  const [qPcs, setQPcs] = useState('0')
  const [qRate, setQRate] = useState('')
  const [qDisc, setQDisc] = useState('0')
  const [qNet, setQNet] = useState('')
  const [qError, setQError] = useState('')
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)

  // ── Load ──

  const loadAll = async () => {
    const [gp, cu, st, sf, ar, em] = await Promise.all([
      api.get('/gate-passes'),
      api.get('/customers'),
      api.get('/stocks'),
      api.get('/gate-passes/staff'),
      api.get('/gate-passes/areas'),
      api.get('/employees'),
    ])
    setGatePasses(gp.data)
    setCustomers(cu.data)
    setStocks(st.data)
    setStaff(sf.data)
    setAreas(ar.data)
    setEmployees(em.data)
    setLoading(false)
  }

  const loadNextOgp = async () => {
    const r = await api.get('/gate-passes/next-ogp')
    setForm(f => ({ ...f, ogpNumber: String(r.data.ogpNumber) }))
  }

  useEffect(() => { loadAll().then(loadNextOgp) }, [])

  const handleAddCustomer = async (customerForm) => {
    if (!customerForm.shopName) return toast('Shop name is required')
    if (!isValidPhone(customerForm.phone)) return toast('Invalid phone number. Use a format like 0300-1234567.')
    setSavingCustomer(true)
    try {
      const r = await api.post('/customers', customerForm)
      const updated = await api.get('/customers')
      setCustomers(updated.data)
      setQShop(String(r.data.id))
      setQShopSearch(r.data.shop_name)
      setQShopOpen(false)
      setShowAddCustomer(false)
    } catch (e) { toast(e.response?.data?.error || 'Error adding customer') }
    setSavingCustomer(false)
  }

  // ── Derived ──

  const deliveryMen = [
    ...staff.filter(s => s.type === 'DELIVERY_MAN'),
    ...employees.filter(e => e.role && e.role.toLowerCase().includes('delivery')),
  ]
  const saleReps = [
    ...staff.filter(s => s.type === 'SALE_REP'),
    ...employees.filter(e => e.role && e.role.toLowerCase().includes('sales')),
  ]

  const itemSearchResults = qItemSearch.trim().length >= 1
    ? stocks.filter(s =>
        s.product_name?.toLowerCase().includes(qItemSearch.toLowerCase()) ||
        (s.company_name || '').toLowerCase().includes(qItemSearch.toLowerCase())
      ).slice(0, 25)
    : []

  const deliveryFiltered = gatePasses.filter(gp => {
    if (!deliverySearch.trim()) return true
    const q = deliverySearch.toLowerCase()
    return (
      String(gp.ogp_number).includes(q) ||
      (gp.delivery_man || '').toLowerCase().includes(q) ||
      (gp.area || '').toLowerCase().includes(q)
    )
  })

  // ── OGP form helpers ──

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleDeliveryManChange = (val) => {
    setField('deliveryMan', val)
    const dm = deliveryMen.find(d => d.name === val)
    setField('mobile', dm?.mobile || '')
  }

  // ── Staff / Area management ──

  const addStaff = async (name, mobile, type) => {
    try { await api.post('/gate-passes/staff', { name, mobile, type }); await loadAll() }
    catch (e) { toast(e.response?.data?.error || 'Error') }
  }
  const updateStaff = async (id, name, mobile) => {
    try { await api.put(`/gate-passes/staff/${id}`, { name, mobile }); await loadAll() }
    catch (e) { toast(e.response?.data?.error || 'Error') }
  }
  const deleteStaff = async (id) => {
    try { await api.delete(`/gate-passes/staff/${id}`); await loadAll() }
    catch (e) { toast(e.response?.data?.error || 'Error') }
  }
  const addArea = async (name) => {
    try { await api.post('/gate-passes/areas', { name }); await loadAll() }
    catch (e) { toast(e.response?.data?.error || 'Error') }
  }
  const deleteArea = async (id) => {
    try { await api.delete(`/gate-passes/areas/${id}`); await loadAll() }
    catch (e) { toast(e.response?.data?.error || 'Error') }
  }

  // ── Save OGP header ──

  const saveOgp = async () => {
    if (!form.ogpNumber) { toast('OGP Number is required'); return }
    if (!isValidPhone(form.mobile)) { toast('Mobile number is invalid. Use a format like 0300-1234567.'); return }
    setSaving(true)
    try {
      const r = await api.post('/gate-passes', {
        ogpNumber: Number(form.ogpNumber),
        ogpDate: todayStr(),
        deliveryDate: form.deliveryDate,
        mobile: form.mobile,
        deliveryMan: form.deliveryMan,
        deliverySaleMan: form.deliverySaleMan,
        area: form.area,
      })
      await loadAll()
      setSuccessOgp(r.data.ogp_number || form.ogpNumber)
      const next = await api.get('/gate-passes/next-ogp')
      setForm({ ogpNumber: String(next.data.ogpNumber), deliveryDate: todayStr(), deliveryMan: '', mobile: '', deliverySaleMan: '', area: '' })
    } catch (e) {
      toast(e.response?.data?.error || 'Error saving OGP')
    }
    setSaving(false)
  }

  // ── Edit / Delete OGP ──

  const saveEdit = async (id, data) => {
    try {
      await api.put(`/gate-passes/${id}`, {
        ogpNumber: Number(data.ogp_number),
        deliveryDate: data.delivery_date,
        deliveryMan: data.delivery_man,
        mobile: data.mobile,
        deliverySaleMan: data.delivery_sale_man,
        area: data.area,
      })
      await loadAll(); setEditId(null)
    } catch (e) { toast(e.response?.data?.error || 'Error') }
  }

  const deleteOgp = async (id) => {
    try { await api.delete(`/gate-passes/${id}`); await loadAll(); setDeleteId(null) }
    catch (e) { toast(e.response?.data?.error || 'Error') }
  }

  // ── Open Booking DO for an OGP ──

  const openBooking = async (gp) => {
    setBookingOgp(gp)
    setBookingMsg(''); setBillsView(false)
    setQShop(''); setQShopSearch(''); setQShopOpen(false); setQShopHighlight(-1)
    setQItem(null); setQItemSearch(''); setQItemOpen(false); setQItemHighlight(-1)
    setQCtn(''); setQPcs('0'); setQRate(''); setQDisc('0'); setQNet('')
    setQError('')
    setCurrentBillLines([])
    setReturnBill(null); setReturnMsg(''); setReturnsView(false)
    try {
      const [items, rets] = await Promise.all([
        api.get(`/gate-passes/${gp.id}/booking-items`),
        api.get(`/gate-passes/${gp.id}/returns`),
      ])
      setAllSavedLines(items.data.map(i => {
        const stock = stocks.find(s => s.id === i.stock_id)
        const ppc = i.pieces_per_ctn || stock?.pieces_per_ctn || 1
        return { ...i, _key: `db-${i.id}`, pieces_per_ctn: ppc, total_pieces: (Number(i.qty_ctn) * ppc) + Number(i.qty_pieces || 0) }
      }))
      setOgpReturns(rets.data)
    } catch {
      setAllSavedLines([])
      setOgpReturns([])
    }
    setView('booking')
  }

  const newPayRow = () => ({ _id: Date.now() + Math.random(), amount: '', bankAccountId: '', date: todayStr(), description: '' })

  const lsPayKey = (gpId) => 'ogp_pays_' + gpId
  const lsLoadPays = (gpId) => { try { const d = localStorage.getItem(lsPayKey(gpId)); return d ? JSON.parse(d) : [] } catch { return [] } }
  const lsSavePays = (gpId, pays) => { try { localStorage.setItem(lsPayKey(gpId), JSON.stringify(pays)) } catch {} }

  const openEditGp = async (gp) => {
    setEditGpOgp(gp)
    setEditGpError(''); setEditGpPayMsg('')
    setEditGpPaymentRows([newPayRow()])
    const localPays = lsLoadPays(gp.id)
    setEditGpSavedPayments(localPays)
    try {
      const [r, banks, pays] = await Promise.all([
        api.get(`/gate-passes/${gp.id}/booking-items`),
        api.get('/bank-accounts'),
        api.get(`/gate-passes/${gp.id}/payments`),
      ])
      // Consolidate items by brand + item_code + rate (same as print GP)
      const rawItems = Array.isArray(r.data) ? r.data : []
      const consMap = {}
      for (const i of rawItems) {
        const key = `${i.brand||''}||${i.item_code||''}||${Number(i.rate||0).toFixed(4)}`
        if (!consMap[key]) consMap[key] = { ...i, _consKey: key, _ids: [], qty_ctn: 0, qty_pieces: 0, amount: 0, returnQtyCtn: '', returnQtyPcs: '', origRate: Number(i.rate) }
        consMap[key]._ids.push(i.id)
        consMap[key].qty_ctn += Number(i.qty_ctn) || 0
        consMap[key].qty_pieces += Number(i.qty_pieces) || 0
        consMap[key].amount += Number(i.amount) || 0
      }
      const consolidated = Object.values(consMap).sort((a, b) => {
        const ba = (a.brand||'').toLowerCase(), bb = (b.brand||'').toLowerCase()
        return ba !== bb ? ba.localeCompare(bb) : (a.item_description||'').toLowerCase().localeCompare((b.item_description||'').toLowerCase())
      })
      setEditGpItems(consolidated)
      setEditGpBankAccounts(Array.isArray(banks.data) ? banks.data : [])
      if (Array.isArray(pays.data) && pays.data.length > 0) {
        setEditGpSavedPayments(pays.data)
        lsSavePays(gp.id, pays.data)
      }
      // else keep localPays already set above
    } catch {
      setEditGpItems([]); setEditGpBankAccounts([])
    }
    setView('edit-gp')
  }

  const saveEditGp = async () => {
    if (!editGpOgp) return
    setEditGpSaving(true); setEditGpError('')
    try {
      const rateChanges = editGpItems.filter(i => Number(i.rate) !== Number(i.origRate))
      if (rateChanges.length > 0) {
        // Expand consolidated rows back to individual IDs
        const allIdChanges = []
        for (const i of rateChanges) {
          for (const boiId of (i._ids && i._ids.length ? i._ids : [i.id])) {
            allIdChanges.push({ id: boiId, rate: Number(i.rate) })
          }
        }
        await api.patch(`/gate-passes/${editGpOgp.id}/booking-item-rates`, { items: allIdChanges })
      }
      const returnItems = editGpItems.filter(i => (Number(i.returnQtyCtn) || 0) > 0 || (Number(i.returnQtyPcs) || 0) > 0)
      if (returnItems.length > 0) {
        const returnPayload = {
          customer_id: null,
          shop_name: '',
          return_date: todayStr(),
          items: returnItems.map(item => ({
            stock_id: item.stock_id,
            item_code: item.item_code,
            item_description: item.item_description,
            brand: item.brand,
            qty_ctn: Number(item.returnQtyCtn) || 0,
            qty_pieces: Number(item.returnQtyPcs) || 0,
            rate: Number(item.rate),
          }))
        }
        await api.post(`/gate-passes/${editGpOgp.id}/returns`, returnPayload)
      }
      const [gps] = await Promise.all([api.get('/gate-passes')])
      setGatePasses(gps.data)
      setEditGpError('✓ Changes saved successfully')
      setTimeout(() => { setView('delivery'); setEditGpOgp(null); setEditGpItems([]) }, 1200)
    } catch (e) {
      setEditGpError(e.response?.data?.error || 'Error saving changes')
    }
    setEditGpSaving(false)
  }

  const updatePayRow = (id, field, val) =>
    setEditGpPaymentRows(prev => prev.map(r => r._id === id ? { ...r, [field]: val } : r))

  const removePayRow = (id) =>
    setEditGpPaymentRows(prev => prev.length > 1 ? prev.filter(r => r._id !== id) : prev)

  const saveEditGpPayment = async () => {
    const valid = (Array.isArray(editGpPaymentRows) ? editGpPaymentRows : []).filter(r => r.amount && r.bankAccountId)
    if (valid.length === 0) {
      setEditGpPayMsg('Add at least one payment with amount and account')
      return
    }
    setEditGpPaySaving(true); setEditGpPayMsg('')
    try {
      const dmEmployee = (Array.isArray(employees) ? employees : []).find(e => e.name === editGpOgp?.delivery_man)
      for (const row of valid) {
        const isOldRep = row.bankAccountId === 'rep'
        const isStaffRep = typeof row.bankAccountId === 'string' && row.bankAccountId.startsWith('rep_')
        const isEmpRep = typeof row.bankAccountId === 'string' && row.bankAccountId.startsWith('emp_')
        const isRep = isOldRep || isStaffRep || isEmpRep
        let employeeId = null
        if (isEmpRep) {
          employeeId = Number(row.bankAccountId.replace('emp_', ''))
        } else if (isStaffRep) {
          const staffId = Number(row.bankAccountId.replace('rep_', ''))
          const matched = (Array.isArray(staff) ? staff : []).find(s => s.id === staffId)
          const emp = (Array.isArray(employees) ? employees : []).find(e => e.name === matched?.name)
          employeeId = emp?.id || null
        } else if (isOldRep) {
          employeeId = dmEmployee?.id || null
        }
        await api.post(`/gate-passes/${editGpOgp.id}/payment`, {
          amount: Number(row.amount),
          bankAccountId: isRep ? null : Number(row.bankAccountId),
          employeeId,
          date: row.date,
          description: row.description || ('Payment for OGP #' + editGpOgp.ogp_number),
        })
      }
      // Try to refresh from server; fall back to merging locally if route not available
      let refreshed = false
      try {
        const pays = await api.get(`/gate-passes/${editGpOgp.id}/payments`)
        if (Array.isArray(pays.data) && pays.data.length > 0) {
          setEditGpSavedPayments(pays.data)
          lsSavePays(editGpOgp.id, pays.data)
          refreshed = true
        }
      } catch {}
      if (!refreshed) {
        const bankAccts = Array.isArray(editGpBankAccounts) ? editGpBankAccounts : []
        const newEntries = valid.map((r, i) => {
          const isOldRep = r.bankAccountId === 'rep'
          const isStaffRep = typeof r.bankAccountId === 'string' && r.bankAccountId.startsWith('rep_')
          const isEmpRep = typeof r.bankAccountId === 'string' && r.bankAccountId.startsWith('emp_')
          const isRep = isOldRep || isStaffRep || isEmpRep
          const acct = bankAccts.find(a => String(a.id) === String(r.bankAccountId))
          let repName = editGpOgp?.delivery_man || 'Representative'
          if (isEmpRep) {
            const empId = Number(r.bankAccountId.replace('emp_', ''))
            const emp = (Array.isArray(employees) ? employees : []).find(e => e.id === empId)
            repName = emp?.name || repName
          } else if (isStaffRep) {
            const staffId = Number(r.bankAccountId.replace('rep_', ''))
            const s = (Array.isArray(staff) ? staff : []).find(x => x.id === staffId)
            repName = s?.name || repName
          }
          return {
            id: 'local-' + Date.now() + '-' + i,
            amount: Number(r.amount),
            date: r.date,
            description: r.description || ('Payment for OGP #' + editGpOgp.ogp_number),
            account_name: isRep ? repName : (acct?.bank_name || acct?.account_name || ''),
            account_type: isRep ? 'REP' : (acct?.account_type || ''),
          }
        })
        const merged = [...(Array.isArray(editGpSavedPayments) ? editGpSavedPayments : []), ...newEntries]
        setEditGpSavedPayments(merged)
        lsSavePays(editGpOgp.id, merged)
      }
      setEditGpPaymentRows([newPayRow()])
      setEditGpPayMsg('✓ ' + valid.length + ' payment(s) recorded')
    } catch (e) {
      setEditGpPayMsg(e.response?.data?.error || 'Error saving payments')
    }
    setEditGpPaySaving(false)
  }

  const closeEditGp = async () => {
    if (!editGpOgp || !window.confirm('Close OGP #' + editGpOgp.ogp_number + '? This cannot be undone.')) return
    try {
      await api.post(`/gate-passes/${editGpOgp.id}/close`)
      await loadAll()
      setView('delivery'); setEditGpOgp(null); setEditGpItems([])
    } catch (e) {
      setEditGpError(e.response?.data?.error || 'Error closing gate pass')
    }
  }

  // ── Booking quick-add ──

  const handleItemSelect = (stockId) => {
    const s = stocks.find(x => String(x.id) === String(stockId))
    setQItem(s || null)
    if (s) {
      setQRate(String(s.sale_price))
      const pcs = parseFloat(qCtn) || 0  // qCtn now holds total pieces
      const net = (pcs * s.sale_price) - (parseFloat(qDisc) || 0)
      setQNet(String(net.toFixed(2)))
    }
  }

  const recalcNet = (ctn, rate, disc) => {
    const n = (parseFloat(ctn) || 0) * (parseFloat(rate) || 0) - (parseFloat(disc) || 0)
    setQNet(String(n.toFixed(2)))
  }

  const addLine = () => {
    if (!qShop) { setQError('Select a shop/customer first'); return }
    if (!qItem) { setQError('Select an item'); return }
    const totalPieces = parseFloat(qCtn) || 0  // qCtn holds total pieces entered
    if (totalPieces <= 0) { setQError('Enter pieces quantity > 0'); return }
    setQError('')
    const ppc = Number(qItem.pieces_per_ctn) || 1
    const qtyCtn = Math.floor(totalPieces / ppc)
    const qtyPcs = totalPieces % ppc
    const customer = customers.find(c => String(c.id) === String(qShop))
    const amount = totalPieces * (parseFloat(qRate) || 0)
    const disc = parseFloat(qDisc) || 0
    const net = parseFloat(qNet) || (amount - disc)
    setCurrentBillLines(prev => [...prev, {
      _key: Date.now(),
      customer_id: Number(qShop),
      shop_name: customer?.shop_name || '',
      stock_id: qItem.id,
      brand: qItem.company_name || '',
      item_code: `P${String(qItem.id).padStart(10, '0')}`,
      item_description: qItem.product_name,
      qty_ctn: qtyCtn,
      qty_pieces: qtyPcs,
      total_pieces: totalPieces,
      pieces_per_ctn: ppc,
      rate: parseFloat(qRate) || 0,
      amount,
      discount: disc,
      net,
    }])
    setQItem(null); setQItemSearch(''); setQItemOpen(false); setQItemHighlight(-1)
    setQCtn(''); setQPcs('0'); setQRate(''); setQDisc('0'); setQNet('')
  }

  const updateCurrentLine = (key, field, val) => {
    setCurrentBillLines(prev => prev.map(l => {
      if (l._key !== key) return l
      const updated = { ...l, [field]: val }
      if (field === 'total_pieces') {
        const ppc = Number(l.pieces_per_ctn) || 1
        const tp = parseFloat(val) || 0
        updated.qty_ctn = Math.floor(tp / ppc)
        updated.qty_pieces = tp % ppc
        updated.amount = tp * (parseFloat(l.rate) || 0)
        updated.net = updated.amount - (parseFloat(l.discount) || 0)
      }
      if (field === 'rate') {
        const tp = (Number(l.qty_ctn) * (Number(l.pieces_per_ctn) || 1)) + Number(l.qty_pieces)
        updated.amount = tp * (parseFloat(val) || 0)
        updated.net = updated.amount - (parseFloat(l.discount) || 0)
      }
      if (field === 'discount') {
        updated.net = (parseFloat(updated.amount) || 0) - (parseFloat(val) || 0)
      }
      return updated
    }))
  }

  // ── Merge helper: current bill replaces same-shop lines in allSaved ──

  const mergedLines = () => {
    const currentShop = qShop
    const otherShopLines = allSavedLines.filter(l => String(l.customer_id) !== String(currentShop))
    return [...otherShopLines, ...currentBillLines]
  }

  // ── Returns ──

  const loadReturns = async (gpId) => {
    try {
      const r = await api.get(`/gate-passes/${gpId}/returns`)
      setOgpReturns(r.data)
    } catch { setOgpReturns([]) }
  }

  const openReturn = (bill) => {
    const lines = bill.lines.map(l => ({
      ...l,
      return_qty_ctn: 0,
      return_qty_pieces: 0,
      net: l.net != null ? parseFloat(l.net) : (parseFloat(l.amount) - parseFloat(l.discount)),
    }))
    setReturnBill({ customer_id: bill.customer_id, shop_name: bill.shop_name })
    setReturnLines(lines)
    setReturnDate(todayStr())
    setReturnNotes('')
    setReturnMsg('')
  }

  const saveReturn = async () => {
    if (!bookingOgp || !returnBill) return
    const itemsToReturn = returnLines.filter(l => (parseFloat(l.return_qty_ctn) || 0) > 0)
    if (!itemsToReturn.length) { setReturnMsg('Enter return quantity for at least one item'); return }
    setReturnSaving(true); setReturnMsg('')
    try {
      await api.post(`/gate-passes/${bookingOgp.id}/returns`, {
        customer_id: returnBill.customer_id,
        shop_name: returnBill.shop_name,
        return_date: returnDate,
        notes: returnNotes,
        items: itemsToReturn.map(l => ({
          stock_id: l.stock_id,
          item_code: l.item_code || '',
          item_description: l.item_description,
          brand: l.brand,
          qty_ctn: parseFloat(l.return_qty_ctn) || 0,
          qty_pieces: parseFloat(l.return_qty_pieces) || 0,
          rate: parseFloat(l.rate) || 0,
          discount: 0,
        })),
      })
      setReturnMsg('✓ Return saved — stock restored')
      // Reload booking items so bill view + print GP reflect the deducted quantities
      const [items, rets] = await Promise.all([
        api.get(`/gate-passes/${bookingOgp.id}/booking-items`),
        api.get(`/gate-passes/${bookingOgp.id}/returns`),
      ])
      setAllSavedLines(items.data.map(i => {
        const stock = stocks.find(s => s.id === i.stock_id)
        const ppc = i.pieces_per_ctn || stock?.pieces_per_ctn || 1
        return { ...i, _key: `db-${i.id}`, pieces_per_ctn: ppc, total_pieces: (Number(i.qty_ctn) * ppc) + Number(i.qty_pieces || 0) }
      }))
      setOgpReturns(rets.data)
      setCurrentBillLines([])
      await loadAll()
    } catch (e) {
      setReturnMsg(e.response?.data?.error || 'Error saving return')
    }
    setReturnSaving(false)
  }

  const deleteReturn = async (returnId) => {
    if (!bookingOgp) return
    if (!confirm('Delete this return? The quantities will be added back to the customer\'s bill.')) return
    try {
      await api.delete(`/gate-passes/${bookingOgp.id}/returns/${returnId}`)
      const [items, rets] = await Promise.all([
        api.get(`/gate-passes/${bookingOgp.id}/booking-items`),
        api.get(`/gate-passes/${bookingOgp.id}/returns`),
      ])
      setAllSavedLines(items.data.map(i => {
        const stock = stocks.find(s => s.id === i.stock_id)
        const ppc = i.pieces_per_ctn || stock?.pieces_per_ctn || 1
        return { ...i, _key: `db-${i.id}`, pieces_per_ctn: ppc, total_pieces: (Number(i.qty_ctn) * ppc) + Number(i.qty_pieces || 0) }
      }))
      setOgpReturns(rets.data)
      setCurrentBillLines([])
      await loadAll()
    } catch (e) {
      toast(e.response?.data?.error || 'Error deleting return')
    }
  }

  // ── Save booking ──

  const doSaveBooking = async () => {
    if (!bookingOgp) return
    const lines = mergedLines()
    if (lines.length === 0) { setBookingMsg('Add at least one item'); return }
    setBookingSaving(true); setBookingMsg('')
    try {
      await api.post(`/gate-passes/${bookingOgp.id}/booking-items`, { items: lines })
      setAllSavedLines(lines.map((l, i) => ({ ...l, _key: l._key || `saved-${i}` })))
      await loadAll()
      setBookingMsg('✓ Bill saved')
    } catch (e) {
      setBookingMsg(e.response?.data?.error || 'Error saving')
    }
    setBookingSaving(false)
  }

  const saveBooking = () => doSaveBooking()

  const createAnother = async () => {
    if (!bookingOgp) return
    const lines = mergedLines()
    if (lines.length === 0) { setBookingMsg('Add at least one item'); return }
    setBookingSaving(true); setBookingMsg('')
    try {
      await api.post(`/gate-passes/${bookingOgp.id}/booking-items`, { items: lines })
      setAllSavedLines(lines.map((l, i) => ({ ...l, _key: l._key || `saved-${i}` })))
      await loadAll()
      // Clear for the next customer's bill
      setQShop(''); setQShopSearch(''); setQShopOpen(false); setQShopHighlight(-1)
      setQItem(null); setQItemSearch(''); setQItemOpen(false); setQItemHighlight(-1)
      setQCtn(''); setQPcs('0'); setQRate(''); setQDisc('0'); setQNet('')
      setQError(''); setCurrentBillLines([])
      setBookingMsg('')
    } catch (e) {
      setBookingMsg(e.response?.data?.error || 'Error saving')
    }
    setBookingSaving(false)
  }

  // ── Load a saved bill back into the edit form ──

  const editSavedBill = (shopId, shopName) => {
    const shopLines = allSavedLines.filter(l => String(l.customer_id) === String(shopId) && l.shop_name === shopName)
    setCurrentBillLines(shopLines.map(l => ({ ...l, _key: l._key || `edit-${l.id || Math.random()}` })))
    setQShop(String(shopId)); setQShopSearch(shopName); setQShopOpen(false); setQShopHighlight(-1)
    setQItem(null); setQItemSearch(''); setQItemOpen(false); setQItemHighlight(-1)
    setQCtn(''); setQPcs('0'); setQRate(''); setQDisc('0'); setQNet('')
    setQError(''); setBookingMsg('')
    setBillsView(false)
  }

  const deleteSavedBill = async (shopId, shopName) => {
    if (!confirm(`Remove all items for "${shopName}" from this OGP?`)) return
    const remaining = allSavedLines.filter(l => !(String(l.customer_id) === String(shopId) && l.shop_name === shopName))
    try {
      await api.post(`/gate-passes/${bookingOgp.id}/booking-items`, { items: remaining })
      setAllSavedLines(remaining)
      await loadAll()
    } catch (e) { toast(e.response?.data?.error || 'Error') }
  }

  // ── Summary totals (current bill only) ──

  const bQty = currentBillLines.reduce((s, l) => s + (parseFloat(l.qty_ctn) || 0), 0)
  const bPcs = currentBillLines.reduce((s, l) => s + (parseFloat(l.qty_pieces) || 0), 0)
  const bAmount = currentBillLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const bDisc = currentBillLines.reduce((s, l) => s + (parseFloat(l.discount) || 0), 0)
  const bTotal = currentBillLines.reduce((s, l) => s + (parseFloat(l.net != null ? l.net : (l.amount - l.discount)) || 0), 0)

  // Saved bills grouped by shop
  const savedBillGroups = Object.values(
    allSavedLines.reduce((acc, l) => {
      const key = `${l.customer_id}|${l.shop_name}`
      if (!acc[key]) acc[key] = { customer_id: l.customer_id, shop_name: l.shop_name, lines: [] }
      acc[key].lines.push(l)
      return acc
    }, {})
  )

  if (loading) return <div style={{padding:32,color:'#64748b'}}>Loading…</div>

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: BOOKING DELIVERY ORDER
  // ════════════════════════════════════════════════════════════════════════════

  if (view === 'booking') {
  const isClosed = bookingOgp?.status === 'CLOSED'
  return (
    <div style={{minHeight:'100vh',background:'#f1f5f9'}}>
      {/* ── Header Bar ── */}
      <div style={{background:'linear-gradient(135deg,#312e81,#4f46e5)',padding:'14px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 2px 16px rgba(79,70,229,0.25)'}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <button onClick={() => setView('delivery')}
            style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:8,padding:'6px 14px',color:'white',cursor:'pointer',fontSize:'0.8125rem',fontWeight:600}}>
            ← Back
          </button>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <h1 style={{fontSize:'1.0625rem',fontWeight:700,color:'white',margin:0}}>Booking Delivery Order</h1>
              <span style={{background:'rgba(255,255,255,0.2)',borderRadius:6,padding:'2px 10px',fontSize:'0.75rem',fontWeight:700,color:'white'}}>OGP #{bookingOgp?.ogp_number}</span>
              {isClosed && <span style={{background:'#fef3c7',borderRadius:6,padding:'2px 10px',fontSize:'0.75rem',fontWeight:700,color:'#92400e'}}>CLOSED</span>}
            </div>
            <div style={{display:'flex',gap:14,marginTop:3,flexWrap:'wrap'}}>
              {bookingOgp?.ogp_date && <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.7)'}}>{bookingOgp.ogp_date}</span>}
              {bookingOgp?.delivery_man && <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.7)'}}>DM: {bookingOgp.delivery_man}</span>}
              {bookingOgp?.area && <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.7)'}}>{bookingOgp.area}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content: Two-column grid ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 308px',gap:20,padding:'20px 24px',alignItems:'start'}}>

        {/* ── LEFT: Entry area ── */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>

          {/* Shop / Customer Selector */}
          {!isClosed && (
            <div className="card" style={{padding:'14px 18px'}}>
              <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                <div style={{flexShrink:0,minWidth:80}}>
                  <p style={{fontSize:'0.625rem',fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',margin:0,marginBottom:2}}>Billing To</p>
                  {qShop
                    ? <span style={{fontSize:'0.875rem',fontWeight:700,color:'#16a34a'}}>✓ {customers.find(c => String(c.id) === String(qShop))?.shop_name}</span>
                    : <span style={{fontSize:'0.8125rem',color:'#94a3b8'}}>Not selected</span>}
                </div>
                <div style={{position:'relative',flex:1,minWidth:220,maxWidth:400}}>
                  <input type="text" value={qShopSearch}
                    onChange={e => { setQShopSearch(e.target.value); setQShopOpen(true); setQShopHighlight(-1); setQShop('') }}
                    onFocus={() => setQShopOpen(true)}
                    onBlur={() => setTimeout(() => { setQShopOpen(false); setQShopHighlight(-1) }, 180)}
                    onKeyDown={e => {
                      const retailers = customers.filter(c => c.customer_type === 'RETAILER' || c.customer_type === 'CUSTOMER')
                      const results = qShopSearch.trim() ? retailers.filter(c => c.shop_name?.toLowerCase().includes(qShopSearch.toLowerCase()) || c.customer_name?.toLowerCase().includes(qShopSearch.toLowerCase())) : retailers
                      if (!qShopOpen || results.length === 0) return
                      if (e.key === 'ArrowDown') { e.preventDefault(); const next = Math.min(qShopHighlight + 1, results.length - 1); setQShopHighlight(next); document.getElementById(`ssr-${next}`)?.scrollIntoView({ block: 'nearest' }) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); const prev = Math.max(qShopHighlight - 1, 0); setQShopHighlight(prev); document.getElementById(`ssr-${prev}`)?.scrollIntoView({ block: 'nearest' }) }
                      else if (e.key === 'Enter') { e.preventDefault(); const idx = qShopHighlight >= 0 ? qShopHighlight : 0; const c = results[idx]; if (c) { setQShop(String(c.id)); setQShopSearch(c.shop_name); setQShopOpen(false); setQShopHighlight(-1) } }
                      else if (e.key === 'Escape') { setQShopOpen(false); setQShopHighlight(-1) }
                    }}
                    placeholder="Search shop / customer name…"
                    className="db-input" style={{width:'100%'}} />
                  {(() => {
                    const retailers = customers.filter(c => c.customer_type === 'RETAILER' || c.customer_type === 'CUSTOMER')
                    const results = qShopSearch.trim() ? retailers.filter(c => c.shop_name?.toLowerCase().includes(qShopSearch.toLowerCase()) || c.customer_name?.toLowerCase().includes(qShopSearch.toLowerCase())) : retailers
                    if (!qShopOpen) return null
                    return (
                      <div style={{position:'absolute',zIndex:50,left:0,right:0,top:'100%',marginTop:4,background:'white',border:'1px solid #e2e8f0',borderRadius:12,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',maxHeight:208,overflowY:'auto'}}>
                        {results.length === 0
                          ? <div style={{padding:'10px 14px',fontSize:'0.875rem',color:'#9ca3af'}}>No retailers found</div>
                          : results.map((c, idx) => (
                            <div key={c.id} id={`ssr-${idx}`}
                              onMouseDown={() => { setQShop(String(c.id)); setQShopSearch(c.shop_name); setQShopOpen(false); setQShopHighlight(-1) }}
                              style={{padding:'9px 14px',fontSize:'0.875rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,background: idx === qShopHighlight ? '#eff6ff' : 'white',borderBottom:'1px solid #f1f5f9'}}>
                              <span style={{fontWeight:500,color:'#1e293b'}}>{c.shop_name}</span>
                              <span style={{color:'#94a3b8',fontSize:'0.75rem'}}>{c.customer_name}</span>
                            </div>
                          ))
                        }
                      </div>
                    )
                  })()}
                </div>
                <button
                  onClick={() => setShowAddCustomer(true)}
                  className="btn btn-primary"
                  style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  + Add Customer
                </button>
              </div>
            </div>
          )}

      {/* ── Item Entry Form ── */}
      {!isClosed && <div className="card" style={{padding:'14px 18px'}}>
        <p style={{fontSize:'0.625rem',fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Add Line Item</p>
        <div style={{display:'grid',gridTemplateColumns:'minmax(220px, 2.5fr) minmax(80px, 0.8fr) minmax(90px, 0.9fr) minmax(70px, 0.7fr) minmax(90px, 0.9fr) auto',gap:10,alignItems:'end'}}>

          {/* Searchable Item */}
          <div style={{position:'relative'}}>
            <label className="form-label" style={{display:'block',marginBottom:4}}>
              Item {qItem && <span style={{color:'#4f46e5',fontWeight:500,marginLeft:4,fontSize:'0.7rem'}}>✓ {qItem.company_name}</span>}
            </label>
            <input
              type="text"
              value={qItemSearch}
              onChange={e => { setQItemSearch(e.target.value); setQItemOpen(true); setQItemHighlight(-1); setQItem(null); setQRate(''); setQNet('') }}
              onFocus={() => setQItemOpen(true)}
              onBlur={() => setTimeout(() => { setQItemOpen(false); setQItemHighlight(-1) }, 180)}
              onKeyDown={e => {
                if (!qItemOpen || itemSearchResults.length === 0) return
                if (e.key === 'ArrowDown') { e.preventDefault(); const next = Math.min(qItemHighlight + 1, itemSearchResults.length - 1); setQItemHighlight(next); document.getElementById(`isr-${next}`)?.scrollIntoView({ block: 'nearest' }) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); const prev = Math.max(qItemHighlight - 1, 0); setQItemHighlight(prev); document.getElementById(`isr-${prev}`)?.scrollIntoView({ block: 'nearest' }) }
                else if (e.key === 'Enter') { e.preventDefault(); const idx = qItemHighlight >= 0 ? qItemHighlight : 0; const s = itemSearchResults[idx]; if (s) { handleItemSelect(s.id); setQItemSearch(s.product_name); setQItemOpen(false); setQItemHighlight(-1) } }
                else if (e.key === 'Escape') { setQItemOpen(false); setQItemHighlight(-1) }
              }}
              placeholder="Type item name to search…"
              className="db-input" style={{width:'100%'}}
            />
            {qItemOpen && itemSearchResults.length > 0 && (
              <div style={{position:'absolute',zIndex:50,left:0,right:0,top:'100%',marginTop:4,background:'white',border:'1px solid #e2e8f0',borderRadius:12,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',maxHeight:208,overflowY:'auto'}}>
                {itemSearchResults.map((s, idx) => (
                  <div
                    key={s.id}
                    id={`isr-${idx}`}
                    onMouseDown={() => { handleItemSelect(s.id); setQItemSearch(s.product_name); setQItemOpen(false); setQItemHighlight(-1) }}
                    style={{padding:'9px 14px',fontSize:'0.875rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,background: idx === qItemHighlight ? '#eff6ff' : 'white',borderBottom:'1px solid #f1f5f9'}}
                  >
                    <div>
                      <span style={{fontWeight:500,color:'#1e293b'}}>{s.product_name}</span>
                      <span style={{color:'#9ca3af',fontSize:'0.75rem',marginLeft:8}}>{s.company_name}</span>
                    </div>
                    <span style={{fontSize:'0.75rem',fontWeight:600,flexShrink:0,color: s.quantity <= 0 ? '#ef4444' : '#16a34a'}}>
                      Qty: {s.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {qItemOpen && qItemSearch.trim().length >= 1 && itemSearchResults.length === 0 && (
              <div style={{position:'absolute',zIndex:50,left:0,right:0,top:'100%',marginTop:4,background:'white',border:'1px solid #e2e8f0',borderRadius:12,boxShadow:'0 4px 16px rgba(0,0,0,0.1)',padding:'8px 12px',fontSize:'0.875rem',color:'#9ca3af'}}>
                No items found
              </div>
            )}
          </div>

          {/* Pieces */}
          <div style={{position:'relative'}}>
            <label className="form-label" style={{display:'block',marginBottom:4}}>
              Pieces {qItem?.pieces_per_ctn && <span style={{color:'#94a3b8',fontWeight:400,fontSize:'0.7rem'}}>({qItem.pieces_per_ctn}/ctn)</span>}
            </label>
            <input type="number" onWheel={e => e.target.blur()} value={qCtn || ''} min="0" step="1" placeholder="0"
              onChange={e => { setQCtn(e.target.value); recalcNet(e.target.value, qRate, qDisc) }}
              className="db-input" style={{width:'100%'}} />
            <p style={{position:'absolute',top:'100%',left:0,fontSize:'0.7rem',color:'#4f46e5',marginTop:2,fontWeight:600,whiteSpace:'nowrap'}}>
              {qCtn && qItem?.pieces_per_ctn ? (() => {
                const ppc = Number(qItem.pieces_per_ctn) || 1; const tp = parseFloat(qCtn) || 0
                const c = Math.floor(tp / ppc); const p = tp % ppc
                return `${c} CTN${p > 0 ? ` ${p}p` : ''}`
              })() : ''}
            </p>
          </div>

          {/* Rate */}
          <div>
            <label className="form-label" style={{display:'block',marginBottom:4}}>Rate</label>
            <input type="number" onWheel={e => e.target.blur()} value={qRate || ''} min="0" step="0.01" placeholder="0.00"
              onChange={e => { setQRate(e.target.value); recalcNet(qCtn, e.target.value, qDisc) }}
              className="db-input" style={{width:'100%'}} />
          </div>

          {/* Discount */}
          <div>
            <label className="form-label" style={{display:'block',marginBottom:4}}>Disc</label>
            <input type="number" onWheel={e => e.target.blur()} value={qDisc || ''} min="0" step="0.01" placeholder="0.00"
              onChange={e => { setQDisc(e.target.value); recalcNet(qCtn, qRate, e.target.value) }}
              className="db-input" style={{width:'100%'}} />
          </div>

          {/* Net */}
          <div>
            <label className="form-label" style={{display:'block',marginBottom:4}}>Net</label>
            <input type="number" onWheel={e => e.target.blur()} value={qNet || ''} min="0" step="0.01" placeholder="0.00"
              onChange={e => setQNet(e.target.value)}
              className="db-input" style={{width:'100%',background:'#f0fdf4',borderColor:'#86efac'}} />
          </div>

          {/* Add */}
          <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
            {qError && <p style={{color:'#ef4444',fontSize:'0.7rem',marginBottom:4,whiteSpace:'nowrap'}}>{qError}</p>}
            <button onClick={addLine} className="btn btn-primary" style={{whiteSpace:'nowrap'}}>+ Add</button>
          </div>
        </div>
      </div>}

      {/* ── Current Bill Lines ── */}
      {currentBillLines.length > 0 && (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',background:'linear-gradient(135deg,#f8fafc,#f1f5f9)',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:'0.875rem',fontWeight:700,color:'#1e293b'}}>
              Current Bill
              {qShop && <span style={{color:'#4f46e5',marginLeft:8}}>— {customers.find(c => String(c.id) === String(qShop))?.shop_name}</span>}
            </span>
            <span className="badge badge-blue">{currentBillLines.length} item{currentBillLines.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="db-table" style={{width:'100%'}}>
              <thead>
                <tr>
                  <th style={{width:28}}>#</th>
                  <th>Item</th>
                  <th>Brand</th>
                  <th style={{textAlign:'center'}}>Qty</th>
                  <th style={{textAlign:'right'}}>Rate</th>
                  <th style={{textAlign:'right'}}>Amount</th>
                  <th style={{textAlign:'right'}}>Disc</th>
                  <th style={{textAlign:'right'}}>Net</th>
                  {!isClosed && <th style={{width:28}}></th>}
                </tr>
              </thead>
              <tbody>
                {currentBillLines.map((line, i) => {
                  const net = line.net != null ? parseFloat(line.net) : (parseFloat(line.amount) - parseFloat(line.discount))
                  return (
                    <tr key={line._key}>
                      <td style={{color:'#94a3b8',fontSize:'0.75rem'}}>{i+1}</td>
                      <td style={{fontWeight:500,color:'#1e293b'}}>{line.item_description}</td>
                      <td><span style={{fontSize:'0.7rem',background:'#f1f5f9',color:'#64748b',borderRadius:4,padding:'2px 6px',fontWeight:500}}>{line.brand}</span></td>
                      <td style={{textAlign:'center'}}>
                        {isClosed ? (
                          <span style={{fontWeight:600,color:'#374151'}}>{line.qty_ctn} CTN{line.qty_pieces > 0 ? ` ${line.qty_pieces} Pcs` : ''}</span>
                        ) : (
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                            <input type="number" onWheel={e => e.target.blur()}
                              value={(line.qty_ctn * (line.pieces_per_ctn || 1)) + (line.qty_pieces || 0)}
                              min="0" step="1"
                              onChange={e => updateCurrentLine(line._key, 'total_pieces', e.target.value)}
                              className="db-input" style={{width:72,textAlign:'center',fontSize:'0.75rem',padding:'3px 6px'}}
                              title="Total pieces" placeholder="0" />
                            <span style={{fontSize:'0.7rem',color:'#4f46e5',fontWeight:600,whiteSpace:'nowrap'}}>{line.qty_ctn}c{line.qty_pieces > 0 ? ` ${line.qty_pieces}p` : ''}</span>
                          </div>
                        )}
                      </td>
                      <td style={{textAlign:'right'}}>
                        {isClosed
                          ? <span style={{color:'#475569'}}>Rs.{fmt(line.rate)}</span>
                          : <input type="number" onWheel={e => e.target.blur()} value={line.rate || ''} min="0" step="0.01" placeholder="0.00"
                              onChange={e => updateCurrentLine(line._key, 'rate', parseFloat(e.target.value) || 0)}
                              className="db-input" style={{width:80,fontSize:'0.75rem',padding:'3px 6px',textAlign:'right'}} />}
                      </td>
                      <td style={{textAlign:'right',color:'#475569',fontSize:'0.875rem'}}>Rs.{fmt(line.amount)}</td>
                      <td style={{textAlign:'right'}}>
                        {isClosed
                          ? <span style={{color:'#ea580c',fontSize:'0.875rem'}}>Rs.{fmt(line.discount)}</span>
                          : <input type="number" onWheel={e => e.target.blur()} value={line.discount || ''} min="0" step="0.01" placeholder="0.00"
                              onChange={e => updateCurrentLine(line._key, 'discount', parseFloat(e.target.value) || 0)}
                              className="db-input" style={{width:72,fontSize:'0.75rem',padding:'3px 6px',textAlign:'right'}} />}
                      </td>
                      <td style={{textAlign:'right',fontWeight:700,color:'#15803d',whiteSpace:'nowrap'}}>Rs.{fmt(net)}</td>
                      {!isClosed && (
                        <td>
                          <button onClick={() => setCurrentBillLines(prev => prev.filter(l => l._key !== line._key))}
                            style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:'1.125rem',lineHeight:1,padding:'2px 4px'}}>×</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{background:'#f8fafc',borderTop:'2px solid #e2e8f0',fontWeight:700}}>
                  <td colSpan={3} style={{padding:'10px 12px',color:'#64748b',fontSize:'0.875rem'}}>Totals</td>
                  <td style={{textAlign:'center',padding:'10px 12px',color:'#1d4ed8'}}>{bQty} CTN{bPcs > 0 ? ` ${bPcs}p` : ''}</td>
                  <td></td>
                  <td style={{textAlign:'right',padding:'10px 12px',color:'#475569'}}>Rs.{fmt(bAmount)}</td>
                  <td style={{textAlign:'right',padding:'10px 12px',color:'#ea580c'}}>Rs.{fmt(bDisc)}</td>
                  <td style={{textAlign:'right',padding:'10px 12px',color:'#15803d',fontSize:'1rem'}}>Rs.{fmt(bTotal)}</td>
                  {!isClosed && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {currentBillLines.length === 0 && !isClosed && (
        <div className="card" style={{padding:'36px 20px',textAlign:'center'}}>
          <div style={{width:44,height:44,background:'#eff6ff',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <p style={{fontSize:'0.875rem',color:'#64748b',margin:0,fontWeight:500}}>No items yet</p>
          <p style={{fontSize:'0.75rem',color:'#94a3b8',margin:'4px 0 0'}}>Select a shop above, then add items</p>
        </div>
      )}
      {isClosed && currentBillLines.length === 0 && (
        <div className="alert alert-info" style={{display:'flex',alignItems:'center',gap:12}}>
          <svg style={{width:16,height:16,flexShrink:0}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>This gate pass is <strong>closed</strong>. Viewing only — reopen to make changes.</span>
        </div>
      )}

        </div>{/* end LEFT COLUMN */}

        {/* ── RIGHT COLUMN ── */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>

          {/* OGP Summary */}
          <div className="card" style={{padding:'14px 18px'}}>
            <p style={{fontSize:'0.625rem',fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>OGP Summary</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'#f8fafc',borderRadius:8}}>
                <span style={{fontSize:'0.75rem',color:'#64748b',fontWeight:500}}>Bills saved</span>
                <span style={{fontSize:'1rem',fontWeight:700,color:'#4f46e5'}}>{savedBillGroups.length}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'#eff6ff',borderRadius:8}}>
                <span style={{fontSize:'0.75rem',color:'#64748b',fontWeight:500}}>Total CTN</span>
                <span style={{fontSize:'1rem',fontWeight:700,color:'#1d4ed8'}}>
                  {allSavedLines.reduce((s,l) => s+(parseFloat(l.qty_ctn)||0),0)}
                </span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'#f0fdf4',borderRadius:8}}>
                <span style={{fontSize:'0.75rem',color:'#64748b',fontWeight:500}}>Total Amount</span>
                <span style={{fontSize:'0.9375rem',fontWeight:700,color:'#15803d'}}>
                  Rs.{fmt(allSavedLines.reduce((s,l) => s+(parseFloat(l.net!=null?l.net:(l.amount-l.discount))||0),0))}
                </span>
              </div>
              {ogpReturns.length > 0 && (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'#fff7ed',borderRadius:8}}>
                  <span style={{fontSize:'0.75rem',color:'#c2410c',fontWeight:500}}>Returns</span>
                  <span style={{fontSize:'0.875rem',fontWeight:700,color:'#c2410c'}}>{ogpReturns.length} record{ogpReturns.length!==1?'s':''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Saved Bills */}
          {savedBillGroups.length > 0 && (
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <div style={{padding:'10px 14px',background:'linear-gradient(135deg,#f5f3ff,#ede9fe)',borderBottom:'1px solid #ddd6fe',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:'0.8125rem',fontWeight:700,color:'#5b21b6'}}>Saved Bills</span>
                <span style={{fontSize:'0.7rem',background:'#7c3aed',color:'white',borderRadius:10,padding:'1px 8px',fontWeight:700}}>{savedBillGroups.length}</span>
              </div>
              <div style={{maxHeight:260,overflowY:'auto'}}>
                {savedBillGroups.map(bill => {
                  const billTotal = bill.lines.reduce((s,l) => s+(parseFloat(l.net!=null?l.net:(l.amount-l.discount))||0),0)
                  const billQty = bill.lines.reduce((s,l) => s+(parseFloat(l.qty_ctn)||0),0)
                  const isEditing = String(bill.customer_id) === String(qShop)
                  return (
                    <div key={`${bill.customer_id}|${bill.shop_name}`}
                      style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',background:isEditing?'#eff6ff':'white'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:'0.8125rem',fontWeight:600,color:isEditing?'#1d4ed8':'#1e293b'}}>{bill.shop_name}</span>
                        <span style={{fontSize:'0.8125rem',fontWeight:700,color:'#15803d'}}>Rs.{fmt(billTotal)}</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <span style={{fontSize:'0.7rem',color:'#94a3b8'}}>{bill.lines.length} items · {billQty} CTN</span>
                        {!isClosed && (
                          <div style={{display:'flex',gap:5}}>
                            <button onClick={() => editSavedBill(bill.customer_id,bill.shop_name)}
                              style={{background:'#eff6ff',border:'none',borderRadius:4,padding:'2px 7px',fontSize:'0.7rem',fontWeight:600,color:'#1d4ed8',cursor:'pointer'}}>Edit</button>
                            <button onClick={() => openReturn(bill)}
                              style={{background:'#fff7ed',border:'none',borderRadius:4,padding:'2px 7px',fontSize:'0.7rem',fontWeight:600,color:'#c2410c',cursor:'pointer'}}>Return</button>
                            <button onClick={() => deleteSavedBill(bill.customer_id,bill.shop_name)}
                              style={{background:'none',border:'none',padding:'2px 3px',fontSize:'0.875rem',color:'#ef4444',cursor:'pointer',lineHeight:1}}>×</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="card" style={{padding:'14px 18px'}}>
            <p style={{fontSize:'0.625rem',fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Actions</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {!isClosed && <>
                <button onClick={saveBooking} disabled={bookingSaving||currentBillLines.length===0}
                  className="btn btn-primary" style={{width:'100%',justifyContent:'center',opacity:bookingSaving||currentBillLines.length===0?0.5:1}}>
                  {bookingSaving?'Saving…':'Save Bill'}
                </button>
                <button onClick={createAnother} disabled={bookingSaving||currentBillLines.length===0}
                  className="btn btn-primary" style={{width:'100%',justifyContent:'center',background:'#2563eb',borderColor:'#2563eb',opacity:bookingSaving||currentBillLines.length===0?0.5:1}}>
                  Save &amp; Next Shop
                </button>
                <div style={{height:1,background:'#f1f5f9',margin:'2px 0'}}></div>
              </>}
              <button onClick={() => setBillsView(true)}
                className="btn btn-secondary" style={{width:'100%',justifyContent:'center',...(savedBillGroups.length>0?{borderColor:'#c4b5fd',color:'#7c3aed'}:{color:'#94a3b8'})}}>
                View All Bills{savedBillGroups.length>0?` (${savedBillGroups.length})`:''}
              </button>
              <button onClick={() => setReturnsView(true)} disabled={isClosed}
                className="btn btn-secondary" style={{width:'100%',justifyContent:'center',opacity:isClosed?0.4:1,cursor:isClosed?'not-allowed':'pointer',...(ogpReturns.length>0?{borderColor:'#fca5a5',color:'#b91c1c'}:{})}}>
                Returns{ogpReturns.length>0?` (${ogpReturns.length})`:''}
              </button>
              <button onClick={() => openEditGp(bookingOgp)} disabled={isClosed}
                className="btn btn-secondary" style={{width:'100%',justifyContent:'center',opacity:isClosed?0.4:1,cursor:isClosed?'not-allowed':'pointer',borderColor:'#c4b5fd',color:'#7c3aed'}}>
                Edit GP
              </button>
              <div style={{height:1,background:'#f1f5f9',margin:'2px 0'}}></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                <button onClick={() => printDO(bookingOgp,savedBillGroups,companyName,false)} disabled={savedBillGroups.length===0}
                  className="btn btn-secondary btn-sm" style={{justifyContent:'center',opacity:savedBillGroups.length===0?0.4:1,borderColor:'#93c5fd',color:'#1d4ed8'}}>Print DO</button>
                <button onClick={() => printDO(bookingOgp,savedBillGroups,companyName,true)} disabled={savedBillGroups.length===0}
                  className="btn btn-secondary btn-sm" style={{justifyContent:'center',opacity:savedBillGroups.length===0?0.4:1,borderColor:'#5eead4',color:'#0f766e'}}>Small DO</button>
              </div>
              <button onClick={() => printGPFromLines(bookingOgp,allSavedLines,companyName,ogpReturns)} disabled={allSavedLines.length===0}
                className="btn btn-secondary btn-sm" style={{width:'100%',justifyContent:'center',opacity:allSavedLines.length===0?0.4:1,borderColor:'#fdba74',color:'#c2410c'}}>Print GP</button>
              {bookingMsg && (
                <div style={{marginTop:2,padding:'6px 10px',borderRadius:6,background:bookingMsg.startsWith('✓')?'#dcfce7':'#fee2e2',color:bookingMsg.startsWith('✓')?'#15803d':'#dc2626',fontSize:'0.75rem',fontWeight:500,textAlign:'center'}}>
                  {bookingMsg}
                </div>
              )}
            </div>
          </div>

        </div>{/* end RIGHT COLUMN */}
      </div>{/* end grid */}

      {showAddCustomer && (
        <AddCustomerModal
          onSave={handleAddCustomer}
          onClose={() => setShowAddCustomer(false)}
          saving={savingCustomer}
          defaultCustomerType="RETAILER"
        />
      )}

      {/* All Bills overlay */}
      {billsView && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{maxWidth:768,maxHeight:'88vh',display:'flex',flexDirection:'column'}}>
            <div className="modal-header">
              <div>
                <h2 style={{fontSize:'1.1rem',fontWeight:700,color:'#1e293b'}}>All Bills — OGP #{bookingOgp?.ogp_number}</h2>
                <p style={{fontSize:'0.75rem',color:'#64748b',marginTop:2}}>{savedBillGroups.length} customer bill{savedBillGroups.length !== 1 ? 's' : ''} saved</p>
              </div>
              <button onClick={() => setBillsView(false)} className="modal-close">&times;</button>
            </div>
            <div className="modal-body" style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:12}}>
              {savedBillGroups.length === 0 ? (
                <p style={{textAlign:'center',color:'#9ca3af',padding:'32px 0'}}>No bills saved yet for this OGP</p>
              ) : savedBillGroups.map(bill => {
                const billTotal = bill.lines.reduce((s, l) => s + (parseFloat(l.net != null ? l.net : (l.amount - l.discount)) || 0), 0)
                const billQty = bill.lines.reduce((s, l) => s + (parseFloat(l.qty_ctn) || 0), 0)
                return (
                  <div key={`${bill.customer_id}|${bill.shop_name}`}
                    style={{border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                      <div>
                        <span style={{fontWeight:700,color:'#1e293b'}}>{bill.shop_name}</span>
                        <span style={{marginLeft:8,fontSize:'0.75rem',color:'#9ca3af'}}>{bill.lines.length} item{bill.lines.length !== 1 ? 's' : ''} · {billQty} CTN</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <span style={{color:'#15803d',fontWeight:700,fontSize:'0.875rem'}}>Rs. {fmt(billTotal)}</span>
                        {!isClosed && <>
                          <button onClick={() => editSavedBill(bill.customer_id, bill.shop_name)}
                            className="btn btn-sm" style={{color:'#1d4ed8',background:'#eff6ff',border:'none'}}>
                            Edit
                          </button>
                          <button onClick={() => { openReturn(bill); setBillsView(false) }}
                            className="btn btn-sm" style={{color:'#c2410c',background:'#fff7ed',border:'none'}}>
                            Return
                          </button>
                          <button onClick={() => deleteSavedBill(bill.customer_id, bill.shop_name)}
                            className="btn btn-ghost btn-sm" style={{color:'#ef4444'}}>
                            Delete
                          </button>
                        </>}
                      </div>
                    </div>
                    <div style={{overflowX:'auto'}}>
                      <table className="db-table" style={{width:'100%',fontSize:'0.75rem'}}>
                        <tbody>
                          {bill.lines.map((l, i) => {
                            const net = l.net != null ? parseFloat(l.net) : (parseFloat(l.amount) - parseFloat(l.discount))
                            return (
                              <tr key={l._key || i}>
                                <td style={{color:'#9ca3af',width:32}}>{i + 1}</td>
                                <td style={{fontWeight:500,color:'#374151'}}>{l.item_description}</td>
                                <td style={{color:'#9ca3af'}}>{l.brand}</td>
                                <td style={{color:'#4b5563'}}>
                                  {l.qty_ctn} CTN{l.qty_pieces > 0 ? ` ${l.qty_pieces} Pcs` : ''}
                                </td>
                                <td style={{color:'#6b7280'}}>Rs.{fmt(l.rate)}</td>
                                <td style={{color:'#6b7280'}}>Disc: Rs.{fmt(l.discount)}</td>
                                <td style={{color:'#15803d',fontWeight:600}}>Rs.{fmt(net)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="modal-footer" style={{textAlign:'right'}}>
              <button onClick={() => setBillsView(false)} className="btn btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Return Entry Modal ── */}
      {returnBill && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{maxWidth:768,maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
            <div className="modal-header">
              <div>
                <h2 style={{fontSize:'1.1rem',fontWeight:700,color:'#1e293b'}}>Record Return — {returnBill.shop_name}</h2>
                <p style={{fontSize:'0.75rem',color:'#64748b',marginTop:2}}>OGP #{bookingOgp?.ogp_number} · Enter quantities being returned</p>
              </div>
              <button onClick={() => setReturnBill(null)} className="modal-close">&times;</button>
            </div>

            <div style={{flexShrink:0,padding:'12px 20px',borderBottom:'1px solid #e2e8f0',background:'#f8fafc',display:'flex',alignItems:'center',gap:16}}>
              <div>
                <label className="form-label" style={{display:'block',marginBottom:4}}>Return Date</label>
                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                  className="db-input" />
              </div>
              <div style={{flex:1}}>
                <label className="form-label" style={{display:'block',marginBottom:4}}>Notes (optional)</label>
                <input type="text" value={returnNotes} onChange={e => setReturnNotes(e.target.value)}
                  placeholder="e.g. Damaged goods, wrong item…"
                  className="db-input" style={{width:'100%'}} />
              </div>
            </div>

            <div style={{flex:1,overflowY:'auto',padding:'12px 20px'}}>
              <table className="db-table" style={{width:'100%'}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left'}}>Item</th>
                    <th style={{textAlign:'left'}}>Brand</th>
                    <th style={{textAlign:'right',width:96}}>Sold CTN</th>
                    <th style={{textAlign:'right',width:96}}>Rate</th>
                    <th style={{textAlign:'center',width:112,color:'#ea580c'}}>Return CTN</th>
                    <th style={{textAlign:'center',width:112,color:'#ea580c'}}>Return Pcs</th>
                    <th style={{textAlign:'right',width:112}}>Return Net</th>
                  </tr>
                </thead>
                <tbody>
                  {returnLines.map((line, i) => {
                    const rCtn = parseFloat(line.return_qty_ctn) || 0
                    const rNet = rCtn * (parseFloat(line.rate) || 0)
                    return (
                      <tr key={line._key || i}>
                        <td style={{fontWeight:500,color:'#1e293b'}}>{line.item_description}</td>
                        <td style={{fontSize:'0.75rem',color:'#9ca3af'}}>{line.brand}</td>
                        <td style={{textAlign:'right',color:'#6b7280',fontSize:'0.75rem'}}>{line.qty_ctn}</td>
                        <td style={{textAlign:'right',color:'#6b7280',fontSize:'0.75rem'}}>Rs.{fmt(line.rate)}</td>
                        <td style={{textAlign:'center'}}>
                          <input
                            type="number" onWheel={e => e.target.blur()} min="0" max={line.qty_ctn} step="1"
                            value={line.return_qty_ctn || ''}
                            onChange={e => setReturnLines(prev => prev.map((l, j) =>
                              j === i ? { ...l, return_qty_ctn: e.target.value } : l
                            ))}
                            placeholder="0"
                            className="db-input" style={{width:80,textAlign:'center',borderColor:'#fdba74'}}
                          />
                        </td>
                        <td style={{textAlign:'center'}}>
                          <input
                            type="number" onWheel={e => e.target.blur()} min="0" step="1"
                            value={line.return_qty_pieces || ''}
                            onChange={e => setReturnLines(prev => prev.map((l, j) =>
                              j === i ? { ...l, return_qty_pieces: e.target.value } : l
                            ))}
                            placeholder="0"
                            className="db-input" style={{width:80,textAlign:'center'}}
                          />
                        </td>
                        <td style={{textAlign:'right',fontWeight:600,color:'#c2410c',fontSize:'0.75rem'}}>
                          {rCtn > 0 ? `Rs.${fmt(rNet)}` : <span style={{color:'#d1d5db'}}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:'#fff7ed',fontWeight:700,borderTop:'2px solid #e2e8f0'}}>
                    <td colSpan={4} style={{padding:'10px 12px',fontSize:'0.875rem',color:'#374151'}}>Return Total</td>
                    <td style={{padding:'10px 12px',textAlign:'center',color:'#c2410c'}}>
                      {returnLines.reduce((s, l) => s + (parseFloat(l.return_qty_ctn) || 0), 0)} CTN
                    </td>
                    <td />
                    <td style={{padding:'10px 12px',textAlign:'right',color:'#c2410c'}}>
                      Rs.{fmt(returnLines.reduce((s, l) => {
                        const q = parseFloat(l.return_qty_ctn) || 0
                        return s + q * (parseFloat(l.rate) || 0)
                      }, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="modal-footer">
              <button onClick={saveReturn} disabled={returnSaving}
                className="btn btn-primary" style={{background:'#ea580c',borderColor:'#ea580c',...(returnSaving?{opacity:0.5}:{})}}>
                {returnSaving ? 'Saving…' : 'Save Return'}
              </button>
              <button onClick={() => setReturnBill(null)} className="btn btn-secondary">Cancel</button>
              {returnMsg && (
                <span style={{fontSize:'0.875rem',fontWeight:500,color: returnMsg.startsWith('✓') ? '#16a34a' : '#dc2626'}}>
                  {returnMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Returns History Overlay ── */}
      {returnsView && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{maxWidth:768,maxHeight:'88vh',display:'flex',flexDirection:'column'}}>
            <div className="modal-header">
              <div>
                <h2 style={{fontSize:'1.1rem',fontWeight:700,color:'#1e293b'}}>Returns — OGP #{bookingOgp?.ogp_number}</h2>
                <p style={{fontSize:'0.75rem',color:'#64748b',marginTop:2}}>{ogpReturns.length} return record{ogpReturns.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setReturnsView(false)} className="modal-close">&times;</button>
            </div>
            <div className="modal-body" style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:12}}>
              {ogpReturns.length === 0 ? (
                <p style={{textAlign:'center',color:'#9ca3af',padding:'32px 0'}}>No returns recorded for this OGP</p>
              ) : ogpReturns.map(ret => {
                const retTotal = (ret.items || []).reduce((s, i) => s + (parseFloat(i.net) || 0), 0)
                const retQty = (ret.items || []).reduce((s, i) => s + (parseFloat(i.qty_ctn) || 0), 0)
                return (
                  <div key={ret.id} style={{border:'1px solid #fed7aa',borderRadius:12,overflow:'hidden'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',background:'#fff7ed',borderBottom:'1px solid #fed7aa'}}>
                      <div>
                        <span style={{fontWeight:700,color:'#1e293b'}}>{ret.shop_name}</span>
                        <span style={{marginLeft:8,fontSize:'0.75rem',color:'#94a3b8'}}>{ret.return_date}</span>
                        {ret.notes && <span style={{marginLeft:8,fontSize:'0.75rem',color:'#6b7280',fontStyle:'italic'}}>— {ret.notes}</span>}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <span style={{fontSize:'0.75rem',color:'#9ca3af'}}>{retQty} CTN returned</span>
                        <span style={{color:'#c2410c',fontWeight:700,fontSize:'0.875rem'}}>Rs. {fmt(retTotal)}</span>
                        {!isClosed && (
                          <button onClick={() => deleteReturn(ret.id)}
                            style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:'1.125rem',fontWeight:700,lineHeight:1,padding:'0 4px'}}
                            title="Delete return">×</button>
                        )}
                      </div>
                    </div>
                    <table className="db-table" style={{width:'100%',fontSize:'0.75rem'}}>
                      <tbody>
                        {(ret.items || []).map((item, i) => (
                          <tr key={item.id || i}>
                            <td style={{color:'#94a3b8',width:28}}>{i + 1}</td>
                            <td style={{fontWeight:500,color:'#1e293b'}}>{item.item_description}</td>
                            <td style={{color:'#94a3b8'}}>{item.brand}</td>
                            <td style={{color:'#475569'}}>{item.qty_ctn} CTN</td>
                            <td style={{color:'#6b7280'}}>Rs.{fmt(item.rate)}</td>
                            <td style={{color:'#c2410c',fontWeight:600}}>Rs.{fmt(item.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
            <div className="modal-footer" style={{justifyContent:'flex-end'}}>
              <button onClick={() => setReturnsView(false)} className="btn btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
  } // end if (view === 'booking')

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: EDIT GATE PASS
  // ════════════════════════════════════════════════════════════════════════════

  if (view === 'edit-gp') {
    const safeSavedPayments = Array.isArray(editGpSavedPayments) ? editGpSavedPayments : []
    const safePaymentRows = Array.isArray(editGpPaymentRows) ? editGpPaymentRows : []
    const safeItems = Array.isArray(editGpItems) ? editGpItems : []
    const gpBrandGroups = []
    const gpBrandMap = {}
    for (const item of safeItems) {
      const key = item.brand || '—'
      if (!gpBrandMap[key]) { const g = { brand: key, rows: [] }; gpBrandMap[key] = g; gpBrandGroups.push(g) }
      gpBrandMap[key].rows.push(item)
    }
    const gpTotalAmt = safeItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
    const gpRetAmt = safeItems.reduce((s, i) => ((parseFloat(i.returnQtyCtn) || 0) + (parseFloat(i.returnQtyPcs) || 0)) * (parseFloat(i.rate) || 0) + s, 0)
    const gpSavedPaid = safeSavedPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    const gpRowsPending = safePaymentRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    const gpTotalPaid = gpSavedPaid + gpRowsPending
    const gpPendingAmt = gpTotalAmt - gpRetAmt - gpTotalPaid
    const safeBankAccounts = Array.isArray(editGpBankAccounts) ? editGpBankAccounts : []
    const acctLabel = (acct) => {
      const last4 = acct.account_number ? '...' + String(acct.account_number).slice(-4) : ''
      const name = acct.bank_name || acct.account_name
      return last4 ? name + ' (' + last4 + ')' : name
    }
    const updateRate = (key, val) => setEditGpItems(prev => prev.map(i => i._consKey === key ? { ...i, rate: val } : i))
    const updateReturnCtn = (key, val) => setEditGpItems(prev => prev.map(i => {
      if (i._consKey !== key) return i
      const num = val === '' ? '' : Math.max(0, Math.min(Number(val), i.qty_ctn))
      return { ...i, returnQtyCtn: num }
    }))
    const updateReturnPcs = (key, val) => setEditGpItems(prev => prev.map(i => {
      if (i._consKey !== key) return i
      const num = val === '' ? '' : Math.max(0, Math.min(Number(val), i.qty_pieces))
      return { ...i, returnQtyPcs: num }
    }))

    const refreshPayments = async () => {
      try {
        const pays = await api.get(`/gate-passes/${editGpOgp.id}/payments`)
        if (Array.isArray(pays.data)) { setEditGpSavedPayments(pays.data); lsSavePays(editGpOgp.id, pays.data) }
      } catch {}
    }

    const handleDeletePayment = async () => {
      try {
        const pid = payDeleteId.id
        if (String(pid).startsWith('local-')) {
          // Only in local state — remove from state and localStorage
          const updated = editGpSavedPayments.filter(p => p.id !== pid)
          setEditGpSavedPayments(updated)
          lsSavePays(editGpOgp.id, updated)
        } else {
          await api.delete(`/gate-passes/${editGpOgp.id}/payments/${pid}?source=${payDeleteId.source}`)
          await refreshPayments()
        }
        setPayDeleteId(null)
      } catch (e) { toast(e.response?.data?.error || 'Failed to delete payment') }
    }

    const handleUpdatePayment = async () => {
      if (!payEditRow?.amount || Number(payEditRow.amount) <= 0) return toast('Enter a valid amount')
      const editMax = Math.max(0, gpTotalAmt - gpRetAmt - gpSavedPaid + (parseFloat(payEditRow.originalAmount ?? payEditRow.amount) || 0) - gpRowsPending)
      if (Number(payEditRow.amount) > editMax + 0.01) return toast(`Amount cannot exceed Rs. ${editMax.toFixed(2)}`)
      try {
        const pid = payEditRow.id
        if (String(pid).startsWith('local-')) {
          // Only in local state — update in state and localStorage
          const updated = editGpSavedPayments.map(p => p.id === pid
            ? { ...p, amount: Number(payEditRow.amount), date: payEditRow.date, description: payEditRow.description }
            : p)
          setEditGpSavedPayments(updated)
          lsSavePays(editGpOgp.id, updated)
        } else {
          await api.put(`/gate-passes/${editGpOgp.id}/payments/${pid}?source=${payEditRow.source}`, {
            amount: payEditRow.amount,
            date: payEditRow.date,
            description: payEditRow.description,
          })
          await refreshPayments()
        }
        setPayEditRow(null)
      } catch (e) { toast(e.response?.data?.error || 'Failed to update payment') }
    }

    return (
      <div style={{padding:'24px 28px',maxWidth:1100}}>

        {/* Delete Payment Confirm Modal */}
        {payDeleteId?.id && (
          <div className="modal-backdrop">
            <div className="modal-box" style={{maxWidth:380,textAlign:'center',padding:32}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:'#fef2f2',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:24}}>🗑️</div>
              <h3 style={{margin:'0 0 8px',fontSize:'1.0625rem'}}>Delete Payment?</h3>
              <p style={{color:'#64748b',fontSize:'0.875rem',marginBottom:20}}>This will permanently remove this payment record.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button onClick={() => setPayDeleteId(null)} className="btn btn-ghost">Cancel</button>
                <button onClick={handleDeletePayment} className="btn btn-danger">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Payment Modal */}
        {payEditRow && (
          <div className="modal-backdrop">
            <div className="modal-box" style={{maxWidth:420,padding:28}}>
              <h3 style={{margin:'0 0 18px',fontSize:'1.0625rem',fontWeight:700}}>Edit Payment</h3>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div>
                  {(() => {
                    const editMaxAmt = Math.max(0, gpTotalAmt - gpRetAmt - gpSavedPaid + (parseFloat(payEditRow.originalAmount ?? payEditRow.amount) || 0) - gpRowsPending)
                    return <>
                      <label style={{fontSize:12,fontWeight:600,color:'#64748b',display:'block',marginBottom:4}}>
                        Amount (Rs.) <span style={{fontWeight:400,color:'#94a3b8'}}>max: Rs. {editMaxAmt.toFixed(2)}</span>
                      </label>
                      <input type="number" onWheel={e => e.target.blur()} min="0.01" step="0.01" max={editMaxAmt} className="db-input" style={{width:'100%'}}
                        value={payEditRow.amount}
                        onChange={e => {
                          const capped = Math.min(parseFloat(e.target.value) || 0, editMaxAmt)
                          setPayEditRow(r => ({...r, amount: capped}))
                        }} />
                    </>
                  })()}
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#64748b',display:'block',marginBottom:4}}>Date</label>
                  <input type="date" className="db-input" style={{width:'100%'}}
                    value={payEditRow.date}
                    onChange={e => setPayEditRow(r => ({...r, date: e.target.value}))} />
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#64748b',display:'block',marginBottom:4}}>Description</label>
                  <input type="text" className="db-input" style={{width:'100%'}}
                    value={payEditRow.description}
                    onChange={e => setPayEditRow(r => ({...r, description: e.target.value}))} />
                </div>
              </div>
              <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
                <button onClick={() => setPayEditRow(null)} className="btn btn-ghost">Cancel</button>
                <button onClick={handleUpdatePayment} className="btn btn-primary">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="page-header" style={{marginBottom:20}}>
          <div>
            <h1 className="page-title">Edit Gate Pass</h1>
            <div style={{display:'flex',gap:12,marginTop:6,flexWrap:'wrap'}}>
              <span className="badge badge-blue">OGP #{editGpOgp?.ogp_number}</span>
              {editGpOgp?.ogp_date && <span className="badge">{editGpOgp.ogp_date}</span>}
              {editGpOgp?.delivery_man && <span className="badge">DM: {editGpOgp.delivery_man}</span>}
            </div>
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <button onClick={saveEditGp} disabled={editGpSaving} className="btn btn-primary" style={editGpSaving?{opacity:0.5}:{}}>
              {editGpSaving ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={() => { setView('delivery'); setEditGpOgp(null); setEditGpItems([]) }} className="btn btn-ghost">
              ← Delivery Orders
            </button>
          </div>
        </div>

        {editGpError && (
          <div className={`alert ${editGpError.startsWith('✓') ? 'alert-success' : 'alert-error'}`} style={{marginBottom:16}}>
            {editGpError}
          </div>
        )}

        {safeItems.length === 0 ? (
          <div className="empty-state">No booking items found. Use Open Booking to add items first.</div>
        ) : (
          <div className="card" style={{padding:0,overflow:'hidden',marginBottom:8}}>
            <table className="db-table" style={{width:'100%'}}>
              <thead>
                <tr>
                  <th style={{width:28}}>#</th>
                  <th>Item</th>
                  <th style={{textAlign:'right',width:60}}>CTN</th>
                  <th style={{textAlign:'right',width:60}}>Pcs</th>
                  <th style={{textAlign:'right',width:120}}>Rate (Rs.)</th>
                  <th style={{textAlign:'right',width:110}}>Amount</th>
                  <th style={{textAlign:'right',width:96}}>Ret CTN</th>
                  <th style={{textAlign:'right',width:96}}>Ret Pcs</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let sr = 0
                  return gpBrandGroups.map(group => [
                    <tr key={`brand-${group.brand}`} style={{background:'#f1f5f9'}}>
                      <td colSpan={8} style={{padding:'6px 12px',fontWeight:700,color:'#475569',fontSize:'0.75rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{group.brand}</td>
                    </tr>,
                    ...group.rows.map(item => {
                      sr++
                      const retCtn = parseFloat(item.returnQtyCtn) || 0
                      const retPcs = parseFloat(item.returnQtyPcs) || 0
                      const rateChanged = Number(item.rate) !== Number(item.origRate)
                      const qtyCtn = parseFloat(item.qty_ctn) || 0
                      const qtyPcs = parseFloat(item.qty_pieces) || 0
                      return (
                        <tr key={item._consKey} style={rateChanged?{background:'#fefce8'}:{}}>
                          <td style={{color:'#94a3b8'}}>{sr}</td>
                          <td style={{fontWeight:500,color:'#1e293b'}}>{item.item_description}</td>
                          <td style={{textAlign:'right',fontWeight:600}}>{qtyCtn}</td>
                          <td style={{textAlign:'right',color:'#64748b'}}>{qtyPcs}</td>
                          <td style={{textAlign:'right'}}>
                            <input type="number" onWheel={e => e.target.blur()} value={item.rate}
                              onChange={e => updateRate(item._consKey, e.target.value)}
                              className="db-input" style={{width:96,textAlign:'right',fontSize:'0.8125rem'}}
                              min="0" step="0.01" />
                          </td>
                          <td style={{textAlign:'right',color:'#475569'}}>Rs.{fmt(item.amount)}</td>
                          <td style={{textAlign:'right'}}>
                            <input type="number" onWheel={e => e.target.blur()} value={item.returnQtyCtn}
                              onChange={e => updateReturnCtn(item._consKey, e.target.value)}
                              className="db-input" style={{width:76,textAlign:'right',fontSize:'0.8125rem',...(retCtn>0?{borderColor:'#f87171',background:'#fff1f2'}:{})}}
                              min="0" max={qtyCtn} step="1" placeholder="" />
                          </td>
                          <td style={{textAlign:'right'}}>
                            <input type="number" onWheel={e => e.target.blur()} value={item.returnQtyPcs}
                              onChange={e => updateReturnPcs(item._consKey, e.target.value)}
                              className="db-input" style={{width:76,textAlign:'right',fontSize:'0.8125rem',...(retPcs>0?{borderColor:'#f87171',background:'#fff1f2'}:{})}}
                              min="0" max={qtyPcs} step="1" placeholder="" />
                          </td>
                        </tr>
                      )
                    })
                  ])
                })()}
              </tbody>
              <tfoot>
                <tr style={{background:'#f8fafc',fontWeight:700,borderTop:'2px solid #e2e8f0'}}>
                  <td colSpan={2} style={{padding:'10px 12px',color:'#64748b'}}>Total</td>
                  <td style={{textAlign:'right',padding:'10px 4px'}}>{safeItems.reduce((s,i) => s+(parseFloat(i.qty_ctn)||0),0)}</td>
                  <td style={{textAlign:'right',padding:'10px 4px',color:'#64748b'}}>{safeItems.reduce((s,i) => s+(parseFloat(i.qty_pieces)||0),0)}</td>
                  <td></td>
                  <td style={{textAlign:'right',padding:'10px 12px'}}>Rs.{fmt(gpTotalAmt)}</td>
                  <td style={{textAlign:'right',padding:'10px 4px',color:'#dc2626',fontSize:'0.8125rem'}}>
                    {safeItems.reduce((s,i) => s+(parseFloat(i.returnQtyCtn)||0),0) > 0 ? `−${safeItems.reduce((s,i) => s+(parseFloat(i.returnQtyCtn)||0),0)}` : ''}
                  </td>
                  <td style={{textAlign:'right',padding:'10px 4px',color:'#dc2626',fontSize:'0.8125rem'}}>
                    {safeItems.reduce((s,i) => s+(parseFloat(i.returnQtyPcs)||0),0) > 0 ? `−${safeItems.reduce((s,i) => s+(parseFloat(i.returnQtyPcs)||0),0)}` : ''}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div style={{display:'flex',gap:12,marginBottom:20,fontSize:'0.75rem',color:'#94a3b8'}}>
          <span><span style={{background:'#fef9c3',color:'#854d0e',borderRadius:4,padding:'1px 7px',marginRight:4,fontWeight:600}}>Yellow</span>= rate changed</span>
          <span><span style={{background:'#fff1f2',border:'1px solid #fca5a5',color:'#dc2626',borderRadius:4,padding:'1px 7px',marginRight:4}}>Red</span>= return qty (stock restored on save)</span>
        </div>

        {/* Payment Section */}
        <div className="card" style={{padding:0,overflow:'hidden',marginBottom:20}}>
          <div style={{padding:'12px 18px',background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',borderBottom:'1px solid #bbf7d0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <h2 style={{fontSize:'0.9375rem',fontWeight:700,color:'#15803d',margin:0}}>Payment Received</h2>
          </div>
          <div style={{padding:'16px 18px'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
              {[
                {label:'Total Amount',value:`Rs. ${gpTotalAmt.toFixed(2)}`,bg:'#f8fafc',color:'#1e293b'},
                {label:'Returns',value:`− Rs. ${gpRetAmt.toFixed(2)}`,bg:'#fff1f2',color:'#dc2626'},
                {label:'Total Paid',value:`Rs. ${gpTotalPaid.toFixed(2)}`,bg:'#eff6ff',color:'#1d4ed8'},
                {label:'Remaining',value:`Rs. ${Math.max(0, gpPendingAmt).toFixed(2)}`,bg:gpPendingAmt<=0?'#f0fdf4':'#fff7ed',color:gpPendingAmt<=0?'#15803d':'#c2410c'},
              ].map(c => (
                <div key={c.label} style={{background:c.bg,borderRadius:10,padding:'10px 14px',textAlign:'center'}}>
                  <div style={{fontSize:'0.6875rem',color:'#64748b',marginBottom:4,fontWeight:500}}>{c.label}</div>
                  <div style={{fontSize:'1rem',fontWeight:700,color:c.color}}>{c.value}</div>
                </div>
              ))}
            </div>

            {safeSavedPayments.length > 0 && (
              <div style={{marginBottom:16}}>
                <p style={{fontSize:'0.6875rem',fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Recorded Payments</p>
                <table className="db-table" style={{width:'100%',fontSize:'0.8125rem'}}>
                  <thead>
                    <tr>
                      <th>#</th><th>Date</th><th>Account</th><th>Description</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'center'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeSavedPayments.map((p, idx) => (
                      <tr key={p.id}>
                        <td style={{color:'#94a3b8'}}>{idx+1}</td>
                        <td>{p.date}</td>
                        <td>{p.account_name} <span style={{fontSize:'0.7rem',color:'#94a3b8'}}>({p.account_type})</span></td>
                        <td style={{fontSize:'0.75rem',color:'#64748b'}}>{p.description}</td>
                        <td style={{textAlign:'right',fontWeight:600,color:'#15803d'}}>Rs. {parseFloat(p.amount).toFixed(2)}</td>
                        <td style={{textAlign:'center',whiteSpace:'nowrap'}}>
                          <button onClick={() => setPayEditRow({ id: p.id, source: p.source || (p.account_type === 'REP' ? 'employee' : 'bank'), amount: p.amount, originalAmount: p.amount, date: p.date, description: p.description })}
                            style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:6,padding:'3px 10px',fontSize:11,fontWeight:600,color:'#2563eb',cursor:'pointer',marginRight:5}}>
                            Edit
                          </button>
                          <button onClick={() => setPayDeleteId({ id: p.id, source: p.source || (p.account_type === 'REP' ? 'employee' : 'bank') })}
                            style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,padding:'3px 10px',fontSize:11,fontWeight:600,color:'#dc2626',cursor:'pointer'}}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{background:'#f0fdf4',fontWeight:700,borderTop:'2px solid #e2e8f0'}}>
                      <td colSpan={5} style={{padding:'8px 12px',color:'#15803d'}}>Total Paid (recorded)</td>
                      <td style={{textAlign:'right',padding:'8px 12px',color:'#15803d'}}>Rs. {gpSavedPaid.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <p style={{fontSize:'0.6875rem',fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Add Payments</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {safePaymentRows.map((row, idx) => (
                <div key={row._id} style={{display:'grid',gridTemplateColumns:'auto 1fr 2fr 1fr 1fr auto',gap:8,alignItems:'center',background:'#f8fafc',borderRadius:10,padding:'10px 12px'}}>
                  <span style={{fontSize:'0.75rem',color:'#94a3b8',minWidth:20,textAlign:'center'}}>{idx+1}</span>
                  <input type="number" onWheel={e => e.target.blur()} min="0" step="0.01" placeholder="Amount"
                    value={row.amount}
                    onChange={ev => {
                      const otherRows = safePaymentRows.filter(r => r._id !== row._id).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
                      const maxAllowed = Math.max(0, gpTotalAmt - gpRetAmt - gpSavedPaid - otherRows)
                      const capped = Math.min(parseFloat(ev.target.value) || 0, maxAllowed)
                      updatePayRow(row._id, 'amount', capped)
                    }}
                    className="db-input" />
                  <select value={row.bankAccountId}
                    onChange={ev => updatePayRow(row._id, 'bankAccountId', ev.target.value)}
                    className="db-input db-select">
                    <option value="">— Account / Rep —</option>
                    {/* Sale reps from OGP staff panel */}
                    {staff.filter(s => s.type === 'SALE_REP').length > 0 && (
                      <optgroup label="Sale Representatives">
                        {staff.filter(s => s.type === 'SALE_REP').map(s => (
                          <option key={`rep_${s.id}`} value={`rep_${s.id}`}>{s.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {/* Employees with Sales Man role */}
                    {employees.filter(e => e.role && e.role.toLowerCase().includes('sales')).length > 0 && (
                      <optgroup label="Sales Employees">
                        {employees.filter(e => e.role && e.role.toLowerCase().includes('sales')).map(e => (
                          <option key={`emp_${e.id}`} value={`emp_${e.id}`}>{e.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {/* Bank accounts */}
                    {safeBankAccounts.length > 0 && (
                      <optgroup label="Bank Accounts">
                        {safeBankAccounts.map(acct => <option key={acct.id} value={acct.id}>{acctLabel(acct)}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <input type="date" value={row.date}
                    onChange={ev => updatePayRow(row._id, 'date', ev.target.value)}
                    className="db-input" />
                  <input type="text" value={row.description} placeholder="Note"
                    onChange={ev => updatePayRow(row._id, 'description', ev.target.value)}
                    className="db-input" />
                  <button onClick={() => removePayRow(row._id)}
                    style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:'1.125rem',lineHeight:1,padding:'2px 4px'}}>×</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginTop:10,flexWrap:'wrap'}}>
              <button onClick={() => setEditGpPaymentRows(prev => [...(Array.isArray(prev)?prev:[]),newPayRow()])}
                className="btn btn-secondary btn-sm" style={{borderColor:'#86efac',color:'#15803d'}}>+ Add Row</button>
              <button onClick={saveEditGpPayment} disabled={editGpPaySaving}
                className="btn btn-success" style={editGpPaySaving?{opacity:0.5}:{}}>
                {editGpPaySaving ? 'Saving…' : 'Save Payments'}
              </button>
              {editGpPayMsg && (
                <span style={{fontSize:'0.875rem',fontWeight:500,color:editGpPayMsg.startsWith('✓')?'#15803d':'#dc2626'}}>{editGpPayMsg}</span>
              )}
            </div>
          </div>
        </div>

        {/* Close GP */}
        {(() => {
          const canClose = gpPendingAmt <= 0.009
          return (
            <div className="card" style={{padding:'16px 18px',border:`1px solid ${canClose ? '#fecaca' : '#e2e8f0'}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
              <div>
                <h3 style={{fontSize:'0.9375rem',fontWeight:700,color:'#1e293b',margin:0,marginBottom:3}}>Close Gate Pass</h3>
                <p style={{fontSize:'0.75rem',color:'#64748b',margin:0}}>
                  {canClose
                    ? `Marks OGP #${editGpOgp?.ogp_number} as closed.`
                    : `Remaining balance Rs. ${gpPendingAmt.toFixed(2)} must be zero before closing.`}
                </p>
              </div>
              <button onClick={closeEditGp} disabled={!canClose}
                className="btn btn-danger"
                style={{whiteSpace:'nowrap', opacity: canClose ? 1 : 0.35, cursor: canClose ? 'pointer' : 'not-allowed'}}>
                Close Gate Pass
              </button>
            </div>
          )
        })()}
      </div>
    )
  }


  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: DELIVERY ORDER SCREEN
  // ════════════════════════════════════════════════════════════════════════════

  if (view === 'delivery') return (
    <div style={{padding:'24px 28px'}}>
      <div className="page-header" style={{marginBottom:20}}>
        <div>
          <h1 className="page-title">Delivery Orders</h1>
          <p className="page-subtitle">Select an OGP to open its Booking Delivery Order</p>
        </div>
        <button onClick={() => setView('main')} className="btn btn-ghost">← Back to OGP List</button>
      </div>

      <div className="search-wrap" style={{marginBottom:16}}>
        <svg style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',width:16,height:16,color:'#94a3b8'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" value={deliverySearch} onChange={e => setDeliverySearch(e.target.value)}
          placeholder="Search by OGP #, delivery man, or area…"
          className="db-input" style={{paddingLeft:36,maxWidth:400,width:'100%'}} />
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <table className="db-table" style={{width:'100%'}}>
          <thead>
            <tr>
              <th style={{width:80}}>OGP #</th>
              <th style={{width:120}}>Delivery Date</th>
              <th>Delivery Man</th>
              <th>Sale Man</th>
              <th>Area</th>
              <th style={{textAlign:'right',width:120}}>Total</th>
              <th style={{width:150}}>Action</th>
            </tr>
          </thead>
          <tbody>
            {deliveryFiltered.length === 0 ? (
              <tr><td colSpan={7} style={{textAlign:'center',padding:'40px 0',color:'#94a3b8'}}>No gate passes found</td></tr>
            ) : deliveryFiltered.map(gp => (
              <tr key={gp.id}>
                <td><span style={{fontWeight:700,color:'#4f46e5'}}>#{gp.ogp_number}</span></td>
                <td style={{color:'#64748b'}}>{gp.delivery_date || <span style={{color:'#cbd5e1'}}>—</span>}</td>
                <td style={{color:'#374151'}}>{gp.delivery_man || <span style={{color:'#cbd5e1'}}>—</span>}</td>
                <td style={{color:'#374151'}}>{gp.delivery_sale_man || <span style={{color:'#cbd5e1'}}>—</span>}</td>
                <td>{gp.area ? <span className="badge badge-purple">{gp.area}</span> : <span style={{color:'#cbd5e1'}}>—</span>}</td>
                <td style={{textAlign:'right',fontWeight:600,color:'#475569'}}>
                  {gp.total_amount > 0 ? `Rs. ${Number(gp.total_amount).toFixed(2)}` : <span style={{color:'#cbd5e1'}}>—</span>}
                </td>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <button onClick={() => openBooking(gp)} className="btn btn-primary btn-sm">Open Booking</button>
                    {gp.status === 'CLOSED' && <span className="badge badge-slate">Closed</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: MAIN (OGP creation form + list)
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div style={{minHeight:'100vh',background:'#f1f5f9'}}>
      {successOgp && <SuccessDialog ogpNumber={successOgp} onClose={() => setSuccessOgp(null)} />}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{maxWidth:360,textAlign:'center'}}>
            <div className="modal-body">
              <div style={{width:48,height:48,background:'#fef2f2',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h2 style={{fontSize:'1.0625rem',fontWeight:700,color:'#1e293b',marginBottom:8}}>Delete this OGP?</h2>
              <p style={{color:'#64748b',fontSize:'0.875rem',marginBottom:24}}>This action cannot be undone.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button onClick={() => setDeleteId(null)} className="btn btn-secondary">Cancel</button>
                <button onClick={() => deleteOgp(deleteId)} className="btn btn-danger">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div style={{background:'linear-gradient(135deg,#312e81,#4f46e5)',padding:'20px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 2px 16px rgba(79,70,229,0.25)'}}>
        <div>
          <h1 style={{fontSize:'1.125rem',fontWeight:700,color:'white',margin:0}}>Outward Gate Pass (OGP)</h1>
          <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.7)',margin:'3px 0 0'}}>Create and manage outward gate passes</p>
        </div>
        <button onClick={() => { setDeliverySearch(''); setView('delivery') }}
          style={{background:'white',color:'#4f46e5',border:'none',borderRadius:10,padding:'10px 20px',fontWeight:700,fontSize:'0.875rem',cursor:'pointer',display:'flex',alignItems:'center',gap:6,boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}}>
          Delivery Orders
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>

      <div style={{padding:'24px 28px'}}>
        {/* OGP Creation Form — horizontal single-row layout */}
        <div className="card" style={{padding:'20px 24px',marginBottom:20,border:'1px solid #e0e7ff',boxShadow:'0 1px 12px rgba(79,70,229,0.07)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
            <div style={{width:6,height:20,background:'linear-gradient(180deg,#6366f1,#4f46e5)',borderRadius:3}}></div>
            <h2 style={{fontSize:'0.9375rem',fontWeight:700,color:'#1e293b',margin:0}}>New Gate Pass</h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr 1fr 1fr 1fr auto',gap:12,alignItems:'end'}}>
            <div>
              <label className="form-label" style={{display:'block',marginBottom:4}}>OGP #</label>
              <div style={{padding:'8px 14px',background:'linear-gradient(135deg,#eff6ff,#e0e7ff)',border:'1.5px solid #c7d2fe',borderRadius:8,fontSize:'0.9375rem',fontWeight:800,color:'#3730a3',whiteSpace:'nowrap',minWidth:72,textAlign:'center'}}>
                #{form.ogpNumber}
              </div>
            </div>
            <div>
              <label className="form-label" style={{display:'block',marginBottom:4}}>Delivery Date</label>
              <input type="date" value={form.deliveryDate} onChange={e => setField('deliveryDate', e.target.value)} className="db-input" style={{width:'100%'}} />
            </div>
            <div>
              <label className="form-label" style={{display:'block',marginBottom:4}}>Delivery Man</label>
              <select value={form.deliveryMan} onChange={e => handleDeliveryManChange(e.target.value)} className="db-input db-select" style={{width:'100%'}}>
                <option value="">— Select —</option>
                {deliveryMen.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{display:'block',marginBottom:4}}>Mobile</label>
              <input type="text" value={form.mobile} placeholder="Auto-filled" onChange={e => setField('mobile', e.target.value)} className="db-input" style={{width:'100%'}} />
            </div>
            <div>
              <label className="form-label" style={{display:'block',marginBottom:4}}>Sale Man</label>
              <select value={form.deliverySaleMan} onChange={e => setField('deliverySaleMan', e.target.value)} className="db-input db-select" style={{width:'100%'}}>
                <option value="">— Select —</option>
                {saleReps.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{display:'block',marginBottom:4}}>Area</label>
              <select value={form.area} onChange={e => setField('area', e.target.value)} className="db-input db-select" style={{width:'100%'}}>
                <option value="">— Select —</option>
                {areas.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <button onClick={saveOgp} disabled={saving} className="btn btn-primary"
                style={{whiteSpace:'nowrap',height:38,paddingLeft:18,paddingRight:18,background:'linear-gradient(135deg,#4f46e5,#6366f1)',borderColor:'#4f46e5',...(saving?{opacity:0.5}:{})}}>
                {saving ? 'Creating…' : '+ Create'}
              </button>
            </div>
          </div>
        </div>

        {/* Manage panels — compact row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
          <ManagePanel title="Delivery Men" items={staff.filter(s => s.type === 'DELIVERY_MAN')} withMobile
            onAdd={(name,mobile) => addStaff(name,mobile,'DELIVERY_MAN')} onUpdate={updateStaff} onDelete={deleteStaff} />
          <ManagePanel title="Sale Representatives" items={staff.filter(s => s.type === 'SALE_REP')} withMobile={false}
            onAdd={(name) => addStaff(name,'','SALE_REP')} onUpdate={updateStaff} onDelete={deleteStaff} />
          <ManagePanel title="Areas" items={areas} withMobile={false}
            onAdd={(name) => addArea(name)} onUpdate={() => {}} onDelete={deleteArea} />
        </div>

        {/* OGP List */}
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',background:'linear-gradient(135deg,#fafafa,#f8fafc)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:6,height:20,background:'linear-gradient(180deg,#6366f1,#4f46e5)',borderRadius:3}}></div>
              <h2 style={{fontSize:'0.9375rem',fontWeight:700,color:'#1e293b',margin:0}}>All Gate Passes</h2>
            </div>
            <span className="badge badge-slate">{gatePasses.length} record{gatePasses.length!==1?'s':''}</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="db-table" style={{width:'100%'}}>
              <thead>
                <tr>
                  <th style={{width:80}}>OGP #</th>
                  <th style={{width:130}}>Delivery Date</th>
                  <th>Delivery Man</th>
                  <th style={{width:140}}>Mobile</th>
                  <th>Sale Man</th>
                  <th>Area</th>
                  <th style={{width:90}}>Status</th>
                  <th style={{width:120}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {gatePasses.length === 0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:'40px 0',color:'#94a3b8'}}>No gate passes yet.</td></tr>
                ) : gatePasses.map(gp => (
                  editId === gp.id ? (
                    <EditRow key={gp.id} gp={gp} deliveryMen={deliveryMen} saleReps={saleReps} areas={areas}
                      onSave={(data) => saveEdit(gp.id, data)} onCancel={() => setEditId(null)} />
                  ) : (
                    <tr key={gp.id}>
                      <td><span style={{fontWeight:700,color:'#4f46e5',fontSize:'0.9375rem'}}>#{gp.ogp_number}</span></td>
                      <td style={{color:'#64748b'}}>{gp.delivery_date || <span style={{color:'#cbd5e1'}}>—</span>}</td>
                      <td style={{color:'#374151',fontWeight:500}}>{gp.delivery_man || <span style={{color:'#cbd5e1'}}>—</span>}</td>
                      <td style={{color:'#64748b',fontSize:'0.8125rem',fontFamily:'monospace'}}>{gp.mobile || <span style={{color:'#cbd5e1'}}>—</span>}</td>
                      <td style={{color:'#374151'}}>{gp.delivery_sale_man || <span style={{color:'#cbd5e1'}}>—</span>}</td>
                      <td>{gp.area ? <span className="badge badge-purple">{gp.area}</span> : <span style={{color:'#cbd5e1'}}>—</span>}</td>
                      <td>{gp.status === 'CLOSED' ? <span className="badge badge-slate">Closed</span> : <span className="badge badge-green">Open</span>}</td>
                      <td>
                        <div style={{display:'flex',gap:10}}>
                        <button onClick={() => setEditId(gp.id)} className="btn btn-ghost btn-sm" style={{color:'#4f46e5'}}>Edit</button>
                        <button onClick={() => setDeleteId(gp.id)} className="btn btn-ghost btn-sm" style={{color:'#ef4444'}}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>{/* end padding wrapper */}
    </div>
  )
}
