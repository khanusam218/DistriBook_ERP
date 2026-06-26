import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

function Login({ setIsAuthenticated }) {
  const [mode, setMode] = useState('login')
  const navigate = useNavigate()

  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const [signupBusinessName, setSignupBusinessName] = useState('')
  const [signupFullName, setSignupFullName] = useState('')
  const [signupUsername, setSignupUsername] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirm, setSignupConfirm] = useState('')
  const [signupError, setSignupError] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const res = await api.post('/auth/login', { username: loginUsername, password: loginPassword })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      setIsAuthenticated(true)
      navigate('/dashboard')
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Invalid username or password')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setSignupError('')
    if (!signupBusinessName.trim()) return setSignupError('Business name is required')
    if (!signupUsername.trim()) return setSignupError('Username is required')
    if (signupPassword.length < 6) return setSignupError('Password must be at least 6 characters')
    if (signupPassword !== signupConfirm) return setSignupError('Passwords do not match')
    setSignupLoading(true)
    try {
      const res = await api.post('/auth/register', {
        businessName: signupBusinessName.trim(),
        fullName: signupFullName.trim(),
        username: signupUsername.trim(),
        password: signupPassword,
      })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      setIsAuthenticated(true)
      navigate('/dashboard')
    } catch (err) {
      setSignupError(err.response?.data?.error || 'Registration failed. Username may already exist.')
    } finally {
      setSignupLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decorations */}
      <div style={{ position: 'absolute', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '40%', left: '10%', width: 2, height: 200, background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.3), transparent)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '20%', right: '15%', width: 2, height: 150, background: 'linear-gradient(to bottom, transparent, rgba(139,92,246,0.2), transparent)', pointerEvents: 'none' }} />

      {/* Left panel — branding */}
      <div style={{
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        display: window.innerWidth < 900 ? 'none' : 'flex',
      }}>
        <div style={{ maxWidth: 440 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
            <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4A2 2 0 0 1 2 16.76V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"/>
                <polyline points="2.32 6.16 12 11 21.68 6.16"/><line x1={12} y1={22.76} x2={12} y2={11}/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>DistriBooks</div>
              <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 500 }}>Business ERP System</div>
            </div>
          </div>

          <h1 style={{ fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: '-1px', marginBottom: 16 }}>
            Manage your<br />
            <span style={{ background: 'linear-gradient(135deg, #818cf8, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              distribution business
            </span>
          </h1>
          <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.7, marginBottom: 40 }}>
            Complete ERP solution for distributors — purchases, sales, inventory, gate passes, and accounting all in one place.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: '📦', label: 'Inventory & Stock Management' },
              { icon: '🚚', label: 'Delivery Orders & Gate Passes' },
              { icon: '📊', label: 'Accounting & Ledgers' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, background: 'rgba(99,102,241,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                  {f.icon}
                </div>
                <span style={{ color: '#cbd5e1', fontSize: 14 }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Card */}
          <div style={{
            background: 'rgba(255,255,255,0.97)',
            borderRadius: 20,
            boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
              {[['login', 'Sign In'], ['signup', 'Create Account']].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setMode(key); setLoginError(''); setSignupError('') }}
                  style={{
                    flex: 1, padding: '14px 0',
                    fontSize: 13.5, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: mode === key ? '#fff' : '#f8fafc',
                    color: mode === key ? '#4f46e5' : '#94a3b8',
                    borderBottom: mode === key ? '2px solid #4f46e5' : '2px solid transparent',
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ padding: '28px 32px 32px' }}>
              {/* LOGIN */}
              {mode === 'login' && (
                <form onSubmit={handleLogin}>
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Welcome back</h2>
                    <p style={{ fontSize: 13, color: '#64748b' }}>Sign in to your DistriBooks account</p>
                  </div>

                  {loginError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx={12} cy={12} r={10}/><line x1={12} y1={8} x2={12} y2={12}/><line x1={12} y1={16} x2={12.01} y2={16}/></svg>
                      {loginError}
                    </div>
                  )}

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Username</label>
                    <input
                      type="text"
                      className="db-input"
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      autoFocus
                      autoComplete="username"
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPass ? 'text' : 'password'}
                        className="db-input"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        autoComplete="current-password"
                        style={{ paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(s => !s)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex' }}
                      >
                        {showPass
                          ? <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1={1} y1={1} x2={23} y2={23}/></svg>
                          : <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx={12} cy={12} r={3}/></svg>
                        }
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    style={{
                      width: '100%', padding: '11px 0',
                      background: loginLoading ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#fff', border: 'none', borderRadius: 10,
                      fontSize: 14, fontWeight: 700, cursor: loginLoading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
                      transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                  >
                    {loginLoading && <span className="spinner" style={{ width: 15, height: 15, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />}
                    {loginLoading ? 'Signing in…' : 'Sign In'}
                  </button>

                  <p style={{ textAlign: 'center', fontSize: 12.5, color: '#94a3b8', marginTop: 16 }}>
                    Don't have an account?{' '}
                    <button type="button" onClick={() => setMode('signup')}
                      style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>
                      Create one free
                    </button>
                  </p>
                </form>
              )}

              {/* SIGNUP */}
              {mode === 'signup' && (
                <form onSubmit={handleSignup}>
                  <div style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Create your account</h2>
                    <p style={{ fontSize: 13, color: '#64748b' }}>Set up DistriBooks for your business</p>
                  </div>

                  {signupError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx={12} cy={12} r={10}/><line x1={12} y1={8} x2={12} y2={12}/><line x1={12} y1={16} x2={12.01} y2={16}/></svg>
                      {signupError}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Business Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" className="db-input" value={signupBusinessName} onChange={e => setSignupBusinessName(e.target.value)} placeholder="e.g. Al-Fatah Traders" required autoFocus />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Your Full Name</label>
                      <input type="text" className="db-input" value={signupFullName} onChange={e => setSignupFullName(e.target.value)} placeholder="Optional" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Username <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" className="db-input" value={signupUsername} onChange={e => setSignupUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} placeholder="Choose a username" required autoComplete="username" style={{ fontFamily: 'monospace' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Password <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="password" className="db-input" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} placeholder="Min. 6 chars" required />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Confirm <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="password" className="db-input" value={signupConfirm} onChange={e => setSignupConfirm(e.target.value)} placeholder="Repeat" required />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={signupLoading}
                    style={{
                      width: '100%', padding: '11px 0', marginTop: 20,
                      background: signupLoading ? '#6ee7b7' : 'linear-gradient(135deg, #059669, #047857)',
                      color: '#fff', border: 'none', borderRadius: 10,
                      fontSize: 14, fontWeight: 700, cursor: signupLoading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
                      transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                  >
                    {signupLoading && <span className="spinner" style={{ width: 15, height: 15, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />}
                    {signupLoading ? 'Creating account…' : 'Create Account'}
                  </button>

                  <p style={{ textAlign: 'center', fontSize: 12.5, color: '#94a3b8', marginTop: 14 }}>
                    Already have an account?{' '}
                    <button type="button" onClick={() => setMode('login')}
                      style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>
                      Sign in
                    </button>
                  </p>
                </form>
              )}
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(148,163,184,0.6)', marginTop: 20 }}>
            DistriBooks © {new Date().getFullYear()} — Offline ERP System
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
