import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import { Icon } from './ui'

const NAV = [
  { label: 'Dashboard', path: '/dashboard', key: 'dashboard', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={3} width={7} height={7}/><rect x={14} y={3} width={7} height={7}/><rect x={14} y={14} width={7} height={7}/><rect x={3} y={14} width={7} height={7}/>
    </svg>
  )},
  { section: 'Master Data' },
  { label: 'Products', path: '/products', key: 'products', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  )},
  { label: 'Stocks', path: '/stocks', key: 'stocks', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4A2 2 0 0 1 2 16.76V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"/>
      <polyline points="2.32 6.16 12 11 21.68 6.16"/><line x1={12} y1={22.76} x2={12} y2={11}/>
    </svg>
  )},
  { label: 'Vendors', path: '/vendors', key: 'vendors', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { label: 'Customers', path: '/customers', key: 'customers', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx={9} cy={7} r={4}/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )},
  { label: 'Employees', path: '/employees', key: 'employees', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx={12} cy={7} r={4}/>
    </svg>
  )},
  { section: 'Transactions' },
  { label: 'Purchases', path: '/purchases', key: 'purchases', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1={3} y1={6} x2={21} y2={6}/><path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  )},
  { label: 'Purchase Returns', path: '/purchase-returns', key: 'purchase_returns', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
    </svg>
  )},
  { label: 'POS', path: '/pos', key: 'pos', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={2} y={3} width={20} height={14} rx={2}/><line x1={8} y1={21} x2={16} y2={21}/><line x1={12} y1={17} x2={12} y2={21}/>
    </svg>
  )},
  { label: 'Sale Invoices', path: '/sales', key: 'sales', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1={16} y1={13} x2={8} y2={13}/><line x1={16} y1={17} x2={8} y2={17}/><polyline points="10 9 9 9 8 9"/>
    </svg>
  )},
  { label: 'Sale Returns', path: '/sale-returns', key: 'sale_returns', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>
    </svg>
  )},
  { label: 'OGP / Delivery', path: '/ogp', key: 'ogp', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={1} y={3} width={15} height={13}/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx={5.5} cy={18.5} r={2.5}/><circle cx={18.5} cy={18.5} r={2.5}/>
    </svg>
  )},
  { section: 'Accounting' },
  { label: 'Receipts', path: '/receipts', key: 'receipts', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x={6} y={14} width={12} height={8}/>
    </svg>
  )},
  { label: 'Vendor Payments', path: '/vendor-payments', key: 'vendor_payments', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={1} y={4} width={22} height={16} rx={2} ry={2}/><line x1={1} y1={10} x2={23} y2={10}/>
    </svg>
  )},
  { label: 'Expenses', path: '/expenses', key: 'expenses', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M15 9.354a4 4 0 1 0 0 5.292"/><line x1={12} y1={6} x2={12} y2={8}/><line x1={12} y1={16} x2={12} y2={18}/>
    </svg>
  )},
  { label: 'Customer Ledger', path: '/customer-ledger', key: 'customer_ledger', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  )},
  { label: 'Vendor Ledger', path: '/vendor-ledger', key: 'vendor_ledger', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  )},
  { label: 'Cash & Bank', path: '/cash-bank', key: 'cash_bank', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={12} y1={1} x2={12} y2={23}/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )},
  { label: 'Trial Balance', path: '/trial-balance', key: 'trial_balance', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={12} y1={3} x2={12} y2={21}/><path d="M3 9h4.5a4.5 4.5 0 1 1 0 9H3"/><path d="M21 9h-4.5a4.5 4.5 0 1 0 0 9H21"/>
    </svg>
  )},
  { section: 'Settings' },
  { label: 'Company Info', path: '/company-settings', key: 'company_settings', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={3}/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )},
  { label: 'User Management', path: '/user-management', key: 'user_management', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx={9} cy={7} r={4}/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )},
  { label: 'Backup & Restore', path: '/backup', key: 'backup', Icon: ({ ...p }) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )},
]

function Sidebar({ setIsAuthenticated }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isAdmin = user.role === 'admin'
  const perms = user.permissions || {}
  const navRef = useRef(null)

  const canSee = (item) => {
    if (item.section || item.key === 'dashboard' || item.key === 'company_settings' || item.key === 'backup') return true;
    if (isAdmin) return true;
    // Missing key = allowed; only explicitly false = denied
    return perms[item.key] !== false;
  }

  const visibleItems = NAV.reduce((acc, item, idx) => {
    if (item.section) {
      const hasChild = NAV.slice(idx + 1).some(n => !n.section && canSee(n))
      if (hasChild) acc.push(item)
    } else if (canSee(item)) {
      acc.push(item)
    }
    return acc
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsAuthenticated(false)
    navigate('/login')
  }

  return (
    <aside
      style={{
        position: 'fixed', left: 0, top: 0, height: '100vh', width: 240,
        background: '#0f172a',
        display: 'flex', flexDirection: 'column',
        zIndex: 40,
        borderRight: '1px solid #1e293b',
      }}
    >
      {/* Logo */}
      <div style={{
        padding: '18px 20px',
        borderBottom: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4A2 2 0 0 1 2 16.76V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"/>
              </svg>
            </div>
            DistriBooks
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2, marginLeft: 36 }}>ERP System</div>
        </div>
        <button
          onClick={() => window.location.reload()}
          title="Hard Refresh (F5)"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#475569', padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
          onMouseLeave={e => e.currentTarget.style.color = '#475569'}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav ref={navRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {visibleItems.map((item, idx) => {
          if (item.section) {
            return (
              <div key={idx} style={{ padding: '10px 16px 4px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#334155' }}>
                  {item.section}
                </span>
              </div>
            )
          }

          const active = location.pathname === item.path
          const Ico = item.Icon

          return (
            <Link
              key={item.path}
              to={item.path}
              className="sidebar-link"
              style={{
                display: 'flex', alignItems: 'center',
                gap: 10,
                padding: '8px 16px',
                justifyContent: 'flex-start',
                margin: '1px 8px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 13.5,
                fontWeight: active ? 600 : 400,
                color: active ? '#fff' : '#94a3b8',
                background: active ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent',
                transition: 'all 0.15s',
                boxShadow: active ? '0 2px 8px rgb(99 102 241 / 0.35)' : 'none',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#1e293b'; if (!active) e.currentTarget.style.color = '#e2e8f0' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; if (!active) e.currentTarget.style.color = '#94a3b8' }}
            >
              {Ico && <Ico style={{ width: 16, height: 16, flexShrink: 0 }} />}
              <span style={{ truncate: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.label}</span>
              {active && (
                <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
              )}
            </Link>
          )
        })}

      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #1e293b', flexShrink: 0 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.fullName || user.username}
              </div>
              {isAdmin && (
                <div style={{ fontSize: 10.5, color: '#818cf8', fontWeight: 600 }}>Administrator</div>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #1e293b',
            background: 'transparent',
            color: '#64748b',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#7f1d1d'; e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.borderColor = '#7f1d1d' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#1e293b' }}
        >
          <Icon.LogOut style={{ width: 15, height: 15, flexShrink: 0 }} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
