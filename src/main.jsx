import { migrateSwipeToRolyPoly } from '@shared-contracts/migrateSwipeToRolyPoly.js'
import React from 'react'
import ReactDOM from 'react-dom/client'

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Hub render error:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            padding: '24px',
            maxWidth: '520px',
            margin: '40px auto',
          }}
        >
          <h1 style={{ fontSize: '1.1rem' }}>Something went wrong loading the hub</h1>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#f4f4f5',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            {String(this.state.error)}
          </pre>
          <p style={{ fontSize: '14px', color: '#52525b' }}>
            Try a hard refresh (Ctrl+Shift+R) or another browser. If this persists, check the
            browser console for details.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

function renderLoadFailure(rootEl, err) {
  console.error('Hub module failed to load:', err)
  ReactDOM.createRoot(rootEl).render(
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: '24px',
        maxWidth: '520px',
        margin: '40px auto',
      }}
    >
      <h1 style={{ fontSize: '1.1rem' }}>Could not load the hub</h1>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: '#f4f4f5',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '13px',
        }}
      >
        {String(err)}
      </pre>
      <p style={{ fontSize: '14px', color: '#52525b' }}>
        If you see a network or MIME error, try another port (stop other dev servers), hard refresh,
        or run from the project root after <code>npm install</code>.
      </p>
    </div>
  )
}

async function boot() {
  migrateSwipeToRolyPoly()
  const rootEl = document.getElementById('root')
  if (!rootEl) {
    console.error('[Puzzles] Missing #root — hub cannot mount (check index.html).')
    return
  }

  let Home
  try {
    ;({ default: Home } = await import('./home.jsx'))
  } catch (err) {
    renderLoadFailure(rootEl, err)
    return
  }

  ReactDOM.createRoot(rootEl).render(
    <RootErrorBoundary>
      <Home />
    </RootErrorBoundary>
  )
}

boot()
