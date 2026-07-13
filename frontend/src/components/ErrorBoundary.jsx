import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Render crash caught by ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 480, padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 16, lineHeight: 1.6 }}>
              {this.state.error.message || String(this.state.error)}
            </div>
            <button
              className="db-btn db-btn-primary"
              onClick={() => { this.setState({ error: null }); this.props.onClose?.() }}
              style={{ padding: '8px 16px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Close
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
