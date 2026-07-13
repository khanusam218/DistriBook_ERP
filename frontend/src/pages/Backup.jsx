import { useState, useRef } from 'react'
import api from '../api'
import { PageHeader, Card, Btn, Spinner } from '../components/ui'

export default function Backup() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')
  const [importFile, setImportFile] = useState(null)
  const fileRef = useRef(null)

  const showMsg = (text, type = 'success') => {
    setMsg(text)
    setMsgType(type)
    if (type === 'success') setTimeout(() => setMsg(''), 6000)
  }

  const handleExport = async () => {
    setExporting(true)
    setMsg('')
    try {
      // Backup/restore moves whole database files — can take far longer than the
      // app's normal 20s request timeout once real business data accumulates.
      const res = await api.get('/backup/export', { timeout: 300000 })
      const backup = res.data

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `thok-backup-${ts}.thokbackup`

      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const fileCount = Object.keys(backup.files || {}).length
      showMsg(`Backup created! ${fileCount} database file(s) saved.`, 'success')
    } catch (err) {
      showMsg('Failed to create backup: ' + (err.response?.data?.error || err.message), 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportFile(file)
      setMsg('')
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      showMsg('Please select a backup file first.', 'error')
      return
    }

    setImporting(true)
    setMsg('')
    try {
      // Read file
      let backup
      try {
        const text = await importFile.text()
        backup = JSON.parse(text)
      } catch {
        throw new Error('Could not read the backup file. Make sure it is a valid .thokbackup file.')
      }

      if (!backup.files || typeof backup.files !== 'object') {
        throw new Error('Invalid backup file format — missing database data.')
      }

      const res = await api.post('/backup/import', backup, { timeout: 300000 })
      showMsg((res.data.message || 'Backup restored successfully!') + ' Reloading app…', 'success')
      setImportFile(null)
      if (fileRef.current) fileRef.current.value = ''
      // The whole dataset just changed on disk — every page's already-loaded state
      // (customers, stocks, dashboard totals, etc.) is now stale. A hard reload is
      // the only way to guarantee the entire app reflects the restored data instead
      // of silently showing whatever was in memory before the restore.
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message
      showMsg('Restore failed: ' + errMsg, 'error')
    } finally {
      setImporting(false)
    }
  }

  // ── Icons ──
  const DownloadIcon = (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1={12} y1={15} x2={12} y2={3} />
    </svg>
  )

  const UploadIcon = (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1={12} y1={3} x2={12} y2={15} />
    </svg>
  )

  const ShieldIcon = (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )

  return (
    <div>
      <PageHeader
        title="Backup & Restore"
        subtitle="Safeguard your data by creating backups and restoring them when needed"
      />

      {/* Alert message — using children (not message prop) */}
      {msg && (
        <div className={`alert alert-${msgType}`} style={{ marginBottom: 20 }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}>
            {msgType === 'success'
              ? <><circle cx={12} cy={12} r={10}/><path d="M9 12l2 2 4-4"/></>
              : <><circle cx={12} cy={12} r={10}/><line x1={12} y1={8} x2={12} y2={12}/><line x1={12} y1={16} x2={12.01} y2={16}/></>
            }
          </svg>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
        {/* ── Export Card ── */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', flexShrink: 0,
            }}>
              <DownloadIcon width={20} height={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Create Backup</h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                Download all your data as a backup file
              </p>
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 16 }}>
            This will export all database files (products, customers, vendors, transactions,
            accounting data, and users) into a single <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>.thokbackup</code> file
            that you can save securely.
          </p>

          <Btn onClick={handleExport} disabled={exporting} style={{ width: '100%' }}>
            {exporting ? <><Spinner size={16} />{' '}Creating Backup...</> : <><DownloadIcon width={16} height={16} />{' '}Download Backup</>}
          </Btn>
        </Card>

        {/* ── Import Card ── */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', flexShrink: 0,
            }}>
              <UploadIcon width={20} height={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Restore Backup</h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                Import a previously saved backup
              </p>
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 16 }}>
            Select a <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>.thokbackup</code> file
            to restore all your data. <strong>This will overwrite your current data.</strong> Data will be available immediately.
          </p>

          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `1.5px dashed ${importFile ? '#6366f1' : '#cbd5e1'}`, borderRadius: 8, padding: 20,
              textAlign: 'center', marginBottom: 12, background: importFile ? '#eef2ff' : '#f8fafc',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".thokbackup,.json,application/json"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {importFile ? (
              <div>
                <ShieldIcon width={24} height={24} style={{ color: '#6366f1', marginBottom: 6 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{importFile.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                  {(importFile.size / 1024).toFixed(1)} KB — Click to change file
                </p>
              </div>
            ) : (
              <div>
                <UploadIcon width={24} height={24} style={{ color: '#94a3b8', marginBottom: 6 }} />
                <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Click here to select a backup file</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>.thokbackup or .json</p>
              </div>
            )}
          </div>

          <Btn
            onClick={handleImport}
            disabled={importing || !importFile}
            style={{ width: '100%' }}
          >
            {importing ? <><Spinner size={16} />{' '}Restoring data...</>
              : importFile ? <><UploadIcon width={16} height={16} />{' '}Restore Backup</>
              : <><UploadIcon width={16} height={16} />{' '}Select a file to restore</>
            }
          </Btn>
        </Card>
      </div>

      {/* Info section */}
      <Card style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: '#fef3c7', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#d97706', flexShrink: 0,
          }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={12} cy={12} r={10} /><line x1={12} y1={8} x2={12} y2={12} /><line x1={12} y1={16} x2={12.01} y2={16} />
            </svg>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Important Notes</h4>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
              <li>Always create a backup before performing bulk operations or updates.</li>
              <li>Store backup files in a safe location (external drive, cloud storage, etc.).</li>
              <li>Restored data becomes active immediately — you can continue working right away.</li>
              <li>Backup files contain all your business data — keep them secure and confidential.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
