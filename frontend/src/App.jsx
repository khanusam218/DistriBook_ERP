import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Stocks from './pages/Stocks'
import Customers from './pages/Customers'
import Vendors from './pages/Vendors'
import Purchases from './pages/Purchases'
import PurchaseReturns from './pages/PurchaseReturns'
import Sales from './pages/Sales'
import SaleReturns from './pages/SaleReturns'
import VendorLedger from './pages/VendorLedger'
import CustomerLedger from './pages/CustomerLedger'
import TrialBalance from './pages/TrialBalance'
import Products from './pages/Products'
import POS from './pages/POS'
import OGP from './pages/OGP'
import Receipts from './pages/Receipts'
import VendorPayments from './pages/VendorPayments'
import CashBank from './pages/CashBank'
import Employees from './pages/Employees'
import UserManagement from './pages/UserManagement'
import CompanySettings from './pages/CompanySettings'
import Expenses from './pages/Expenses'
import Backup from './pages/Backup'
import Sidebar from './components/Sidebar'
import { ToastContainer } from './components/Toast'
import { loadCompanyInfo } from './utils/companyInfo'

function AnimatedRoutes({ children }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-enter" style={{ minHeight: '100vh' }}>
      {children}
    </div>
  )
}

function AccessDenied() {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
      <h2 style={{ color: '#0f172a', marginBottom: 8 }}>Access Denied</h2>
      <p>You don't have permission to view this page. Contact your administrator.</p>
    </div>
  )
}

function Guard({ permKey, element, currentUser }) {
  const isAdmin = currentUser?.role === 'admin'
  const perms = currentUser?.permissions || {}
  // Only explicitly granted (true) modules are allowed for non-admins
  const allowed = isAdmin || perms[permKey] === true
  if (allowed) return element
  return <AccessDenied />
}

function AdminOnly({ element, currentUser }) {
  if (currentUser?.role === 'admin') return element
  return <AccessDenied />
}

function AuthenticatedLayout({ currentUser, setIsAuthenticated }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
      <Sidebar setIsAuthenticated={setIsAuthenticated} />
      <div style={{ flex: 1, marginLeft: 240, minHeight: '100vh', minWidth: 0 }}>
        <AnimatedRoutes>
          <Routes>
            <Route path="/dashboard"          element={<Guard permKey="dashboard"        element={<Dashboard />}        currentUser={currentUser} />} />
            <Route path="/stocks"             element={<Guard permKey="stocks"           element={<Stocks />}           currentUser={currentUser} />} />
            <Route path="/customers"          element={<Guard permKey="customers"        element={<Customers />}        currentUser={currentUser} />} />
            <Route path="/vendors"            element={<Guard permKey="vendors"          element={<Vendors />}          currentUser={currentUser} />} />
            <Route path="/purchases"          element={<Guard permKey="purchases"        element={<Purchases />}        currentUser={currentUser} />} />
            <Route path="/purchase-returns"   element={<Guard permKey="purchase_returns" element={<PurchaseReturns />}  currentUser={currentUser} />} />
            <Route path="/products"           element={<Guard permKey="products"         element={<Products />}         currentUser={currentUser} />} />
            <Route path="/pos"                element={<Guard permKey="pos"              element={<POS />}              currentUser={currentUser} />} />
            <Route path="/sales"              element={<Guard permKey="sales"            element={<Sales />}            currentUser={currentUser} />} />
            <Route path="/ogp"                element={<Guard permKey="ogp"              element={<OGP />}              currentUser={currentUser} />} />
            <Route path="/sale-returns"       element={<Guard permKey="sale_returns"     element={<SaleReturns />}      currentUser={currentUser} />} />
            <Route path="/vendor-ledger"      element={<Guard permKey="vendor_ledger"    element={<VendorLedger />}     currentUser={currentUser} />} />
            <Route path="/customer-ledger"    element={<Guard permKey="customer_ledger"  element={<CustomerLedger />}   currentUser={currentUser} />} />
            <Route path="/receipts"           element={<Guard permKey="receipts"         element={<Receipts />}         currentUser={currentUser} />} />
            <Route path="/vendor-payments"    element={<Guard permKey="vendor_payments"  element={<VendorPayments />}   currentUser={currentUser} />} />
            <Route path="/expenses"           element={<Guard permKey="expenses"         element={<Expenses />}         currentUser={currentUser} />} />
            <Route path="/cash-bank"          element={<Guard permKey="cash_bank"        element={<CashBank />}         currentUser={currentUser} />} />
            <Route path="/employees"          element={<Guard permKey="employees"        element={<Employees />}        currentUser={currentUser} />} />
            <Route path="/trial-balance"      element={<Guard permKey="trial_balance"    element={<TrialBalance />}     currentUser={currentUser} />} />
            <Route path="/user-management"    element={<AdminOnly element={<UserManagement />}   currentUser={currentUser} />} />
            <Route path="/company-settings"   element={<AdminOnly element={<CompanySettings />}   currentUser={currentUser} />} />
            <Route path="/backup"             element={<AdminOnly element={<Backup />}            currentUser={currentUser} />} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </AnimatedRoutes>
      </div>
    </div>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    fetch('/api/auth/verify', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.authenticated && data.user) {
          localStorage.setItem('user', JSON.stringify(data.user))
          setCurrentUser(data.user)
          setIsAuthenticated(true)
          // Load company info into localStorage so print headers reflect it
          loadCompanyInfo()
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        }
      })
      .catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setIsAuthenticated(false)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>

  return (
    <Router>
      <ToastContainer />
      <Routes>
        <Route
          path="/login"
          element={!isAuthenticated ? <Login setIsAuthenticated={setIsAuthenticated} setCurrentUser={setCurrentUser} /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/*"
          element={
            isAuthenticated
              ? <AuthenticatedLayout currentUser={currentUser} setIsAuthenticated={setIsAuthenticated} />
              : <Navigate to="/login" />
          }
        />
      </Routes>
    </Router>
  )
}

export default App
