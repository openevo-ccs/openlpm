import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

// Catches a crash inside any page and shows a short screen with a way out.
// Before this, one error while drawing a page left students with a blank or
// frozen page and no way to tell what happened (a Jena seminar student
// reported "the page crashes", 2026-11-16). The screen resets when the route
// changes, so moving to another page works without a reload.

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically|Loading chunk/i

interface Props {
  children: ReactNode
  /** Changing this value clears a shown error (the route path is passed in). */
  resetKey?: string
}
interface State {
  error: Error | null
}

class Boundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed:', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const stale = CHUNK_ERROR.test(error.message ?? '')
    return (
      <div className="page page-narrow" style={{ maxWidth: 520, marginTop: 80 }}>
        <div className="card" role="alert">
          <h2 style={{ marginTop: 0 }}>{stale ? 'EvoMentor wurde gerade aktualisiert' : 'Hier ist etwas schiefgegangen'}</h2>
          <p>
            {stale
              ? 'Diese Seite ist noch die alte Fassung. Lade sie neu, dann geht es weiter.'
              : 'Die Seite konnte nicht angezeigt werden. Lade sie neu. Hilft das nicht, geh zur Startseite und öffne die Seite von dort noch einmal. Was du schon gespeichert hast, bleibt erhalten.'}
          </p>
          <p className="muted">
            {stale
              ? 'EvoMentor was just updated and this page is the old version. Reload it to continue.'
              : 'The page could not be shown. Reload it. If that does not help, go to the start page and open the page again from there. What you already saved is kept.'}
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Seite neu laden / Reload
            </button>
            <button className="btn" onClick={() => { window.location.hash = '#/'; this.setState({ error: null }) }}>
              Zur Startseite / Start page
            </button>
          </div>
          {!stale && error.message && (
            <details style={{ marginTop: 12 }}>
              <summary className="muted">Technische Angabe für die Fehlermeldung / Technical detail</summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{error.message}</pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}

/** Wrap the app's routes. Must sit inside the router so it can reset on navigation. */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <Boundary resetKey={location.pathname}>{children}</Boundary>
}
