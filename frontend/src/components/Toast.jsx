import { useEffect, useState } from 'react'

// Non-blocking replacement for window.alert().
// alert() steals native OS focus into a system dialog; when it closes, Chromium
// often fails to restore keyboard focus into freshly-mounted inputs (e.g. a modal
// opened right after) until the window itself loses and regains focus.
let listeners = []
let idCounter = 0

export function toast(message, type = 'info') {
  const id = ++idCounter
  const item = { id, message, type }
  listeners.forEach(fn => fn(item))
  return id
}

const COLORS = {
  info: '#1e293b',
  success: '#16a34a',
  error: '#dc2626',
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handleAdd = (item) => {
      setToasts(prev => [...prev, item])
      const duration = item.type === 'error' ? 6000 : 3500
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== item.id))
      }, duration)
    }
    listeners.push(handleAdd)
    return () => { listeners = listeners.filter(l => l !== handleAdd) }
  }, [])

  const remove = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380,
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          style={{
            padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
            background: COLORS[t.type] || COLORS.info,
            color: '#fff', fontSize: 14, fontWeight: 500, lineHeight: 1.4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
