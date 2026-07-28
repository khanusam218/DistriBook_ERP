import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { toast } from '../components/Toast'
import { getCompanyInfo } from '../utils/companyInfo'
import { h } from '../utils/exportUtils'
import { Btn, Input, Select, Card, Alert, Empty, Table, PageHeader, SectionLabel, Icon, Spinner, Badge } from '../components/ui'

const today = () => new Date().toISOString().split('T')[0]
const fmt = n => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })

function printReceipt(r) {
  const c = getCompanyInfo()
  const name = c.name || 'DistriBook ERP'
  const addr = [c.address, c.city].filter(Boolean).join(', ')
  const contact = [c.phone && `Ph: ${c.phone}`, c.mobile && `Mob: ${c.mobile}`].filter(Boolean).join('  |  ')
  const w = window.open('', '_blank', 'width=400,height=560')
  w.document.write(`
    <html><head><title>Receipt ${r.receipt_no}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; margin: 0; padding: 20px; color: #111; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .big { font-size: 18px; font-weight: bold; }
      .line { border-top: 1px dashed #aaa; margin: 10px 0; }
      .row { display: flex; justify-content: space-between; margin: 5px 0; }
      .label { color: #555; }
      .amount { font-size: 20px; font-weight: bold; text-align: center; margin: 12px 0; }
      .footer { text-align: center; font-size: 11px; color: #888; margin-top: 16px; }
      .sig { margin-top: 30px; border-top: 1px solid #333; padding-top: 4px; font-size: 11px; color: #555; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    <div class="center bold big">${h(name)}</div>
    ${addr ? `<div class="center" style="font-size:10px;color:#666">${h(addr)}</div>` : ''}
    ${contact ? `<div class="center" style="font-size:10px;color:#666;margin-bottom:4px">${h(contact)}</div>` : ''}
    <div class="center bold" style="font-size:14px;margin-top:6px">PAYMENT RECEIPT</div>
    <div class="line"></div>
    <div class="row"><span class="label">Receipt No.</span><span class="bold">${h(r.receipt_no)}</span></div>
    <div class="row"><span class="label">Date</span><span>${h(r.receipt_date)}</span></div>
    <div class="line"></div>
    <div class="row"><span class="label">Customer</span><span class="bold">${h(r.shop_name || r.customer_name || '')}</span></div>
    <div class="row"><span class="label">Code</span><span>${h(r.customer_code || '')}</span></div>
    <div class="line"></div>
    <div class="amount">Rs. ${fmt(r.amount)}</div>
    <div class="row"><span class="label">Payment Method</span><span>${h(r.payment_method)}</span></div>
    ${r.account_name ? `<div class="row"><span class="label">Account</span><span>${h(r.account_name)}</span></div>` : ''}
    ${r.notes ? `<div class="row"><span class="label">Notes</span><span>${h(r.notes)}</span></div>` : ''}
    <div class="line"></div>
    <div class="footer">Thank you for your payment</div>
    <div class="center sig">Authorised Signature ___________________</div>
    </body></html>`)
  w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 300)
}

export default function Receipts() {
  const [customers, setCustomers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [history, setHistory] = useState([])
  const [queue, setQueue] = useState([])

  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedBalance, setSelectedBalance] = useState(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [bankAccountId, setBankAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptDate, setReceiptDate] = useState(today())

  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterMethod, setFilterMethod] = useState('')

  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const searchRef = useRef(null)
  const amountRef = useRef(null)

  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data))
    api.get('/bank-accounts').then(r => {
      setAccounts(r.data)
      const first = r.data[0]
      if (first) setBankAccountId(String(first.id))
    })
    loadHistory()
  }, [])

  const loadHistory = () => api.get('/receipts').then(r => setHistory(r.data))

  const handleSearch = val => {
    setSearch(val)
    setSelectedCustomer(null)
    setSelectedBalance(null)
    if (!val.trim()) { setSuggestions([]); return }
    const q = val.toLowerCase()
    setSuggestions(
      customers.filter(c =>
        c.customer_type === 'WHOLESALER' && (
          c.shop_name?.toLowerCase().includes(q) ||
          c.customer_name?.toLowerCase().includes(q) ||
          c.customer_code?.toLowerCase().includes(q)
        )
      ).slice(0, 8)
    )
  }

  const selectCustomer = async c => {
    setSelectedCustomer(c)
    setSelectedBalance(null)
    setSearch(c.customer_name || c.shop_name)
    setSuggestions([])
    setTimeout(() => amountRef.current?.focus(), 30)
    if (c.customer_type === 'WHOLESALER') {
      setBalanceLoading(true)
      try {
        const r = await api.get(`/customer-ledger/${c.id}`)
        setSelectedBalance(r.data.balance ?? 0)
      } catch { setSelectedBalance(null) }
      setBalanceLoading(false)
    }
  }

  const addToQueue = () => {
    if (!selectedCustomer) { setError('Select a customer first'); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return }
    if (selectedCustomer.customer_type === 'WHOLESALER' && (selectedBalance === null || selectedBalance <= 0)) {
      setError('No outstanding balance — this account is already fully paid.'); return
    }
    if (method !== 'CASH' && !bankAccountId) { setError('Select a bank account'); return }
    const accId = bankAccountId ? Number(bankAccountId) : null
    setError('')
    setQueue(prev => [...prev, {
      _key: Date.now(),
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.customer_name || selectedCustomer.shop_name,
      shop_name: selectedCustomer.shop_name,
      customer_code: selectedCustomer.customer_code,
      customer_type: selectedCustomer.customer_type,
      balance: selectedBalance,
      amount: amt,
      payment_method: method,
      bank_account_id: accId,
      account_name: accounts.find(a => a.id === accId)?.account_name || '',
      notes,
      receipt_date: receiptDate,
    }])
    setSearch(''); setSelectedCustomer(null); setSelectedBalance(null); setAmount(''); setNotes('')
    setTimeout(() => searchRef.current?.focus(), 30)
  }

  const postAll = async () => {
    if (!queue.length) return
    setPosting(true); setError('')
    try {
      const r = await api.post('/receipts/bulk', { receipts: queue })
      setSuccess(`${r.data.count} receipt(s) posted successfully`)
      setQueue([])
      loadHistory()
      setTimeout(() => setSuccess(''), 5000)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to post receipts')
    }
    setPosting(false)
  }

  const deleteReceipt = async id => {
    if (!confirm('Delete this receipt? This will reverse the ledger entry.')) return
    try {
      await api.delete(`/receipts/${id}`)
      loadHistory()
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to delete')
    }
  }

  const filteredAccounts = accounts.filter(a => a.account_type === (method === 'CASH' ? 'CASH' : 'BANK'))
  const queueTotal = queue.reduce((s, r) => s + r.amount, 0)

  const filteredHistory = history.filter(r => {
    if (filterFrom && r.receipt_date < filterFrom) return false
    if (filterTo && r.receipt_date > filterTo) return false
    if (filterCustomer) {
      const q = filterCustomer.toLowerCase()
      if (!r.shop_name?.toLowerCase().includes(q) && !r.customer_code?.toLowerCase().includes(q)) return false
    }
    if (filterMethod && r.payment_method !== filterMethod) return false
    return true
  })

  const filteredTotal = filteredHistory.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader
        title="Receipts"
        subtitle="Queue multiple customer payments and post them all at once"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Date</label>
            <input
              type="date"
              value={receiptDate}
              onChange={e => setReceiptDate(e.target.value)}
              className="db-input"
              style={{ fontSize: 13 }}
            />
          </div>
        }
      />

      <Card style={{ marginTop: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 16px' }}>
          Quick Entry — Tab through fields, Enter to add
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: 230 }}>
            <label className="form-label">Customer</label>
            <input
              ref={searchRef}
              type="text"
              value={search}
              autoComplete="off"
              autoFocus
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && suggestions.length) selectCustomer(suggestions[0])
                if (e.key === 'Escape') setSuggestions([])
              }}
              placeholder="Name or code…"
              className="db-input"
            />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                {suggestions.map(c => (
                  <button
                    key={c.id}
                    onMouseDown={() => selectCustomer(c)}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', width: 56, flexShrink: 0 }}>{c.customer_code}</span>
                    <span style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.customer_name || c.shop_name}</div>
                      {c.shop_name && c.customer_name && c.shop_name !== c.customer_name && (
                        <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.shop_name}</div>
                      )}
                    </span>
                    <span style={{ fontSize: 11, flexShrink: 0, color: c.customer_type === 'WHOLESALER' ? '#3b82f6' : '#94a3b8' }}>
                      {c.customer_type}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>✓ {selectedCustomer.shop_name}</span>
                {balanceLoading && <span style={{ fontSize: 12, color: '#94a3b8' }}>loading…</span>}
                {!balanceLoading && selectedBalance !== null && (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: selectedBalance > 0 ? '#fff7ed' : '#f0fdf4', color: selectedBalance > 0 ? '#c2410c' : '#15803d' }}>
                    {selectedBalance > 0 ? `Owes Rs. ${fmt(selectedBalance)}` : `Advance Rs. ${fmt(Math.abs(selectedBalance))}`}
                  </span>
                )}
                {!balanceLoading && selectedBalance === null && selectedCustomer.customer_type === 'RETAILER' && (
                  <span style={{ fontSize: 12, color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: 999 }}>Cash Customer</span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="form-label">Amount (Rs.)</label>
            <input
              ref={amountRef}
              type="number" onWheel={e => e.target.blur()}
              value={amount}
              min="0"
              step="0.01"
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addToQueue() }}
              placeholder="0.00"
              className="db-input"
              style={{ width: 140 }}
            />
          </div>

          <div>
            <Select
              label="Method"
              value={method}
              onChange={e => { setMethod(e.target.value); setBankAccountId('') }}
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank Transfer</option>
            </Select>
          </div>

          <div>
            <label className="form-label">Account</label>
            {filteredAccounts.length > 0 ? (
              <select
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
                className="db-input db-select"
              >
                <option value="">No account</option>
                {filteredAccounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
              </select>
            ) : (
              <p style={{ fontSize: 12, color: '#f97316', marginTop: 8 }}>Add account in Cash &amp; Bank</p>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 130 }}>
            <Input
              label="Notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addToQueue() }}
              placeholder="Cheque #, remarks…"
            />
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <Btn icon={<Icon.Plus style={{ width: 14, height: 14 }} />} onClick={addToQueue}>
              Add
            </Btn>
          </div>
        </div>
        {error && <div style={{ marginTop: 12 }}><Alert type="error">{error}</Alert></div>}
      </Card>

      {queue.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Pending Queue</h2>
              <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{queue.length}</span>
            </div>
            <span style={{ fontSize: 13, color: '#64748b' }}>Total: <span style={{ fontWeight: 700, color: '#0f172a' }}>Rs. {fmt(queueTotal)}</span></span>
          </div>
          <Table>
            <thead>
              <tr>
                {['#', 'Code', 'Customer', 'Balance', 'Paying', 'Method', 'Notes', ''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue.map((r, i) => (
                <tr key={r._key}>
                  <td style={{ color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{r.customer_code}</td>
                  <td style={{ fontWeight: 500 }}>{r.shop_name}</td>
                  <td>
                    {r.balance !== null && r.balance !== undefined ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: r.balance > 0 ? '#c2410c' : '#15803d' }}>
                        Rs. {fmt(r.balance)}
                      </span>
                    ) : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ fontWeight: 700, color: '#15803d' }}>Rs. {fmt(r.amount)}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: r.payment_method === 'CASH' ? '#f0fdf4' : '#eff6ff', color: r.payment_method === 'CASH' ? '#15803d' : '#1d4ed8' }}>
                      {r.payment_method}
                    </span>
                    {r.account_name && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>{r.account_name}</span>}
                  </td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{r.notes || '—'}</td>
                  <td>
                    <button
                      onClick={() => setQueue(prev => prev.filter(x => x._key !== r._key))}
                      style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, fontWeight: 700, padding: 4 }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
            <Btn variant="ghost" size="sm" onClick={() => setQueue([])}>Clear all</Btn>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Rs. {fmt(queueTotal)}</span>
              <Btn onClick={postAll} disabled={posting} icon={posting ? <Spinner size={14} /> : <Icon.Check style={{ width: 14, height: 14 }} />}>
                {posting ? 'Posting…' : `Post ${queue.length} Receipt${queue.length > 1 ? 's' : ''}`}
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {success && (
        <div style={{ marginTop: 12 }}>
          <Alert type="success">{success}</Alert>
        </div>
      )}

      <Card style={{ marginTop: 16 }}>
        <SectionLabel>Receipt History</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', margin: '16px 0' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>From</label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="db-input" style={{ fontSize: 12 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>To</label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="db-input" style={{ fontSize: 12 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Customer</label>
            <input
              type="text"
              value={filterCustomer}
              onChange={e => setFilterCustomer(e.target.value)}
              placeholder="Name or code…"
              className="db-input"
              style={{ width: 160, fontSize: 12 }}
            />
          </div>
          <div>
            <Select
              value={filterMethod}
              onChange={e => setFilterMethod(e.target.value)}
              style={{ fontSize: 12 }}
            >
              <option value="">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
            </Select>
          </div>
          {(filterFrom || filterTo || filterCustomer || filterMethod) && (
            <Btn variant="ghost" size="sm" onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterCustomer(''); setFilterMethod('') }}>
              Clear
            </Btn>
          )}
          {filteredHistory.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
              {filteredHistory.length} record{filteredHistory.length !== 1 ? 's' : ''} · Total: <span style={{ fontWeight: 700, color: '#0f172a' }}>Rs. {fmt(filteredTotal)}</span>
            </span>
          )}
        </div>

        <Table>
          <thead>
            <tr>
              {['Receipt No.', 'Date', 'Customer', 'Amount', 'Method / Account', 'Notes', 'Actions'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 0 }}><Empty message="No receipts found" /></td></tr>
            ) : filteredHistory.map(r => (
              <tr key={r.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#3b82f6' }}>{r.receipt_no}</td>
                <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{r.receipt_date}</td>
                <td>
                  <span style={{ fontWeight: 500 }}>{r.shop_name}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>({r.customer_code})</span>
                </td>
                <td style={{ fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>Rs. {fmt(r.amount)}</td>
                <td>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: r.payment_method === 'CASH' ? '#f0fdf4' : '#eff6ff', color: r.payment_method === 'CASH' ? '#15803d' : '#1d4ed8' }}>
                    {r.payment_method}
                  </span>
                  {r.account_name && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>{r.account_name}</span>}
                </td>
                <td style={{ fontSize: 12, color: '#94a3b8' }}>{r.notes || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Btn variant="ghost" size="sm" icon={<Icon.Print style={{ width: 12, height: 12 }} />} onClick={() => printReceipt(r)}>Print</Btn>
                    <Btn variant="danger" size="sm" icon={<Icon.Trash style={{ width: 12, height: 12 }} />} onClick={() => deleteReceipt(r.id)}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
