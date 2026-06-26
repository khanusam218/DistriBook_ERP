import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ── Icons (inline SVG — no dependency) ─────────────────────────────────────
export const Icon = {
  Search: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  Plus: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  Edit: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Trash: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  X: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  ),
  Check: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  ChevronDown: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Print: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x={6} y={14} width={12} height={8}/>
    </svg>
  ),
  Download: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1={12} y1={15} x2={12} y2={3}/>
    </svg>
  ),
  Filter: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  Eye: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx={12} cy={12} r={3}/>
    </svg>
  ),
  Save: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
  ),
  Refresh: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  Info: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={10}/><line x1={12} y1={16} x2={12} y2={12}/><line x1={12} y1={8} x2={12.01} y2={8}/>
    </svg>
  ),
  Alert: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1={12} y1={9} x2={12} y2={13}/><line x1={12} y1={17} x2={12.01} y2={17}/>
    </svg>
  ),
  Back: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={19} y1={12} x2={5} y2={12}/><polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  User: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx={12} cy={7} r={4}/>
    </svg>
  ),
  LogOut: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1={21} y1={12} x2={9} y2={12}/>
    </svg>
  ),
  Menu: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1={3} y1={12} x2={21} y2={12}/><line x1={3} y1={6} x2={21} y2={6}/><line x1={3} y1={18} x2={21} y2={18}/>
    </svg>
  ),
}

// ── Button ──────────────────────────────────────────────────────────────────
export function Btn({ variant = 'primary', size = '', icon, children, className = '', ...props }) {
  const cls = ['btn', `btn-${variant}`, size && `btn-${size}`, className].filter(Boolean).join(' ')
  return (
    <button className={cls} {...props}>
      {icon && <span style={{ width: 14, height: 14, display: 'flex', flexShrink: 0 }}>{icon}</span>}
      {children}
    </button>
  )
}

// ── Input ───────────────────────────────────────────────────────────────────
export function Input({ label, required, error, className = '', ...props }) {
  return (
    <div>
      {label && (
        <label className="form-label">
          {label}{required && <span className="req">*</span>}
        </label>
      )}
      <input className={`db-input ${error ? 'error' : ''} ${className}`} {...props} />
      {error && <p style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 3 }}>{error}</p>}
    </div>
  )
}

// ── NumInput (no 0 default, no spinners) ────────────────────────────────────
export function NumInput({ label, required, error, value, onChange, className = '', ...props }) {
  return (
    <div>
      {label && (
        <label className="form-label">
          {label}{required && <span className="req">*</span>}
        </label>
      )}
      <input
        type="number"
        className={`db-input ${error ? 'error' : ''} ${className}`}
        value={value === 0 || value === null || value === undefined ? '' : value}
        onChange={onChange}
        onWheel={e => e.target.blur()}
        {...props}
      />
      {error && <p style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 3 }}>{error}</p>}
    </div>
  )
}

// ── Select ──────────────────────────────────────────────────────────────────
export function Select({ label, required, error, className = '', children, ...props }) {
  return (
    <div>
      {label && (
        <label className="form-label">
          {label}{required && <span className="req">*</span>}
        </label>
      )}
      <select className={`db-input db-select ${error ? 'error' : ''} ${className}`} {...props}>
        {children}
      </select>
      {error && <p style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 3 }}>{error}</p>}
    </div>
  )
}

// ── Textarea ────────────────────────────────────────────────────────────────
export function Textarea({ label, required, error, className = '', ...props }) {
  return (
    <div>
      {label && (
        <label className="form-label">
          {label}{required && <span className="req">*</span>}
        </label>
      )}
      <textarea className={`db-input ${error ? 'error' : ''} ${className}`} rows={3} {...props} />
      {error && <p style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 3 }}>{error}</p>}
    </div>
  )
}

// ── SearchBar ───────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = 'Search…', className = '', autoFocus, onKeyDown }) {
  return (
    <div className={`search-wrap ${className}`} style={{ position: 'relative' }}>
      <Icon.Search className="search-icon" style={{ width: 15, height: 15 }} />
      <input
        type="text"
        className="db-input"
        style={{ paddingLeft: 34 }}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}

// ── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, maxWidth = 560, onKeyDown }) {
  const ref = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    ref.current?.focus()
    const handleKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      prev?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        className="modal-box"
        style={{ maxWidth }}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close" tabIndex={0}>
            <Icon.X style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', style, onClick, ...rest }) {
  return (
    <div className={`card ${className}`} style={style} onClick={onClick} {...rest}>
      {children}
    </div>
  )
}

// ── Badge ───────────────────────────────────────────────────────────────────
export function Badge({ color = 'slate', children }) {
  return <span className={`badge badge-${color}`}>{children}</span>
}

// ── Alert ───────────────────────────────────────────────────────────────────
export function Alert({ type = 'error', children }) {
  const icons = { error: Icon.Alert, success: Icon.Check, info: Icon.Info, warning: Icon.Alert }
  const Ico = icons[type] || Icon.Info
  return (
    <div className={`alert alert-${type}`}>
      <Ico style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
export function Empty({ message = 'No records found', hint }) {
  return (
    <div className="empty-state">
      <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x={3} y={3} width={18} height={18} rx={3}/>
        <path d="M9 9h6M9 12h6M9 15h4"/>
      </svg>
      <p>{message}</p>
      {hint && <small>{hint}</small>}
    </div>
  )
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} />
}

// ── PageHeader ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}

// ── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="stat-card" style={{ borderTop: accent ? `3px solid ${accent}` : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <p className="stat-label">{label}</p>
        {icon && (
          <div style={{ width: 34, height: 34, borderRadius: 8, background: accent ? accent + '18' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent || '#64748b' }}>
            {icon}
          </div>
        )}
      </div>
      <p className="stat-value">{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  )
}

// ── Kbd shortcut hint ────────────────────────────────────────────────────────
export function Kbd({ children }) {
  return <span className="kbd">{children}</span>
}

// ── Confirm dialog ───────────────────────────────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title = 'Confirm', message, danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={400}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>
            {danger ? 'Delete' : 'Confirm'}
          </Btn>
        </>
      }
    >
      <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>{message}</p>
    </Modal>
  )
}

// ── Table wrapper ────────────────────────────────────────────────────────────
export function Table({ children, className = '' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className={`db-table ${className}`}>{children}</table>
    </div>
  )
}

// ── FormGrid: responsive 2-col grid ─────────────────────────────────────────
export function FormGrid({ cols = 2, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '14px 16px' }}>
      {children}
    </div>
  )
}

// ── Divider with label ────────────────────────────────────────────────────────
export function SectionLabel({ children }) {
  return (
    <div className="section-divider">
      <span>{children}</span>
      <span style={{ flex: 1, height: 1, background: '#e2e8f0', display: 'block' }} />
    </div>
  )
}

// ── Searchable Combobox ────────────────────────────────────────────────────────
export function Combobox({ options, value, onSelect, placeholder, autoFocus, inputId, style }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef(null)

  const selected = options.find(o => o.value === value)
  const displayValue = (open && query) ? query : (selected?.label || '')
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const updatePos = useRef(() => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  })

  useEffect(() => {
    if (!open) return
    const fn = updatePos.current
    window.addEventListener('scroll', fn, true)
    window.addEventListener('resize', fn)
    return () => {
      window.removeEventListener('scroll', fn, true)
      window.removeEventListener('resize', fn)
    }
  }, [open])

  const pick = (opt) => {
    onSelect(opt.value)
    setQuery('')
    setOpen(false)
    setHighlight(-1)
  }

  const onKeyDown = (e) => {
    if (!open && e.key !== 'Escape') { updatePos.current(); setOpen(true); setHighlight(-1); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(highlight + 1, filtered.length - 1)
      setHighlight(next)
      document.getElementById('cb-opt-' + next)?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(highlight - 1, 0)
      setHighlight(prev)
      document.getElementById('cb-opt-' + prev)?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = highlight >= 0 ? highlight : 0
      if (filtered[idx]) pick(filtered[idx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div style={style}>
      <input
        ref={inputRef}
        type="text"
        id={inputId}
        autoFocus={autoFocus}
        value={displayValue}
        placeholder={placeholder}
        onChange={e => {
          const v = e.target.value
          setQuery(v); updatePos.current(); setOpen(true); setHighlight(-1)
          if (v === '' && value) onSelect('')
        }}
        onFocus={() => { updatePos.current(); setOpen(true); setQuery('') }}
        onBlur={() => setTimeout(() => { setOpen(false); setQuery('') }, 160)}
        onKeyDown={onKeyDown}
        className="db-input"
      />
      {open && filtered.length > 0 && createPortal(
        <div
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 208, overflowY: 'auto' }}
        >
          {filtered.map((opt, i) => (
            <div
              key={opt.value}
              id={'cb-opt-' + i}
              onMouseDown={(e) => { e.preventDefault(); pick(opt) }}
              style={{
                padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                background: i === highlight ? '#eff6ff' : 'transparent',
                color: i === highlight ? '#1d4ed8' : '#334155',
                fontWeight: i === highlight ? 500 : 400,
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.getElementById('root')
      )}
    </div>
  )
}
