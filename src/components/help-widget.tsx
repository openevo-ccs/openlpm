import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, HelpCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { listAvailableTutorials, tutorialSteps, type TutorialWithProject } from '@/lib/supabase/tutorials'

// Help button + tutorial picker, topbar (next to Profile) -- 2026-09-18 ask.
// Lives in DashboardLayout so it's reachable from the project switcher and
// every project alike, and lists every tutorial the signed-in user can see
// across ALL their project spaces at once (RLS already scopes this to
// general tutorials + whichever projects they're actually a member of --
// see tutorials.ts), not just whichever project happens to be open right
// now. A real, anchored dropdown (.popover, the same pattern context menus
// already use), not a floating corner widget like Chat/Feedback -- this is
// triggered from a specific topbar button, so it should visually anchor to
// it.

export function HelpWidget() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [tutorials, setTutorials] = useState<TutorialWithProject[] | null>(null)
  const [selected, setSelected] = useState<TutorialWithProject | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && tutorials === null) {
      listAvailableTutorials(supabase).then(setTutorials)
    }
  }, [open, tutorials, supabase])

  // Close on an outside click, same convention a topbar dropdown needs
  // regardless of which page is open behind it.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const close = () => {
    setOpen(false)
    setSelected(null)
  }

  return (
    <div className="row" style={{ position: 'relative' }} ref={rootRef}>
      <button
        type="button"
        className="btn btn-mini"
        onClick={() => setOpen((o) => !o)}
        aria-label="Help"
      >
        <HelpCircle size={12} />
        Help
      </button>

      {open && (
        <div className="popover" style={{ right: 0, left: 'auto', width: 340, maxHeight: 440, overflowY: 'auto' }}>
          {selected ? (
            <div>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <button type="button" className="btn btn-mini" onClick={() => setSelected(null)}>
                  <ArrowLeft size={11} />
                  All tutorials
                </button>
                <button type="button" className="btn btn-mini" onClick={close} aria-label="Close">
                  <X size={11} />
                </button>
              </div>
              <h3 style={{ marginTop: 0 }}>{selected.title}</h3>
              {tutorialSteps(selected).map((step, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <h4 style={{ marginBottom: 4 }}>{step.title}</h4>
                  <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: 0 }}>{step.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ marginTop: 0, marginBottom: 0 }}>Tutorials</h3>
                <button type="button" className="btn btn-mini" onClick={close} aria-label="Close">
                  <X size={11} />
                </button>
              </div>
              {tutorials === null ? (
                <p className="muted">Loading…</p>
              ) : tutorials.length === 0 ? (
                <p className="muted">No tutorials available yet for you or your project spaces.</p>
              ) : (
                tutorials.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="btn-linklike"
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 0', borderBottom: '1px solid var(--border)' }}
                    onClick={() => setSelected(t)}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {t.project ? t.project.name : 'General'}
                      {t.description ? ` — ${t.description}` : ''}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
