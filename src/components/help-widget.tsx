import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Compass, HelpCircle, Pencil, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { listAvailableTutorials, tutorialSteps, type TutorialWithProject } from '@/lib/supabase/tutorials'
import { tourStrings } from '@/lib/supabase/guided-tours'
import { useTours } from '@/state/tours'

// Help menu in the top bar, next to Profile.
//
// Guided tours come first: the ones that belong to the space and view the
// reader is in right now (reported by ProjectLayout, see state/tours.tsx), so
// a student in the Jena view sees only the Jena tour, in German. Owners and
// maintainers also get a link to the tour editor.
//
// The older plain-text tutorials (tutorials table, migration 030) stay
// reachable below the tours everywhere except in student views, where they
// are in English and describe the researcher view.

export function HelpWidget() {
  const supabase = createClient()
  const { space, tours, startTour } = useTours()
  const [open, setOpen] = useState(false)
  const [tutorials, setTutorials] = useState<TutorialWithProject[] | null>(null)
  const [selected, setSelected] = useState<TutorialWithProject | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const s = tourStrings(space?.language ?? 'en')
  const inStudentView = !!space && space.templateId !== null
  const showTextGuides = !inStudentView

  useEffect(() => {
    if (open && showTextGuides && tutorials === null) {
      listAvailableTutorials(supabase).then(setTutorials)
    }
  }, [open, showTextGuides, tutorials, supabase])

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
        aria-label={s.help}
        data-tour="help-button"
      >
        <HelpCircle size={12} />
        {s.help}
      </button>

      {open && (
        <div className="popover" style={{ right: 0, left: 'auto', width: 360, maxHeight: 480, overflowY: 'auto' }}>
          {selected ? (
            <div>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <button type="button" className="btn btn-mini" onClick={() => setSelected(null)}>
                  <ArrowLeft size={11} />
                  {s.help}
                </button>
                <button type="button" className="btn btn-mini" onClick={close} aria-label={s.close}>
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
                <h3 style={{ marginTop: 0, marginBottom: 0 }}>{s.help}</h3>
                <button type="button" className="btn btn-mini" onClick={close} aria-label={s.close}>
                  <X size={11} />
                </button>
              </div>

              {space && (
                <section style={{ marginBottom: 12 }}>
                  <p className="muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.tours}</p>
                  {tours === null ? (
                    <p className="muted">…</p>
                  ) : tours.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13 }}>{s.noTours}</p>
                  ) : (
                    tours.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="btn-linklike"
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 0', borderBottom: '1px solid var(--border)' }}
                        onClick={() => {
                          close()
                          startTour(t)
                        }}
                      >
                        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          <Compass size={14} style={{ flexShrink: 0, color: 'var(--series-a)' }} />
                          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t.title}</span>
                          {!t.is_published && <span className="chip" style={{ fontSize: 10.5 }}>{s.draft}</span>}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginLeft: 20 }}>
                          {t.description ? `${t.description} ` : ''}
                          ({s.steps(t.steps.length)})
                        </div>
                      </button>
                    ))
                  )}
                  {space.canManage && (
                    <Link
                      to={`/dashboard/${space.slug}/tours`}
                      className="btn btn-mini"
                      style={{ marginTop: 8 }}
                      onClick={close}
                    >
                      <Pencil size={11} />
                      {s.manage}
                    </Link>
                  )}
                </section>
              )}

              {showTextGuides && (
                <section>
                  {space && <p className="muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{tourStrings('en').moreHelp}</p>}
                  {tutorials === null ? (
                    <p className="muted">Loading…</p>
                  ) : tutorials.length === 0 ? (
                    !space && <p className="muted">No tutorials available yet for you or your project spaces.</p>
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
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
