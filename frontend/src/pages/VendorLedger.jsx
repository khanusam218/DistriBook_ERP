import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { exportPDF, exportExcel, printTable, ExportBar, h } from '../utils/exportUtils'
import { DEVELOPER_CREDIT_LINE1, DEVELOPER_CREDIT_LINE2 } from '../utils/companyInfo'
import {
  PageHeader, Card, StatCard, Select, Input, Btn, Badge, Alert, Empty, Spinner, Table, Modal
} from '../components/ui'

const LEDGER_COLS = [
  { header: 'Date', accessor: r => r.transaction_date },
  { header: 'Description', accessor: r => r.description },
  { header: 'Type', accessor: r => r.transaction_type },
  { header: 'Debit', accessor: r => r.debit > 0 ? `Rs. ${Number(r.debit).toFixed(2)}` : '-' },
  { header: 'Credit', accessor: r => r.credit > 0 ? `Rs. ${Number(r.credit).toFixed(2)}` : '-' },
  { header: 'Balance', accessor: r => `Rs. ${Number(r.balance).toFixed(2)}` },
]

const TYPE_COLOR = {
  OPENING: 'blue',
  PURCHASE: 'orange',
  PURCHASE_RETURN: 'green',
  PAYMENT: 'purple',
}

function PurchaseDetailModal({ purchaseId, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/purchases/${purchaseId}`)
      .then(r => { setDetail(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [purchaseId])

  const print = () => {
    const w = window.open('', '_blank')
    w.document.write(`<html><head><title>Purchase Invoice</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
      h2 { text-align: center; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #000; padding: 6px 10px; text-align: left; }
      th { background: #f0f0f0; }
      .total { font-weight: bold; text-align: right; margin-top: 12px; font-size: 14px; }
    </style></head><body>
    <h2>Purchase Invoice — ${h(detail?.invoice_no || detail?.id)}</h2>
    <p><strong>Vendor:</strong> ${h(detail?.company_name)} &nbsp;&nbsp; <strong>Date:</strong> ${h(detail?.purchase_date)}</p>
    <table>
      <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${(detail?.items || []).map(i =>
        `<tr><td>${h(i.product_name)}</td><td>${h(i.quantity)}</td><td>Rs. ${Number(i.purchase_price).toFixed(2)}</td><td>Rs. ${Number(i.total).toFixed(2)}</td></tr>`
      ).join('')}</tbody>
    </table>
    <p class="total">Grand Total: Rs. ${Number(detail?.total_amount || 0).toFixed(2)}</p>
    <p style="text-align:center;font-size:10px;font-weight:bold;color:#64748b;margin-top:20px">${h(DEVELOPER_CREDIT_LINE1)} | ${h(DEVELOPER_CREDIT_LINE2)}</p>
    </body></html>`)
    w.document.close(); w.focus(); w.print(); w.close()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Purchase Invoice${detail?.invoice_no ? ` — ${detail.invoice_no}` : ''}`}
      maxWidth={680}
      footer={
        <>
          {detail && <Btn variant="secondary" onClick={print}>Print Invoice</Btn>}
          <Btn variant="primary" onClick={onClose}>Close</Btn>
        </>
      }
    >
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <Spinner size={24} />
        </div>
      )}
      {!loading && !detail && (
        <Alert type="error">Could not load invoice.</Alert>
      )}
      {detail && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16, fontSize: 13 }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Vendor:</span> <strong>{detail.company_name}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Invoice #:</span> <strong>{detail.invoice_no || '—'}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Date:</span> <strong>{detail.purchase_date}</strong></div>
            {detail.remarks && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-muted)' }}>Remarks:</span> {detail.remarks}
              </div>
            )}
          </div>
          <Table>
            <thead>
              <tr>
                {['Product', 'Qty (CTN)', 'Unit Price', 'Total'].map(col => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(detail.items || []).map((item, i) => (
                <tr key={i}>
                  <td>{item.product_name}</td>
                  <td>{item.quantity}</td>
                  <td>Rs. {Number(item.purchase_price).toFixed(2)}</td>
                  <td style={{ fontWeight: 600 }}>Rs. {Number(item.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: 15 }}>
            Total: Rs. {Number(detail.total_amount).toFixed(2)}
          </div>
        </>
      )}
    </Modal>
  )
}

export default function VendorLedger() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState([])
  const [selectedVendor, setSelectedVendor] = useState('')
  const [ledger, setLedger] = useState([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [vendorsLoading, setVendorsLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewPurchaseId, setViewPurchaseId] = useState(null)

  useEffect(() => {
    api.get('/vendors').then(r => { setVendors(r.data); setVendorsLoading(false) })
  }, [])

  const loadLedger = async (vendorId) => {
    setSelectedVendor(vendorId)
    if (!vendorId) { setLedger([]); setBalance(0); return }
    setLoading(true)
    try {
      const r = await api.get(`/vendor-ledger/${vendorId}`)
      setLedger(r.data.ledger || [])
      setBalance(r.data.balance || 0)
    } catch { setLedger([]); setBalance(0) }
    setLoading(false)
  }

  const vendor = vendors.find(v => v.id === Number(selectedVendor))

  const filteredLedger = ledger.filter(e => {
    const matchFrom = !dateFrom || e.transaction_date >= dateFrom
    const matchTo = !dateTo || e.transaction_date <= dateTo
    return matchFrom && matchTo
  })

  const totalDebit = filteredLedger.reduce((s, e) => s + Number(e.debit || 0), 0)
  const totalCredit = filteredLedger.reduce((s, e) => s + Number(e.credit || 0), 0)

  const exportTitle = `Vendor Ledger — ${vendor?.company_name || ''}`

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader
        title="Vendor Ledger"
        subtitle="Vendor account statements and purchase history"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {selectedVendor && (
              <ExportBar
              onPDF={() => exportPDF(exportTitle, LEDGER_COLS, filteredLedger, `vendor_ledger_${vendor?.company_code || selectedVendor}`)}
              onExcel={() => exportExcel(exportTitle, LEDGER_COLS, filteredLedger, `vendor_ledger_${vendor?.company_code || selectedVendor}`)}
              onPrint={() => printTable(exportTitle, LEDGER_COLS, filteredLedger)}
            />
            )}
            <Btn variant="danger" onClick={() => navigate('/customer-ledger')}>← Back</Btn>
          </div>
        }
      />

      <Card style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 280 }}>
            <Select
              label="Vendor"
              value={selectedVendor}
              onChange={e => loadLedger(e.target.value)}
            >
              <option value="">Select a vendor…</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.company_name} ({v.company_code})</option>
              ))}
            </Select>
          </div>

          {selectedVendor && (
            <>
              <div>
                <Input
                  label="From"
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Input
                  label="To"
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
              {(dateFrom || dateTo) && (
                <Btn variant="secondary" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>
                  Clear Dates
                </Btn>
              )}
            </>
          )}
        </div>
      </Card>

      {vendorsLoading && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', marginBottom: 12 }}>
          <Spinner size={16} /> Loading vendors…
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Spinner size={28} />
        </div>
      )}

      {selectedVendor && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            <StatCard
              label="Company"
              value={vendor?.company_name || '—'}
              accent="#6366f1"
            />
            <StatCard
              label="Representative"
              value={vendor?.representative_name || '—'}
              accent="#0ea5e9"
            />
            <StatCard
              label="Current Balance (Payable)"
              value={`Rs. ${Math.abs(balance).toFixed(2)} ${balance >= 0 ? 'DR' : 'CR'}`}
              accent={balance >= 0 ? '#3b82f6' : '#dc2626'}
            />
          </div>

          {filteredLedger.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <StatCard label="Total Debit" value={`Rs. ${totalDebit.toFixed(2)}`} accent="#dc2626" />
              <StatCard label="Total Credit" value={`Rs. ${totalCredit.toFixed(2)}`} accent="#059669" />
              <StatCard
                label="Net Balance"
                value={`Rs. ${Math.abs(totalDebit - totalCredit).toFixed(2)} ${totalDebit >= totalCredit ? 'DR' : 'CR'}`}
                accent={totalDebit >= totalCredit ? '#3b82f6' : '#dc2626'}
              />
            </div>
          )}

          <Card>
            <Table>
              <thead>
                <tr>
                  {['Date', 'Description', 'Type', 'Debit', 'Credit', 'Balance', 'Actions'].map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <Empty message="No ledger entries" hint="Select a date range or check if this vendor has transactions" />
                    </td>
                  </tr>
                ) : filteredLedger.map((entry, i) => {
                  const bal = Number(entry.balance)
                  return (
                    <tr key={entry.id ?? i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{entry.transaction_date}</td>
                      <td style={{ maxWidth: 240 }}>{entry.description}</td>
                      <td>
                        <Badge color={TYPE_COLOR[entry.transaction_type] || 'slate'}>
                          {entry.transaction_type}
                        </Badge>
                      </td>
                      <td style={{ color: entry.debit > 0 ? '#dc2626' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {entry.debit > 0 ? `Rs. ${Number(entry.debit).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ color: entry.credit > 0 ? '#059669' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {entry.credit > 0 ? `Rs. ${Number(entry.credit).toFixed(2)}` : '—'}
                      </td>
                      <td style={{
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: bal >= 0 ? '#3b82f6' : '#dc2626',
                      }}>
                        Rs. {Number(entry.balance).toFixed(2)}
                      </td>
                      <td>
                        {entry.reference_type === 'purchase' && entry.reference_id ? (
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewPurchaseId(entry.reference_id)}
                          >
                            View Invoice
                          </Btn>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      {viewPurchaseId && (
        <PurchaseDetailModal
          purchaseId={viewPurchaseId}
          onClose={() => setViewPurchaseId(null)}
        />
      )}
    </div>
  )
}
