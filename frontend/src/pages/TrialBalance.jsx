import { useState, useEffect } from 'react'
import api from '../api'
import {
  PageHeader, Card, StatCard, Badge, Alert, Empty, Spinner, Table, SectionLabel, Btn, Icon
} from '../components/ui'

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const SECTIONS = [
  { key: 'cashBank',   label: 'Cash & Bank Accounts',            accent: '#3b82f6', note: 'Positive balance = company holds cash (DR)' },
  { key: 'customers',  label: 'Accounts Receivable (Customers)', accent: '#f97316', note: 'Positive balance = customer owes us (DR)' },
  { key: 'vendors',    label: 'Accounts Payable (Vendors)',       accent: '#8b5cf6', note: 'Positive balance = we owe vendor (CR)' },
  { key: 'employees',  label: 'Employee Accounts',                accent: '#0d9488', note: 'Positive balance = employee owes company (DR)' },
]

function AccountTable({ rows }) {
  if (!rows || rows.length === 0)
    return <Empty message="No entries in this section" />

  const totalDr = rows.reduce((s, r) => s + Number(r.debit || 0), 0)
  const totalCr = rows.reduce((s, r) => s + Number(r.credit || 0), 0)

  return (
    <Table>
      <thead>
        <tr>
          <th>Account Name</th>
          <th style={{ textAlign: 'right' }}>Debit (DR)</th>
          <th style={{ textAlign: 'right' }}>Credit (CR)</th>
          <th style={{ textAlign: 'right' }}>Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const hasDr = Number(row.debit) > 0
          const hasCr = Number(row.credit) > 0
          const bal = Number(row.balance || 0)
          return (
            <tr key={row.id ?? i}>
              <td style={{ fontWeight: 500 }}>{row.account_name}</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: hasDr ? '#dc2626' : 'var(--text-muted)' }}>
                {hasDr ? fmt(row.debit) : '—'}
              </td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: hasCr ? '#059669' : 'var(--text-muted)' }}>
                {hasCr ? fmt(row.credit) : '—'}
              </td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {bal === 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>NIL</span>
                ) : hasDr ? (
                  <span style={{ color: '#dc2626' }}>{fmt(Math.abs(bal))} DR</span>
                ) : (
                  <span style={{ color: '#059669' }}>{fmt(Math.abs(bal))} CR</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
          <td style={{ padding: '10px 14px' }}>Section Total</td>
          <td style={{ textAlign: 'right', padding: '10px 14px', fontVariantNumeric: 'tabular-nums', color: '#dc2626' }}>{fmt(totalDr)}</td>
          <td style={{ textAlign: 'right', padding: '10px 14px', fontVariantNumeric: 'tabular-nums', color: '#059669' }}>{fmt(totalCr)}</td>
          <td style={{ textAlign: 'right', padding: '10px 14px', fontVariantNumeric: 'tabular-nums' }}>
            {totalDr > totalCr
              ? <span style={{ color: '#dc2626' }}>{fmt(totalDr - totalCr)} DR</span>
              : totalCr > totalDr
              ? <span style={{ color: '#059669' }}>{fmt(totalCr - totalDr)} CR</span>
              : <span style={{ color: 'var(--text-muted)' }}>NIL</span>}
          </td>
        </tr>
      </tfoot>
    </Table>
  )
}

export default function TrialBalance() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/trial-balance')
      .then(r => { setData(r.data); setLoading(false) })
      .catch(e => { setError(e.response?.data?.error || 'Error loading trial balance'); setLoading(false) })
  }, [])

  const handlePrint = () => window.print()

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
          <Spinner size={32} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
        <Alert type="error">{error}</Alert>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
        <Alert type="error">No data available.</Alert>
      </div>
    )
  }

  const totalDebit  = Number(data.totalDebit  || 0)
  const totalCredit = Number(data.totalCredit || 0)
  const diff = Math.abs(totalDebit - totalCredit)
  const isBalanced = diff < 0.01

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader
        title="Trial Balance"
        subtitle="All accounts — Cash, Receivables, Payables, Employees"
        actions={
          <Btn
            variant="secondary"
            icon={<Icon.Print style={{ width: 14, height: 14 }} />}
            onClick={handlePrint}
          >
            Print
          </Btn>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Total Debits (DR)"
          value={fmt(totalDebit)}
          accent="#dc2626"
        />
        <StatCard
          label="Total Credits (CR)"
          value={fmt(totalCredit)}
          accent="#059669"
        />
        <StatCard
          label="Difference"
          value={isBalanced ? 'Balanced' : fmt(diff)}
          accent={isBalanced ? '#3b82f6' : '#f59e0b'}
          sub={isBalanced ? 'Accounts are in balance' : 'Discrepancy detected'}
        />
      </div>

      {SECTIONS.map(({ key, label, accent, note }) => {
        const rows = data[key] || []
        if (rows.length === 0) return null
        return (
          <Card key={key} style={{ marginBottom: 16, overflow: 'hidden', padding: 0 }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              borderLeft: `4px solid ${accent}`,
            }}>
              <div>
                <div style={{ fontWeight: 700, color: accent, fontSize: 14 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{note}</div>
              </div>
              <Badge color="slate">{rows.length} account{rows.length !== 1 ? 's' : ''}</Badge>
            </div>
            <div style={{ padding: 0 }}>
              <AccountTable rows={rows} />
            </div>
          </Card>
        )
      })}

      <div style={{
        background: '#0f172a',
        color: '#fff',
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
      }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>Grand Total</span>
        <div style={{ display: 'flex', gap: 48 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Total Debit
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(totalDebit)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Total Credit
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(totalCredit)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
