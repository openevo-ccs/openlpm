import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/error-boundary'
import './globals.css'

// HashRouter: this is a static bundle on GitHub Pages, no server rewrite
// rules available -- hash routes (#/dashboard/foo) never require the host to
// resolve an arbitrary path, only index.html, matching eva-graph/apps/kgdj's
// same choice for the same reason.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </HashRouter>
  </React.StrictMode>
)
