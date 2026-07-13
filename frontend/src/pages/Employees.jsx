import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { toast } from '../components/Toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { isValidPhone } from '../utils/validation'

const ROLES = ['Delivery Man', 'Sales Man', 'Accountant', 'Manager', 'Supervisor', 'Other']
const fmt = n => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })
const today = () => new Date().toISOString().split('T')[0]

// ── Employee profile modal ─────────────────────────────────────────────────────
function ProfileModal({ title, form, onChange, onSave, onClose, saving }) {
  const isCustomRole = form.role && !ROLES.includes(form.role)
  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Full Name <span className="req">*</span></label>
            <input type="text" value={form.name} onChange={e => onChange('name', e.target.value)}
              placeholder="e.g. Ahmed Khan" className="db-input" autoFocus />
          </div>
          <div>
            <label className="form-label">Mobile Number</label>
            <input type="text" value={form.mobile} onChange={e => onChange('mobile', e.target.value)}
              placeholder="0300-1234567" className="db-input" />
          </div>
          <div>
            <label className="form-label">Role</label>
            <select value={isCustomRole ? '' : (form.role || '')} onChange={e => onChange('role', e.target.value)} className="db-input db-select">
              <option value="">— Select Role —</option>
              {ROLES.filter(r => r !== 'Other').map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="text" value={form.role} onChange={e => onChange('role', e.target.value)}
              placeholder="Or type a custom role…" className="db-input" style={{ marginTop: 8 }} />
          </div>
          <div>
            <label className="form-label">Base Monthly Salary (Rs)</label>
            <input type="number" onWheel={e => e.target.blur()} min="0" step="any"
              value={form.baseSalary === 0 || form.baseSalary === null || form.baseSalary === undefined || form.baseSalary === '' ? '' : form.baseSalary}
              onChange={e => onChange('baseSalary', e.target.value)}
              placeholder="e.g. 25000" className="db-input" />
          </div>
          <div>
            <label className="form-label">OT Rate (Rs / hour)</label>
            <input type="number" onWheel={e => e.target.blur()} min="0" step="any"
              value={form.otRate === 0 || form.otRate === null || form.otRate === undefined || form.otRate === '' ? '' : form.otRate}
              onChange={e => onChange('otRate', e.target.value)}
              placeholder="e.g. 150" className="db-input" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={onSave} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : 'Save Employee'}
          </button>
        </div>
      </div>
    </div>
  )
}

const TYPE_META = {
  ADVANCE:          { label: 'Cash Advance',      btnColor: 'bg-orange-500 hover:bg-orange-600',  badgeCls: 'bg-orange-100 text-orange-700',  entryVerb: 'CREDIT', side: 'credit' },
  OVERTIME:         { label: 'Overtime',           btnColor: 'bg-green-600 hover:bg-green-700',    badgeCls: 'bg-green-100 text-green-700',    entryVerb: 'CREDIT', side: 'credit' },
  SHORTAGE:         { label: 'Gatepass Shortage',  btnColor: 'bg-red-600 hover:bg-red-700',        badgeCls: 'bg-red-100 text-red-700',        entryVerb: 'DEBIT',  side: 'debit'  },
  PAYMENT_RECEIVED: { label: 'Receive Payment',    btnColor: 'bg-red-600 hover:bg-red-700',        badgeCls: 'bg-red-100 text-red-800',        entryVerb: 'DEBIT',  side: 'debit'  },
  RECOVERY:         { label: 'Shortage Recovery',  btnColor: 'bg-teal-600 hover:bg-teal-700',      badgeCls: 'bg-teal-100 text-teal-700',      entryVerb: 'CREDIT', side: 'credit' },
  SALARY:           { label: 'Salary Payment',     btnColor: 'bg-blue-600 hover:bg-blue-700',      badgeCls: 'bg-blue-100 text-blue-700',      entryVerb: 'CREDIT', side: 'credit' },
}

// ── Ledger entry form modal ────────────────────────────────────────────────────
function LedgerEntryModal({ type, employee, gatePasses, onSave, onClose, saving }) {
  const meta = TYPE_META[type]
  const isGP = type === 'SHORTAGE' || type === 'RECOVERY'
  const isReceivePayment = type === 'PAYMENT_RECEIVED'

  const [date, setDate] = useState(today())
  const [amount, setAmount] = useState(type === 'SALARY' && employee.base_salary > 0 ? String(employee.base_salary) : '')
  const [hours, setHours] = useState('')
  const [period, setPeriod] = useState(() => {
    const d = new Date(); return `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`
  })
  const [bankAccounts, setBankAccounts] = useState([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [gpNumber, setGpNumber] = useState('')
  const [gpId, setGpId] = useState(null)
  const [gpCustomers, setGpCustomers] = useState([])   // distinct shop names on this GP
  const [custSearch, setCustSearch] = useState('')
  const [custOpen, setCustOpen] = useState(false)
  const [custHighlight, setCustHighlight] = useState(0)
  const [desc, setDesc] = useState('')

  const otAmount = type === 'OVERTIME' ? (parseFloat(hours) || 0) * (employee.ot_rate || 0) : 0
  const isPayment = type === 'ADVANCE' || type === 'OVERTIME' || type === 'SALARY' || type === 'PAYMENT_RECEIVED'

  useEffect(() => {
    api.get('/bank-accounts').then(r => {
      setBankAccounts(r.data)
      // Default to the first CASH-type account
      const cashAcc = r.data.find(a => a.account_type === 'CASH') || r.data[0]
      if (cashAcc) setBankAccountId(String(cashAcc.id))
    }).catch(() => {})
  }, [])

  // When a gatepass is picked, load its booking items and extract distinct shop names
  useEffect(() => {
    if (!gpId) { setGpCustomers([]); return }
    api.get(`/gate-passes/${gpId}/booking-items`).then(r => {
      const names = [...new Set(r.data.map(item => item.shop_name).filter(Boolean))].sort()
      setGpCustomers(names)
      setCustSearch('')
      setCustOpen(names.length > 0)
      setCustHighlight(0)
    }).catch(() => setGpCustomers([]))
  }, [gpId])

  const custResults = gpCustomers.filter(n =>
    !custSearch || n.toLowerCase().includes(custSearch.toLowerCase())
  )

  const selectCustomer = (name) => {
    setCustSearch(name)
    setCustOpen(false)
    setCustHighlight(0)
  }

  const handleCustKey = (e) => {
    if (!custOpen) { if (e.key === 'ArrowDown') { setCustOpen(true); return } }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(custHighlight + 1, custResults.length - 1)
      setCustHighlight(next)
      document.getElementById(`csr-${next}`)?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(custHighlight - 1, 0)
      setCustHighlight(prev)
      document.getElementById(`csr-${prev}`)?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (custResults[custHighlight]) selectCustomer(custResults[custHighlight])
    } else if (e.key === 'Escape') {
      setCustOpen(false)
    }
  }

  const selectedAccType = bankAccounts.find(a => String(a.id) === bankAccountId)?.account_type
  const paymentPayload = isPayment ? { bankAccountId: bankAccountId || null, paymentMethod: selectedAccType === 'CASH' ? 'CASH' : 'BANK' } : {}

  const handleSave = () => {
    if (type === 'ADVANCE')            onSave({ date, amount, description: desc, ...paymentPayload })
    else if (type === 'PAYMENT_RECEIVED') onSave({ date, amount, description: desc, ...paymentPayload })
    else if (type === 'OVERTIME')      onSave({ date, hours, description: desc, ...paymentPayload })
    else if (type === 'SALARY')        onSave({ date, amount, period, description: desc, ...paymentPayload })
    else onSave({ date, amount, gatpassNumber: gpNumber, customerName: custSearch, description: desc })
  }

  // Info banners
  const banners = {
    ADVANCE:          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-xs text-orange-700">Posts a <strong>CREDIT</strong> — records cash given to the employee; increases the company's total payment to this employee.</div>,
    OVERTIME:         <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-700">Posts a <strong>CREDIT</strong> — reduces the employee's outstanding balance.{employee.ot_rate > 0 ? <> OT rate: <strong>Rs. {fmt(employee.ot_rate)} / hr</strong></> : <> <strong>Warning:</strong> OT rate is 0.</>}</div>,
    SHORTAGE:         <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">Posts a <strong>DEBIT</strong> — delivery man is liable for the cash shortage on this gatepass.</div>,
    PAYMENT_RECEIVED: <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800">Posts a <strong>DEBIT</strong> — records cash received from the salesman (deposits, collections, etc.). Reduces the net balance.</div>,
    RECOVERY:         <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-xs text-teal-700">Posts a <strong>CREDIT</strong> — clears the delivery liability when cash is recovered.</div>,
    SALARY:           <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">Posts a <strong>CREDIT</strong> — records salary paid; reduces any advance balance owed.{employee.base_salary > 0 ? <> Base salary: <strong>Rs. {fmt(employee.base_salary)}</strong></> : null}</div>,
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h2>Record {meta.label}</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{employee.name}</p>
          </div>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {banners[type]}

          <div>
            <label className="form-label">Date <span className="req">*</span></label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="db-input" />
          </div>

          {/* GP fields */}
          {isGP && (
            <>
              <div>
                <label className="form-label">Gatepass Number <span className="req">*</span></label>
                {gatePasses.length > 0 ? (
                  <select value={gpId || ''} onChange={e => {
                    const selected = gatePasses.find(g => String(g.id) === e.target.value)
                    setGpId(selected ? selected.id : null)
                    setGpNumber(selected ? String(selected.ogp_number) : '')
                    setCustSearch('')
                    setGpCustomers([])
                  }} className="db-input db-select">
                    <option value="">— Select OGP —</option>
                    {gatePasses.map(gp => (
                      <option key={gp.id} value={gp.id}>
                        OGP #{gp.ogp_number}{gp.delivery_date ? ` — ${gp.delivery_date}` : ''}{gp.delivery_man ? ` — ${gp.delivery_man}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={gpNumber} onChange={e => setGpNumber(e.target.value)}
                    placeholder="e.g. 42" className="db-input" />
                )}
              </div>

              <div>
                <label className="form-label">
                  Customer Name
                  {gpCustomers.length > 0 && <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>({gpCustomers.length} on this OGP)</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={custSearch}
                    onChange={e => { setCustSearch(e.target.value); setCustOpen(true); setCustHighlight(0) }}
                    onFocus={() => { if (gpCustomers.length > 0) setCustOpen(true) }}
                    onBlur={() => setTimeout(() => setCustOpen(false), 180)}
                    onKeyDown={handleCustKey}
                    placeholder={gpId ? (gpCustomers.length > 0 ? 'Type or select customer…' : 'No booking items on this OGP') : 'Select a gatepass first'}
                    disabled={!gpId}
                    className="db-input"
                  />
                  {custOpen && custResults.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: 176, overflowY: 'auto' }}>
                      {custResults.map((name, idx) => (
                        <div id={`csr-${idx}`} key={name} onMouseDown={() => selectCustomer(name)}
                          style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', background: idx === custHighlight ? '#eef2ff' : 'transparent', color: idx === custHighlight ? '#4f46e5' : '#334155', fontWeight: idx === custHighlight ? 600 : 400 }}>
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {type === 'SALARY' && (
            <div>
              <label className="form-label">Pay Period <span className="req">*</span></label>
              <input type="text" value={period} onChange={e => setPeriod(e.target.value)}
                placeholder="e.g. June 2025" className="db-input" />
            </div>
          )}

          {type === 'OVERTIME' ? (
            <div>
              <label className="form-label">OT Hours <span className="req">*</span></label>
              <input type="number" onWheel={e => e.target.blur()} min="0.01" step="0.5" value={hours} onChange={e => setHours(e.target.value)}
                placeholder="e.g. 8" className="db-input" />
              {hours && parseFloat(hours) > 0 && (
                <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>
                  = Rs. {fmt(otAmount)} credit ({hours} hrs × Rs. {fmt(employee.ot_rate)})
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="form-label">Amount (Rs) <span className="req">*</span></label>
              <input type="number" onWheel={e => e.target.blur()} min="0.01" step="any" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 5000" className="db-input" />
            </div>
          )}

          {isPayment && (() => {
            const cashAccounts = bankAccounts.filter(a => a.account_type === 'CASH')
            const bankOnlyAccounts = bankAccounts.filter(a => a.account_type !== 'CASH')
            const selectedAcc = bankAccounts.find(a => String(a.id) === bankAccountId)
            const isCashSelected = !bankAccountId || selectedAcc?.account_type === 'CASH'
            return (
              <div>
                <label className="form-label">Payment Method <span className="req">*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <button type="button"
                    onClick={() => { const cashAcc = cashAccounts[0] || bankAccounts[0]; if (cashAcc) setBankAccountId(String(cashAcc.id)) }}
                    className={`btn ${isCashSelected ? 'btn-primary' : 'btn-secondary'}`}>
                    Cash
                  </button>
                  <button type="button"
                    onClick={() => { const bankAcc = bankOnlyAccounts[0]; if (bankAcc) setBankAccountId(String(bankAcc.id)) }}
                    disabled={bankOnlyAccounts.length === 0}
                    className={`btn ${!isCashSelected ? 'btn-primary' : 'btn-secondary'}`}>
                    Bank / Account
                  </button>
                </div>
                <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className="db-input db-select">
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.account_name}{a.bank_name ? ` — ${a.bank_name}` : ''}{a.account_type === 'CASH' ? ' (Cash)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )
          })()}

          <div>
            <label className="form-label">Description <span style={{ color: '#94a3b8', fontWeight: 400 }}>(auto-filled if blank)</span></label>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
              placeholder={isGP ? 'Leave blank to auto-generate from GP & customer' : type === 'ADVANCE' ? 'e.g. Personal emergency advance' : 'e.g. OT for June 2025'}
              className="db-input" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : `Post ${meta.label}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ledger view ────────────────────────────────────────────────────────────────
function LedgerView({ employeeId, onBack }) {
  const [data, setData] = useState(null)
  const [gatePasses, setGatePasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [entryModal, setEntryModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  // Filter state
  const [fType, setFType]   = useState('All')
  const [fFrom, setFFrom]   = useState('')
  const [fTo, setFTo]       = useState('')
  const [showFilter, setShowFilter] = useState(false)

  const load = () => Promise.all([
    api.get(`/employees/${employeeId}/ledger`),
    api.get('/gate-passes'),
  ]).then(([ledger, gps]) => {
    setData(ledger.data)
    setGatePasses(gps.data)
    setLoading(false)
  })

  useEffect(() => { load() }, [employeeId])

  const post = async (endpoint, payload) => {
    setSaving(true)
    try {
      await api.post(`/employees/${employeeId}/ledger/${endpoint}`, payload)
      setEntryModal(null); await load()
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.statusText || e.message || 'Unknown error'
      toast(msg)
    }
    setSaving(false)
  }

  const routeMap = { ADVANCE: 'advance', OVERTIME: 'overtime', SHORTAGE: 'shortage', PAYMENT_RECEIVED: 'payment-received', RECOVERY: 'recovery', SALARY: 'salary' }

  const delEntry = async () => {
    try {
      await api.delete(`/employees/${employeeId}/ledger/${deleteId}`)
      setDeleteId(null); await load()
    } catch (e) { toast(e.response?.data?.error || 'Error') }
  }

  if (loading) return <div style={{ padding: 32, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10 }}><span className="spinner" />Loading ledger…</div>

  const { employee, entries, balance } = data

  // Apply filters
  const filtered = entries.filter(e => {
    if (fType !== 'All' && e.transaction_type !== fType) return false
    if (fFrom && e.date < fFrom) return false
    if (fTo   && e.date > fTo)   return false
    return true
  })

  const totalDebit  = filtered.reduce((s, e) => s + e.debit, 0)
  const totalCredit = filtered.reduce((s, e) => s + e.credit, 0)
  const filteredBalance = filtered.reduce((s, e) => s + e.debit - e.credit, 0)
  const owes = balance > 0
  const owed = balance < 0

  const companyInfo = (() => { try { return JSON.parse(localStorage.getItem('companyInfo') || '{}') } catch { return {} } })()

  const handlePrint = () => {
    const rows = filtered.map(e => `
      <tr>
        <td>${e.date}</td>
        <td>${e.transaction_type === 'PAYMENT_RECEIVED' ? 'RECEIVED' : e.transaction_type}</td>
        <td>${e.gatepass_number ? '#' + e.gatepass_number : '—'}</td>
        <td>${e.description || '—'}${e.customer_name ? ' / ' + e.customer_name : ''}</td>
        <td style="text-align:right;color:#dc2626">${e.debit > 0 ? 'Rs. ' + Number(e.debit).toLocaleString('en-PK', {minimumFractionDigits:2}) : '—'}</td>
        <td style="text-align:right;color:#16a34a">${e.credit > 0 ? 'Rs. ' + Number(e.credit).toLocaleString('en-PK', {minimumFractionDigits:2}) : '—'}</td>
        <td style="text-align:right;font-weight:700;color:${e.balance > 0 ? '#dc2626' : '#2563eb'}">
          Rs. ${Math.abs(e.balance).toLocaleString('en-PK', {minimumFractionDigits:2})} ${e.balance > 0 ? 'Dr' : e.balance < 0 ? 'Cr' : ''}
        </td>
      </tr>`).join('')

    const w = window.open('', '_blank', 'width=900,height=700')
    w.document.write(`<!DOCTYPE html><html><head><title>Employee Ledger — ${employee.name}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12pt;margin:24px;color:#111}
      h2{margin:0 0 4px;font-size:18pt} .sub{font-size:10pt;color:#555;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:10pt}
      td{padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:10pt}
      tfoot td{background:#f1f5f9;font-weight:700;border-top:2px solid #334155}
      .summary{display:flex;gap:24px;margin-bottom:16px}
      .scard{border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;min-width:140px}
      .slabel{font-size:9pt;color:#64748b;font-weight:600} .sval{font-size:14pt;font-weight:800;margin-top:2px}
      @media print{body{margin:10px}}
    </style></head><body>
    <h2>${companyInfo.name || 'DistriBooks'}</h2>
    <div class="sub">Employee Ledger${fFrom || fTo ? ' | ' + (fFrom||'') + (fTo ? ' to '+fTo : '') : ''}</div>
    <div style="font-size:13pt;font-weight:700;margin-bottom:4px">${employee.name}</div>
    <div style="font-size:10pt;color:#555;margin-bottom:16px">${employee.role||''} ${employee.mobile ? '| '+employee.mobile : ''} | Base: Rs.${employee.base_salary?.toLocaleString()||0}/mo</div>
    <div class="summary">
      <div class="scard"><div class="slabel">TOTAL DEBITS</div><div class="sval" style="color:#dc2626">Rs. ${totalDebit.toLocaleString('en-PK',{minimumFractionDigits:2})}</div></div>
      <div class="scard"><div class="slabel">TOTAL CREDITS</div><div class="sval" style="color:#16a34a">Rs. ${totalCredit.toLocaleString('en-PK',{minimumFractionDigits:2})}</div></div>
      <div class="scard"><div class="slabel">NET BALANCE</div><div class="sval" style="color:${filteredBalance>0?'#dc2626':'#2563eb'}">Rs. ${Math.abs(filteredBalance).toLocaleString('en-PK',{minimumFractionDigits:2})} ${filteredBalance>0?'Dr':filteredBalance<0?'Cr':''}</div></div>
    </div>
    <table><thead><tr><th>Date</th><th>Type</th><th>GP#</th><th>Description</th><th style="text-align:right">Debit (Dr)</th><th style="text-align:right">Credit (Cr)</th><th style="text-align:right">Balance</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4" style="text-align:right">Totals</td>
      <td style="text-align:right;color:#dc2626">Rs. ${totalDebit.toLocaleString('en-PK',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;color:#16a34a">Rs. ${totalCredit.toLocaleString('en-PK',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;color:${filteredBalance>0?'#dc2626':'#2563eb'}">Rs. ${Math.abs(filteredBalance).toLocaleString('en-PK',{minimumFractionDigits:2})} ${filteredBalance>0?'Dr':filteredBalance<0?'Cr':''}</td>
    </tr></tfoot></table>
    <div style="margin-top:20px;font-size:9pt;color:#94a3b8">Printed on ${new Date().toLocaleDateString()}</div>
    </body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  const handlePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const co = companyInfo.name || 'DistriBooks'
    doc.setFontSize(16); doc.setFont(undefined, 'bold')
    doc.text(co, 14, 16)
    doc.setFontSize(11); doc.setFont(undefined, 'normal')
    doc.text(`Employee Ledger — ${employee.name}`, 14, 24)
    doc.setFontSize(9); doc.setTextColor(100)
    doc.text(`${employee.role || ''} | ${employee.mobile || ''} | Base: Rs.${employee.base_salary?.toLocaleString() || 0}/mo`, 14, 30)
    if (fFrom || fTo) doc.text(`Period: ${fFrom || ''} to ${fTo || ''}`, 14, 35)
    doc.setTextColor(0)

    autoTable(doc, {
      startY: (fFrom || fTo) ? 39 : 35,
      head: [['Date', 'Type', 'GP #', 'Description', 'Debit (Dr)', 'Credit (Cr)', 'Balance']],
      body: filtered.map(e => [
        e.date,
        e.transaction_type === 'PAYMENT_RECEIVED' ? 'RECEIVED' : e.transaction_type,
        e.gatepass_number ? '#' + e.gatepass_number : '—',
        (e.description || '—') + (e.customer_name ? ' / ' + e.customer_name : ''),
        e.debit > 0 ? 'Rs. ' + Number(e.debit).toLocaleString('en-PK', {minimumFractionDigits:2}) : '—',
        e.credit > 0 ? 'Rs. ' + Number(e.credit).toLocaleString('en-PK', {minimumFractionDigits:2}) : '—',
        'Rs. ' + Math.abs(e.balance).toLocaleString('en-PK', {minimumFractionDigits:2}) + (e.balance > 0 ? ' Dr' : e.balance < 0 ? ' Cr' : ''),
      ]),
      foot: [['', '', '', 'Totals',
        'Rs. ' + totalDebit.toLocaleString('en-PK', {minimumFractionDigits:2}),
        'Rs. ' + totalCredit.toLocaleString('en-PK', {minimumFractionDigits:2}),
        'Rs. ' + Math.abs(filteredBalance).toLocaleString('en-PK', {minimumFractionDigits:2}) + (filteredBalance > 0 ? ' Dr' : filteredBalance < 0 ? ' Cr' : ''),
      ]],
      headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      didParseCell(data) {
        if (data.section === 'body') {
          if (data.column.index === 4 && data.cell.text[0] !== '—') data.cell.styles.textColor = [220, 38, 38]
          if (data.column.index === 5 && data.cell.text[0] !== '—') data.cell.styles.textColor = [22, 163, 74]
        }
      },
    })

    doc.save(`ledger-${employee.name.replace(/\s+/g,'-')}-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      {deleteId && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 400, textAlign: 'center', padding: 32 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1={12} y1={9} x2={12} y2={13}/><line x1={12} y1={17} x2={12.01} y2={17}/></svg>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Delete this entry?</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>Balances will be recalculated automatically.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={delEntry} className="btn btn-danger" style={{ background: '#ef4444', color: '#fff', border: 'none' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {entryModal && (
        <LedgerEntryModal
          type={entryModal}
          employee={employee}
          gatePasses={gatePasses}
          onSave={payload => post(routeMap[entryModal], payload)}
          onClose={() => setEntryModal(null)}
          saving={saving}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: 8, paddingLeft: 0 }}>← Back to Employees</button>
          <h1 className="page-title">{employee.name}</h1>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {employee.role && <span className="badge badge-blue">{employee.role}</span>}
            {employee.mobile && <span style={{ fontSize: 12, color: '#64748b' }}>{employee.mobile}</span>}
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Base: Rs. {fmt(employee.base_salary)}/mo</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>OT: Rs. {fmt(employee.ot_rate)}/hr</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => setEntryModal('ADVANCE')}          className="btn btn-sm" style={{ background: '#f97316', color: '#fff', border: 'none' }}>+ Advance</button>
          <button onClick={() => setEntryModal('OVERTIME')}         className="btn btn-sm" style={{ background: '#16a34a', color: '#fff', border: 'none' }}>+ Overtime</button>
          <button onClick={() => setEntryModal('PAYMENT_RECEIVED')} className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', border: 'none' }}>+ Receive Payment</button>
          <button onClick={() => setEntryModal('RECOVERY')}         className="btn btn-sm" style={{ background: '#0d9488', color: '#fff', border: 'none' }}>+ Recovery</button>
          <button onClick={() => setEntryModal('SALARY')}           className="btn btn-primary btn-sm">+ Pay Salary</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label" style={{ color: '#c2410c' }}>Total Debits</div><div className="stat-value" style={{ color: '#ea580c', fontSize: 20 }}>Rs. {fmt(totalDebit)}</div><div className="stat-sub">Received Payments</div></div>
        <div className="stat-card"><div className="stat-label" style={{ color: '#15803d' }}>Total Credits</div><div className="stat-value" style={{ color: '#16a34a', fontSize: 20 }}>Rs. {fmt(totalCredit)}</div><div className="stat-sub">Advances + OT + Salary</div></div>
        <div className="stat-card"><div className="stat-label" style={{ color: '#b91c1c' }}>GP Shortages</div><div className="stat-value" style={{ color: '#dc2626', fontSize: 20 }}>Rs. {fmt(entries.filter(e => e.transaction_type === 'SHORTAGE').reduce((s, e) => s + e.debit, 0))}</div><div className="stat-sub">{entries.filter(e => e.transaction_type === 'SHORTAGE').length} entries</div></div>
        <div className="stat-card"><div className="stat-label" style={{ color: owes ? '#b91c1c' : owed ? '#1d4ed8' : '#64748b' }}>Net Balance</div><div className="stat-value" style={{ color: owes ? '#dc2626' : owed ? '#2563eb' : '#94a3b8', fontSize: 20 }}>Rs. {fmt(Math.abs(balance))}</div><div className="stat-sub">{owes ? 'Employee owes company' : owed ? 'Company owes employee' : 'Settled'}</div></div>
      </div>

      {/* Ledger table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Table header with filter + actions */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontWeight: 700, color: '#1e293b' }}>
              Ledger Entries
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginLeft: 10 }}>
                {filtered.length} record{filtered.length !== 1 ? 's' : ''}{filtered.length !== entries.length ? ` (filtered from ${entries.length})` : ''}
              </span>
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => setShowFilter(f => !f)}
                style={{ background: showFilter ? '#e2e8f0' : '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Filter
              </button>
              <button onClick={handlePrint}
                style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print
              </button>
              <button onClick={handlePDF}
                style={{ background: '#dc2626', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
                PDF
              </button>
            </div>
          </div>

          {/* Filter row */}
          {showFilter && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Type</div>
                <select value={fType} onChange={e => setFType(e.target.value)} className="db-input db-select" style={{ width: 160, fontSize: 12 }}>
                  <option value="All">All Types</option>
                  <option value="ADVANCE">Advance</option>
                  <option value="PAYMENT_RECEIVED">Receive Payment</option>
                  <option value="OVERTIME">Overtime</option>
                  <option value="SHORTAGE">Shortage</option>
                  <option value="RECOVERY">Recovery</option>
                  <option value="SALARY">Salary</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>From Date</div>
                <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} className="db-input" style={{ width: 140, fontSize: 12 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>To Date</div>
                <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} className="db-input" style={{ width: 140, fontSize: 12 }} />
              </div>
              {(fType !== 'All' || fFrom || fTo) && (
                <button onClick={() => { setFType('All'); setFFrom(''); setFTo('') }}
                  style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="db-table">
            <thead>
              <tr>
                {['Date', 'Type', 'GP #', 'Description', 'Debit (Dr)', 'Credit (Cr)', 'Balance', ''].map(h => (
                  <th key={h} style={h === 'Debit (Dr)' || h === 'Credit (Cr)' || h === 'Balance' ? { textAlign: 'right' } : {}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>{entries.length === 0 ? 'No entries yet' : 'No entries match the filter'}</td></tr>
              ) : filtered.map(entry => {
                const meta = TYPE_META[entry.transaction_type] || { badgeCls: 'bg-gray-100 text-gray-600' }
                const badgeColor = entry.transaction_type === 'ADVANCE' ? 'amber' : entry.transaction_type === 'OVERTIME' ? 'green' : entry.transaction_type === 'SHORTAGE' ? 'red' : entry.transaction_type === 'PAYMENT_RECEIVED' ? 'red' : entry.transaction_type === 'RECOVERY' ? 'green' : 'blue'
                const badgeLabel = entry.transaction_type === 'PAYMENT_RECEIVED' ? 'RECEIVED' : entry.transaction_type
                return (
                  <tr key={entry.id}>
                    <td style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{entry.date}</td>
                    <td><span className={`badge badge-${badgeColor}`}>{badgeLabel}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
                      {entry.gatepass_number ? `#${entry.gatepass_number}` : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ color: '#475569', maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description}</div>
                      {entry.ot_hours > 0 && <span style={{ color: '#94a3b8', fontSize: 11 }}>({entry.ot_hours} hrs)</span>}
                      {entry.customer_name && <div style={{ fontSize: 11, color: '#94a3b8' }}>{entry.customer_name}</div>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {entry.debit > 0 ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Rs. {fmt(entry.debit)}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {entry.credit > 0 ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Rs. {fmt(entry.credit)}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: entry.balance > 0 ? '#dc2626' : entry.balance < 0 ? '#2563eb' : '#94a3b8' }}>
                      Rs. {fmt(Math.abs(entry.balance))}
                      <span style={{ fontWeight: 400, marginLeft: 2 }}>{entry.balance > 0 ? 'Dr' : entry.balance < 0 ? 'Cr' : ''}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => setDeleteId(entry.id)} className="btn btn-danger btn-sm">Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 700, fontSize: 13 }}>
                  <td colSpan={4} style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b' }}>Totals</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#dc2626', fontFamily: 'monospace' }}>Rs. {fmt(totalDebit)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#16a34a', fontFamily: 'monospace' }}>Rs. {fmt(totalCredit)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: filteredBalance > 0 ? '#dc2626' : filteredBalance < 0 ? '#2563eb' : '#94a3b8' }}>
                    Rs. {fmt(Math.abs(filteredBalance))} {filteredBalance > 0 ? 'Dr' : filteredBalance < 0 ? 'Cr' : ''}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main Employees list ────────────────────────────────────────────────────────
export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', mobile: '', role: '', baseSalary: '', otRate: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [ledgerEmpId, setLedgerEmpId] = useState(null)

  const load = () => api.get('/employees').then(r => { setEmployees(r.data); setLoading(false) })
  useEffect(() => { load() }, [])

  // Show ledger view
  if (ledgerEmpId) return <LedgerView employeeId={ledgerEmpId} onBack={() => { setLedgerEmpId(null); load() }} />

  const openAdd = () => { setForm({ name: '', mobile: '', role: '', baseSalary: '', otRate: '' }); setModal('add') }
  const openEdit = (emp) => {
    setForm({ name: emp.name, mobile: emp.mobile || '', role: emp.role || '', baseSalary: emp.base_salary || '', otRate: emp.ot_rate || '' })
    setModal(emp.id)
  }

  const save = async () => {
    if (!form.name.trim()) return toast('Name is required')
    if (!isValidPhone(form.mobile)) return toast('Mobile number is invalid. Use a format like 0300-1234567.')
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), mobile: form.mobile, role: form.role, baseSalary: Number(form.baseSalary) || 0, otRate: Number(form.otRate) || 0 }
      if (modal === 'add') await api.post('/employees', payload)
      else await api.put(`/employees/${modal}`, payload)
      setModal(null); await load()
    } catch (e) { toast(e.response?.data?.error || 'Error saving') }
    setSaving(false)
  }

  const del = async () => {
    try { await api.delete(`/employees/${deleteId}`); setDeleteId(null); await load() }
    catch (e) { toast(e.response?.data?.error || 'Error deleting') }
  }

  const allRoles = [...new Set(employees.map(e => e.role).filter(Boolean))].sort()
  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.mobile?.includes(search) || e.role?.toLowerCase().includes(search.toLowerCase())
    const matchRole = !roleFilter || e.role === roleFilter
    return matchSearch && matchRole
  })

  if (loading) return <div style={{ padding: 32, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10 }}><span className="spinner" />Loading employees…</div>

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      {deleteId && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 420, textAlign: 'center', padding: 32 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1={12} y1={9} x2={12} y2={13}/><line x1={12} y1={17} x2={12.01} y2={17}/></svg>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Delete this employee?</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>All ledger entries will also be deleted.</p>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={del} className="btn" style={{ background: '#ef4444', color: '#fff', border: 'none' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Management</h1>
          <p className="page-subtitle">Manage staff profiles, salaries and overtime rates</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">+ Add Employee</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label">Total Employees</div><div className="stat-value">{employees.length}</div><div className="stat-sub">Staff members</div></div>
        <div className="stat-card"><div className="stat-label" style={{ color: '#15803d' }}>Monthly Payroll</div><div className="stat-value" style={{ color: '#16a34a' }}>Rs. {fmt(employees.reduce((s, e) => s + (e.base_salary || 0), 0))}</div><div className="stat-sub">Total base salaries</div></div>
        <div className="stat-card"><div className="stat-label" style={{ color: '#c2410c' }}>Advance Outstanding</div><div className="stat-value" style={{ color: '#ea580c' }}>Rs. {fmt(employees.reduce((s, e) => s + Math.max(e.current_balance || 0, 0), 0))}</div><div className="stat-sub">Total debit balances</div></div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 220, maxWidth: 320 }}>
          <svg className="search-icon" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={8}/><line x1={21} y1={21} x2={16.65} y2={16.65}/></svg>
          <input type="text" placeholder="Search by name, mobile or role…" value={search} onChange={e => setSearch(e.target.value)} className="db-input" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="db-input db-select" style={{ width: 160 }}>
          <option value="">All Roles</option>
          {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(search || roleFilter) && (
          <button onClick={() => { setSearch(''); setRoleFilter('') }} className="btn btn-ghost btn-sm">Clear filters</button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <table className="db-table">
          <thead>
            <tr>
              {['Name', 'Mobile', 'Role', 'Base Salary / Mo', 'OT Rate / Hr', 'Balance', 'Actions'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>No employees found</td></tr>
            ) : filtered.map(emp => {
              const bal = emp.current_balance || 0
              return (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>{emp.name}</td>
                  <td style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{emp.mobile || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td>
                    {emp.role ? <span className="badge badge-blue">{emp.role}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ fontWeight: 500, color: '#1e293b' }}>
                    {emp.base_salary > 0 ? `Rs. ${fmt(emp.base_salary)}` : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ color: '#475569' }}>
                    {emp.ot_rate > 0 ? `Rs. ${fmt(emp.ot_rate)}` : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td>
                    {bal === 0
                      ? <span className="badge badge-slate">Settled</span>
                      : bal > 0
                        ? <span className="badge badge-red">Rs. {fmt(bal)} Dr</span>
                        : <span className="badge badge-blue">Rs. {fmt(Math.abs(bal))} Cr</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setLedgerEmpId(emp.id)} className="btn btn-sm" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ede9fe' }}>Ledger</button>
                      <button onClick={() => openEdit(emp)} className="btn btn-secondary btn-sm">Edit</button>
                      <button onClick={() => setDeleteId(emp.id)} className="btn btn-danger btn-sm">Delete</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <ProfileModal
          title={modal === 'add' ? 'Add Employee' : 'Edit Employee'}
          form={form}
          onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
          onSave={save}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}
    </div>
  )
}
