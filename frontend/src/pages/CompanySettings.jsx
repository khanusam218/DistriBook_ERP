import { useState, useEffect } from 'react'
import api from '../api'
import { loadCompanyInfo } from '../utils/companyInfo'
import { isValidEmail, isValidPhone } from '../utils/validation'
import {
  PageHeader, Card, Input, Btn, Alert, Spinner, FormGrid, SectionLabel, Icon
} from '../components/ui'

const empty = {
  name: '', tagline: '', address: '', city: '',
  phone: '', mobile: '', email: '', website: '',
  ntn: '', strn: '',
}

const emptyDeletePwForm = { currentPassword: '', newPassword: '', confirmPassword: '' }

export default function CompanySettings() {
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  const [deletePwSet, setDeletePwSet] = useState(false)
  const [deletePwForm, setDeletePwForm] = useState(emptyDeletePwForm)
  const [deletePwSaving, setDeletePwSaving] = useState(false)
  const [deletePwMsg, setDeletePwMsg] = useState('')
  const [deletePwMsgType, setDeletePwMsgType] = useState('success')

  useEffect(() => {
    api.get('/company').then(r => {
      setForm({ ...empty, ...r.data })
      setLoading(false)
    }).catch(() => setLoading(false))
    loadDeletePwStatus()
  }, [])

  const loadDeletePwStatus = () => {
    api.get('/company/delete-password-status').then(r => setDeletePwSet(!!r.data.isSet)).catch(() => {})
  }

  const setDeletePw = (k, v) => setDeletePwForm(f => ({ ...f, [k]: v }))

  const saveDeletePassword = async () => {
    setDeletePwMsg('')
    if (!deletePwForm.currentPassword) { setDeletePwMsg('Enter your current login password.'); setDeletePwMsgType('error'); return }
    if (deletePwForm.newPassword.length < 4) { setDeletePwMsg('Delete password must be at least 4 characters.'); setDeletePwMsgType('error'); return }
    if (deletePwForm.newPassword !== deletePwForm.confirmPassword) { setDeletePwMsg('Passwords do not match.'); setDeletePwMsgType('error'); return }
    setDeletePwSaving(true)
    try {
      await api.post('/company/delete-password', {
        currentPassword: deletePwForm.currentPassword,
        newPassword: deletePwForm.newPassword,
      })
      setDeletePwForm(emptyDeletePwForm)
      setDeletePwSet(true)
      setDeletePwMsg('Delete confirmation password saved.')
      setDeletePwMsgType('success')
    } catch (e) {
      setDeletePwMsg(e.response?.data?.error || 'Failed to save delete password')
      setDeletePwMsgType('error')
    }
    setDeletePwSaving(false)
  }

  const removeDeletePassword = async () => {
    setDeletePwMsg('')
    if (!deletePwForm.currentPassword) { setDeletePwMsg('Enter your current login password to remove it.'); setDeletePwMsgType('error'); return }
    setDeletePwSaving(true)
    try {
      await api.delete('/company/delete-password', { data: { currentPassword: deletePwForm.currentPassword } })
      setDeletePwForm(emptyDeletePwForm)
      setDeletePwSet(false)
      setDeletePwMsg('Delete confirmation password removed. Your login password will be used instead.')
      setDeletePwMsgType('success')
    } catch (e) {
      setDeletePwMsg(e.response?.data?.error || 'Failed to remove delete password')
      setDeletePwMsgType('error')
    }
    setDeletePwSaving(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!isValidPhone(form.phone)) { setMsg('Phone number is invalid. Use a format like +92-42-1234567.'); setMsgType('error'); return }
    if (!isValidPhone(form.mobile)) { setMsg('Mobile number is invalid. Use a format like 0300-1234567.'); setMsgType('error'); return }
    if (!isValidEmail(form.email)) { setMsg('Email address is invalid.'); setMsgType('error'); return }
    setSaving(true)
    setMsg('')
    try {
      await api.put('/company', form)
      await loadCompanyInfo()
      setMsg('Company information saved successfully.')
      setMsgType('success')
    } catch (e) {
      setMsg(e.response?.data?.error || 'Save failed')
      setMsgType('error')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
  }

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
          <Spinner size={28} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860 }} onKeyDown={handleKeyDown}>
      <PageHeader
        title="Company Information"
        subtitle="This information appears on all printed documents — invoices, gate passes, receipts, ledgers."
        actions={
          <Btn
            variant="primary"
            icon={<Icon.Save style={{ width: 14, height: 14 }} />}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Btn>
        }
      />

      {msg && (
        <div style={{ marginBottom: 20 }}>
          <Alert type={msgType}>{msg}</Alert>
        </div>
      )}

      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Business Identity</SectionLabel>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Company / Business Name"
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Your Company Name"
          />
          <Input
            label="Tagline / Slogan"
            value={form.tagline}
            onChange={e => set('tagline', e.target.value)}
            placeholder="e.g. Wholesale Distributors of FMCG Products"
          />
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Contact Details</SectionLabel>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Address"
            value={form.address}
            onChange={e => set('address', e.target.value)}
            placeholder="Street address, area"
          />
          <FormGrid cols={2}>
            <Input
              label="City"
              value={form.city}
              onChange={e => set('city', e.target.value)}
              placeholder="City"
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="+92-42-XXXXXXX"
            />
            <Input
              label="Mobile / WhatsApp"
              value={form.mobile}
              onChange={e => set('mobile', e.target.value)}
              placeholder="+92-3XX-XXXXXXX"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="info@company.com"
            />
            <Input
              label="Website"
              value={form.website}
              onChange={e => set('website', e.target.value)}
              placeholder="www.company.com"
            />
          </FormGrid>
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Tax Registration</SectionLabel>
        <div style={{ marginTop: 16 }}>
          <FormGrid cols={2}>
            <Input
              label="NTN (National Tax Number)"
              value={form.ntn}
              onChange={e => set('ntn', e.target.value)}
              placeholder="XXXXXXX-X"
            />
            <Input
              label="STRN (Sales Tax Reg. No.)"
              value={form.strn}
              onChange={e => set('strn', e.target.value)}
              placeholder="XX-XX-XXXX-XXX-XX"
            />
          </FormGrid>
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Delete Confirmation Password</SectionLabel>
        <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 8, marginBottom: 16, lineHeight: 1.6 }}>
          Set a dedicated password that must be entered to confirm deletions (e.g. Cash &amp; Bank accounts),
          separate from your login password. {deletePwSet
            ? 'A dedicated password is currently set.'
            : 'No dedicated password is set — your login password is used for delete confirmations.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
          <Input
            label="Your Current Login Password"
            required
            type="password"
            value={deletePwForm.currentPassword}
            onChange={e => setDeletePw('currentPassword', e.target.value)}
            placeholder="Required to authorize this change"
          />
          <Input
            label="New Delete Confirmation Password"
            type="password"
            value={deletePwForm.newPassword}
            onChange={e => setDeletePw('newPassword', e.target.value)}
            placeholder="At least 4 characters"
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={deletePwForm.confirmPassword}
            onChange={e => setDeletePw('confirmPassword', e.target.value)}
            placeholder="Re-enter new password"
          />
          {deletePwMsg && <Alert type={deletePwMsgType}>{deletePwMsg}</Alert>}
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="primary" onClick={saveDeletePassword} disabled={deletePwSaving}>
              {deletePwSaving ? 'Saving…' : 'Save Delete Password'}
            </Btn>
            {deletePwSet && (
              <Btn variant="secondary" onClick={removeDeletePassword} disabled={deletePwSaving}>
                Remove
              </Btn>
            )}
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <SectionLabel>Letterhead Preview</SectionLabel>
        <div style={{
          marginTop: 16,
          border: '1.5px dashed #cbd5e1',
          borderRadius: 8,
          padding: '20px 24px',
          textAlign: 'center',
          background: '#fafbfd',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
            {form.name || 'Your Company Name'}
          </div>
          {form.tagline && (
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{form.tagline}</div>
          )}
          {form.address && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
              {form.address}{form.city ? `, ${form.city}` : ''}
            </div>
          )}
          {(form.phone || form.mobile || form.email) && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              {form.phone && <span>Ph: {form.phone}</span>}
              {form.mobile && <span>Mob: {form.mobile}</span>}
              {form.email && <span>{form.email}</span>}
            </div>
          )}
          {(form.ntn || form.strn) && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'flex', justifyContent: 'center', gap: 20 }}>
              {form.ntn && <span>NTN: {form.ntn}</span>}
              {form.strn && <span>STRN: {form.strn}</span>}
            </div>
          )}
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
        {msg && <Alert type={msgType}>{msg}</Alert>}
        <Btn
          variant="primary"
          icon={<Icon.Save style={{ width: 14, height: 14 }} />}
          onClick={save}
          disabled={saving}
          size="lg"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </Btn>
      </div>
    </div>
  )
}
