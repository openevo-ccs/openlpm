import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BookCheck, Download, ExternalLink, Plus, SkipForward } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { findLiteraturebaseMatchesByDoi } from '@/lib/supabase/literature'
import { verifyDOI } from '@/lib/api/crossref'
import { doiUrl, formatApa, recordLink } from '@/lib/apa-citation'
import {
  AGE_BANDS, DESIGNS, SLICES, TOPICS, addReview, addSuggestion, latestReviews, listReviews, listSuggestions, loadQueue, reviewsToCsv,
  type QueueRecord, type ReviewRow, type SuggestionRow,
} from '@/lib/supabase/literature-workshop'

// EvoKE Literature Workshop (migration 246). Three tabs: review one record at a time, propose a missing paper by DOI, see what the group has done.

type Tab = 'review' | 'add' | 'group'

interface Me { id: string; name: string }

function useMe(supabase: ProjectOutletContext['supabase']): Me | null {
  const [me, setMe] = useState<Me | null>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('users').select('name,email').eq('id', user.id).maybeSingle()
      const name = (data?.name || data?.email || user.email || 'A member').split('@')[0]
      if (alive) setMe({ id: user.id, name })
    })()
    return () => { alive = false }
  }, [supabase])
  return me
}

export default function LiteratureReviewPage() {
  const { project, supabase, role } = useOutletContext<ProjectOutletContext>()
  const me = useMe(supabase)
  const [tab, setTab] = useState<Tab>('review')
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionRow[] | null>(null)
  const canWrite = role !== 'viewer'

  const reload = useCallback(async () => {
    setReviews(await listReviews(supabase, project.id))
    setSuggestions(await listSuggestions(supabase, project.id))
  }, [supabase, project.id])
  useEffect(() => { reload() }, [reload])

  const mine = useMemo(() => (me && reviews ? reviews.filter((r) => r.reviewer_id === me.id) : []), [me, reviews])
  const myIds = useMemo(() => new Set(mine.map((r) => r.record_id)), [mine])

  return (
    <div>
      <h1 className="row"><BookCheck size={18} style={{ color: 'var(--text-muted)' }} />Literature Workshop</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Check, tag and annotate the records of the library, one at a time. Every review is saved under your name and goes back into the library in a weekly batch.
        You have reviewed {mine.length} record{mine.length === 1 ? '' : 's'}.
      </p>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        <button className={`btn btn-mini${tab === 'review' ? ' btn-primary' : ''}`} onClick={() => setTab('review')}>Review a record</button>
        <button className={`btn btn-mini${tab === 'add' ? ' btn-primary' : ''}`} onClick={() => setTab('add')}>Propose a missing paper</button>
        <button className={`btn btn-mini${tab === 'group' ? ' btn-primary' : ''}`} onClick={() => setTab('group')}>What the group has done</button>
      </div>
      {!canWrite && <p className="notice">You can read everything here. Ask the space owner for a contributor role to add reviews.</p>}
      {tab === 'review' && <ReviewTab me={me} canWrite={canWrite} reviews={reviews ?? []} myIds={myIds} onSaved={reload} projectId={project.id} supabase={supabase} />}
      {tab === 'add' && <AddTab me={me} canWrite={canWrite} suggestions={suggestions} onSaved={reload} projectId={project.id} supabase={supabase} />}
      {tab === 'group' && <GroupTab reviews={reviews ?? []} suggestions={suggestions ?? []} />}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------------------

function Citation({ rec }: { rec: QueueRecord }) {
  const parts = useMemo(() => formatApa(rec.type ?? undefined, rec.citation), [rec])
  const link = recordLink(rec.citation)
  return (
    <p style={{ fontSize: 15, lineHeight: 1.5, margin: '4px 0 8px' }}>
      {parts.map((p, i) => (p.italic ? <em key={i}>{p.text}</em> : <span key={i}>{p.text}</span>))}
      {link && <a href={link} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}><ExternalLink size={13} /> open</a>}
    </p>
  )
}

function Toggle({ options, value, onChange, multi }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button key={o} type="button" className={`btn btn-mini${on ? ' btn-primary' : ''}`} onClick={() => onChange(multi ? (on ? value.filter((x) => x !== o) : [...value, o]) : on ? [] : [o])}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

interface FormState {
  citationOk: string[]
  fixNote: string
  relevance: string[]
  ages: string[]
  topics: string[]
  design: string[]
  instrument: string
  country: string
  adds: string
}
const EMPTY: FormState = { citationOk: [], fixNote: '', relevance: [], ages: [], topics: [], design: [], instrument: '', country: '', adds: '' }

function ReviewTab({ me, canWrite, reviews, myIds, onSaved, projectId, supabase }: {
  me: Me | null; canWrite: boolean; reviews: ReviewRow[]; myIds: Set<string>; onSaved: () => Promise<void>; projectId: string; supabase: ProjectOutletContext['supabase']
}) {
  const [slice, setSlice] = useState(SLICES[0].domain ?? '')
  const [queue, setQueue] = useState<QueueRecord[] | null>(null)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!me) return
    let alive = true
    setQueue(null)
    setSkipped(new Set())
    loadQueue(supabase, slice || null, me.id).then((q) => alive && setQueue(q))
    return () => { alive = false }
  }, [supabase, slice, me])

  const todo = useMemo(() => (queue ?? []).filter((r) => !myIds.has(r.id) && !skipped.has(r.id)), [queue, myIds, skipped])
  const rec = todo[0]
  const others = useMemo(() => (rec ? latestReviews(reviews).filter((r) => r.record_id === rec.id) : []), [rec, reviews])
  useEffect(() => { setForm(EMPTY); setError(null) }, [rec?.id])

  const save = async () => {
    if (!rec || !me) return
    if (form.citationOk.length === 0 || form.relevance.length === 0) { setError('Please answer the first two questions.'); return }
    if (form.citationOk[0] === 'needs-fix' && !form.fixNote.trim()) { setError('Say what needs fixing.'); return }
    setSaving(true)
    setError(null)
    try {
      await addReview(supabase, {
        project_id: projectId, record_id: rec.id, reviewer_id: me.id, reviewer_name: me.name,
        citation_ok: form.citationOk[0] as ReviewRow['citation_ok'], fix_note: form.fixNote.trim() || null,
        relevance: form.relevance[0] as ReviewRow['relevance'], age_bands: form.ages, topics: form.topics,
        design: form.design[0] ?? null, instrument: form.instrument.trim() || null, country: form.country.trim() || null, adds_note: form.adds.trim() || null,
      })
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="field" style={{ maxWidth: 380, marginBottom: 12 }}>
        <label>Which part of the library?</label>
        <select value={slice} onChange={(e) => setSlice(e.target.value)}>
          {SLICES.map((s) => <option key={s.label} value={s.domain ?? ''}>{s.label}</option>)}
        </select>
      </div>
      {queue === null ? <p className="muted">Loading…</p> : !rec ? (
        <div className="card empty"><p>Nothing left in this part of the library for you. Pick another part, or look at what the group has done.</p></div>
      ) : (
        <div className="card">
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>{todo.length} left in this part · library status: {rec.review_status ?? 'unknown'}{rec.domains.length ? ` · tags: ${rec.domains.join(', ')}` : ' · no topic tag yet'}</p>
          <Citation rec={rec} />
          {others.length > 0 && (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Already reviewed by {others.map((o) => `${o.reviewer_name} (citation ${o.citation_ok}, relevance ${o.relevance})`).join('; ')}.
            </p>
          )}
          <fieldset disabled={!canWrite || saving} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="field"><label>1. Is the citation right (authors, year, title, journal)?</label>
              <Toggle options={['correct', 'needs-fix', 'cannot-tell']} value={form.citationOk} onChange={(v) => setForm({ ...form, citationOk: v })} />
              {form.citationOk[0] === 'needs-fix' && <input style={{ marginTop: 6 }} placeholder="What needs fixing?" value={form.fixNote} onChange={(e) => setForm({ ...form, fixNote: e.target.value })} />}
            </div>
            <div className="field"><label>2. Is it about evolution education?</label>
              <Toggle options={['yes', 'partly', 'no']} value={form.relevance} onChange={(v) => setForm({ ...form, relevance: v })} />
            </div>
            <div className="field"><label>3. Which ages or grades does it concern? (optional)</label>
              <Toggle multi options={AGE_BANDS} value={form.ages} onChange={(v) => setForm({ ...form, ages: v })} />
            </div>
            <div className="field"><label>4. Which topics? (optional)</label>
              <Toggle multi options={TOPICS} value={form.topics} onChange={(v) => setForm({ ...form, topics: v })} />
            </div>
            <div className="field"><label>5. Study design (optional)</label>
              <Toggle options={DESIGNS} value={form.design} onChange={(v) => setForm({ ...form, design: v })} />
            </div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Instrument, if named</label><input value={form.instrument} onChange={(e) => setForm({ ...form, instrument: e.target.value })} placeholder="for example ACORNS, CINS, KAEVO" /></div>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Country or sample</label><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="for example Germany, grade 8" /></div>
            </div>
            <div className="field"><label>What does it add to the field? One line, in your words (optional)</label>
              <textarea rows={2} value={form.adds} onChange={(e) => setForm({ ...form, adds: e.target.value })} />
            </div>
          </fieldset>
          {error && <p className="notice notice-bad">{error}</p>}
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" disabled={!canWrite || saving || !me} onClick={save}>{saving ? 'Saving…' : 'Save and next'}</button>
            <button className="btn" onClick={() => setSkipped(new Set([...skipped, rec.id]))}><SkipForward size={13} /> Skip</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------------------

function AddTab({ me, canWrite, suggestions, onSaved, projectId, supabase }: {
  me: Me | null; canWrite: boolean; suggestions: SuggestionRow[] | null; onSaved: () => Promise<void>; projectId: string; supabase: ProjectOutletContext['supabase']
}) {
  const [doi, setDoi] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const clean = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '')
    if (!clean || !me) return
    setBusy(true)
    setMsg(null)
    try {
      const existing = await findLiteraturebaseMatchesByDoi(supabase, [clean.toLowerCase()])
      if (existing.size > 0) { setMsg('That paper is already in the library. Look for it in the review queue.'); return }
      const v = await verifyDOI(clean)
      if (!v.verified) { setMsg('Crossref could not confirm that DOI. Check it for typos, or add a note and propose it anyway below.'); return }
      await addSuggestion(supabase, { project_id: projectId, doi: v.doi ?? clean, title: v.title ?? null, note: note.trim() || null, suggested_by: me.id, suggested_name: me.name })
      setMsg(`Proposed: ${v.title}`)
      setDoi('')
      setNote('')
      await onSaved()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Saving failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="field"><label>DOI of the missing paper</label><input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.1007/s12052-009-0142-3" disabled={!canWrite} /></div>
        <div className="field"><label>Why it belongs (optional)</label><input value={note} onChange={(e) => setNote(e.target.value)} disabled={!canWrite} /></div>
        <button className="btn btn-primary" onClick={submit} disabled={!canWrite || busy || !doi.trim() || !me}><Plus size={13} /> {busy ? 'Checking…' : 'Check and propose'}</button>
        {msg && <p className="muted" style={{ marginTop: 8 }}>{msg}</p>}
      </div>
      <h3>Proposed so far</h3>
      {suggestions === null ? <p className="muted">Loading…</p> : suggestions.length === 0 ? <p className="muted">Nothing proposed yet.</p> : suggestions.map((s) => (
        <div key={s.id} className="card" style={{ marginBottom: 6 }}>
          <strong>{s.title ?? s.doi}</strong> <span className="muted">· {s.suggested_name} · {s.status}</span>
          <div style={{ fontSize: 12.5 }}><a href={doiUrl(s.doi) ?? undefined} target="_blank" rel="noreferrer">{s.doi}</a>{s.note ? ` · ${s.note}` : ''}</div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------------------

function GroupTab({ reviews, suggestions }: { reviews: ReviewRow[]; suggestions: SuggestionRow[] }) {
  const latest = useMemo(() => latestReviews(reviews), [reviews])
  const byPerson = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of latest) m.set(r.reviewer_name, (m.get(r.reviewer_name) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [latest])
  const records = new Set(latest.map((r) => r.record_id)).size
  const needsFix = latest.filter((r) => r.citation_ok === 'needs-fix')
  const download = () => {
    const blob = new Blob([reviewsToCsv(reviews)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'literature-workshop-reviews.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div>
      <p>{latest.length} reviews of {records} records · {suggestions.length} papers proposed · {needsFix.length} citations flagged for a fix.</p>
      <h3>Reviews per person</h3>
      {byPerson.length === 0 ? <p className="muted">No reviews yet.</p> : <ul>{byPerson.map(([n, c]) => <li key={n}>{n}: {c}</li>)}</ul>}
      {needsFix.length > 0 && (
        <>
          <h3>Citations flagged for a fix</h3>
          {needsFix.map((r) => <p key={r.id} style={{ fontSize: 13 }}><code>{r.record_id}</code>: {r.fix_note} <span className="muted">({r.reviewer_name})</span></p>)}
        </>
      )}
      <button className="btn" onClick={download} disabled={reviews.length === 0}><Download size={13} /> Download all reviews (CSV)</button>
    </div>
  )
}
