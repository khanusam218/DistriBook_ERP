import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'
import { getCompanyInfo } from '../utils/companyInfo'

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0]

const fmt = (n) => Number(n || 0).toFixed(2)

// ── Shared print CSS (injected once when receipt is visible) ──────────────────

const PRINT_CSS = `
  @media print {
    body * { visibility: hidden !important; }
    #pos-receipt, #pos-receipt * { visibility: visible !important; }
    #pos-receipt {
      position: fixed !important; top: 0 !important; left: 0 !important;
      width: 80mm !important; padding: 4mm !important; margin: 0 !important;
      background: #fff !important; color: #000 !important;
      font-family: 'Courier New', Courier, monospace !important;
      font-size: 8.5pt !important; line-height: 1.45 !important;
    }
    @page { size: 80mm auto; margin: 0; }
  }
`

// ── ReceiptContent — pure printable HTML, no modal wrapper ───────────────────

function ReceiptContent({ bill, items }) {
  const dateStr = bill.sale_date || today()
  const timeStr = bill.created_at
    ? new Date(bill.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
  const custLabel = bill.customer_name || bill.customer_shop || 'Walk-in Customer'
  const co = getCompanyInfo()
  const storeName = co.name || 'POS'
  const storeAddr = [co.address, co.city].filter(Boolean).join(', ')
  const storePhone = co.phone || co.mobile || ''

  return (
    <div id="pos-receipt" className="font-mono text-xs bg-white text-black leading-relaxed">
      <div className="text-center mb-1">
        <div className="font-bold text-sm">{storeName}</div>
        {storeAddr && <div className="text-xs text-gray-600">{storeAddr}</div>}
        {storePhone && <div className="text-xs text-gray-600">{storePhone}</div>}
        <div className="border-b border-dashed border-gray-400 my-1" />
      </div>
      <div className="flex justify-between text-xs mb-0.5">
        <span>Bill#: <b>{bill.bill_no}</b></span>
        <span>{dateStr}</span>
      </div>
      <div className="flex justify-between text-xs mb-0.5">
        <span>Time: {timeStr}</span>
        <span className="capitalize">{(bill.payment_method || 'CASH').toLowerCase()}</span>
      </div>
      <div className="text-xs mb-1">Customer: {custLabel}</div>
      <div className="border-b border-dashed border-gray-400 mb-1" />
      <div className="text-xs">
        <div className="flex justify-between font-semibold mb-0.5 border-b border-gray-300 pb-0.5">
          <span className="flex-1">Item</span>
          <span className="w-8 text-right">Qty</span>
          <span className="w-14 text-right">Rate</span>
          <span className="w-14 text-right">Amt</span>
        </div>
        {items.map((item, i) => (
          <div key={i} className="mb-0.5">
            <div className="text-gray-600 leading-tight truncate">{item.product_name}</div>
            <div className="flex justify-between">
              <span className="flex-1 text-gray-400 text-xs">{item.company_name}</span>
              <span className="w-8 text-right">{item.product_qty}</span>
              <span className="w-14 text-right">{fmt(item.product_rate)}</span>
              <span className="w-14 text-right">{fmt(item.total)}</span>
            </div>
            {Number(item.discount) > 0 && (
              <div className="text-right text-gray-500 text-xs">Disc: -{fmt(item.discount)}</div>
            )}
          </div>
        ))}
      </div>
      <div className="border-b border-dashed border-gray-400 my-1" />
      <div className="text-xs space-y-0.5">
        {Number(bill.discount_total) > 0 && (
          <>
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>Rs. {fmt(Number(bill.total_amount) + Number(bill.discount_total))}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Discount</span>
              <span>-Rs. {fmt(bill.discount_total)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-bold text-sm border-t border-gray-300 pt-0.5 mt-0.5">
          <span>TOTAL</span>
          <span>Rs. {fmt(bill.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cash Received</span>
          <span>Rs. {fmt(bill.amount_paid)}</span>
        </div>
        {Number(bill.change_amount) > 0 && (
          <div className="flex justify-between font-semibold">
            <span>Change</span>
            <span>Rs. {fmt(bill.change_amount)}</span>
          </div>
        )}
      </div>
      <div className="border-b border-dashed border-gray-400 my-1" />
      <div className="text-center text-xs text-gray-500">Thank you! Visit again.</div>
    </div>
  )
}

// ── Receipt modal (shown after sale completes) ────────────────────────────────

function Receipt({ bill, items, onNewSale }) {
  return (
    <div className="modal-backdrop">
      <style>{PRINT_CSS}</style>
      <div className="modal-box" style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 32px)' }}>
        <div className="modal-header">
          <div>
            <h2>Sale Complete!</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{bill.bill_no}</p>
          </div>
          <div style={{ width: 32, height: 32, background: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <ReceiptContent bill={bill} items={items} />
        </div>
        <div className="modal-footer">
          <button onClick={() => window.print()} className="btn btn-primary" style={{ flex: 1 }}>Print Receipt</button>
          <button onClick={onNewSale} className="btn btn-success" style={{ flex: 1 }}>+ New Sale</button>
        </div>
      </div>
    </div>
  )
}

// ── BillHistory component ─────────────────────────────────────────────────────

function BillHistory({ onClose }) {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState(null)
  const [billItems, setBillItems] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/pos/bills').then(r => { setBills(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const openBill = async (id) => {
    try {
      const r = await api.get(`/pos/bills/${id}`)
      setSelectedBill(r.data.sale)
      setBillItems(r.data.items)
    } catch {}
  }

  const filtered = bills.filter(b =>
    !search ||
    b.bill_no?.toLowerCase().includes(search.toLowerCase()) ||
    (b.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.customer_shop || '').toLowerCase().includes(search.toLowerCase())
  )

  if (selectedBill) {
    return (
      <div className="modal-backdrop">
        <style>{PRINT_CSS}</style>
        <div className="modal-box" style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 32px)' }}>
          <div className="modal-header">
            <div>
              <h2>{selectedBill.bill_no}</h2>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{selectedBill.sale_date}</p>
            </div>
            <button onClick={() => setSelectedBill(null)} className="modal-close">×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <ReceiptContent bill={selectedBill} items={billItems} />
          </div>
          <div className="modal-footer">
            <button onClick={() => window.print()} className="btn btn-primary" style={{ flex: 1 }}>Print Receipt</button>
            <button onClick={() => setSelectedBill(null)} className="btn btn-secondary" style={{ flex: 1 }}>← Back</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>
        <div className="modal-header">
          <h2>Bill History</h2>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div className="search-wrap">
            <svg className="search-icon" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={8}/><line x1={21} y1={21} x2={16.65} y2={16.65}/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by bill number or customer…" className="db-input" autoFocus />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}><span className="spinner" />Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>No bills found</div>
          ) : (
            <table className="db-table">
              <thead>
                <tr>
                  {['Bill #', 'Date', 'Customer', 'Total', 'Method', ''].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => openBill(b.id)}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5' }}>{b.bill_no}</td>
                    <td style={{ color: '#64748b' }}>{b.sale_date}</td>
                    <td>{b.customer_name || b.customer_shop || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Walk-in</span>}</td>
                    <td style={{ fontWeight: 700 }}>Rs. {fmt(b.total_amount)}</td>
                    <td><span className={`badge ${b.payment_method === 'CASH' ? 'badge-green' : 'badge-blue'}`}>{b.payment_method || 'CASH'}</span></td>
                    <td style={{ color: '#4f46e5', fontSize: 12 }}>View →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Product card (module-level so React never remounts on POS re-render) ──────

function ProductCard({ product, cartQtyMap, onAdd }) {
  const inCart = cartQtyMap[product.id]
  const outOfStock = product.quantity <= 0
  const stockColor = product.quantity > 20 ? '#16a34a' : product.quantity > 5 ? '#d97706' : product.quantity > 0 ? '#ea580c' : '#dc2626'
  const stockBg   = product.quantity > 20 ? '#f0fdf4' : product.quantity > 5 ? '#fffbeb' : product.quantity > 0 ? '#fff7ed' : '#fef2f2'
  return (
    <div onClick={() => !outOfStock && onAdd(product)}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: 10, borderRadius: 10, border: `2px solid ${inCart ? '#6366f1' : outOfStock ? '#f1f5f9' : '#e2e8f0'}`, background: inCart ? '#eef2ff' : outOfStock ? '#f8fafc' : '#fff',
        cursor: outOfStock ? 'not-allowed' : 'pointer', opacity: outOfStock ? 0.5 : 1, transition: 'all 0.12s', userSelect: 'none',
        boxShadow: inCart ? '0 2px 8px rgba(99,102,241,0.2)' : 'none' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.company_name}</div>
      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 12.5, marginTop: 3, lineHeight: 1.4, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {product.product_name}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, gap: 4 }}>
        <span style={{ color: '#4f46e5', fontWeight: 800, fontSize: 14 }}>Rs.{product.sale_price}</span>
        <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 99, fontWeight: 600, flexShrink: 0, background: stockBg, color: stockColor }}>
          {product.quantity} {product.packing_unit}
        </span>
      </div>
      {inCart && (
        <div style={{ position: 'absolute', top: 6, right: 6, background: '#4f46e5', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {inCart}
        </div>
      )}
    </div>
  )
}

// ── Main POS component ────────────────────────────────────────────────────────

export default function POS() {
  // Data
  const [products, setProducts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  // Search / filter
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('ALL')
  const searchRef = useRef(null)

  // Cart
  const [cart, setCart] = useState([])
  const [walkInName, setWalkInName] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [bankAccountId, setBankAccountId] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [overallDiscount, setOverallDiscount] = useState('')

  // UI
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lastBill, setLastBill] = useState(null)
  const [lastItems, setLastItems] = useState([])
  const [showReceipt, setShowReceipt] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [clock, setClock] = useState(new Date())

  // Scanner detection
  const scannerBuffer = useRef('')
  const lastKeyTime = useRef(0)

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      api.get('/pos/products'),
      api.get('/bank-accounts'),
      api.get('/customers'),
    ]).then(([p, b, c]) => {
      setProducts(p.data)
      setBankAccounts(b.data)
      const cashAcc = b.data.find(a => a.account_type === 'CASH') || b.data[0]
      if (cashAcc) setBankAccountId(String(cashAcc.id))
      setCustomers(c.data.filter(x => x.customer_type === 'WHOLESALER'))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Lock body scroll while POS is mounted (it manages its own viewport)
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Focus search on mount
  useEffect(() => {
    if (!loading) searchRef.current?.focus()
  }, [loading])

  // Global keyboard shortcut: / focuses search, F10 completes sale
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F10') { e.preventDefault(); handleCompleteSale() }
      if ((e.key === '/' || e.key === 'F2') && document.activeElement !== searchRef.current) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // ── Derived values ────────────────────────────────────────────────────────────

  const brands = ['ALL', ...new Set(products.map(p => p.company_name).filter(Boolean)).values()].sort((a, b) => a === 'ALL' ? -1 : a.localeCompare(b))

  const filteredProducts = products.filter(p => {
    const matchBrand = brandFilter === 'ALL' || p.company_name === brandFilter
    const q = search.toLowerCase()
    const matchSearch = !q || p.product_name.toLowerCase().includes(q) ||
      p.company_name.toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    return matchBrand && matchSearch
  })

  const lineSubtotal = cart.reduce((sum, i) => sum + (i.qty * i.rate) - (i.discount || 0), 0)
  const disc = Number(overallDiscount) || 0
  const grandTotal = Math.max(0, lineSubtotal - disc)
  const cashAmt = Number(cashReceived) || 0
  const change = Math.max(0, cashAmt - grandTotal)

  const cartQtyMap = Object.fromEntries(cart.map(i => [i.stock_id, i.qty]))

  // ── Cart operations ───────────────────────────────────────────────────────────

  const addToCart = useCallback((product) => {
    if (product.quantity <= 0) return
    setCart(prev => {
      const existing = prev.find(i => i.stock_id === product.id)
      if (existing) {
        if (existing.qty >= product.quantity) return prev
        return prev.map(i => i.stock_id === product.id
          ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.rate - (i.discount || 0) }
          : i
        )
      }
      return [...prev, {
        stock_id: product.id,
        product_name: product.product_name,
        company_name: product.company_name,
        rate: product.sale_price,
        qty: 1,
        discount: 0,
        total: product.sale_price,
        maxQty: product.quantity,
        packing_unit: product.packing_unit,
      }]
    })
  }, [])

  const removeFromCart = (stock_id) => {
    setCart(prev => prev.filter(i => i.stock_id !== stock_id))
  }

  const updateCart = (stock_id, field, value) => {
    setCart(prev => prev.map(i => {
      if (i.stock_id !== stock_id) return i
      const updated = { ...i, [field]: value }
      updated.total = (Number(updated.qty) * Number(updated.rate)) - (Number(updated.discount) || 0)
      return updated
    }))
  }

  const clearCart = () => {
    setCart([])
    setWalkInName('')
    setSelectedCustomerId('')
    setCashReceived('')
    setOverallDiscount('')
    setError('')
    setPaymentMethod('CASH')
    const cashAcc = bankAccounts.find(a => a.account_type === 'CASH') || bankAccounts[0]
    if (cashAcc) setBankAccountId(String(cashAcc.id))
    searchRef.current?.focus()
  }

  // ── Scanner handler ───────────────────────────────────────────────────────────

  const handleSearchKeyDown = (e) => {
    const now = Date.now()
    const gap = now - lastKeyTime.current
    lastKeyTime.current = now

    if (e.key === 'Enter') {
      e.preventDefault()
      const term = search.trim()
      if (!term) return

      // Fast input (scanner): try barcode match
      if (scannerBuffer.current.length >= 3) {
        const byBarcode = products.find(p => p.barcode && p.barcode === term)
        if (byBarcode) {
          addToCart(byBarcode)
          setSearch('')
          scannerBuffer.current = ''
          return
        }
      }
      scannerBuffer.current = ''

      // Single result — add it
      const visible = products.filter(p => {
        const q = term.toLowerCase()
        return p.product_name.toLowerCase().includes(q) || (p.barcode || '') === term
      })
      if (visible.length === 1) {
        addToCart(visible[0])
        setSearch('')
      }
      return
    }

    if (gap < 50 && e.key.length === 1) {
      scannerBuffer.current += e.key
    } else {
      scannerBuffer.current = e.key.length === 1 ? e.key : ''
    }
  }

  // ── Complete sale ─────────────────────────────────────────────────────────────

  const handleCompleteSale = async () => {
    if (cart.length === 0) return setError('Cart is empty')
    if (paymentMethod === 'CASH' && cashReceived !== '' && Number(cashReceived) < grandTotal) {
      return setError('Cash received is less than total amount')
    }

    setSaving(true)
    setError('')
    try {
      const r = await api.post('/pos/sale', {
        items: cart.map(i => ({
          stock_id: i.stock_id,
          qty: i.qty,
          rate: i.rate,
          discount: i.discount || 0,
        })),
        customerName: walkInName,
        customerId: selectedCustomerId || null,
        paymentMethod,
        bankAccountId: bankAccountId || null,
        amountPaid: cashReceived !== '' ? Number(cashReceived) : grandTotal,
        discountTotal: disc,
        date: today(),
      })
      setLastBill(r.data.sale)
      setLastItems(r.data.items)
      setShowReceipt(true)
      // Refresh product stock quantities
      const fresh = await api.get('/pos/products')
      setProducts(fresh.data)
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error completing sale')
    }
    setSaving(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <span className="spinner" style={{ width: 32, height: 32, borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#6366f1', marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
          <p style={{ fontWeight: 500 }}>Loading POS…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#0f172a', overflow: 'hidden', height: '100vh', width: '100%' }}>

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1e1b4b, #312e81)', color: '#fff', padding: '10px 20px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1={3} y1={6} x2={21} y2={6}/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{getCompanyInfo().name || 'DistriBooks'}</div>
            <div style={{ fontSize: 11, color: '#a5b4fc' }}>Point of Sale</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 13 }}>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4ade80', fontSize: 15 }}>
            {clock.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{today()}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowHistory(true)}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#e2e8f0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Bill History
          </button>
          {cart.length > 0 && (
            <button onClick={() => { if (window.confirm('Clear current cart?')) clearCart() }}
              style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear Cart
            </button>
          )}
        </div>
      </header>

      {/* ── Main area ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, gap: 10, padding: 10, overflow: 'hidden', minWidth: 0 }}>

        {/* ── LEFT: Products ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, overflow: 'hidden', flex: '3 1 0%', minWidth: 0 }}>

          {/* Search bar */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={8}/><line x1={21} y1={21} x2={16.65} y2={16.65}/></svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search products or scan barcode… (press / to focus)"
                className="db-input"
                style={{ paddingLeft: 34, paddingRight: search ? 32 : 12 }}
              />
              {search && (
                <button onClick={() => { setSearch(''); searchRef.current?.focus() }}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
              )}
            </div>
          </div>

          {/* Brand chips */}
          <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', overflowX: 'auto', flexShrink: 0 }}>
            {brands.map(b => (
              <button key={b} onClick={() => setBrandFilter(b)}
                style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', transition: 'all 0.1s',
                  background: brandFilter === b ? '#4f46e5' : '#fff', color: brandFilter === b ? '#fff' : '#475569', borderColor: brandFilter === b ? '#4f46e5' : '#e2e8f0' }}>
                {b}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {filteredProducts.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ marginBottom: 10, opacity: 0.4 }}><path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4A2 2 0 0 1 2 16.76V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"/></svg>
                <p style={{ fontSize: 13 }}>No products found</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                {filteredProducts.map(p => <ProductCard key={p.id} product={p} cartQtyMap={cartQtyMap} onAdd={addToCart} />)}
              </div>
            )}
          </div>

          {/* Footer count */}
          <div style={{ padding: '6px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11.5, color: '#94a3b8', flexShrink: 0 }}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} shown
            {search && ` · Press Enter to add if single result`}
          </div>
        </div>

        {/* ── RIGHT: Cart & Payment ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, overflow: 'hidden', flex: '2 1 0%', minWidth: 0 }}>

          {/* Customer row */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer (optional)</label>
                <input type="text" value={walkInName} onChange={e => setWalkInName(e.target.value)}
                  placeholder="Walk-in customer name…" className="db-input" style={{ fontSize: 12.5 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Account (wholesaler)</label>
                <select value={selectedCustomerId}
                  onChange={e => {
                    setSelectedCustomerId(e.target.value)
                    if (e.target.value) {
                      const c = customers.find(x => String(x.id) === e.target.value)
                      if (c) setWalkInName(c.shop_name)
                    }
                  }}
                  className="db-input db-select" style={{ fontSize: 12.5 }}>
                  <option value="">— No account —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.shop_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Cart items */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#cbd5e1', padding: 24 }}>
                <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} style={{ marginBottom: 12 }}><circle cx={9} cy={21} r={1}/><circle cx={20} cy={21} r={1}/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                <p style={{ fontWeight: 600, fontSize: 13 }}>Cart is empty</p>
                <p style={{ fontSize: 11.5, marginTop: 4 }}>Click a product or scan barcode</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                <colgroup>
                  <col /><col style={{ width: 90 }} /><col style={{ width: 64 }} /><col style={{ width: 56 }} /><col style={{ width: 70 }} /><col style={{ width: 24 }} />
                </colgroup>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>Item</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>Qty</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>Rate</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>Disc</th>
                    <th style={{ padding: '8px 8px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' }}>Total</th>
                    <th style={{ borderBottom: '1px solid #e2e8f0' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.stock_id} style={{ borderBottom: '1px solid #f1f5f9' }} className="group">
                      <td style={{ padding: '8px 12px', minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 12, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</div>
                        <div style={{ fontSize: 10.5, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.company_name}</div>
                      </td>
                      <td style={{ padding: '8px 2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                          <button onClick={() => item.qty > 1 ? updateCart(item.stock_id, 'qty', item.qty - 1) : removeFromCart(item.stock_id)}
                            style={{ width: 20, height: 20, borderRadius: 5, background: '#e2e8f0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <input type="number" value={item.qty} min={1} max={item.maxQty}
                            onChange={e => updateCart(item.stock_id, 'qty', Math.max(1, Math.min(item.maxQty, Number(e.target.value) || 1)))}
                            style={{ width: 28, textAlign: 'center', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 11.5, padding: '2px 0' }} />
                          <button onClick={() => item.qty < item.maxQty && updateCart(item.stock_id, 'qty', item.qty + 1)}
                            disabled={item.qty >= item.maxQty}
                            style={{ width: 20, height: 20, borderRadius: 5, background: '#e2e8f0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: item.qty >= item.maxQty ? 0.4 : 1 }}>+</button>
                        </div>
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <input type="number" value={item.rate === 0 ? '' : item.rate} min={0}
                          onChange={e => updateCart(item.stock_id, 'rate', Number(e.target.value) || 0)}
                          placeholder="Rate"
                          style={{ width: '100%', textAlign: 'right', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 11.5, padding: '3px 4px' }} />
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <input type="number" value={item.discount || ''} min={0} placeholder="0"
                          onChange={e => updateCart(item.stock_id, 'discount', Number(e.target.value) || 0)}
                          style={{ width: '100%', textAlign: 'right', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 11.5, padding: '3px 4px' }} />
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: 12 }}>{fmt(item.total)}</td>
                      <td style={{ padding: '8px 4px' }}>
                        <button onClick={() => removeFromCart(item.stock_id)}
                          style={{ width: 18, height: 18, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Totals + Payment */}
          <div style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: '#475569' }}>
              <span>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
              <span style={{ fontWeight: 600 }}>Subtotal: Rs.{fmt(lineSubtotal)}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Disc (Rs.)</label>
              <input type="number" value={overallDiscount} min={0} placeholder="0"
                onChange={e => setOverallDiscount(e.target.value)}
                style={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '5px 10px', fontSize: 12.5, textAlign: 'right', background: '#fff' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', borderRadius: 10, padding: '10px 16px' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>TOTAL</span>
              <span style={{ fontSize: 20, fontWeight: 800 }}>Rs.{fmt(grandTotal)}</span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {bankAccounts.map(acc => (
                <button key={acc.id}
                  onClick={() => { setBankAccountId(String(acc.id)); setPaymentMethod(acc.account_type === 'CASH' ? 'CASH' : 'BANK') }}
                  style={{ flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s',
                    background: bankAccountId === String(acc.id) ? '#4f46e5' : '#fff', color: bankAccountId === String(acc.id) ? '#fff' : '#475569', borderColor: bankAccountId === String(acc.id) ? '#4f46e5' : '#e2e8f0' }}>
                  {acc.account_name}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cash Received</label>
                <input type="number" value={cashReceived} min={0} placeholder={fmt(grandTotal)}
                  onChange={e => setCashReceived(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', fontSize: 13 }} />
              </div>
              {cashReceived !== '' && (
                <div style={{ flex: 1, borderRadius: 8, padding: '8px 10px', textAlign: 'center', background: change >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${change >= 0 ? '#a7f3d0' : '#fecaca'}` }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{change >= 0 ? 'Change' : 'Short'}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: change >= 0 ? '#16a34a' : '#dc2626' }}>Rs.{fmt(Math.abs(change))}</div>
                </div>
              )}
            </div>

            {error && (
              <div className="alert alert-error" style={{ fontSize: 12 }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx={12} cy={12} r={10}/><line x1={12} y1={8} x2={12} y2={12}/><line x1={12} y1={16} x2={12.01} y2={16}/></svg>
                {error}
              </div>
            )}

            <button onClick={handleCompleteSale} disabled={saving || cart.length === 0}
              style={{ width: '100%', padding: '12px 0', borderRadius: 10, fontWeight: 800, fontSize: 14, border: 'none', cursor: saving || cart.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                background: saving || cart.length === 0 ? '#e2e8f0' : 'linear-gradient(135deg, #059669, #047857)',
                color: saving || cart.length === 0 ? '#94a3b8' : '#fff',
                boxShadow: saving || cart.length === 0 ? 'none' : '0 4px 12px rgba(5,150,105,0.25)' }}>
              {saving ? 'Processing…' : `Complete Sale  (F10)  ·  Rs.${fmt(grandTotal)}`}
            </button>
          </div>
        </div>
      </div>

      {/* ── Receipt modal ───────────────────────────────────────────────────────── */}
      {showReceipt && lastBill && (
        <Receipt
          bill={lastBill}
          items={lastItems}
          onClose={() => setShowReceipt(false)}
          onNewSale={() => { setShowReceipt(false); clearCart() }}
        />
      )}

      {/* ── History modal ───────────────────────────────────────────────────────── */}
      {showHistory && <BillHistory onClose={() => setShowHistory(false)} />}
    </div>
  )
}
