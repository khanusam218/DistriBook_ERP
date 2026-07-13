import { useState } from 'react'
import { Btn, Input, Select, FormGrid, Icon, Spinner } from './ui'

const emptyCustomer = (defaultType) => ({
  customerCode: '', shopName: '', customerName: '', customerType: defaultType || 'RETAILER',
  address: '', email: '', phone: '', openingBalance: 0,
})

export default function AddCustomerModal({ onSave, onClose, saving, defaultCustomerType }) {
  const [form, setForm] = useState(emptyCustomer(defaultCustomerType))
  const change = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2>Quick Add Customer</h2>
          <button className="modal-close" onClick={onClose}><Icon.X style={{ width: 14, height: 14 }} /></button>
        </div>
        <div className="modal-body">
          <FormGrid cols={2}>
            <Select label="Customer Type" value={form.customerType} onChange={e => change('customerType', e.target.value)}>
              <option value="RETAILER">RETAILER</option>
              <option value="WHOLESALER">WHOLESALER</option>
            </Select>
            <Input label="Phone" placeholder="e.g. 0300-1234567" type="text" value={form.phone} onChange={e => change('phone', e.target.value)} />
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Shop Name" required placeholder="Shop name" value={form.shopName} onChange={e => change('shopName', e.target.value)} autoFocus />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Customer Name" placeholder="Owner / contact name" value={form.customerName} onChange={e => change('customerName', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Address" placeholder="Full address" value={form.address} onChange={e => change('address', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Opening Balance" type="number" onWheel={e => e.target.blur()} step="any" placeholder="0" value={form.openingBalance || ''} onChange={e => change('openingBalance', Number(e.target.value))} />
            </div>
          </FormGrid>
        </div>
        <div className="modal-footer">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => onSave(form)} disabled={saving} icon={saving ? <Spinner size={13} /> : null}>
            {saving ? 'Saving…' : 'Add Customer'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
