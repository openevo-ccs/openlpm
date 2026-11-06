import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Compass, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { getUserProjects } from '@/lib/supabase/projects'
import { listDashboardViews, type DashboardView } from '@/lib/supabase/dashboard-views'
import {
  deleteTour,
  draftFromTour,
  emptyDraft,
  listToursOfSpace,
  saveTour,
  type GuidedTour,
  type TourDraft,
  type TourStep,
} from '@/lib/supabase/guided-tours'
import { TOUR_ANCHORS, TOUR_PAGES, getTourAnchor } from '@/lib/tour-anchors'
import { isJenaTemplate } from '@/lib/student-view-templates'
import { useTours } from '@/state/tours'

// The tour editor, for owners and maintainers of a space. Reached from the
// Help menu ("Edit tours"). A tour is a list of steps; each step has a title,
// a text, and optionally a part of the screen to point at, a "try it out" box,
// and a few settings for parts that are not always on screen.

type Scope = 'all' | `view:${string}` | `template:${string}`

function scopeOf(d: TourDraft): Scope {
  if (d.view_id) return `view:${d.view_id}`
  if (d.template_id) return `template:${d.template_id}`
  return 'all'
}

function applyScope(d: TourDraft, scope: Scope): TourDraft {
  if (scope === 'all') return { ...d, view_id: null, template_id: null }
  if (scope.startsWith('view:')) return { ...d, view_id: scope.slice(5), template_id: null }
  return { ...d, view_id: null, template_id: scope.slice(9) }
}

export default function TourEditorPage() {
  const { project, role, slug, supabase } = useOutletContext<ProjectOutletContext>()
  const { startTour, refreshTours } = useTours()
  const canManage = role === 'owner' || role === 'maintainer'

  const [tours, setTours] = useState<GuidedTour[] | null>(null)
  const [views, setViews] = useState<DashboardView[]>([])
  const [otherSpaces, setOtherSpaces] = useState<{ id: string; name: string }[]>([])
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<TourDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  const reload = useCallback(async () => {
    setTours(await listToursOfSpace(supabase, project.id))
  }, [supabase, project.id])

  useEffect(() => {
    void reload()
    listDashboardViews(supabase, project.id).then(setViews)
    getUserProjects(supabase).then((rows) =>
      setOtherSpaces(
        rows
          .filter((r) => (r.role === 'owner' || r.role === 'maintainer') && r.project.id !== project.id)
          .map((r) => ({ id: r.project.id, name: r.project.name })),
      ),
    )
  }, [reload, supabase, project.id])

  const scopeOptions = useMemo(() => {
    const opts: { value: Scope; label: string }[] = [{ value: 'all', label: 'Every view of this space' }]
    const seen = new Set<string>()
    for (const v of views) {
      if (v.kind === 'template' && v.template_id) {
        const value = `template:${v.template_id}` as Scope
        if (seen.has(value)) continue
        seen.add(value)
        opts.push({ value, label: `Only the view “${v.name}”` })
      } else if (v.kind === 'standard') {
        opts.push({ value: `view:${v.id}`, label: `Only the view “${v.name}”` })
      }
    }
    // A tour shared in from another space may point at a template this space has no view for.
    const current = scopeOf(draft)
    if (current !== 'all' && !opts.some((o) => o.value === current)) {
      opts.push({ value: current, label: current.startsWith('template:') ? `Only views of type “${current.slice(9)}”` : 'Only one specific view' })
    }
    return opts
  }, [views, draft])

  const templateInScope = draft.template_id ?? null
  const anchorsAllowed = useMemo(
    () =>
      TOUR_ANCHORS.filter((a) => !a.templates || (a.templates === 'jena' && isJenaTemplate(templateInScope))),
    [templateInScope],
  )
  const pagesAllowed = useMemo(
    () => TOUR_PAGES.filter((p) => !p.templates || (p.templates === 'jena' && isJenaTemplate(templateInScope))),
    [templateInScope],
  )

  const scopeLabel = (t: GuidedTour) => {
    if (t.view_id) return views.find((v) => v.id === t.view_id)?.name ?? 'One view'
    if (t.template_id) return views.find((v) => v.template_id === t.template_id)?.name ?? 'One kind of view'
    return 'Every view'
  }

  const startEdit = (t: GuidedTour | null) => {
    setMessage(null)
    if (t) {
      setDraft(draftFromTour(t))
      setEditing(t.id)
    } else {
      const base = emptyDraft(project.working_languages?.length === 1 && project.working_languages[0] === 'en' ? 'en' : 'de')
      setDraft(base)
      setEditing('new')
    }
  }

  const patchStep = (i: number, patch: Partial<TourStep>) =>
    setDraft((d) => ({ ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  const chooseAnchor = (i: number, key: string) => {
    const anchor = getTourAnchor(key)
    if (!key) {
      patchStep(i, { anchor: undefined })
      return
    }
    // A part that lives on one page moves the tour to that page; a part that is
    // on every page keeps the tour where it is.
    const page = anchor && anchor.page !== '*' ? anchor.page : undefined
    patchStep(i, { anchor: key, page })
  }

  const moveStep = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir
      if (j < 0 || j >= d.steps.length) return d
      const steps = [...d.steps]
      ;[steps[i], steps[j]] = [steps[j], steps[i]]
      return { ...d, steps }
    })

  const problem = (): string | null => {
    if (!draft.title.trim()) return 'Give the tour a title.'
    if (draft.steps.length === 0) return 'Add at least one step.'
    const bad = draft.steps.findIndex((s) => !s.title.trim() || !s.body.trim())
    if (bad >= 0) return `Step ${bad + 1} needs a title and a text.`
    return null
  }

  const save = async (): Promise<string | null> => {
    const p = problem()
    if (p) {
      setMessage({ kind: 'bad', text: p })
      return null
    }
    setSaving(true)
    const nextOrder = (tours?.reduce((m, t) => Math.max(m, t.sort_order), -1) ?? -1) + 1
    const result = await saveTour(supabase, project.id, editing === 'new' ? null : editing, draft, nextOrder)
    setSaving(false)
    if (result.error || !result.id) {
      setMessage({ kind: 'bad', text: `Could not save: ${result.error ?? 'unknown problem'}` })
      return null
    }
    setMessage({ kind: 'ok', text: 'Saved.' })
    setEditing(result.id)
    await reload()
    refreshTours()
    return result.id
  }

  const saveAndPreview = async (startAt: number) => {
    const id = await save()
    if (!id) return
    const fresh = (await listToursOfSpace(supabase, project.id)).find((t) => t.id === id)
    if (fresh) startTour(fresh, startAt)
  }

  const remove = async (t: GuidedTour) => {
    if (!window.confirm(`Delete the tour “${t.title}”? This cannot be undone.`)) return
    const err = await deleteTour(supabase, t.id)
    if (err) setMessage({ kind: 'bad', text: `Could not delete: ${err}` })
    else {
      if (editing === t.id) setEditing(null)
      await reload()
      refreshTours()
    }
  }

  if (!canManage) {
    return (
      <div className="card empty">
        <p>Only owners and maintainers of this space can edit its tours.</p>
        <Link to={`/dashboard/${slug}`} className="btn btn-mini">Back</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <Link to={`/dashboard/${slug}`} className="row muted" style={{ marginBottom: 10 }}>
        <ArrowLeft size={14} />
        Back to {project.name}
      </Link>
      <h1 className="row" style={{ gap: 8 }}>
        <Compass size={20} />
        Guided tours
      </h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        A tour walks people through the space step by step. It shows up under Help for the people it is meant for.
        To test a tour properly, first switch to the view it is written for with “Preview as” in the side menu, then
        use “Save and preview”.
      </p>

      {message && <div className={`notice ${message.kind === 'bad' ? 'notice-bad' : 'notice-ok'}`}>{message.text}</div>}

      {editing === null && (
        <>
          <div className="row" style={{ marginBottom: 10 }}>
            <button type="button" className="btn btn-primary btn-mini" onClick={() => startEdit(null)}>
              <Plus size={12} />
              New tour
            </button>
          </div>
          {tours === null ? (
            <p className="muted">Loading…</p>
          ) : tours.length === 0 ? (
            <div className="card empty"><p>This space has no tours yet.</p></div>
          ) : (
            tours.map((t) => (
              <div key={t.id} className="card">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{t.title}</strong>{' '}
                    <span className="chip" style={{ fontSize: 10.5 }}>{t.is_published ? 'Published' : 'Draft'}</span>
                    <p className="muted" style={{ margin: '2px 0 0' }}>
                      {t.steps.length} steps · {scopeLabel(t)} · {t.language === 'en' ? 'English' : 'Deutsch'}
                      {t.space_ids.length > 0 ? ` · also in ${t.space_ids.length} other space${t.space_ids.length === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                  <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                    <button type="button" className="btn btn-mini" onClick={() => startTour(t)}>
                      <Play size={11} />
                      Start
                    </button>
                    <button type="button" className="btn btn-mini" onClick={() => startEdit(t)}>
                      <Pencil size={11} />
                      Edit
                    </button>
                    <button type="button" className="btn btn-mini btn-danger" onClick={() => remove(t)} aria-label="Delete tour">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {editing !== null && (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{editing === 'new' ? 'New tour' : 'Edit tour'}</h3>
              <button type="button" className="btn btn-mini" onClick={() => { setEditing(null); setMessage(null) }}>
                <X size={11} />
                Close editor
              </button>
            </div>
            <div className="field">
              <label htmlFor="tour-title">Title</label>
              <input id="tour-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="tour-desc">One line shown in the Help menu</label>
              <input id="tour-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div className="field" style={{ flex: '1 1 260px' }}>
                <label htmlFor="tour-scope">Who sees it</label>
                <select id="tour-scope" value={scopeOf(draft)} onChange={(e) => setDraft(applyScope(draft, e.target.value as Scope))}>
                  {scopeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: '0 0 160px' }}>
                <label htmlFor="tour-lang">Language of the tour</label>
                <select id="tour-lang" value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value })}>
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            {otherSpaces.length > 0 && (
              <div className="field">
                <label>Also show this tour in these other spaces (you manage them)</label>
                {otherSpaces.map((sp) => (
                  <label key={sp.id} className="row" style={{ gap: 6, fontWeight: 400, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={draft.space_ids.includes(sp.id)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          space_ids: e.target.checked ? [...draft.space_ids, sp.id] : draft.space_ids.filter((x) => x !== sp.id),
                        })
                      }
                    />
                    {sp.name}
                  </label>
                ))}
              </div>
            )}

            <label className="row" style={{ gap: 6, fontSize: 13, marginBottom: 6 }}>
              <input type="checkbox" checked={draft.is_published} onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} />
              Published (people in the space can see it under Help). Leave this off while you are still writing.
            </label>
            <label className="row" style={{ gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={draft.offer_on_first_visit} onChange={(e) => setDraft({ ...draft, offer_on_first_visit: e.target.checked })} />
              Offer the tour once when someone first opens this view (they can say “Später”).
            </label>
          </div>

          <h3 style={{ margin: '14px 0 8px' }}>Steps</h3>
          {draft.steps.map((step, i) => {
            const chosen = step.anchor ? getTourAnchor(step.anchor) : null
            const groups = Array.from(new Set(anchorsAllowed.map((a) => a.group)))
            const chosenMissing = step.anchor && !anchorsAllowed.some((a) => a.key === step.anchor)
            return (
              <div key={i} className="tour-edit-step">
                <div className="tour-edit-step-head">
                  <strong>Step {i + 1}</strong>
                  <div className="row" style={{ gap: 4 }}>
                    <button type="button" className="btn btn-mini" onClick={() => saveAndPreview(i)} disabled={saving} title="Save the tour and start it at this step">
                      <Play size={11} />
                      Preview from here
                    </button>
                    <button type="button" className="btn btn-mini" onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label="Move step up"><ArrowUp size={11} /></button>
                    <button type="button" className="btn btn-mini" onClick={() => moveStep(i, 1)} disabled={i === draft.steps.length - 1} aria-label="Move step down"><ArrowDown size={11} /></button>
                    <button
                      type="button"
                      className="btn btn-mini btn-danger"
                      onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}
                      aria-label="Delete step"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label>Title</label>
                  <input value={step.title} onChange={(e) => patchStep(i, { title: e.target.value })} />
                </div>
                <div className="field">
                  <label>Text (leave an empty line between paragraphs)</label>
                  <textarea value={step.body} onChange={(e) => patchStep(i, { body: e.target.value })} />
                </div>
                <div className="field">
                  <label>Part of the screen to point at</label>
                  <select value={step.anchor ?? ''} onChange={(e) => chooseAnchor(i, e.target.value)}>
                    <option value="">Nothing. Show the text in the middle of the screen.</option>
                    {chosenMissing && step.anchor && <option value={step.anchor}>{chosen?.label ?? step.anchor} (not available for this audience)</option>}
                    {groups.map((g) => (
                      <optgroup key={g} label={g}>
                        {anchorsAllowed.filter((a) => a.group === g).map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {!step.anchor && (
                  <div className="field">
                    <label>Page this step happens on</label>
                    <select value={step.page ?? '__stay'} onChange={(e) => patchStep(i, { page: e.target.value === '__stay' ? undefined : e.target.value })}>
                      <option value="__stay">Stay on the current page</option>
                      {pagesAllowed.map((p) => <option key={p.path || 'start'} value={p.path}>{p.label}</option>)}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label>“Try it out” box (optional): something the reader can do right now</label>
                  <textarea style={{ minHeight: 52 }} value={step.tryIt ?? ''} onChange={(e) => patchStep(i, { tryIt: e.target.value })} />
                </div>
                {step.anchor && (
                  <details>
                    <summary className="muted" style={{ cursor: 'pointer' }}>For parts that are not always on screen</summary>
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>Message to show if the part cannot be seen</label>
                      <textarea style={{ minHeight: 52 }} value={step.hint ?? ''} onChange={(e) => patchStep(i, { hint: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Click this first if the part cannot be seen yet (for example to open a card)</label>
                      <select value={step.openFirst ?? ''} onChange={(e) => patchStep(i, { openFirst: e.target.value || undefined })}>
                        <option value="">Nothing</option>
                        {anchorsAllowed.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                      </select>
                    </div>
                  </details>
                )}
              </div>
            )
          })}
          <button
            type="button"
            className="btn btn-mini"
            onClick={() => setDraft({ ...draft, steps: [...draft.steps, { title: '', body: '' }] })}
          >
            <Plus size={12} />
            Add a step
          </button>

          <div className="row" style={{ gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn" onClick={() => saveAndPreview(0)} disabled={saving}>
              <Play size={13} />
              Save and preview
            </button>
          </div>
        </>
      )}
    </div>
  )
}
