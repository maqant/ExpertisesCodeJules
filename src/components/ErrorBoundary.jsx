import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Zéro erreur silencieuse : on log explicitement.
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', color: '#b91c1c', background: '#fff' }}>
          <h1>Une erreur inattendue est survenue</h1>
          <p>Version : {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'inconnue'}</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.message || this.state.error)}</pre>
          <button 
            onClick={() => window.location.reload(true)} 
            style={{ padding: '8px 16px', background: '#b91c1c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '16px' }}>
            Forcer le rechargement
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
