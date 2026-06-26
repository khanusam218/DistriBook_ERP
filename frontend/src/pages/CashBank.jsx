import { useState, useEffect } from 'react'
import api from '../api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  PageHeader, Card, StatCard, Select, Input, NumInput, Btn, Badge, Alert, Empty, Spinner, Table, Modal, SectionLabel, FormGrid
} from '../components/ui'

const fmt = n => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })

const blankForm = { account_name: '', account_type: 'CASH', bank_name: '', account_number: '', opening_balance: '' }

const TX_TYPE_COLOR = {
  RECEIPT: 'green',
  PAYMENT: 'red',
  REVERSAL: 'yellow',
}

export default function CashBank() {
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [txLoading, setTxLoading] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { loadAccounts() }, [])

  const loadAccounts = async () => {
    const r = await api.get('/bank-accounts')
    setAccounts(r.data)
  }

  const loadTransactions = async acc => {
    setSelected(acc)
    setTxLoading(true)
    try {
      const r = await api.get(`/bank-accounts/${acc.id}/transactions`)
      setSelected(r.data.account || acc)
      setTransactions(Array.isArray(r.data.transactions) ? r.data.transactions : [])
    } catch (e) {
      setTransactions([])
    }
    setTxLoading(false)
  }

  const openAdd = () => { setEditing(null); setForm(blankForm); setFormError(''); setShowModal(true) }
  const openEdit = (acc, e) => { e.stopPropagation(); setEditing(acc); setForm({ ...acc, opening_balance: acc.opening_balance ?? '' }); setFormError(''); setShowModal(true) }

  const save = async () => {
    if (!form.account_name.trim()) { setFormError('Account name is required'); return }
    setSaving(true); setFormError('')
    try {
      const payload = { ...form, opening_balance: parseFloat(form.opening_balance) || 0 }
      if (editing) {
        await api.put(`/bank-accounts/${editing.id}`, payload)
      } else {
        await api.post('/bank-accounts', payload)
      }
      setShowModal(false)
      await loadAccounts()
      if (selected) {
        const fresh = await api.get('/bank-accounts')
        const updated = fresh.data.find(a => a.id === selected.id)
        if (updated) loadTransactions(updated)
      }
    } catch (e) {
      setFormError(e.response?.data?.error || 'Failed to save')
    }
    setSaving(false)
  }

  const deleteAccount = async (id) => {
    try {
      await api.delete(`/bank-accounts/${id}`)
      if (selected?.id === id) { setSelected(null); setTransactions([]) }
      loadAccounts()
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to delete')
    }
  }

  const cashTotal = accounts.filter(a => a.account_type === 'CASH').reduce((s, a) => s + (a.balance || 0), 0)
  const bankTotal = accounts.filter(a => a.account_type === 'BANK').reduce((s, a) => s + (a.balance || 0), 0)

  const handlePrintLedger = (acc, txns) => {
    const co = (() => { try { return JSON.parse(localStorage.getItem('companyInfo') || '{}').name || 'DistriBooks' } catch { return 'DistriBooks' } })()
    const rows = txns.map((t, i) => `<tr>
      <td>${i + 1}</td><td>${t.transaction_date}</td><td>${t.transaction_type}</td>
      <td>${t.description || '—'}</td>
      <td style="text-align:right;color:#059669">${t.debit > 0 ? 'Rs. ' + Number(t.debit).toLocaleString('en-PK', {minimumFractionDigits:2}) : '—'}</td>
      <td style="text-align:right;color:#dc2626">${t.credit > 0 ? 'Rs. ' + Number(t.credit).toLocaleString('en-PK', {minimumFractionDigits:2}) : '—'}</td>
      <td style="text-align:right;font-weight:700">Rs. ${Number(t.balance).toLocaleString('en-PK', {minimumFractionDigits:2})}</td>
    </tr>`).join('')
    const totalDr = txns.reduce((s, t) => s + t.debit, 0)
    const totalCr = txns.reduce((s, t) => s + t.credit, 0)
    const w = window.open('', '_blank', 'width=900,height=700')
    w.document.write(`<!DOCTYPE html><html><head><title>Ledger — ${acc.account_name}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12pt;margin:24px;color:#111}h2{margin:0 0 4px}
    table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:10pt}
    td{padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:10pt}tfoot td{background:#f1f5f9;font-weight:700;border-top:2px solid #334155}
    @media print{body{margin:10px}}</style></head><body>
    <h2>${co}</h2>
    <div style="font-size:14pt;font-weight:700;margin:6px 0 2px">${acc.account_name}</div>
    <div style="font-size:11pt;color:#555;margin-bottom:12px">${acc.bank_name ? acc.bank_name + (acc.account_number ? ' · ' + acc.account_number : '') : acc.account_type}</div>
    <div style="display:flex;gap:24px;margin-bottom:14px;font-size:11pt">
      <span>Opening Balance: <strong>Rs. ${Number(acc.opening_balance||0).toLocaleString('en-PK',{minimumFractionDigits:2})}</strong></span>
      <span>Closing Balance: <strong style="color:#059669">Rs. ${Number(acc.balance).toLocaleString('en-PK',{minimumFractionDigits:2})}</strong></span>
    </div>
    <table><thead><tr><th>#</th><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">In (Dr)</th><th style="text-align:right">Out (Cr)</th><th style="text-align:right">Balance</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4" style="text-align:right">Totals</td>
      <td style="text-align:right;color:#059669">Rs. ${totalDr.toLocaleString('en-PK',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;color:#dc2626">Rs. ${totalCr.toLocaleString('en-PK',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;color:#059669">Rs. ${Number(acc.balance).toLocaleString('en-PK',{minimumFractionDigits:2})}</td>
    </tr></tfoot></table>
    <div style="margin-top:16px;font-size:9pt;color:#94a3b8">Printed on ${new Date().toLocaleDateString()}</div>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close() }, 400)
  }

  const handlePDFLedger = (acc, txns) => {
    const co = (() => { try { return JSON.parse(localStorage.getItem('companyInfo') || '{}').name || 'DistriBooks' } catch { return 'DistriBooks' } })()
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text(co, 14, 16)
    doc.setFontSize(13); doc.text(acc.account_name, 14, 24)
    doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(100)
    if (acc.bank_name) doc.text(`${acc.bank_name}${acc.account_number ? ' · ' + acc.account_number : ''}`, 14, 30)
    doc.text(`Opening Balance: Rs. ${Number(acc.opening_balance||0).toLocaleString('en-PK',{minimumFractionDigits:2})}   Closing Balance: Rs. ${Number(acc.balance).toLocaleString('en-PK',{minimumFractionDigits:2})}`, 14, 36)
    doc.setTextColor(0)
    const totalDr = txns.reduce((s, t) => s + t.debit, 0)
    const totalCr = txns.reduce((s, t) => s + t.credit, 0)
    autoTable(doc, {
      startY: 40,
      head: [['#', 'Date', 'Type', 'Description', 'In (Dr)', 'Out (Cr)', 'Balance']],
      body: txns.map((t, i) => [
        i + 1, t.transaction_date, t.transaction_type, t.description || '—',
        t.debit > 0 ? 'Rs. ' + Number(t.debit).toLocaleString('en-PK',{minimumFractionDigits:2}) : '—',
        t.credit > 0 ? 'Rs. ' + Number(t.credit).toLocaleString('en-PK',{minimumFractionDigits:2}) : '—',
        'Rs. ' + Number(t.balance).toLocaleString('en-PK',{minimumFractionDigits:2}),
      ]),
      foot: [['', '', '', 'Totals',
        'Rs. ' + totalDr.toLocaleString('en-PK',{minimumFractionDigits:2}),
        'Rs. ' + totalCr.toLocaleString('en-PK',{minimumFractionDigits:2}),
        'Rs. ' + Number(acc.balance).toLocaleString('en-PK',{minimumFractionDigits:2}),
      ]],
      headStyles: { fillColor: [30,41,59], fontSize: 9 },
      footStyles: { fillColor: [241,245,249], textColor: [30,41,59], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      didParseCell(data) {
        if (data.section === 'body') {
          if (data.column.index === 4 && data.cell.text[0] !== '—') data.cell.styles.textColor = [5,150,105]
          if (data.column.index === 5 && data.cell.text[0] !== '—') data.cell.styles.textColor = [220,38,38]
        }
      },
    })
    doc.save(`ledger-${acc.account_name.replace(/\s+/g,'-')}-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const handleModalKey = (e) => {
    if (e.key === 'Enter') save()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader
        title="Cash & Bank"
        subtitle="Track cash and bank account balances and transactions"
        actions={
          <Btn variant="primary" onClick={openAdd}>+ Add Account</Btn>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Total Cash in Hand"
          value={`Rs. ${fmt(cashTotal)}`}
          accent="#059669"
        />
        <StatCard
          label="Total Bank Balance"
          value={`Rs. ${fmt(bankTotal)}`}
          accent="#3b82f6"
        />
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ width: 280, flexShrink: 0 }}>
          <SectionLabel>Accounts</SectionLabel>

          {accounts.length === 0 && (
            <Alert type="info">No accounts yet. Add one to start tracking.</Alert>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {accounts.map(acc => (
              <Card
                key={acc.id}
                style={{
                  cursor: 'pointer',
                  border: selected?.id === acc.id ? '2px solid var(--primary)' : '2px solid transparent',
                  padding: '14px 16px',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxShadow: selected?.id === acc.id ? '0 0 0 3px var(--primary-light)' : undefined,
                }}
                onClick={() => loadTransactions(acc)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {acc.account_name}
                    </div>
                    {acc.bank_name && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {acc.bank_name}{acc.account_number ? ` · ${acc.account_number}` : ''}
                      </div>
                    )}
                  </div>
                  <Badge color={acc.account_type === 'CASH' ? 'green' : 'blue'}>
                    {acc.account_type}
                  </Badge>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Rs. {fmt(acc.balance)}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={e => openEdit(acc, e)}
                  >
                    Edit
                  </button>
                  <button
                    style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={e => { e.stopPropagation(); setDeleteTarget(acc) }}
                  >
                    Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {!selected ? (
            <Card>
              <Empty message="Select an account to view transactions" hint="Click any account on the left" />
            </Card>
          ) : (
            <>
              {/* Ledger header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: '#1e293b' }}>{selected.account_name}</div>
                  {selected.bank_name && (
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                      {selected.bank_name}{selected.account_number ? ' · ' + selected.account_number : ''}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Opening Balance: <strong>Rs. {fmt(selected.opening_balance || 0)}</strong></div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Current Balance: <strong style={{ color: '#059669' }}>Rs. {fmt(selected.balance)}</strong></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handlePrintLedger(selected, transactions)}
                    style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print
                  </button>
                  <button onClick={() => handlePDFLedger(selected, transactions)}
                    style={{ background: '#dc2626', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
                    PDF
                  </button>
                </div>
              </div>

              <Card>
                {txLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                    <Spinner size={24} />
                  </div>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th style={{ textAlign: 'right' }}>In (Dr)</th>
                        <th style={{ textAlign: 'right' }}>Out (Cr)</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: 'linear-gradient(90deg,#1e293b 0%,#334155 100%)', borderBottom: '2px solid #0f172a' }}>
                        <td style={{ color: '#94a3b8', fontWeight: 600 }}>—</td>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>—</td>
                        <td><span style={{ background: 'rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>OPENING</span></td>
                        <td style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>Opening Balance</td>
                        <td style={{ textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#34d399', fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>Rs. {fmt(selected.opening_balance || 0)}</td>
                      </tr>
                      {transactions.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No transactions yet</td></tr>
                      ) : transactions.map((t, idx) => (
                        <tr key={t.id}>
                          <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                          <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: 12 }}>{t.transaction_date}</td>
                          <td><Badge color={TX_TYPE_COLOR[t.transaction_type] || 'slate'}>{t.transaction_type}</Badge></td>
                          <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                          <td style={{ textAlign: 'right', color: t.debit > 0 ? '#059669' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', fontWeight: t.debit > 0 ? 600 : 400 }}>
                            {t.debit > 0 ? `Rs. ${fmt(t.debit)}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: t.credit > 0 ? '#dc2626' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', fontWeight: t.credit > 0 ? 600 : 400 }}>
                            {t.credit > 0 ? `Rs. ${fmt(t.credit)}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Rs. {fmt(t.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {transactions.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#f0fdf4', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                          <td colSpan={4} style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b' }}>Totals</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                            Rs. {fmt(transactions.reduce((s, t) => s + (t.debit || 0), 0))}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                            Rs. {fmt(transactions.reduce((s, t) => s + (t.credit || 0), 0))}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                            Rs. {fmt(selected.balance)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </Table>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Account' : 'Add Account'}
        maxWidth={460}
        onKeyDown={handleModalKey}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Account'}
            </Btn>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Account Name"
            required
            value={form.account_name}
            onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
            placeholder="e.g. Cash in Hand, HBL Current"
            autoFocus
          />
          <Select
            label="Account Type"
            value={form.account_type}
            onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}
          >
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
          </Select>

          {form.account_type === 'BANK' && (
            <>
              <Input
                label="Bank Name"
                value={form.bank_name}
                onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                placeholder="HBL, UBL, MCB…"
              />
              <Input
                label="Account Number"
                value={form.account_number}
                onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                placeholder="Account number"
              />
            </>
          )}

          <NumInput
            label="Opening Balance (Rs.)"
            value={form.opening_balance || ''}
            onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
            placeholder="Opening balance amount"
            min="0"
          />

          {formError && <Alert type="error">{formError}</Alert>}
        </div>
      </Modal>

      {deleteTarget && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title="Delete Account"
          maxWidth={400}
          footer={
            <>
              <Btn variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={() => { deleteAccount(deleteTarget.id); setDeleteTarget(null) }}>Delete</Btn>
            </>
          }
        >
          <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
            Delete <strong>{deleteTarget.account_name}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}
