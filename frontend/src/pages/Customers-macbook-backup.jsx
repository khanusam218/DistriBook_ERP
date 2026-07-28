import { useState, useEffect } from 'react'
import api from '../api'
import { exportPDF, exportExcel, printTable, ExportBar } from '../utils/exportUtils'

const empty = { customerCode: '', shopName: '', customerName: '', customerType: 'RETAILER', address: '', email: '', phone: '', openingBalance: 0 }

const COLS = [
  { header: 'Code', accessor: r => r.customer_code },
  { header: 'Shop Name', accessor: r => r.shop_name },
  { header: 'Customer Name', accessor: r => r.customer_name },
  { header: 'Type', accessor: r => r.customer_type },
  { header: 'Phone', accessor: r => r.phone },
  { header: 'Email', accessor: r => r.email },
  { header: 'Address', accessor: r => r.address },
  { header: 'Opening Balance', accessor: r => `Rs. ${Number(r.opening_balance).toFixed(2)}` },
]

function Modal({ title, form, onChange, onSave, onClose, saving, isAdd }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Code</label>
            <input type="text" value={form.customerCode} readOnly={isAdd}
              onChange={e => onChange('customerCode', e.target.value)}
              placeholder={isAdd ? 'Auto-generated' : ''}
              className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAdd ? 'bg-gray-50 text-gray-500 border-gray-200' : 'border-gray-300'}`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type</label>
            <select value={form.customerType} onChange={e => onChange('customerType', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['RETAILER', 'WHOLESALER'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {[
            { label: 'Shop Name', key: 'shopName', span: 2 },
            { label: 'Customer Name', key: 'customerName', span: 2 },
            { label: 'Phone', key: 'phone' },
            { label: 'Email', key: 'email' },
            { label: 'Address', key: 'address', span: 2 },
            { label: 'Opening Balance', key: 'openingBalance', type: 'number', span: 2 },
          ].map(({ label, key, type = 'text', span }) => (
            <div key={key} className={span === 2 ? 'col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} value={form[key]}
                onChange={e => onChange(key, type === 'number' ? Number(e.target.value) : e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                step={type === 'number' ? 'any' : undefined} />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')

  const load = () => api.get('/customers').then(r => { setCustomers(r.data); setLoading(false) })
  useEffect(() => { load() }, [])

  const openAdd = async () => {
    try {
      const r = await api.get('/customers/next-code')
      setForm({ ...empty, customerCode: r.data.code })
    } catch { setForm(empty) }
    setModal('add')
  }
  const openEdit = (c) => {
    setForm({ customerCode: c.customer_code, shopName: c.shop_name, customerName: c.customer_name, customerType: c.customer_type, address: c.address || '', email: c.email || '', phone: c.phone || '', openingBalance: c.opening_balance })
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
    if (!confirm('Delete this customer?')) return
    try { await api.delete(`/customers/${id}`); await load() }
    catch (e) { alert(e.response?.data?.error || 'Error deleting') }
  }

  const filtered = customers.filter(c => {
    const matchType = filter === 'ALL' || c.customer_type === filter
    const matchSearch = c.shop_name?.toLowerCase().includes(search.toLowerCase()) || c.customer_name?.toLowerCase().includes(search.toLowerCase()) || c.customer_code?.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">+ Add Customer</button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        {['ALL', 'RETAILER', 'WHOLESALER'].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${filter === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
        <ExportBar
          onPDF={() => exportPDF('Customers Report', COLS, filtered, 'customers')}
          onExcel={() => exportExcel('Customers Report', COLS, filtered, 'customers')}
          onPrint={() => printTable('Customers Report', COLS, filtered)}
        />
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Code', 'Shop Name', 'Customer Name', 'Type', 'Phone', 'Opening Bal.', 'Actions'].map(h => (
                <th key={h} className="text-left py-3 px-4 text-gray-600 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No customers found</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 font-mono text-xs">{c.customer_code}</td>
                <td className="py-3 px-4 font-medium">{c.shop_name}</td>
                <td className="py-3 px-4">{c.customer_name}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.customer_type === 'WHOLESALER' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                    {c.customer_type}
                  </span>
                </td>
                <td className="py-3 px-4">{c.phone}</td>
                <td className="py-3 px-4">Rs. {Number(c.opening_balance).toFixed(2)}</td>
                <td className="py-3 px-4">
                  <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline mr-3">Edit</button>
                  <button onClick={() => del(c.id)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <Modal title={modal === 'add' ? 'Add Customer' : 'Edit Customer'} form={form} onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))} onSave={save} onClose={() => setModal(null)} saving={saving} isAdd={modal === 'add'} />}
    </div>
  )
}
