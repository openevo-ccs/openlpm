import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Compass } from 'lucide-react'
import {
  FOUR_MODELS,
  MODELS_INTRO,
  MODELS_TITLE,
  PROGRESSION_GLOSS,
  TOOLKIT_LINE,
  resolveStartingPoints,
} from '@/lib/start-here'

const STORAGE_KEY = 'openlpm.startHere.collapsed'

// A remembered "collapsed" choice is a convenience. Private windows and
// blocked site data can make storage throw, so every access is wrapped.
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* the card still works without storage */
  }
}

// Shown at the top of the project list for everyone who signs in. It answers
// the question first-time visitors asked most often ("what is this page?")
// and offers three places to look first.
export function StartHereCard({ slugs }: { slugs: ReadonlySet<string> }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const points = resolveStartingPoints(slugs)

  const toggle = () => {
    setCollapsed((c) => {
      writeCollapsed(!c)
      return !c
    })
  }

  return (
    <section className="card start-here" aria-labelledby="start-here-title">
      <button
        type="button"
        className="start-here-head"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls="start-here-body"
      >
        <Compass size={18} aria-hidden="true" />
        <span id="start-here-title" className="start-here-title">New here? Start here</span>
        {collapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>

      {!collapsed && (
        <div id="start-here-body" className="start-here-body">
          <p>{TOOLKIT_LINE} {PROGRESSION_GLOSS}</p>

          <h3>{MODELS_TITLE}</h3>
          <p className="muted">{MODELS_INTRO}</p>
          <div className="start-here-models">
            {FOUR_MODELS.map((m) => (
              <div key={m.slug} className={`start-here-model start-here-model-${m.kind}`}>
                <h4>{m.name}</h4>
                <p className="muted">{m.text}</p>
              </div>
            ))}
          </div>

          <h3>Three places to look first</h3>
          <ol className="start-here-points">
            {points.map((p) => (
              <li key={p.key}>
                <strong>{p.title}.</strong> {p.text}{' '}
                {p.href ? (
                  <Link to={p.href}>Open it</Link>
                ) : (
                  <span className="muted">You need access to the {p.spaceName} space first. Ask the person who invited you.</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
