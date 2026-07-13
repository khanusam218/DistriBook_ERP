import { useState, useEffect } from 'react'
import api from '../api'
import { toast } from '../components/Toast'

const today = () => new Date().toISOString().split('T')[0]
const fmt = n => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })

const CATEGORIES = [
  'Misc', 'Rent', 'Salaries', 'Utilities', 'Transport', 'Fuel',
  'Office Supplies', 'Repair & Maintenance', 'Marketing',
  'Insurance', 'Taxes & Fees',
]

const EMPTY = {
  category: 'Misc', amount: '', expense_date: today(),
  description: '', payment_method: 'Cash', bank_account_id: '', notes: '',
}

export default function Expenses() {
  const [expenses, setExpenses]   = useState([])
  const [accounts, setAccounts]   = useState([])
  const [form, setForm]           = useState(EMPTY)
  const [formError, setFormError] = useState('')
  const [saving, setSaving]       = useState(false)

  // Filters
  const [fCat, setFCat]   = useState('All')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo]     = useState('')
  const [filtered, setFiltered] = useState([])

  const load = () => Promise.all([
    api.get('/expenses'),
    api.get('/bank-accounts'),
  ]).then(([e, a]) => {
    setExpenses(e.data)
    setAccounts(a.data)
    setFiltered(e.data)
  })

  useEffect(() => { load() }, [])

  // This-month total
  const thisMonth = (() => {
    const now = new Date()
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const rows = expenses.filter(e => e.expense_date?.startsWith(prefix))
    return { total: rows.reduce((s, e) => s + Number(e.amount), 0), count: rows.length }
  })()

  const set = k => ev => setForm(f => ({ ...f, [k]: ev.target.value }))

  const handleAdd = async () => {
    setFormError('')
    if (!form.amount || Number(form.amount) <= 0) return setFormError('Enter a valid amount')
    setSaving(true)
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        payment_method: form.payment_method.toUpperCase(),
        bank_account_id: form.payment_method.toUpperCase() === 'CASH' ? null : (form.bank_account_id || null),
      }
      await api.post('/expenses', payload)
      setForm(EMPTY)
      await load()
      applyFilter(expenses)
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return
    try { await api.delete(`/expenses/${id}`); await load() } catch { toast('Delete failed') }
  }

  const applyFilter = (data) => {
    setFiltered((data || expenses).filter(e => {
      if (fCat !== 'All' && e.category !== fCat) return false
      if (fFrom && e.expense_date < fFrom) return false
      if (fTo && e.expense_date > fTo) return false
      return true
    }))
  }

  const handleFilter = () => applyFilter(expenses)
  const handleClearFilter = () => { setFCat('All'); setFFrom(''); setFTo(''); setFiltered(expenses) }

  const uniqueCats = ['All', ...Array.from(new Set(expenses.map(e => e.category)))]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, fontFamily: 'inherit' }}>

      {/* ── Header ── */}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Daily Expenses</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        Track shop operating costs — rent, utilities, transport, and more
      </p>

      {/* ── This Month card ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 24px', marginBottom: 20, display: 'inline-block', minWidth: 200 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>This Month</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>Rs. {fmt(thisMonth.total)}</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{thisMonth.count} entr{thisMonth.count === 1 ? 'y' : 'ies'}</div>
      </div>

      {/* ── Record New Expense ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          Record New Expense
        </div>

        {/* Row 1: Category, Amount, Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Category <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select value={form.category} onChange={set('category')} className="db-input db-select" style={{ width: '100%' }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Amount (Rs.) <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="number" onWheel={e => e.target.blur()} min="0" step="0.01"
              value={form.amount} onChange={set('amount')}
              className="db-input" placeholder="0.00" style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Date</label>
            <input type="date" value={form.expense_date} onChange={set('expense_date')} className="db-input" style={{ width: '100%' }} />
          </div>
        </div>

        {/* Row 2: Description, Method, Account */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Description</label>
            <input
              type="text" value={form.description} onChange={set('description')}
              className="db-input" placeholder="e.g. Monthly shop rent, fuel receipt..."
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Method</label>
            <select value={form.payment_method} onChange={set('payment_method')} className="db-input db-select" style={{ width: '100%' }}>
              <option value="Cash">Cash</option>
              <option value="Bank">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Account</label>
            <select value={form.bank_account_id} onChange={set('bank_account_id')} className="db-input db-select" style={{ width: '100%' }}>
              <option value="">— Select —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
            </select>
          </div>
        </div>

        {/* Error */}
        {formError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#dc2626', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={12} cy={12} r={10}/><line x1={12} y1={8} x2={12} y2={12}/><line x1={12} y1={16} x2={12.01} y2={16}/></svg>
            {formError}
          </div>
        )}

        {/* Add button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleAdd} disabled={saving}
            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : '+ Add Expense'}
          </button>
        </div>
      </div>

      {/* ── Expense History ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {/* History header + filters */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Expense History
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={fCat} onChange={e => setFCat(e.target.value)} className="db-input db-select" style={{ width: 140, fontSize: 12 }}>
              {uniqueCats.map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} className="db-input" style={{ width: 140, fontSize: 12 }} placeholder="From" />
            <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} className="db-input" style={{ width: 140, fontSize: 12 }} placeholder="To" />
            <button
              onClick={handleFilter}
              style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >Filter</button>
            {(fCat !== 'All' || fFrom || fTo) && (
              <button onClick={handleClearFilter} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>Clear</button>
            )}
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['EXP NO.', 'DATE', 'CATEGORY', 'DESCRIPTION', 'AMOUNT', 'METHOD', 'ACCOUNT', 'ACTIONS'].map(h => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'AMOUNT' ? 'right' : 'left', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
                  <div style={{ marginBottom: 8 }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth={1.5} style={{ margin: '0 auto', display: 'block' }}>
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                      <rect x={9} y={3} width={6} height={4} rx={1}/>
                      <line x1={9} y1={12} x2={15} y2={12}/><line x1={9} y1={16} x2={13} y2={16}/>
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>No expenses recorded</div>
                  <div style={{ fontSize: 12 }}>Click "Add Expense" above to record your first expense</div>
                </td>
              </tr>
            ) : filtered.map((exp, i) => (
              <tr key={exp.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1d4ed8', fontSize: 12 }}>{exp.expense_no}</td>
                <td style={{ padding: '10px 14px', color: '#4b5563' }}>{exp.expense_date}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ background: '#f3f4f6', color: '#374151', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>
                    {exp.category}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {exp.description || '—'}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                  Rs. {fmt(exp.amount)}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{exp.payment_method}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>{exp.account_name || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <button
                    onClick={() => handleDelete(exp.id)}
                    style={{ background: 'none', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                    onMouseOver={e => e.currentTarget.style.background = '#fef2f2'}
                    onMouseOut={e => e.currentTarget.style.background = 'none'}
                  >Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: '#fef9ee', borderTop: '2px solid #fde68a' }}>
                <td colSpan={4} style={{ padding: '10px 14px', fontWeight: 700, color: '#6b7280', fontSize: 12 }}>
                  Total ({filtered.length} record{filtered.length !== 1 ? 's' : ''})
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontSize: 15 }}>
                  Rs. {fmt(filtered.reduce((s, e) => s + Number(e.amount), 0))}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
