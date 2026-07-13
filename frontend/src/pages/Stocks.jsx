import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'
import { toast } from '../components/Toast'
import { exportPDF, exportExcel, printTable, ExportBar } from '../utils/exportUtils'
import {
  Btn, Input, NumInput, Select, SearchBar, Modal, Card, Badge, Alert, Empty,
  ConfirmModal, Table, FormGrid, PageHeader, SectionLabel, Icon, Spinner, Combobox,
} from '../components/ui'

const emptyForm = {
  companyName: '', productName: '', productDescription: '',
  packingUnit: 'CTN', piecesPerCtn: '',
  purchasePrice: '', salePrice: '',
  qtyCtn: '', qtyPieces: '',
  barcode: '',
}

const COLS = [
  { header: 'Company', accessor: r => r.company_name },
  { header: 'Product', accessor: r => r.product_name },
  { header: 'Description', accessor: r => r.product_description },
  { header: 'Packing', accessor: r => r.packing_unit },
  { header: 'Pcs/Unit', accessor: r => r.pieces_per_ctn },
  { header: 'Purchase Price', accessor: r => `Rs. ${Number(r.purchase_price).toFixed(2)}` },
  { header: 'Sale Price', accessor: r => `Rs. ${Number(r.sale_price).toFixed(2)}` },
  { header: 'Qty', accessor: r => r.quantity },
]

function AddModal({ vendors, allProducts, onSave, onClose, saving }) {
  const [vendorId, setVendorId] = useState('')
  const [rows, setRows] = useState([{ key: 0, productId: '', productData: null, barcode: '', qtyCtn: '', qtyPcs: '' }])
  const counterRef = useRef(1)

  const vendorOptions = vendors.map(v => ({ value: String(v.id), label: v.company_name }))
  const productOptions = vendorId
    ? allProducts
        .filter(p => String(p.vendor_id) === vendorId)
        .map(p => ({ value: String(p.id), label: p.product_name + (p.product_code ? ` (${p.product_code})` : '') }))
    : []

  const handleVendorSelect = (id) => {
    if (id === vendorId) return
    const key = counterRef.current++
    setVendorId(id)
    setRows([{ key, productId: '', productData: null, barcode: '', qtyCtn: '', qtyPcs: '' }])
  }

  const selectProduct = (rowKey, productId) => {
    const p = allProducts.find(pr => String(pr.id) === productId) || null
    setRows(rs => rs.map(r => r.key === rowKey ? { ...r, productId, productData: p } : r))
  }

  const updateRow = (rowKey, field, val) =>
    setRows(rs => rs.map(r => r.key === rowKey ? { ...r, [field]: val } : r))

  const addRow = () => {
    const key = counterRef.current++
    setRows(rs => [...rs, { key, productId: '', productData: null, barcode: '', qtyCtn: '', qtyPcs: '' }])
    setTimeout(() => document.getElementById('cb-input-' + key)?.focus(), 100)
  }

  const removeRow = (rowKey) =>
    setRows(rs => rs.length > 1 ? rs.filter(r => r.key !== rowKey) : rs)

  const readyRows = rows.filter(r => r.productId)

  const handleSave = () => {
    if (!vendorId) return toast('Select a vendor')
    if (readyRows.length === 0) return toast('Select at least one product')
    onSave(readyRows.map(r => ({
      companyName: r.productData?.company_name || '',
      productName: r.productData?.product_name || '',
      productDescription: r.productData?.product_description || '',
      packingUnit: r.productData?.packing_unit || 'CTN',
      piecesPerCtn: r.productData?.pieces_per_ctn || 1,
      purchasePrice: r.productData?.purchase_price || 0,
      salePrice: r.productData?.sale_price || 0,
      barcode: r.barcode || '',
      quantity: Number(r.qtyCtn || 0) * Number(r.productData?.pieces_per_ctn || 1) + Number(r.qtyPcs || 0),
    })))
  }

  return (
    <Modal open onClose={onClose} title="Add Stock Items" maxWidth={640}
      footer={
        <>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {readyRows.length > 0 ? readyRows.length + ' item' + (readyRows.length > 1 ? 's' : '') + ' ready' : 'No items selected'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSave} disabled={saving || readyRows.length === 0}>
              {saving ? 'Saving...' : `Save ${readyRows.length || ''} Item${readyRows.length !== 1 ? 's' : ''}`}
            </Btn>
          </div>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="form-label">Vendor <span className="req">*</span></label>
          <Combobox
            options={vendorOptions}
            value={vendorId}
            onSelect={handleVendorSelect}
            placeholder="Type to search vendor..."
            autoFocus={true}
          />
        </div>

        {vendorId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="form-label">Products</label>
            {rows.map((row, idx) => (
              <div key={row.key} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#f8fafc' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <Combobox
                      options={productOptions}
                      value={row.productId}
                      onSelect={(pid) => selectProduct(row.key, pid)}
                      placeholder="Search product..."
                      inputId={'cb-input-' + row.key}
                    />
                  </div>
                  <Btn variant="ghost" size="sm" onClick={() => removeRow(row.key)}>
                    <Icon.X style={{ width: 14, height: 14 }} />
                  </Btn>
                </div>

                {row.productData && (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '8px 0' }}>
                      {[
                        row.productData.product_description,
                        (row.productData.packing_unit || 'CTN') + ' x ' + (row.productData.pieces_per_ctn || 1) + ' pcs',
                        'Buy Rs.' + row.productData.purchase_price,
                        'Sell Rs.' + row.productData.sale_price,
                      ].filter(Boolean).map((tag, i) => (
                        <Badge key={i} color="blue">{tag}</Badge>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="text" value={row.barcode}
                        onChange={e => updateRow(row.key, 'barcode', e.target.value)}
                        placeholder="Barcode (optional)"
                        className="db-input"
                        style={{ width: 140, fontFamily: 'monospace' }} />
                      <span style={{ fontSize: 12, color: '#64748b' }}>CTN</span>
                      <input type="number" onWheel={e => e.target.blur()} min="0" value={row.qtyCtn || ''}
                        onChange={e => updateRow(row.key, 'qtyCtn', e.target.value)}
                        placeholder="0"
                        className="db-input"
                        style={{ width: 64, textAlign: 'center' }} />
                      <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500 }}>+</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Pcs</span>
                      <input type="number" onWheel={e => e.target.blur()} min="0" value={row.qtyPcs || ''}
                        onChange={e => updateRow(row.key, 'qtyPcs', e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Tab' && !e.shiftKey && idx === rows.length - 1) {
                            e.preventDefault()
                            addRow()
                          }
                        }}
                        placeholder="0"
                        className="db-input"
                        style={{ width: 64, textAlign: 'center' }} />
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        = <span style={{ fontWeight: 600, color: '#2563eb' }}>
                          {Number(row.qtyCtn || 0) * (row.productData?.pieces_per_ctn || 1) + Number(row.qtyPcs || 0)}
                        </span> pcs
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))}
            <Btn variant="ghost" size="sm" onClick={addRow} icon={<Icon.Plus style={{ width: 14, height: 14 }} />}>
              Add Another Product
            </Btn>
          </div>
        )}
      </div>
    </Modal>
  )
}

function EditModal({ form, onChange, onSave, onClose, saving }) {
  const computedQty = Number(form.qtyCtn || 0) * Number(form.piecesPerCtn || 0) + Number(form.qtyPieces || 0)
  return (
    <Modal open onClose={onClose} title="Edit Stock Item"
      onKeyDown={e => { if (e.key === 'Enter') onSave() }}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Btn>
        </>
      }
    >
      <FormGrid cols={2}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Company Name" value={form.companyName} autoFocus
            onChange={e => onChange('companyName', e.target.value)}
            placeholder="Enter company name" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Product Name" value={form.productName}
            onChange={e => onChange('productName', e.target.value)}
            placeholder="Enter product name" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Description" value={form.productDescription}
            onChange={e => onChange('productDescription', e.target.value)}
            placeholder="Enter description" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Barcode" value={form.barcode}
            onChange={e => onChange('barcode', e.target.value)}
            placeholder="Scan or type barcode (optional)"
            style={{ fontFamily: 'monospace' }} />
        </div>
        <Input label="Packing Unit 🔒" value={form.packingUnit}
          readOnly tabIndex={-1}
          style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', userSelect: 'none' }} />
        <NumInput label="Pieces per Unit 🔒" value={form.piecesPerCtn || ''}
          readOnly tabIndex={-1}
          style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', userSelect: 'none' }} />
        <NumInput label="Purchase Price 🔒" value={form.purchasePrice || ''}
          readOnly tabIndex={-1}
          style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', userSelect: 'none' }} />
        <NumInput label="Sale Price 🔒" value={form.salePrice || ''}
          readOnly tabIndex={-1}
          style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', userSelect: 'none' }} />
        <div style={{ gridColumn: '1 / -1' }}>
          <SectionLabel>Quantity</SectionLabel>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Cartons (CTN)</label>
              <NumInput value={form.qtyCtn || ''}
                onChange={e => onChange('qtyCtn', Number(e.target.value))}
                placeholder="0" min="0" />
            </div>
            <span style={{ color: '#94a3b8', fontWeight: 600, paddingBottom: 8 }}>+</span>
            <div style={{ flex: 1 }}>
              <label className="form-label">Pieces (Pcs)</label>
              <NumInput value={form.qtyPieces || ''}
                onChange={e => onChange('qtyPieces', Number(e.target.value))}
                placeholder="0" min="0" />
            </div>
            <div style={{ paddingBottom: 8, fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
              = <span style={{ fontWeight: 700, color: '#2563eb' }}>{computedQty}</span> pcs
            </div>
          </div>
        </div>
      </FormGrid>
    </Modal>
  )
}


export default function Stocks() {
  const [stocks, setStocks] = useState([])
  const [vendors, setVendors] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [lowStock, setLowStock] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const load = () => Promise.all([api.get('/stocks'), api.get('/vendors'), api.get('/products')])
    .then(([s, v, p]) => { setStocks(s.data); setVendors(v.data); setAllProducts(p.data); setLoading(false) })
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

  const vendorCompanies = vendors.map(v => v.company_name).filter(Boolean)
  const stockCompanies = stocks.map(s => s.company_name).filter(Boolean)
  const filterCompanies = [...new Set(stockCompanies)].sort()

  const openAdd = () => { setForm(emptyForm); setModal('add') }
  const openEdit = (s) => {
    const ppc = s.pieces_per_ctn || 1
    const qty = s.quantity || 0
    setForm({
      companyName: s.company_name,
      productName: s.product_name,
      productDescription: s.product_description || '',
      packingUnit: s.packing_unit || 'CTN',
      piecesPerCtn: ppc,
      purchasePrice: s.purchase_price,
      salePrice: s.sale_price,
      qtyCtn: Math.floor(qty / ppc),
      qtyPieces: qty % ppc,
      barcode: s.barcode || '',
    })
    setModal(s.id)
  }

  const saveBatch = async (items) => {
    setSaving(true)
    try {
      for (const payload of items) {
        await api.post('/stocks', payload)
      }
      setModal(null); await load()
    } catch (e) { toast(e.response?.data?.error || 'Error saving') }
    setSaving(false)
  }

  const saveEdit = async () => {
    if (!form.companyName) return toast('Company name is required')
    if (!form.productName) return toast('Product name is required')
    const quantity = Number(form.qtyCtn || 0) * Number(form.piecesPerCtn || 0) + Number(form.qtyPieces || 0)
    const payload = {
      companyName: form.companyName,
      productName: form.productName,
      productDescription: form.productDescription,
      packingUnit: form.packingUnit,
      piecesPerCtn: form.piecesPerCtn,
      purchasePrice: form.purchasePrice,
      salePrice: form.salePrice,
      quantity,
      barcode: form.barcode || '',
    }
    setSaving(true)
    try {
      await api.put(`/stocks/${modal}`, payload)
      setModal(null); await load()
    } catch (e) { toast(e.response?.data?.error || 'Error saving') }
    setSaving(false)
  }

  const del = async (id) => {
    try { await api.delete(`/stocks/${id}`); setDeleteId(null); await load() }
    catch (e) { toast(e.response?.data?.error || 'Error deleting') }
  }

  const filtered = stocks.filter(s => {
    const matchSearch = s.company_name?.toLowerCase().includes(search.toLowerCase()) || s.product_name?.toLowerCase().includes(search.toLowerCase())
    const matchCompany = !companyFilter || s.company_name === companyFilter
    const matchLow = !lowStock || s.quantity <= 10
    return matchSearch && matchCompany && matchLow
  })

  if (loading) return (
    <div style={{ padding: '48px 32px', display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8' }}>
      <Spinner size={20} /> Loading stocks…
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>

      <PageHeader
        title="Stock Management"
        subtitle={`${stocks.length} total items`}
        actions={
          <>
            <ExportBar
              onPDF={() => exportPDF('Stock Report', COLS, filtered, 'stocks')}
              onExcel={() => exportExcel('Stock Report', COLS, filtered, 'stocks')}
              onPrint={() => printTable('Stock Report', COLS, filtered)}
            />
            <Btn variant="primary" onClick={openAdd} icon={<Icon.Plus style={{ width: 14, height: 14 }} />}>
              Add Stock
            </Btn>
          </>
        }
      />

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchBar
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by company or product..."
            style={{ width: 280 }}
          />
          <Select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={{ width: 200 }}>
            <option value="">All Companies</option>
            {filterCompanies.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} style={{ borderRadius: 4 }} />
            Low Stock (≤10)
          </label>
          {(search || companyFilter || lowStock) && (
            <Btn variant="ghost" size="sm" onClick={() => { setSearch(''); setCompanyFilter(''); setLowStock(false) }}>
              Clear filters
            </Btn>
          )}
        </div>

        <Table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Product</th>
              <th>Packing</th>
              <th>Pcs/Unit</th>
              <th>Purchase Price</th>
              <th>Sale Price</th>
              <th>Qty</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <Empty message={search || companyFilter || lowStock ? 'No stocks match your filters' : 'No stocks found'} hint="Click Add Stock or press N to add one" />
                </td>
              </tr>
            ) : filtered.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.company_name}</td>
                <td>{s.product_name}</td>
                <td>{s.packing_unit}</td>
                <td>{s.pieces_per_ctn}</td>
                <td>Rs. {Number(s.purchase_price).toFixed(2)}</td>
                <td>Rs. {Number(s.sale_price).toFixed(2)}</td>
                <td>
                  <Badge color={s.quantity <= 0 ? 'red' : s.quantity <= 10 ? 'amber' : 'green'}>
                    {s.quantity}
                  </Badge>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn variant="ghost" size="sm" onClick={() => openEdit(s)} title="Edit">
                      <Icon.Edit style={{ width: 14, height: 14 }} />
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setDeleteId(s.id)} title="Delete" style={{ color: '#ef4444' }}>
                      <Icon.Trash style={{ width: 14, height: 14 }} />
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {modal === 'add' && (
        <AddModal
          vendors={vendors}
          allProducts={allProducts}
          onSave={saveBatch}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}
      {modal && modal !== 'add' && (
        <EditModal
          form={form}
          onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
          onSave={saveEdit}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => del(deleteId)}
        title="Delete Stock Item"
        message="Are you sure you want to delete this stock item? This action cannot be undone."
        danger
      />
    </div>
  )
}
