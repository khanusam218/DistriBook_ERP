import { useState, useEffect } from 'react'
import api from '../api'
import { toast } from '../components/Toast'
import { isValidEmail } from '../utils/validation'
import {
  PageHeader, Card, Input, Select, Btn, Badge, Alert, Empty, Spinner, Table, Modal, SectionLabel, Icon
} from '../components/ui'

const ALL_PERMISSIONS = [
  { key: 'dashboard',        label: 'Dashboard',          icon: '📊' },
  { key: 'stocks',           label: 'Stocks',             icon: '📦' },
  { key: 'customers',        label: 'Customers',          icon: '👥' },
  { key: 'vendors',          label: 'Vendors',            icon: '🏭' },
  { key: 'products',         label: 'Products',           icon: '🗂️' },
  { key: 'purchases',        label: 'Purchases',          icon: '📥' },
  { key: 'purchase_returns', label: 'Purchase Returns',   icon: '↩️' },
  { key: 'pos',              label: 'POS',                icon: '🏪' },
  { key: 'sales',            label: 'Sales',              icon: '📤' },
  { key: 'ogp',              label: 'OGP',                icon: '📋' },
  { key: 'sale_returns',     label: 'Sale Returns',       icon: '↪️' },
  { key: 'vendor_ledger',    label: 'Vendor Ledger',      icon: '📑' },
  { key: 'customer_ledger',  label: 'Customer Ledger',    icon: '📋' },
  { key: 'receipts',         label: 'Receipts',           icon: '🧾' },
  { key: 'vendor_payments',  label: 'Vendor Payments',    icon: '💸' },
  { key: 'cash_bank',        label: 'Cash & Bank',        icon: '🏦' },
  { key: 'employees',        label: 'Employees',          icon: '👤' },
  { key: 'trial_balance',    label: 'Trial Balance',      icon: '⚖️' },
]

const emptyForm = () => ({
  username: '', fullName: '', email: '', password: '',
  role: 'user', isActive: true,
  permissions: Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, false])),
})

function Toggle({ checked, onChange, label, icon, disabled }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      borderRadius: 8,
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: checked ? '#eff6ff' : 'transparent',
      transition: 'background 0.12s',
      opacity: disabled ? 0.4 : 1,
      userSelect: 'none',
    }}>
      <div
        onClick={disabled ? undefined : onChange}
        style={{
          position: 'relative',
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? '#2563eb' : '#cbd5e1',
          transition: 'background 0.15s',
          flexShrink: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          background: '#fff',
          borderRadius: '50%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.15s',
        }} />
      </div>
      <span style={{ fontSize: 13 }}>{icon} {label}</span>
    </label>
  )
}

function UserModal({ user, onClose, onSaved }) {
  const isNew = !user
  const [form, setForm] = useState(() => {
    if (isNew) return emptyForm()
    return {
      username: user.username || '',
      fullName: user.full_name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'user',
      isActive: user.is_active !== 0,
      permissions: {
        ...Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, false])),
        ...(user.permissions || {}),
      },
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const setPermission = (key, value) =>
    setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: value } }))

  const toggleAll = (on) =>
    setForm(f => ({
      ...f,
      permissions: Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, on])),
    }))

  const handleSave = async () => {
    if (!form.username.trim()) return setError('Username is required')
    if (isNew && !form.password.trim()) return setError('Password is required for new users')
    if (!isValidEmail(form.email)) return setError('Email address is invalid.')

    setSaving(true)
    setError('')
    try {
      const payload = {
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim() || `${form.username.trim()}@distribooks.local`,
        role: form.role,
        isActive: form.isActive,
        permissions: form.role === 'admin' ? {} : form.permissions,
        ...(form.password.trim() ? { password: form.password.trim() } : {}),
      }
      if (isNew) {
        await api.post('/auth/users', payload)
      } else {
        await api.put(`/auth/users/${user.id}`, payload)
      }
      onSaved()
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error saving user')
    }
    setSaving(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSave()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Create New User' : `Edit — ${user.username}`}
      maxWidth={640}
      onKeyDown={handleKeyDown}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create User' : 'Save Changes'}
          </Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SectionLabel>Account Details</SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input
            label="Username"
            required
            value={form.username}
            onChange={e => set('username', e.target.value)}
            placeholder="e.g. ali.ahmad"
            autoFocus
          />
          <Input
            label="Full Name"
            value={form.fullName}
            onChange={e => set('fullName', e.target.value)}
            placeholder="e.g. Ali Ahmad"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="ali@company.com"
          />
          <Input
            label={isNew ? 'Password' : 'New Password (leave blank to keep)'}
            required={isNew}
            type="password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder={isNew ? 'Set a password' : 'Enter to change password'}
          />
        </div>

        <SectionLabel>Role & Status</SectionLabel>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Role
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['admin', 'user'].map(r => (
                <button
                  key={r}
                  onClick={() => set('role', r)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: '1.5px solid',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    borderColor: form.role === r ? (r === 'admin' ? '#7c3aed' : '#2563eb') : '#e2e8f0',
                    background: form.role === r ? (r === 'admin' ? '#7c3aed' : '#2563eb') : '#fff',
                    color: form.role === r ? '#fff' : '#64748b',
                  }}
                >
                  {r === 'admin' ? '👑 Admin' : '👤 User'}
                </button>
              ))}
            </div>
            {form.role === 'admin' && (
              <p style={{ fontSize: 12, color: '#7c3aed', marginTop: 6, fontWeight: 500 }}>
                Admin has access to all features automatically
              </p>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Status
            </div>
            <button
              onClick={() => set('isActive', !form.isActive)}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: '1.5px solid',
                cursor: 'pointer',
                transition: 'all 0.12s',
                borderColor: form.isActive ? '#059669' : '#dc2626',
                background: form.isActive ? '#059669' : '#fef2f2',
                color: form.isActive ? '#fff' : '#dc2626',
                whiteSpace: 'nowrap',
              }}
            >
              {form.isActive ? '✓ Active' : '✗ Inactive'}
            </button>
          </div>
        </div>

        {form.role === 'user' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel>Module Access</SectionLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="primary" size="sm" onClick={() => toggleAll(true)}>Enable All</Btn>
                <Btn variant="secondary" size="sm" onClick={() => toggleAll(false)}>Disable All</Btn>
              </div>
            </div>

            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: 12,
              background: '#f8fafc',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
            }}>
              {ALL_PERMISSIONS.map(p => (
                <Toggle
                  key={p.key}
                  checked={!!form.permissions[p.key]}
                  onChange={() => setPermission(p.key, !form.permissions[p.key])}
                  label={p.label}
                  icon={p.icon}
                />
              ))}
            </div>
          </>
        )}

        {error && <Alert type="error">{error}</Alert>}
      </div>
    </Modal>
  )
}

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')

  const load = () => {
    setLoading(true)
    api.get('/auth/users')
      .then(r => { setUsers(r.data); setLoading(false) })
      .catch(e => { setError(e.response?.data?.error || 'Error loading users'); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) return
    try {
      await api.delete(`/auth/users/${user.id}`)
      load()
    } catch (e) {
      toast(e.response?.data?.error || 'Error deleting user')
    }
  }

  const handleToggleActive = async (user) => {
    try {
      await api.put(`/auth/users/${user.id}`, { isActive: !user.is_active })
      load()
    } catch (e) {
      toast(e.response?.data?.error || 'Error updating user')
    }
  }

  const enabledCount = (perms) => {
    if (!perms) return 0
    return Object.values(perms).filter(Boolean).length
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <PageHeader
        title="User Management"
        subtitle="Create users and control their module access"
        actions={
          <Btn
            variant="primary"
            icon={<Icon.Plus style={{ width: 14, height: 14 }} />}
            onClick={() => setModal('new')}
          >
            Create User
          </Btn>
        }
      />

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="error">{error}</Alert>
        </div>
      )}

      <Card>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner size={24} />
          </div>
        ) : users.length === 0 ? (
          <Empty message="No users found" hint="Create the first user to get started" />
        ) : (
          <Table>
            <thead>
              <tr>
                {['User', 'Role', 'Module Access', 'Status', 'Actions'].map(col => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const isMe = user.id === currentUser.id
                const perms = user.permissions || {}
                const count = user.role === 'admin' ? ALL_PERMISSIONS.length : enabledCount(perms)
                return (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {user.full_name || user.username}
                        {isMe && <Badge color="blue">You</Badge>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>@{user.username}</div>
                    </td>
                    <td>
                      <Badge color={user.role === 'admin' ? 'purple' : 'slate'}>
                        {user.role === 'admin' ? '👑 Admin' : '👤 User'}
                      </Badge>
                    </td>
                    <td>
                      {user.role === 'admin' ? (
                        <span style={{ fontSize: 13, color: '#7c3aed', fontWeight: 500 }}>All modules</span>
                      ) : (
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: count > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                            {count} / {ALL_PERMISSIONS.length}
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, maxWidth: 280 }}>
                            {ALL_PERMISSIONS.filter(p => perms[p.key]).slice(0, 5).map(p => (
                              <Badge key={p.key} color="blue">{p.label}</Badge>
                            ))}
                            {count > 5 && (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{count - 5} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => !isMe && handleToggleActive(user)}
                        disabled={isMe}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          border: 'none',
                          cursor: isMe ? 'not-allowed' : 'pointer',
                          opacity: isMe ? 0.6 : 1,
                          background: user.is_active ? '#dcfce7' : '#fee2e2',
                          color: user.is_active ? '#15803d' : '#dc2626',
                          transition: 'all 0.12s',
                        }}
                      >
                        {user.is_active ? '● Active' : '○ Inactive'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn
                          variant="secondary"
                          size="sm"
                          icon={<Icon.Edit style={{ width: 12, height: 12 }} />}
                          onClick={() => setModal(user)}
                        >
                          Edit
                        </Btn>
                        {!isMe && (
                          <Btn
                            variant="danger"
                            size="sm"
                            icon={<Icon.Trash style={{ width: 12, height: 12 }} />}
                            onClick={() => handleDelete(user)}
                          >
                            Delete
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {modal && (
        <UserModal
          user={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
