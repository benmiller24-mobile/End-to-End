import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Catch any render-time throw so a single bad component never white-screens the
// whole app in front of a customer. Shows a recoverable message instead.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('App crashed:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ fontFamily: "'Questrial', Arial, sans-serif", maxWidth: 560, margin: '80px auto', padding: 24, textAlign: 'center', color: '#1a1a1a' }}>
          <div style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: '#b8944e', fontWeight: 600 }}>Eclipse Kitchen Designer</div>
          <h2 style={{ fontWeight: 600 }}>Something went wrong on this screen.</h2>
          <p style={{ color: '#555' }}>Your saved projects are safe. Reload to continue — if it keeps happening, note what you were doing.</p>
          <pre style={{ textAlign: 'left', fontSize: 11, color: '#9a6b16', background: '#fdf3e3', border: '1px solid #e8cd92', borderRadius: 6, padding: 10, overflow: 'auto', maxHeight: 160 }}>{String(this.state.error?.message || this.state.error)}</pre>
          <button onClick={() => window.location.reload()}
            style={{ background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
