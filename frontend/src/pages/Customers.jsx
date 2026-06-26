import { useState, useEffect } from 'react'
import api from '../api'
import { exportPDF, exportExcel, printTable, ExportBar } from '../utils/exportUtils'
import { isValidEmail, isValidPhone } from '../utils/validation'
import {
  Btn, Input, NumInput, Select, SearchBar, Modal, Card, Badge, Empty,
  ConfirmModal, Table, FormGrid, PageHeader, Icon, Spinner,
} from '../components/ui'

const empty = { customerCode: '', shopName: '', customerName: '', customerType: 'CUSTOMER', address: '', email: '', phone: '', openingBalance: '' }

const COLS = [
  { header: 'Code', accessor: r => r.customer_code },
  { header: 'Shop Name', accessor: r => r.shop_name },
  { header: 'Customer Name', accessor: r => r.customer_name },
  { header: 'Type', accessor: r => r.customer_type === 'WHOLESALER' ? 'Wholesaler' : 'Retail' },
  { header: 'Phone', accessor: r => r.phone },
  { header: 'Email', accessor: r => r.email },
  { header: 'Address', accessor: r => r.address },
  { header: 'Opening Balance', accessor: r => `Rs. ${Number(r.opening_balance).toFixed(2)}` },
]

function CustomerModal({ title, form, onChange, onSave, onClose, saving, isAdd }) {
  const [errors, setErrors] = useState({})
  const handleSave = () => {
    const errs = {}
    if (!isValidPhone(form.phone)) errs.phone = 'Invalid phone number (e.g. 0300-1234567)'
    if (!isValidEmail(form.email)) errs.email = 'Invalid email address'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    onSave()
  }
  return (
    <Modal open onClose={onClose} title={title}
      onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Btn>
        </>
      }
    >
      <FormGrid cols={2}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Customer Code" value={form.customerCode} readOnly={isAdd}
            onChange={e => onChange('customerCode', e.target.value)}
            placeholder={isAdd ? 'Auto-generated' : ''}
            autoFocus={isAdd}
            style={isAdd ? { background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' } : {}} />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Shop Name" required value={form.shopName}
            onChange={e => onChange('shopName', e.target.value)}
            placeholder="Enter shop name"
            autoFocus={!isAdd} />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Customer Name" required value={form.customerName}
            onChange={e => onChange('customerName', e.target.value)}
            placeholder="Enter customer name" />
        </div>

        <Input label="Phone" value={form.phone}
          onChange={e => { onChange('phone', e.target.value); setErrors(p => ({ ...p, phone: '' })) }}
          placeholder="e.g. 0300-1234567"
          error={errors.phone} />

        <Input label="Email" type="email" value={form.email}
          onChange={e => { onChange('email', e.target.value); setErrors(p => ({ ...p, email: '' })) }}
          placeholder="e.g. info@shop.com"
          error={errors.email} />

        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Address" value={form.address}
            onChange={e => onChange('address', e.target.value)}
            placeholder="Enter address" />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <NumInput label="Opening Balance" value={form.openingBalance || ''}
            onChange={e => onChange('openingBalance', Number(e.target.value))}
            placeholder="0.00" step="any" />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Select label="Customer Type" value={form.customerType}
            onChange={e => onChange('customerType', e.target.value)}>
            <option value="CUSTOMER">Retail / Walk-in</option>
            <option value="WHOLESALER">Wholesaler / Dealer (Ledger Tracked)</option>
          </Select>
        </div>
      </FormGrid>
    </Modal>
  )
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  const load = () => api.get('/customers').then(r => { setCustomers(r.data); setLoading(false) })
  useEffect(() => { load() }, [])

  useEffect(() => {
    const handler = (e) => {
      if ((e.key === 'n' || e.key === 'N') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        openAdd()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const openAdd = async () => {
    try {
      const r = await api.get('/customers/next-code')
      setForm({ ...empty, customerCode: r.data.code })
    } catch { setForm(empty) }
    setModal('add')
  }
  const openEdit = (c) => {
    setForm({ customerCode: c.customer_code, shopName: c.shop_name, customerName: c.customer_name, customerType: c.customer_type || 'CUSTOMER', address: c.address || '', email: c.email || '', phone: c.phone || '', openingBalance: c.opening_balance })
    setModal(c.id)
  }

  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'add') await api.post('/customers', form)
      else await api.put(`/customers/${modal}`, form)
      setModal(null); await load()
    } catch (e) { alert(e.response?.data?.error || 'Error saving') }
    setSaving(false)
  }

  const del = async (id) => {
    try { await api.delete(`/customers/${id}`); setDeleteId(null); await load() }
    catch (e) { alert(e.response?.data?.error || 'Error deleting') }
  }

  const filtered = customers.filter(c => {
    return c.shop_name?.toLowerCase().includes(search.toLowerCase()) || c.customer_name?.toLowerCase().includes(search.toLowerCase()) || c.customer_code?.toLowerCase().includes(search.toLowerCase())
  })

  if (loading) return (
    <div style={{ padding: '48px 32px', display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8' }}>
      <Spinner size={20} /> Loading customers…
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>

      <PageHeader
        title="Customers"
        subtitle={`${customers.length} registered customers`}
        actions={
          <>
            <ExportBar
              onPDF={() => exportPDF('Customers Report', COLS, filtered, 'customers')}
              onExcel={() => exportExcel('Customers Report', COLS, filtered, 'customers')}
              onPrint={() => printTable('Customers Report', COLS, filtered)}
            />
            <Btn variant="primary" onClick={openAdd} icon={<Icon.Plus style={{ width: 14, height: 14 }} />}>
              Add Customer
            </Btn>
          </>
        }
      />

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'center' }}>
          <SearchBar
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by shop, name or code..."
            style={{ width: 300 }}
          />
          {search && (
            <Btn variant="ghost" size="sm" onClick={() => setSearch('')}>Clear</Btn>
          )}
        </div>

        <Table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Shop Name</th>
              <th>Customer Name</th>
              <th>Type</th>
              <th>Phone</th>
              <th>Opening Bal.</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <Empty message={search ? 'No customers match your search' : 'No customers found'} hint="Click Add Customer or press N to add one" />
                </td>
              </tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{c.customer_code}</td>
                <td style={{ fontWeight: 500 }}>{c.shop_name}</td>
                <td>{c.customer_name}</td>
                <td>
                  <Badge color={c.customer_type === 'WHOLESALER' ? 'purple' : 'slate'}>
                    {c.customer_type === 'WHOLESALER' ? 'Wholesaler' : 'Retail'}
                  </Badge>
                </td>
                <td>{c.phone || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                <td>Rs. {Number(c.opening_balance).toFixed(2)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn variant="ghost" size="sm" onClick={() => openEdit(c)} title="Edit">
                      <Icon.Edit style={{ width: 14, height: 14 }} />
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setDeleteId(c.id)} title="Delete" style={{ color: '#ef4444' }}>
                      <Icon.Trash style={{ width: 14, height: 14 }} />
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {modal && (
        <CustomerModal
          title={modal === 'add' ? 'Add Customer' : 'Edit Customer'}
          form={form}
          onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
          onSave={save}
          onClose={() => setModal(null)}
          saving={saving}
          isAdd={modal === 'add'}
        />
      )}

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => del(deleteId)}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        danger
      />
    </div>
  )
}
