import React from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { getCompanyInfo } from './companyInfo'

export function h(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function companyName() {
  const c = getCompanyInfo()
  return c.name || 'DistriBooks'
}

function companyHeader() {
  const c = getCompanyInfo()
  const parts = []
  if (c.address) parts.push(c.address + (c.city ? `, ${c.city}` : ''))
  if (c.phone) parts.push(`Ph: ${c.phone}`)
  if (c.mobile) parts.push(`Mob: ${c.mobile}`)
  if (c.ntn) parts.push(`NTN: ${c.ntn}`)
  if (c.strn) parts.push(`STRN: ${c.strn}`)
  return parts.join('  |  ')
}

// ── PDF ────────────────────────────────────────────────────────────────────────
export function exportPDF(title, columns, rows, filename, meta) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const name = companyName()
  const info = companyHeader()

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(name, 14, 15)
  if (info) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(info, 14, 20)
    doc.setTextColor(0)
    doc.setFontSize(11)
    doc.text(title, 14, 26)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31)
  } else {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(title, 14, 22)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
  }

  let startY = info ? 37 : 35
  if (meta) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(meta, 14, startY)
    doc.line(14, startY + 3, 283, startY + 3)
    startY += 7
  } else {
    doc.line(14, startY - 2, 283, startY - 2)
  }

  autoTable(doc, {
    startY,
    head: [columns.map(c => c.header)],
    body: rows.map(row => columns.map(c => {
      const val = c.accessor(row)
      return val === null || val === undefined ? '' : String(val)
    })),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Page ${i} of ${pageCount}`, 283, 205, { align: 'right' })
    doc.text(name, 14, 205)
  }

  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`)
}

// ── Excel ──────────────────────────────────────────────────────────────────────
export function exportExcel(title, columns, rows, filename) {
  const header = columns.map(c => c.header)
  const data = rows.map(row => columns.map(c => {
    const val = c.accessor(row)
    return val === null || val === undefined ? '' : val
  }))

  const ws = XLSX.utils.aoa_to_sheet([
    [companyName()],
    [title],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    header,
    ...data,
  ])

  ws['!cols'] = columns.map(() => ({ wch: 20 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ── Print ──────────────────────────────────────────────────────────────────────
export function printTable(title, columns, rows, meta) {
  const c = getCompanyInfo()
  const name = c.name || 'DistriBooks'
  const addressLine = [c.address, c.city].filter(Boolean).join(', ')
  const contactLine = [c.phone && `Ph: ${c.phone}`, c.mobile && `Mob: ${c.mobile}`, c.email].filter(Boolean).join('  |  ')
  const taxLine = [c.ntn && `NTN: ${c.ntn}`, c.strn && `STRN: ${c.strn}`].filter(Boolean).join('  |  ')

  const rowsHtml = rows.map(row =>
    `<tr>${columns.map(col => `<td>${h(col.accessor(row))}</td>`).join('')}</tr>`
  ).join('')

  const html = `
    <html><head><title>${h(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
      .co-name { font-size: 18px; font-weight: bold; margin: 0; }
      .co-tag { font-size: 10px; color: #555; margin: 1px 0 0; }
      .co-addr { font-size: 9px; color: #666; margin: 2px 0 0; }
      .co-contact { font-size: 9px; color: #666; margin: 1px 0 0; }
      .co-tax { font-size: 9px; color: #888; margin: 1px 0 0; }
      .divider { border: none; border-top: 2px solid #1e40af; margin: 8px 0; }
      .report-title { font-size: 13px; font-weight: bold; color: #1e40af; margin: 4px 0; }
      .report-date { font-size: 9px; color: #888; margin: 0 0 8px; }
      .meta { font-size: 10px; font-weight: bold; color: #1e40af; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1e40af; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
      td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f5f7fa; }
      .footer { margin-top: 20px; font-size: 9px; color: #aaa; text-align: center; }
      @media print { button { display: none; } }
    </style></head>
    <body>
      <div class="co-name">${h(name)}</div>
      ${c.tagline ? `<div class="co-tag">${h(c.tagline)}</div>` : ''}
      ${addressLine ? `<div class="co-addr">${h(addressLine)}</div>` : ''}
      ${contactLine ? `<div class="co-contact">${h(contactLine)}</div>` : ''}
      ${taxLine ? `<div class="co-tax">${h(taxLine)}</div>` : ''}
      <hr class="divider"/>
      <div class="report-title">${h(title)}</div>
      <div class="report-date">Generated: ${new Date().toLocaleString()}</div>
      ${meta ? `<div class="meta">${h(meta)}</div>` : ''}
      <table>
        <thead><tr>${columns.map(col => `<th>${h(col.header)}</th>`).join('')}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="footer">${h(name)}</div>
    </body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}

// ── Reusable ExportBar component ───────────────────────────────────────────────
export function ExportBar({ onPDF, onExcel, onPrint, children }) {
  return React.createElement('div', { className: 'flex items-center gap-2 flex-wrap' },
    children,
    React.createElement('button', { onClick: onPrint, className: 'flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 font-medium' }, 'Print'),
    React.createElement('button', { onClick: onPDF,   className: 'flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 font-medium' }, 'PDF'),
    React.createElement('button', { onClick: onExcel, className: 'flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 hover:bg-green-100 text-green-700 rounded-lg border border-green-200 font-medium' }, 'Excel'),
  )
}
