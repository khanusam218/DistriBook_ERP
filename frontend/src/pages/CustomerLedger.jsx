import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  PageHeader, Card, Btn, Badge, Alert, Empty, Spinner, Table, SectionLabel
} from '../components/ui'
import ErrorBoundary from '../components/ErrorBoundary'
import PrintInvoice from '../components/InvoicePreview'
import { toast } from '../components/Toast'
import { DEVELOPER_CREDIT_LINE1, DEVELOPER_CREDIT_LINE2 } from '../utils/companyInfo'

const fmt  = n => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })
const today = () => new Date().toISOString().split('T')[0]
const daysDiff = (dateStr) => {
  if (!dateStr) return 0
  const d = new Date(dateStr)
  return Math.floor((new Date() - d) / 86400000)
}

const TYPE_COLOR = { SALE:'orange', GATE_PASS:'blue', SALE_RETURN:'green', PAYMENT:'purple', OPENING:'slate' }

const co = () => { try { return JSON.parse(localStorage.getItem('companyInfo')||'{}') } catch { return {} } }

export default function CustomerLedger() {
  const navigate = useNavigate()
  const [customers, setCustomers]           = useState([])
  const [allBalances, setAllBalances]       = useState([])  // { id, name, balance, lastDate }
  const [balancesLoading, setBalancesLoading] = useState(false)

  // Search
  const [search, setSearch]                 = useState('')
  const [suggestions, setSuggestions]       = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)

  // Selected customer ledger
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [ledger, setLedger]                 = useState([])
  const [balance, setBalance]               = useState(0)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')

  // Filters for ledger
  const [dateFrom, setDateFrom]             = useState('')
  const [dateTo, setDateTo]                 = useState('')
  const [typeFilter, setTypeFilter]         = useState('All')

  // View All
  const [viewAll, setViewAll]               = useState(false)
  const [vaSearch, setVaSearch]             = useState('')
  const [vaSort, setVaSort]                 = useState('balance_desc')

  // Invoice preview (opened by clicking a Sale entry's description)
  const [printSale, setPrintSale]           = useState(null)
  const openSalePreview = async (saleId) => {
    try {
      const r = await api.get(`/sales/${saleId}`)
      setPrintSale(r.data)
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to load invoice')
    }
  }

  useEffect(() => {
    api.get('/customers').then(r => {
      setCustomers(r.data.filter(c => c.customer_type === 'WHOLESALER'))
    })
  }, [])

  const handleSearch = val => {
    setSearch(val)
    setSelectedCustomer(null)
    setLedger([])
    if (!val.trim()) { setSuggestions([]); setShowSuggestions(false); return }
    const q = val.toLowerCase()
    setSuggestions(customers.filter(c =>
      c.customer_name?.toLowerCase().includes(q) ||
      c.shop_name?.toLowerCase().includes(q) ||
      c.customer_code?.toLowerCase().includes(q)
    ).slice(0, 8))
    setShowSuggestions(true)
  }

  const selectCustomer = async c => {
    setSearch(c.customer_name || c.shop_name)
    setSuggestions([]); setShowSuggestions(false)
    setSelectedCustomer(c)
    setViewAll(false)
    setLoading(true); setError(''); setLedger([]); setBalance(0)
    try {
      const r = await api.get(`/customer-ledger/${c.id}`)
      setLedger(r.data.ledger || [])
      setBalance(r.data.balance || 0)
    } catch (e) { setError(e.response?.data?.error || 'Error loading ledger') }
    setLoading(false)
  }

  const loadAllBalances = async () => {
    setBalancesLoading(true)
    const fetchOne = async (cust) => {
      try {
        const r = await api.get(`/customer-ledger/${cust.id}`)
        const entries = r.data.ledger || []
        return {
          id: cust.id,
          customer_name: cust.customer_name,
          shop_name: cust.shop_name,
          customer_code: cust.customer_code,
          balance: r.data.balance || 0,
          lastDate: entries.length ? entries[entries.length - 1].transaction_date : null,
        }
      } catch (err) {
        return { id: cust.id, customer_name: cust.customer_name, shop_name: cust.shop_name, customer_code: cust.customer_code, balance: 0, lastDate: null }
      }
    }
    const results = await Promise.all(customers.map(fetchOne))
    setAllBalances(results)
    setBalancesLoading(false)
  }

  const openViewAll = async () => {
    setViewAll(true)
    setSelectedCustomer(null)
    setSearch('')
    if (allBalances.length === 0) await loadAllBalances()
  }

  // Filtered ledger
  const filteredLedger = ledger.filter(e => {
    if (typeFilter !== 'All' && e.transaction_type !== typeFilter) return false
    if (dateFrom && e.transaction_date < dateFrom) return false
    if (dateTo && e.transaction_date > dateTo) return false
    return true
  })
  const totalDebit  = filteredLedger.reduce((s, e) => s + Number(e.debit  || 0), 0)
  const totalCredit = filteredLedger.reduce((s, e) => s + Number(e.credit || 0), 0)

  // View All sorted/filtered
  const vaFiltered = allBalances
    .filter(c => {
      if (!vaSearch.trim()) return true
      const q = vaSearch.toLowerCase()
      return (c.customer_name||'').toLowerCase().includes(q) || (c.shop_name||'').toLowerCase().includes(q) || (c.customer_code||'').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (vaSort === 'balance_desc') return b.balance - a.balance
      if (vaSort === 'balance_asc')  return a.balance - b.balance
      if (vaSort === 'name')         return (a.customer_name||a.shop_name||'').localeCompare(b.customer_name||b.shop_name||'')
      return 0
    })

  const totalReceivable = allBalances.reduce((s, c) => s + Math.max(0, c.balance), 0)

  // Print ledger
  const handlePrint = () => {
    const c = co()
    const rows = filteredLedger.map((e, i) => `<tr>
      <td>${i+1}</td><td>${e.transaction_date}</td><td>${e.transaction_type}</td><td>${e.description||'—'}</td>
      <td style="text-align:right;color:#dc2626">${e.debit > 0 ? 'Rs. '+fmt(e.debit) : '—'}</td>
      <td style="text-align:right;color:#059669">${e.credit > 0 ? 'Rs. '+fmt(e.credit) : '—'}</td>
      <td style="text-align:right;font-weight:700">Rs. ${fmt(e.balance)}</td>
    </tr>`).join('')
    const w = window.open('','_blank','width=900,height=700')
    w.document.write(`<!DOCTYPE html><html><head><title>Ledger — ${selectedCustomer?.customer_name}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12pt;margin:24px}
    table{width:100%;border-collapse:collapse}th{background:#1e293b;color:#fff;padding:8px 10px;font-size:10pt}
    td{padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:10pt}
    tfoot td{background:#f1f5f9;font-weight:700;border-top:2px solid #334155}
    @media print{body{margin:10px}}</style></head><body>
    <h2 style="margin:0 0 4px">${c.name||'DistriBook ERP'}</h2>
    <div style="font-size:13pt;font-weight:700;margin:6px 0 2px">Customer Ledger — ${selectedCustomer?.customer_name||''}</div>
    <div style="font-size:10pt;color:#555;margin-bottom:14px">${selectedCustomer?.shop_name||''} | Code: ${selectedCustomer?.customer_code||''}</div>
    <table><thead><tr><th>#</th><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4" style="text-align:right">Totals</td>
      <td style="text-align:right;color:#dc2626">Rs. ${fmt(totalDebit)}</td>
      <td style="text-align:right;color:#059669">Rs. ${fmt(totalCredit)}</td>
      <td style="text-align:right">Rs. ${fmt(Math.abs(balance))} ${balance >= 0 ? 'DR' : 'CR'}</td>
    </tr></tfoot></table>
    <div style="margin-top:16px;font-size:9pt;color:#94a3b8">Printed on ${new Date().toLocaleDateString()}</div>
    <div style="margin-top:4px;font-size:9pt;font-weight:bold;color:#64748b">${DEVELOPER_CREDIT_LINE1} | ${DEVELOPER_CREDIT_LINE2}</div>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close() }, 400)
  }

  const handlePDF = () => {
    const c = co()
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFontSize(16); doc.setFont(undefined,'bold'); doc.text(c.name||'DistriBook ERP', 14, 16)
    doc.setFontSize(12); doc.text(`Customer Ledger — ${selectedCustomer?.customer_name||''}`, 14, 24)
    doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(100)
    doc.text(`${selectedCustomer?.shop_name||''} | Code: ${selectedCustomer?.customer_code||''}`, 14, 30)
    doc.text(`Balance: Rs. ${fmt(Math.abs(balance))} ${balance >= 0 ? 'DR' : 'CR'}`, 14, 35)
    doc.setTextColor(0)
    autoTable(doc, {
      startY: 39,
      head: [['#','Date','Type','Description','Debit','Credit','Balance']],
      body: filteredLedger.map((e,i) => [
        i+1, e.transaction_date, e.transaction_type, e.description||'—',
        e.debit > 0 ? 'Rs. '+fmt(e.debit) : '—',
        e.credit > 0 ? 'Rs. '+fmt(e.credit) : '—',
        'Rs. '+fmt(e.balance),
      ]),
      foot: [['','','','Totals', 'Rs. '+fmt(totalDebit), 'Rs. '+fmt(totalCredit), 'Rs. '+fmt(Math.abs(balance))+' '+(balance>=0?'DR':'CR')]],
      headStyles: { fillColor:[30,41,59], fontSize:9 },
      footStyles: { fillColor:[241,245,249], textColor:[30,41,59], fontStyle:'bold', fontSize:9 },
      bodyStyles: { fontSize:8.5 },
      columnStyles: { 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right'} },
      didParseCell(d) {
        if (d.section==='body') {
          if (d.column.index===4 && d.cell.text[0]!=='—') d.cell.styles.textColor=[220,38,38]
          if (d.column.index===5 && d.cell.text[0]!=='—') d.cell.styles.textColor=[5,150,105]
        }
      }
    })
    for (let i = 1; i <= doc.getNumberOfPages(); i++) {
      doc.setPage(i)
      doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(100)
      doc.text(`${DEVELOPER_CREDIT_LINE1} | ${DEVELOPER_CREDIT_LINE2}`, 148.5, 205, { align: 'center' })
    }
    doc.save(`ledger-${selectedCustomer?.customer_name?.replace(/\s+/g,'-')}-${today()}.pdf`)
  }

  // View All PDF
  const handleVaPDF = () => {
    const c = co()
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    doc.setFontSize(16); doc.setFont(undefined,'bold'); doc.text(c.name||'DistriBook ERP', 14, 16)
    doc.setFontSize(12); doc.text('All Customer Balances', 14, 24)
    doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(100)
    doc.text(`Total Receivable: Rs. ${fmt(totalReceivable)}   |   Generated: ${today()}`, 14, 30)
    doc.setTextColor(0)
    autoTable(doc, {
      startY: 35,
      head: [['#','Customer','Shop','Code','Balance (Dr)','Days Since Last Txn','Status']],
      body: vaFiltered.map((c,i) => {
        const days = c.lastDate ? daysDiff(c.lastDate) : null
        const overdue = c.balance > 0 && days !== null && days > 15
        return [i+1, c.customer_name||'—', c.shop_name||'—', c.customer_code||'—',
          c.balance > 0 ? 'Rs. '+fmt(c.balance) : '—',
          days !== null ? days+' days' : '—',
          overdue ? 'OVERDUE' : c.balance > 0 ? 'Due' : 'Clear']
      }),
      foot: [['','','','Total Receivable', 'Rs. '+fmt(totalReceivable),'','']],
      headStyles: { fillColor:[30,41,59], fontSize:8.5 },
      footStyles: { fillColor:[241,245,249], textColor:[30,41,59], fontStyle:'bold', fontSize:9 },
      bodyStyles: { fontSize:8 },
      columnStyles: { 4:{halign:'right'} },
      didParseCell(d) {
        if (d.section==='body' && d.column.index===6 && d.cell.text[0]==='OVERDUE') d.cell.styles.textColor=[220,38,38]
      }
    })
    for (let i = 1; i <= doc.getNumberOfPages(); i++) {
      doc.setPage(i)
      doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(100)
      doc.text(`${DEVELOPER_CREDIT_LINE1} | ${DEVELOPER_CREDIT_LINE2}`, 105, 290, { align: 'center' })
    }
    doc.save(`all-customer-balances-${today()}.pdf`)
  }

  const handleVaPrint = () => {
    const c = co()
    const rows = vaFiltered.map((cu,i) => {
      const days = cu.lastDate ? daysDiff(cu.lastDate) : null
      const overdue = cu.balance > 0 && days !== null && days > 15
      return `<tr style="${overdue?'background:#fff1f2;color:#b91c1c':''}">
        <td>${i+1}</td>
        <td>${cu.customer_name||'—'}</td>
        <td>${cu.shop_name||'—'}</td>
        <td>${cu.customer_code||'—'}</td>
        <td style="text-align:right;font-weight:700;color:${cu.balance>0?'#dc2626':'#059669'}">${cu.balance>0?'Rs. '+fmt(cu.balance):'—'}</td>
        <td style="text-align:right">${days !== null ? days+' days' : '—'}</td>
        <td style="text-align:center;font-weight:700;color:${overdue?'#dc2626':cu.balance>0?'#f97316':'#059669'}">${overdue?'⚠ OVERDUE':cu.balance>0?'Due':'Clear'}</td>
      </tr>`
    }).join('')
    const w = window.open('','_blank','width=900,height=700')
    w.document.write(`<!DOCTYPE html><html><head><title>All Customer Balances</title>
    <style>body{font-family:Arial,sans-serif;font-size:12pt;margin:24px}
    table{width:100%;border-collapse:collapse}th{background:#1e293b;color:#fff;padding:8px 10px;font-size:10pt}
    td{padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:10pt}
    tfoot td{background:#f1f5f9;font-weight:700;border-top:2px solid #334155}
    @media print{body{margin:10px}}</style></head><body>
    <h2 style="margin:0 0 4px">${c.name||'DistriBook ERP'}</h2>
    <div style="font-size:13pt;font-weight:700;margin:6px 0 2px">All Customer Balances</div>
    <div style="font-size:10pt;color:#555;margin-bottom:14px">Total Receivable: Rs. ${fmt(totalReceivable)} | ${today()}</div>
    <table><thead><tr><th>#</th><th>Customer</th><th>Shop</th><th>Code</th><th style="text-align:right">Balance</th><th style="text-align:right">Days</th><th style="text-align:center">Status</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4" style="text-align:right">Total Receivable</td><td style="text-align:right;color:#dc2626">Rs. ${fmt(totalReceivable)}</td><td colspan="2"></td></tr></tfoot>
    </table>
    <div style="margin-top:16px;font-size:9pt;color:#94a3b8">Printed on ${new Date().toLocaleDateString()}</div>
    <div style="margin-top:4px;font-size:9pt;font-weight:bold;color:#64748b">${DEVELOPER_CREDIT_LINE1} | ${DEVELOPER_CREDIT_LINE2}</div>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close() }, 400)
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader title="Customer Ledger" subtitle="Wholesaler customer account statements"
        actions={
          <Btn variant="danger" onClick={() => {
            setSelectedCustomer(null)
            setViewAll(false)
            setLedger([])
            setBalance(0)
            setError('')
            setSearch('')
          }}>← Back</Btn>
        }
      />

      {/* Search + View All bar */}
      <Card style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: 280, flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Wholesaler Customer</label>
            <input
              ref={searchRef}
              type="text"
              value={search}
              autoComplete="off"
              placeholder="Search by name, shop or code…"
              className="db-input"
              style={{ width: '100%' }}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => search && setSuggestions(customers.filter(c =>
                c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
                c.shop_name?.toLowerCase().includes(search.toLowerCase())
              ).slice(0, 8))}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
            {suggestions.length > 0 && (
              <div style={{ position:'absolute', zIndex:40, top:'100%', left:0, right:0, background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.10)', marginTop:4, maxHeight:220, overflowY:'auto' }}>
                {suggestions.map(c => (
                  <button key={c.id} onMouseDown={() => selectCustomer(c)}
                    style={{ width:'100%', textAlign:'left', padding:'8px 14px', fontSize:13, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:10 }}
                    onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                    onMouseLeave={e => e.currentTarget.style.background='none'}>
                    <span style={{ fontFamily:'monospace', fontSize:11, color:'#94a3b8', width:56, flexShrink:0 }}>{c.customer_code}</span>
                    <span style={{ flex:1 }}>
                      <div style={{ fontWeight:600 }}>{c.customer_name}</div>
                      {c.shop_name && c.shop_name !== c.customer_name && <div style={{ fontSize:11, color:'#94a3b8' }}>{c.shop_name}</div>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View All button */}
          <button onClick={openViewAll}
            style={{ background: viewAll ? '#1e293b' : '#f1f5f9', color: viewAll ? '#fff' : '#374151', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            View All
          </button>

          {/* Ledger filters — only when a customer selected */}
          {selectedCustomer && (
            <>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Type</label>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="db-input db-select" style={{ width: 140 }}>
                  <option value="All">All Types</option>
                  <option value="SALE">Sale</option>
                  <option value="GATE_PASS">Gate Pass</option>
                  <option value="SALE_RETURN">Return</option>
                  <option value="PAYMENT">Payment</option>
                  <option value="OPENING">Opening</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="db-input" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="db-input" />
              </div>
              {(dateFrom || dateTo || typeFilter !== 'All') && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); setTypeFilter('All') }}
                  style={{ background:'none', border:'1px solid #d1d5db', borderRadius:7, padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#6b7280', marginTop:20 }}>
                  Clear
                </button>
              )}
              {/* Print / PDF for individual ledger */}
              <button onClick={handlePrint}
                style={{ background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:7, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', color:'#374151', marginTop:20, display:'flex', alignItems:'center', gap:5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print
              </button>
              <button onClick={handlePDF}
                style={{ background:'#dc2626', border:'none', borderRadius:7, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer', color:'#fff', marginTop:20, display:'flex', alignItems:'center', gap:5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                PDF
              </button>
            </>
          )}
        </div>
      </Card>

      {/* ── VIEW ALL ── */}
      {viewAll && (
        <div>
          {/* Summary + actions */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:16, color:'#1e293b' }}>All Customer Balances</div>
              <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                Total Receivable: <strong style={{ color:'#dc2626' }}>Rs. {fmt(totalReceivable)}</strong>
                &nbsp;·&nbsp; {allBalances.filter(c => c.balance > 0).length} customers with balance due
                &nbsp;·&nbsp; <span style={{ color:'#dc2626' }}>{allBalances.filter(c => c.balance > 0 && c.lastDate && daysDiff(c.lastDate) > 15).length} overdue (&gt;15 days)</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input type="text" placeholder="Search…" value={vaSearch} onChange={e => setVaSearch(e.target.value)}
                className="db-input" style={{ width:180, fontSize:12 }} />
              <select value={vaSort} onChange={e => setVaSort(e.target.value)} className="db-input db-select" style={{ fontSize:12, width:160 }}>
                <option value="balance_desc">Balance ↓ High to Low</option>
                <option value="balance_asc">Balance ↑ Low to High</option>
                <option value="name">Name A–Z</option>
              </select>
              <button onClick={handleVaPrint}
                style={{ background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer', color:'#374151' }}>
                Print
              </button>
              <button onClick={handleVaPDF}
                style={{ background:'#dc2626', border:'none', borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', color:'#fff' }}>
                PDF
              </button>
            </div>
          </div>

          {balancesLoading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'48px 0' }}><Spinner size={28} /></div>
          ) : (
            <Card style={{ padding:0, overflow:'hidden' }}>
              <Table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Customer Name</th>
                    <th>Shop Name</th>
                    <th>Code</th>
                    <th style={{ textAlign:'right' }}>Balance (Receivable)</th>
                    <th style={{ textAlign:'right' }}>Days Since Last Txn</th>
                    <th style={{ textAlign:'center' }}>Status</th>
                    <th style={{ textAlign:'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {vaFiltered.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8' }}>No customers found</td></tr>
                  ) : vaFiltered.map((c, i) => {
                    const days    = c.lastDate ? daysDiff(c.lastDate) : null
                    const overdue = c.balance > 0 && days !== null && days > 15
                    return (
                      <tr key={c.id} style={{ background: overdue ? '#fff1f2' : undefined }}>
                        <td style={{ color:'#94a3b8' }}>{i+1}</td>
                        <td style={{ fontWeight:600, color: overdue ? '#b91c1c' : '#1e293b' }}>{c.customer_name || '—'}</td>
                        <td style={{ color:'#64748b', fontSize:12 }}>{c.shop_name || '—'}</td>
                        <td style={{ fontFamily:'monospace', fontSize:11, color:'#94a3b8' }}>{c.customer_code || '—'}</td>
                        <td style={{ textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums', color: c.balance > 0 ? '#dc2626' : c.balance < 0 ? '#059669' : '#94a3b8' }}>
                          {c.balance !== 0 ? `Rs. ${fmt(Math.abs(c.balance))} ${c.balance > 0 ? 'DR' : 'CR'}` : '—'}
                        </td>
                        <td style={{ textAlign:'right', color: overdue ? '#dc2626' : '#64748b', fontWeight: overdue ? 700 : 400 }}>
                          {days !== null ? `${days} days` : '—'}
                        </td>
                        <td style={{ textAlign:'center' }}>
                          {overdue
                            ? <span style={{ background:'#fef2f2', color:'#dc2626', borderRadius:6, padding:'2px 10px', fontSize:11, fontWeight:700, border:'1px solid #fecaca' }}>⚠ OVERDUE</span>
                            : c.balance > 0
                              ? <span style={{ background:'#fff7ed', color:'#c2410c', borderRadius:6, padding:'2px 10px', fontSize:11, fontWeight:600, border:'1px solid #fed7aa' }}>Due</span>
                              : <span style={{ background:'#f0fdf4', color:'#15803d', borderRadius:6, padding:'2px 10px', fontSize:11, fontWeight:600, border:'1px solid #bbf7d0' }}>Clear</span>
                          }
                        </td>
                        <td style={{ textAlign:'center' }}>
                          <button onMouseDown={() => selectCustomer(customers.find(cu => cu.id === c.id))}
                            style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:6, padding:'3px 12px', fontSize:11, fontWeight:600, color:'#2563eb', cursor:'pointer' }}>
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background:'#fef2f2', fontWeight:700, borderTop:'2px solid #e2e8f0' }}>
                    <td colSpan={4} style={{ padding:'10px 14px', textAlign:'right', color:'#64748b' }}>Total Receivable</td>
                    <td style={{ padding:'10px 14px', textAlign:'right', color:'#dc2626', fontVariantNumeric:'tabular-nums' }}>Rs. {fmt(totalReceivable)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* ── INDIVIDUAL LEDGER ── */}
      {selectedCustomer && !viewAll && (
        <>
          {loading && <div style={{ display:'flex', justifyContent:'center', padding:'48px 0' }}><Spinner size={28} /></div>}
          {error && <Alert type="error">{error}</Alert>}

          {!loading && !error && (
            <>
              {/* Summary cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:20 }}>
                <div className="stat-card">
                  <div className="stat-label">Customer</div>
                  <div className="stat-value" style={{ fontSize:15 }}>{selectedCustomer.customer_name}</div>
                  <div className="stat-sub">{selectedCustomer.shop_name}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Code</div>
                  <div className="stat-value" style={{ fontSize:15 }}>{selectedCustomer.customer_code || '—'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label" style={{ color:'#dc2626' }}>Total Debit</div>
                  <div className="stat-value" style={{ color:'#dc2626', fontSize:18 }}>Rs. {fmt(totalDebit)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label" style={{ color: balance >= 0 ? '#c2410c' : '#15803d' }}>Balance (Receivable)</div>
                  <div className="stat-value" style={{ color: balance >= 0 ? '#dc2626' : '#059669', fontSize:18 }}>
                    Rs. {fmt(Math.abs(balance))} {balance >= 0 ? 'DR' : 'CR'}
                  </div>
                </div>
              </div>

              {/* Ledger table */}
              <Card style={{ padding:0, overflow:'hidden' }}>
                <div style={{ padding:'12px 18px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:700, color:'#1e293b' }}>Ledger Entries <span style={{ fontWeight:400, fontSize:12, color:'#94a3b8', marginLeft:8 }}>{filteredLedger.length} records{filteredLedger.length !== ledger.length ? ` (filtered from ${ledger.length})` : ''}</span></span>
                </div>
                <Table>
                  <thead>
                    <tr>
                      {['#','Date','Type','Description','Debit','Credit','Balance'].map(h => (
                        <th key={h} style={['Debit','Credit','Balance'].includes(h) ? { textAlign:'right' } : {}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8' }}>No entries match the filter</td></tr>
                    ) : filteredLedger.map((entry, i) => (
                      <tr key={entry.id ?? i}>
                        <td style={{ color:'#94a3b8' }}>{i+1}</td>
                        <td style={{ whiteSpace:'nowrap', color:'#64748b', fontSize:12 }}>{entry.transaction_date}</td>
                        <td><Badge color={TYPE_COLOR[entry.transaction_type] || 'slate'}>{entry.transaction_type}</Badge></td>
                        <td>
                          {entry.reference_type === 'sale' && entry.reference_id ? (
                            <button
                              onClick={() => openSalePreview(entry.reference_id)}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#2563eb', fontWeight: 600, fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 2 }}
                            >
                              {entry.description}
                            </button>
                          ) : entry.description}
                        </td>
                        <td style={{ textAlign:'right', color: entry.debit > 0 ? '#dc2626' : '#cbd5e1', fontVariantNumeric:'tabular-nums', fontWeight: entry.debit > 0 ? 600 : 400 }}>
                          {entry.debit > 0 ? `Rs. ${fmt(entry.debit)}` : '—'}
                        </td>
                        <td style={{ textAlign:'right', color: entry.credit > 0 ? '#059669' : '#cbd5e1', fontVariantNumeric:'tabular-nums', fontWeight: entry.credit > 0 ? 600 : 400 }}>
                          {entry.credit > 0 ? `Rs. ${fmt(entry.credit)}` : '—'}
                        </td>
                        <td style={{ textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums', color: Number(entry.balance) >= 0 ? '#f97316' : '#059669' }}>
                          Rs. {fmt(entry.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {filteredLedger.length > 0 && (
                    <tfoot>
                      <tr style={{ background:'#f8fafc', fontWeight:700, borderTop:'2px solid #e2e8f0' }}>
                        <td colSpan={4} style={{ padding:'10px 14px', textAlign:'right', color:'#64748b' }}>Totals</td>
                        <td style={{ padding:'10px 14px', textAlign:'right', color:'#dc2626', fontVariantNumeric:'tabular-nums' }}>Rs. {fmt(totalDebit)}</td>
                        <td style={{ padding:'10px 14px', textAlign:'right', color:'#059669', fontVariantNumeric:'tabular-nums' }}>Rs. {fmt(totalCredit)}</td>
                        <td style={{ padding:'10px 14px', textAlign:'right', fontVariantNumeric:'tabular-nums', color: balance >= 0 ? '#dc2626' : '#059669' }}>
                          Rs. {fmt(Math.abs(balance))} {balance >= 0 ? 'DR' : 'CR'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </Table>
              </Card>
            </>
          )}
        </>
      )}

      {!selectedCustomer && !viewAll && (
        <Card>
          <Empty message="Search for a customer or click View All" hint="Type a name, shop or code in the search box above" />
        </Card>
      )}

      {printSale && (
        <ErrorBoundary key={printSale.id} onClose={() => setPrintSale(null)}>
          <PrintInvoice sale={printSale} onClose={() => setPrintSale(null)} />
        </ErrorBoundary>
      )}
    </div>
  )
}
