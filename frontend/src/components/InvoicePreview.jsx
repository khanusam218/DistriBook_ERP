import { useRef } from 'react'
import { getCompanyInfo } from '../utils/companyInfo'
import { Btn, Icon } from './ui'

export function numberToWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function convert(n) {
    if (n === 0) return ''
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '')
  }
  const n = Number(amount)
  if (!Number.isFinite(n)) return 'Zero Rupees Only'
  const rupees = Math.floor(Math.abs(n))
  const paise = Math.round((Math.abs(n) - rupees) * 100)
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only'
  let result = 'Rupees ' + convert(rupees)
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise'
  return result + ' Only'
}

export function formatQty(item) {
  const ctn = Number(item.qty_ctn) || 0
  const loose = Number(item.qty_loose_pieces) || 0
  if (ctn > 0 && loose > 0) return `${ctn} CTN + ${loose} PCS`
  if (ctn > 0) return `${ctn} CTN`
  if (loose > 0) return `${loose} PCS`
  return String(item.product_qty ?? 0)
}

export default function PrintInvoice({ sale, onClose }) {
  const printRef = useRef()
  const hasDiscount = sale.items?.some(i => Number(i.discount) > 0)
  const hasDescription = sale.items?.some(i => i.description)
  const co = getCompanyInfo()
  const colSpan = 4 + (hasDescription ? 1 : 0) + (hasDiscount ? 1 : 0)

  const print = () => {
    const content = printRef.current.innerHTML
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${sale.bill_no || sale.id}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Arial', sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 32px; }
      .inv-wrap { max-width: 750px; margin: 0 auto; }
      /* Header */
      .inv-header { text-align: center; border-bottom: 3px double #1e293b; padding-bottom: 14px; margin-bottom: 18px; }
      .inv-header h1 { font-size: 22px; font-weight: 800; color: #1e293b; letter-spacing: 1px; margin-bottom: 3px; }
      .inv-header .tagline { font-size: 11px; color: #555; margin: 2px 0; }
      .inv-header .contact { font-size: 10px; color: #666; margin: 2px 0; }
      .inv-title { text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #475569; text-transform: uppercase; margin-bottom: 18px; }
      /* Info grid */
      .inv-info { display: flex; justify-content: space-between; margin-bottom: 18px; gap: 16px; }
      .inv-info-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; background: #f8fafc; }
      .inv-info-box .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px; }
      .inv-info-box .val { font-size: 13px; font-weight: 700; color: #1e293b; }
      .inv-info-box .sub { font-size: 10px; color: #64748b; margin-top: 2px; }
      /* Table */
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      thead tr { background: #1e293b; color: #fff; }
      thead th { padding: 9px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
      thead th.r { text-align: right; }
      tbody tr { border-bottom: 1px solid #e2e8f0; }
      tbody tr:nth-child(even) { background: #f8fafc; }
      tbody td { padding: 8px 10px; font-size: 11.5px; color: #334155; }
      tbody td.r { text-align: right; }
      tbody td.num { font-variant-numeric: tabular-nums; }
      /* Totals */
      .inv-total-row { background: #1e293b !important; }
      .inv-total-row td { padding: 10px 10px; font-size: 13px; font-weight: 800; color: #fff !important; }
      /* Words */
      .inv-words { font-size: 10.5px; font-style: italic; color: #475569; margin: 8px 0 24px; }
      /* Footer */
      .inv-footer { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 12px; border-top: 1px dashed #cbd5e1; }
      .inv-footer .sig { text-align: center; min-width: 160px; }
      .inv-footer .sig-line { border-top: 1.5px solid #334155; margin-bottom: 6px; }
      .inv-footer .sig-label { font-size: 11px; color: #475569; font-weight: 600; }
      .inv-stamp { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px; }
      @media print { body { padding: 16px; } }
    </style></head><body>
    <div class="inv-wrap">${content}</div>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(() => { w.print() }, 300)
  }

  const fmt = n => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })

  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: 720, maxHeight: '85vh', overflow: 'auto', margin: 'auto' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 15 }}>Invoice Preview</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={print} icon={<Icon.Print style={{ width: 14, height: 14 }} />}>Print / PDF</Btn>
            <button className="modal-close" onClick={onClose}><Icon.X style={{ width: 14, height: 14 }} /></button>
          </div>
        </div>

        <div ref={printRef} style={{ padding: '28px 36px', background: '#fff' }}>
          {/* Company Header */}
          <div className="inv-header" style={{ textAlign: 'center', borderBottom: '3px double #1e293b', paddingBottom: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', letterSpacing: 1 }}>{co.name || 'SALE INVOICE'}</div>
            {co.tagline && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{co.tagline}</div>}
            {co.address && <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{[co.address, co.city].filter(Boolean).join(', ')}</div>}
            {(co.phone || co.mobile) && <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{[co.phone && `Ph: ${co.phone}`, co.mobile && `Mob: ${co.mobile}`].filter(Boolean).join('   |   ')}</div>}
            {(co.ntn || co.strn) && <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{[co.ntn && `NTN: ${co.ntn}`, co.strn && `STRN: ${co.strn}`].filter(Boolean).join('   |   ')}</div>}
          </div>

          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: 4, color: '#475569', textTransform: 'uppercase', marginBottom: 18 }}>Sale Invoice</div>

          {/* Info boxes */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 2, border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 4 }}>Bill To</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{sale.shop_name || sale.customer_name || 'Direct Sale'}</div>
              {sale.customer_name && sale.shop_name && sale.customer_name !== sale.shop_name && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sale.customer_name}</div>
              )}
            </div>
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 4 }}>Bill No</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{sale.bill_no || '—'}</div>
            </div>
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 4 }}>Date</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{sale.sale_date}</div>
            </div>
            {sale.gate_pass_no && (
              <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 4 }}>Gate Pass #</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{sale.gate_pass_no}</div>
              </div>
            )}
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead>
              <tr style={{ background: '#1e293b' }}>
                <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'left', width: 36 }}>#</th>
                <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'left' }}>Product Name</th>
                {hasDescription && <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'left' }}>Description</th>}
                <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'right', width: 100 }}>Rate/CTN</th>
                <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'right', width: 60 }}>Qty</th>
                {hasDiscount && <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'right', width: 70 }}>Disc %</th>}
                <th style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#fff', textAlign: 'right', width: 110 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 1 ? '#f8fafc' : '#fff' }}>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#94a3b8', textAlign: 'left' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#1e293b', fontWeight: 500 }}>{item.product_name}</td>
                  {hasDescription && <td style={{ padding: '8px 10px', fontSize: 11, color: '#64748b' }}>{item.description || '—'}</td>}
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#334155', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>Rs. {fmt(Number(item.product_rate) * (Number(item.pieces_per_ctn) || 1))}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#334155', textAlign: 'right', fontWeight: 600 }}>{formatQty(item)}</td>
                  {hasDiscount && <td style={{ padding: '8px 10px', fontSize: 12, color: '#334155', textAlign: 'right' }}>{Number(item.discount) > 0 ? `${item.discount}%` : '—'}</td>}
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#1e293b', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Rs. {fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#1e293b' }}>
                <td colSpan={colSpan} style={{ padding: '11px 10px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#fff' }}>Grand Total</td>
                <td style={{ padding: '11px 10px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>Rs. {fmt(sale.total_amount)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Amount in words */}
          <div style={{ fontSize: 11, fontStyle: 'italic', color: '#475569', marginBottom: 32 }}>
            {numberToWords(Number(sale.total_amount))}
          </div>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 12, borderTop: '1px dashed #cbd5e1' }}>
            <div style={{ textAlign: 'center', minWidth: 160 }}>
              <div style={{ borderTop: '1.5px solid #334155', marginBottom: 6 }} />
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>Received By</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: 160 }}>
              <div style={{ borderTop: '1.5px solid #334155', marginBottom: 6 }} />
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>Authorized Signature</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: 9, color: '#94a3b8', marginTop: 20 }}>
            Generated by {co.name || 'DistriBook ERP'} — {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  )
}
