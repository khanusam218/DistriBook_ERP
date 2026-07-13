import { useState, useEffect } from 'react'
import api from '../api'
import { toast } from '../components/Toast'
import { exportPDF, exportExcel, printTable, ExportBar } from '../utils/exportUtils'
import {
  Btn, Input, NumInput, Select, SearchBar, Modal, Card, Badge, Empty,
  ConfirmModal, Table, FormGrid, PageHeader, SectionLabel, Icon, Spinner,
} from '../components/ui'

const emptyForm = {
  vendorId: '', productName: '', productDescription: '',
  packingUnit: 'CTN', piecesPerCtn: '', purchasePrice: '', salePrice: '',
}

const COLS = [
  { header: 'Vendor', accessor: r => r.company_name },
  { header: 'Product Name', accessor: r => r.product_name },
  { header: 'Description', accessor: r => r.product_description },
  { header: 'Packing', accessor: r => r.packing_unit },
  { header: 'Pcs/Unit', accessor: r => r.pieces_per_ctn },
  { header: 'Purchase Price', accessor: r => `Rs. ${Number(r.purchase_price).toFixed(2)}` },
  { header: 'Sale Price', accessor: r => `Rs. ${Number(r.sale_price).toFixed(2)}` },
]

function ProductFormModal({ title, form, onChange, onSave, onClose, saving, vendors, isAdd }) {
  return (
    <Modal open onClose={onClose} title={title}
      onKeyDown={e => { if (e.key === 'Enter') onSave() }}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Btn>
        </>
      }
    >
      <FormGrid cols={2}>
        {isAdd && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Input label="Product Code" value={form.productCode || ''} readOnly
              placeholder="Auto-generated"
              style={{ background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' }} />
          </div>
        )}

        <div style={{ gridColumn: '1 / -1' }}>
          <Select label="Vendor" required value={form.vendorId}
            onChange={e => onChange('vendorId', e.target.value)}
            autoFocus={isAdd}>
            <option value="">-- Select Vendor --</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.company_name} ({v.company_code})</option>
            ))}
          </Select>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Product Name" required value={form.productName}
            onChange={e => onChange('productName', e.target.value)}
            placeholder="Enter product name"
            autoFocus={!isAdd} />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Description" value={form.productDescription}
            onChange={e => onChange('productDescription', e.target.value)}
            placeholder="Enter description" />
        </div>

        <Input label="Packing Unit" value={form.packingUnit}
          onChange={e => onChange('packingUnit', e.target.value)}
          placeholder="e.g. CTN" />

        <NumInput label="Pieces per Unit" value={form.piecesPerCtn || ''}
          onChange={e => onChange('piecesPerCtn', Number(e.target.value))}
          placeholder="e.g. 12" min="1" />

        <NumInput label="Purchase Price" value={form.purchasePrice || ''}
          onChange={e => onChange('purchasePrice', Number(e.target.value))}
          placeholder="Enter price" step="any" min="0" />

        <NumInput label="Sale Price" value={form.salePrice || ''}
          onChange={e => onChange('salePrice', Number(e.target.value))}
          placeholder="Enter price" step="any" min="0" />
      </FormGrid>
    </Modal>
  )
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  const load = () => Promise.all([api.get('/products'), api.get('/vendors')])
    .then(([p, v]) => { setProducts(p.data); setVendors(v.data); setLoading(false) })
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
      const r = await api.get('/products/next-code')
      setForm({ ...emptyForm, productCode: r.data.code })
    } catch { setForm(emptyForm) }
    setModal('add')
  }
  const openEdit = (p) => {
    setForm({
      vendorId: String(p.vendor_id),
      productName: p.product_name,
      productDescription: p.product_description || '',
      packingUnit: p.packing_unit || 'CTN',
      piecesPerCtn: p.pieces_per_ctn || '',
      purchasePrice: p.purchase_price,
      salePrice: p.sale_price,
    })
    setModal(p.id)
  }

  const save = async () => {
    if (!form.vendorId) return toast('Please select a vendor')
    if (!form.productName) return toast('Product name is required')
    setSaving(true)
    try {
      const payload = { ...form, vendorId: Number(form.vendorId) }
      if (modal === 'add') await api.post('/products', payload)
      else await api.put(`/products/${modal}`, payload)
      setModal(null); await load()
    } catch (e) { toast(e.response?.data?.error || 'Error saving') }
    setSaving(false)
  }

  const del = async (id) => {
    try { await api.delete(`/products/${id}`); setDeleteId(null); await load() }
    catch (e) { toast(e.response?.data?.error || 'Error deleting') }
  }

  const filtered = products.filter(p => {
    const matchVendor = !vendorFilter || String(p.vendor_id) === vendorFilter
    const matchSearch =
      p.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.product_description?.toLowerCase().includes(search.toLowerCase())
    return matchVendor && matchSearch
  })

  if (loading) return (
    <div style={{ padding: '48px 32px', display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8' }}>
      <Spinner size={20} /> Loading products…
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>

      <PageHeader
        title="Products"
        subtitle="Vendor-wise product catalog"
        actions={
          <>
            <ExportBar
              onPDF={() => exportPDF('Products Catalog', COLS, filtered, 'products')}
              onExcel={() => exportExcel('Products Catalog', COLS, filtered, 'products')}
              onPrint={() => printTable('Products Catalog', COLS, filtered)}
            />
            <Btn variant="primary" onClick={openAdd} icon={<Icon.Plus style={{ width: 14, height: 14 }} />}>
              Add Product
            </Btn>
          </>
        }
      />

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchBar
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product or vendor..."
            style={{ width: 280 }}
          />
          <Select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} style={{ width: 200 }}>
            <option value="">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.company_name}</option>)}
          </Select>
          {(search || vendorFilter) && (
            <Btn variant="ghost" size="sm" onClick={() => { setSearch(''); setVendorFilter('') }}>
              Clear filters
            </Btn>
          )}
        </div>

        {vendorFilter === '' && search === '' ? (
          vendors
            .filter(v => products.some(p => p.vendor_id === v.id))
            .map(v => {
              const vProducts = products.filter(p => p.vendor_id === v.id)
              return (
                <div key={v.id}>
                  <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, color: '#334155', fontSize: 13 }}>{v.company_name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{v.company_code}</span>
                    <Badge color="blue">{vProducts.length} products</Badge>
                  </div>
                  <ProductTable rows={vProducts} onEdit={openEdit} onDelete={id => setDeleteId(id)} />
                </div>
              )
            })
        ) : (
          filtered.length === 0 ? (
            <div style={{ padding: 32 }}>
              <Empty message="No products match your filters" hint="Try adjusting your search or filter" />
            </div>
          ) : (
            <ProductTable rows={filtered} onEdit={openEdit} onDelete={id => setDeleteId(id)} showVendor />
          )
        )}
      </Card>

      {modal && (
        <ProductFormModal
          title={modal === 'add' ? 'Add Product' : 'Edit Product'}
          form={form}
          onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
          onSave={save}
          onClose={() => setModal(null)}
          saving={saving}
          vendors={vendors}
          isAdd={modal === 'add'}
        />
      )}

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => del(deleteId)}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        danger
      />
    </div>
  )
}

function ProductTable({ rows, onEdit, onDelete, showVendor }) {
  if (rows.length === 0) return (
    <div style={{ padding: 24 }}><Empty message="No products" /></div>
  )
  return (
    <Table>
      <thead>
        <tr>
          {showVendor && <th>Vendor</th>}
          <th>Code</th>
          <th>Product Name</th>
          <th>Description</th>
          <th>Packing</th>
          <th>Pcs/Unit</th>
          <th>Purchase Price</th>
          <th>Sale Price</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(p => (
          <tr key={p.id}>
            {showVendor && <td style={{ fontWeight: 500, color: '#2563eb' }}>{p.company_name}</td>}
            <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{p.product_code || '-'}</td>
            <td style={{ fontWeight: 500 }}>{p.product_name}</td>
            <td style={{ color: '#64748b' }}>{p.product_description || '-'}</td>
            <td>{p.packing_unit}</td>
            <td>{p.pieces_per_ctn}</td>
            <td>Rs. {Number(p.purchase_price).toFixed(2)}</td>
            <td>Rs. {Number(p.sale_price).toFixed(2)}</td>
            <td>
              <div style={{ display: 'flex', gap: 4 }}>
                <Btn variant="ghost" size="sm" onClick={() => onEdit(p)} title="Edit">
                  <Icon.Edit style={{ width: 14, height: 14 }} />
                </Btn>
                <Btn variant="ghost" size="sm" onClick={() => onDelete(p.id)} title="Delete" style={{ color: '#ef4444' }}>
                  <Icon.Trash style={{ width: 14, height: 14 }} />
                </Btn>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
