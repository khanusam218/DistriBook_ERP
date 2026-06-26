import { useState, useEffect } from 'react'
import api from '../api'
import { Btn, Input, Select, Card, Alert, Empty, Table, PageHeader, SectionLabel, Icon, Spinner } from '../components/ui'

const today = () => new Date().toISOString().split('T')[0]
const fmt = n => Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2 })

export default function VendorPayments() {
  const [vendors, setVendors] = useState([])
  const [accounts, setAccounts] = useState([])
  const [history, setHistory] = useState([])
  const [form, setForm] = useState({ vendor_id: '', amount: '', payment_method: 'CASH', bank_account_id: '', notes: '', payment_date: today() })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    api.get('/vendors').then(r => setVendors(r.data))
    api.get('/bank-accounts').then(r => {
      setAccounts(r.data)
      const first = r.data[0]
      if (first) setForm(f => ({ ...f, bank_account_id: String(first.id) }))
    })
    loadHistory()
  }, [])

  const loadHistory = () => api.get('/vendor-payments').then(r => setHistory(r.data))

  const filteredAccounts = accounts.filter(a => a.account_type === (form.payment_method === 'CASH' ? 'CASH' : 'BANK'))

  const save = async () => {
    if (!form.vendor_id) { setError('Select a vendor'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Enter a valid amount'); return }
    setSaving(true); setError('')
    try {
      await api.post('/vendor-payments', {
        ...form,
        amount: parseFloat(form.amount),
        bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : null,
      })
      setSuccess('Payment recorded successfully')
      setForm(f => ({ ...f, vendor_id: '', amount: '', notes: '' }))
      loadHistory()
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save payment')
    }
    setSaving(false)
  }

  const deletePayment = async id => {
    if (!confirm('Delete this payment? This will reverse the vendor ledger entry.')) return
    try {
      await api.delete(`/vendor-payments/${id}`)
      loadHistory()
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to delete')
    }
  }

  const totalPaid = history.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader
        title="Vendor Payments"
        subtitle="Record payments made to vendors — auto-updates vendor ledger"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, margin: '24px 0', maxWidth: 600 }}>
        <Card>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Total Paid</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '6px 0 0' }}>Rs. {totalPaid.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</p>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>{history.length} payment{history.length !== 1 ? 's' : ''}</p>
        </Card>
        <Card>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Active Vendors</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '6px 0 0' }}>{vendors.length}</p>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>In system</p>
        </Card>
      </div>

      <Card>
        <SectionLabel>New Payment</SectionLabel>
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 16px' }}>
            <Select
              label="Vendor"
              required
              value={form.vendor_id}
              onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}
              autoFocus
            >
              <option value="">Select vendor…</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.company_name}</option>)}
            </Select>
            <Input
              label="Amount (Rs.)"
              required
              type="number"
              value={form.amount || ''}
              min="0"
              step="0.01"
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              placeholder="0.00"
            />
            <Input
              label="Payment Date"
              type="date"
              value={form.payment_date}
              onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
            />
            <Select
              label="Method"
              value={form.payment_method}
              onChange={e => setForm(f => ({ ...f, payment_method: e.target.value, bank_account_id: '' }))}
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank Transfer</option>
            </Select>
            <div>
              <label className="form-label">Account</label>
              {filteredAccounts.length > 0 ? (
                <select
                  value={form.bank_account_id}
                  onChange={e => setForm(f => ({ ...f, bank_account_id: e.target.value }))}
                  className="db-input db-select"
                >
                  <option value="">No account</option>
                  {filteredAccounts.map(a => {
                    const last4 = a.account_number ? ' ···' + String(a.account_number).slice(-4) : ''
                    const bank = a.bank_name ? ' — ' + a.bank_name : ''
                    return <option key={a.id} value={a.id}>{a.account_name}{bank}{last4}</option>
                  })}
                </select>
              ) : (
                <p style={{ fontSize: 12, color: '#f97316', marginTop: 8 }}>Add account in Cash &amp; Bank</p>
              )}
            </div>
            <Input
              label="Notes"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              placeholder="Cheque #, bank ref…"
            />
          </div>
        </div>
        {error && <div style={{ marginTop: 12 }}><Alert type="error">{error}</Alert></div>}
        {success && <div style={{ marginTop: 12 }}><Alert type="success">{success}</Alert></div>}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={save} disabled={saving} icon={saving ? <Spinner size={14} /> : <Icon.Save style={{ width: 14, height: 14 }} />}>
            {saving ? 'Saving…' : 'Record Payment'}
          </Btn>
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <SectionLabel>Payment History</SectionLabel>
        <div style={{ marginTop: 16 }}>
          <Table>
            <thead>
              <tr>
                {['Payment No.', 'Date', 'Vendor', 'Amount', 'Method', 'Account', 'Notes', ''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 0 }}><Empty message="No payments yet" hint="Record your first vendor payment above" /></td></tr>
              ) : history.map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#3b82f6' }}>{p.payment_no}</td>
                  <td style={{ color: '#64748b' }}>{p.payment_date}</td>
                  <td style={{ fontWeight: 500 }}>{p.company_name}</td>
                  <td style={{ fontWeight: 700, color: '#dc2626' }}>Rs. {fmt(p.amount)}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: p.payment_method === 'CASH' ? '#f0fdf4' : '#eff6ff', color: p.payment_method === 'CASH' ? '#15803d' : '#1d4ed8' }}>
                      {p.payment_method}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{p.account_name || '—'}</td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{p.notes || '—'}</td>
                  <td>
                    <Btn variant="danger" size="sm" icon={<Icon.Trash style={{ width: 12, height: 12 }} />} onClick={() => deletePayment(p.id)}>
                      Delete
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
