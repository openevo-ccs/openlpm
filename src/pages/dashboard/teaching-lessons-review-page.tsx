import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import { LanguageSwitch } from '@/components/language-switch'
import { ReviewItem } from '@/components/teaching-review-item'
import { DRAFT_LABEL } from '@/lib/supabase/curriculum-repository'
import {
  addVerdict,
  currentReviewer,
  filterLessons,
  isLessonReviewed,
  latestVerdicts,
  lessonProgress,
  linkProgress,
  listLessons,
  listVerdicts,
  summaryOf,
  verdictKey,
  verdictsExport,
  type ItemKind,
  type LessonLink,
  type LessonRow,
  type Verdict,
  type VerdictRow,
} from '@/lib/supabase/teaching-lessons-review'
import { KIND_ORDER, T, type Lang } from './teaching-lessons-review-strings'

// Teaching lessons review (Dustin, 2026-11-11): experts check, inside OpenLPM, the links a language model drafted between TeachingBase
// lessons and the other base repos. Admin-only for now (the Admin area gates the page, the database rules gate the writes).
// Verdicts are append-only rows (migration 240); the newest per item counts. "Download verdicts" saves them for a session to carry back
// into the teachingbase repo. Design note: lab_manager/docs/design-notes/openlpm-teaching-lessons-review-2026-11-11.md

function ProgressBar({ judged, total }: { judged: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((judged / total) * 100)
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-1)', border: '1px solid var(--border)', overflow: 'hidden', minWidth: 60 }} aria-hidden>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--series-a)' }} />
    </div>
  )
}

export default function TeachingLessonsReviewPage() {
  const { isAdmin } = useSession()
  const supabase = useMemo(() => createClient(), [])
  const [params] = useSearchParams()
  const [lang, setLang] = useState<Lang>('en')
  const t = T[lang]

  const [lessons, setLessons] = useState<LessonRow[] | null>(null)
  const [verdicts, setVerdicts] = useState<VerdictRow[]>([])
  const [available, setAvailable] = useState(true)
  const [reviewer, setReviewer] = useState<{ id: string; name: string } | null>(null)
  const [collection, setCollection] = useState('')
  const [review, setReview] = useState<'' | 'open' | 'reviewed'>('')
  const [sampleOnly, setSampleOnly] = useState(false)
  const [graphOnly, setGraphOnly] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    let alive = true
    Promise.all([listLessons(supabase), listVerdicts(supabase), currentReviewer(supabase)]).then(([l, v, r]) => {
      if (!alive) return
      setLessons(l.lessons)
      setVerdicts(v.rows)
      setAvailable(l.available && v.available)
      setReviewer(r)
    })
    return () => { alive = false }
  }, [supabase, isAdmin])

  const latest = useMemo(() => latestVerdicts(verdicts), [verdicts])
  const selectedId = params.get('lesson')
  const selected = useMemo(() => (lessons ?? []).find((l) => l.id === selectedId) ?? null, [lessons, selectedId])

  const judge = useCallback(async (lesson: LessonRow, kind: ItemKind, item: LessonLink | LessonRow['data']['components'][number], verdict: Verdict, note: string | null): Promise<string | null> => {
    if (!reviewer) return 'not signed in'
    const { row, error } = await addVerdict(supabase, reviewer, {
      lesson_id: lesson.id, item_kind: kind, item_key: item.item_key, item_summary: summaryOf(item, kind), verdict, note,
    })
    if (error || !row) return error ?? 'unknown error'
    setVerdicts((cur) => [...cur, row])
    return null
  }, [supabase, reviewer])

  const download = () => {
    const payload = { exported_at: new Date().toISOString(), source: 'teachingbase_link_verdicts', verdicts: verdictsExport(latest) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `teaching-lesson-verdicts-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isAdmin) {
    return (
      <div>
        <h1>{T.en.title}</h1>
        <p className="muted">This page isn&apos;t available to your account.</p>
      </div>
    )
  }

  const header = (
    <>
      <h1 className="row" style={{ gap: 8 }}><GraduationCap size={18} style={{ color: 'var(--text-muted)' }} />{t.title}</h1>
      <div className="row tlr-lang" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <LanguageSwitch value={lang} onChange={(l) => setLang(l as Lang)} uiLang={lang} languages={['en', 'de']} />
      </div>
    </>
  )

  if (lessons === null) return <div>{header}<p className="muted">{t.loading}</p></div>
  if (!available || lessons.length === 0) return <div>{header}<p className="muted">{t.notReady}</p></div>

  const overall = linkProgress(lessons, latest)
  const start = linkProgress(lessons, latest, true)
  const toolbar = (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: 180, flex: '1 1 220px' }}>
          <strong data-testid="overall-progress">{overall.judged} {t.of} {overall.total} {t.overall}</strong>
          <ProgressBar {...overall} />
        </div>
        <div className="muted" style={{ fontSize: 12.5 }} data-testid="start-progress">{t.startHere}: {start.judged} {t.of} {start.total}</div>
        <button type="button" className="btn tlr-tap" onClick={download} title={t.downloadHint}><Download size={14} /> {t.download}</button>
      </div>
    </div>
  )

  if (selected) {
    const d = selected.data
    const p = lessonProgress(selected, latest)
    const title = (lang === 'de' && d.title.de) || d.title.en
    const description = ((lang === 'de' && d.description.de) || d.description.en || '').trim()
    const shortDescription = description.length > 420 ? `${description.slice(0, 420)}…` : description
    const pageUrl = d.source_pages?.[lang] ?? d.source_pages?.en
    const byType = KIND_ORDER.map((k) => ({ kind: k, links: d.links.filter((l) => l.type === k) })).filter((g) => g.links.length > 0)
    const known = new Set(KIND_ORDER)
    const other = d.links.filter((l) => !known.has(l.type))
    if (other.length > 0) byType.push({ kind: 'other', links: other })
    return (
      <div>
        {header}
        {toolbar}
        <Link to="/dashboard/admin/teaching-lessons" className="btn btn-mini tlr-tap"><ArrowLeft size={13} /> {t.back}</Link>
        <div className="card" style={{ marginTop: 10 }}>
          <h2 style={{ marginBottom: 6, overflowWrap: 'anywhere' }}>{title}</h2>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className="chip chip-draft" data-testid="draft-tag">{DRAFT_LABEL[lang]}</span>
            {selected.collections.map((c) => <span key={c} className="chip">{c.replace(/-/g, ' ')}</span>)}
          </div>
          {shortDescription && <p style={{ margin: '0 0 8px' }}>{shortDescription}</p>}
          <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
            {d.grades.length > 0 && <>{t.grades}: {d.grades.join(', ')}. </>}
            {d.subjects.length > 0 && <>{t.subjects}: {d.subjects.join(', ')}. </>}
            {d.material_types.length > 0 && <>{t.types}: {d.material_types.join(', ')}.</>}
          </p>
          {pageUrl && <p style={{ margin: '8px 0 0' }}><a href={pageUrl} target="_blank" rel="noreferrer" className="row tlr-link" style={{ gap: 4 }}>{t.open} <ExternalLink size={12} /></a></p>}
          <p style={{ margin: '10px 0 0', fontWeight: 600 }} data-testid="lesson-progress">{p.judged} {t.of} {p.total} {t.judgedOf}</p>
          <ProgressBar {...p} />
        </div>

        {selected.link_count === 0 && d.components.length === 0 && <p className="muted">{t.noLinks}</p>}

        {d.components.length > 0 && (
          <section className="card">
            <h3>{t.components} ({d.components.length})</h3>
            <p className="muted" style={{ fontSize: 12.5 }}>{t.componentsHint}</p>
            <ul className="tlr-list">
              {d.components.map((c) => (
                <ReviewItem key={c.item_key} kind="component" item={c} lang={lang} latest={latest.get(verdictKey(selected.id, 'component', c.item_key))}
                  onJudge={(v, n) => judge(selected, 'component', c, v, n)} />
              ))}
            </ul>
          </section>
        )}

        {byType.length > 0 && (
          <section>
            <h3 style={{ marginBottom: 2 }}>{t.links} ({d.links.length})</h3>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{t.linksHint}</p>
            {byType.map((g) => (
              <div key={g.kind} className="card">
                <h3>{t.kind[g.kind] ?? g.kind} ({g.links.length})</h3>
                <ul className="tlr-list">
                  {g.links.map((l) => (
                    <ReviewItem key={l.item_key} kind="link" item={l} lang={lang} latest={latest.get(verdictKey(selected.id, 'link', l.item_key))}
                      onJudge={(v, n) => judge(selected, 'link', l, v, n)} />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        <section className="card">
          <h3>{t.assets} ({d.assets.length})</h3>
          {d.assets.length === 0 ? <p className="muted">{t.none}</p> : (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {d.assets.map((a, i) => (
                <li key={a.id ?? i} style={{ overflowWrap: 'anywhere', marginBottom: 4 }} className="tlr-asset">
                  {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="tlr-link">{a.label || a.anchor_text || a.url}</a> : (a.label || a.anchor_text)}
                  <span className="muted" style={{ fontSize: 12 }}> &middot; {a.kind} &middot; {t.rightsStatus}: {a.rights?.status ?? t.unknown}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3>{t.rights} ({d.rights_flags.length})</h3>
          {d.rights_flags.length === 0 ? <p className="muted">{t.none}</p> : (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {d.rights_flags.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r.issue}</li>)}
            </ul>
          )}
        </section>
      </div>
    )
  }

  const collections = [...new Set(lessons.flatMap((l) => l.collections))].sort()
  const shown = filterLessons(lessons, latest, { collection, review, sampleOnly, graphOnly, search })
  return (
    <div>
      {header}
      <p className="muted" style={{ marginBottom: 6 }}>{t.intro}</p>
      <p className="muted" style={{ marginTop: 0 }}><span className="chip chip-draft">{DRAFT_LABEL[lang]}</span> {t.draftHint}</p>
      {toolbar}
      <div className="card tlr-filters">
        <label className="field"><span>{t.search}</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="field"><span>{t.collection}</span>
          <select value={collection} onChange={(e) => setCollection(e.target.value)}>
            <option value="">{t.allCollections}</option>
            {collections.map((c) => <option key={c} value={c}>{c.replace(/-/g, ' ')}</option>)}
          </select>
        </label>
        <label className="field"><span>{t.status}</span>
          <select value={review} onChange={(e) => setReview(e.target.value as '' | 'open' | 'reviewed')}>
            <option value="">{t.allStatus}</option>
            <option value="open">{t.stillOpen}</option>
            <option value="reviewed">{t.reviewedOnly}</option>
          </select>
        </label>
        <label className="row tlr-tap" style={{ gap: 6 }}><input type="checkbox" checked={sampleOnly} onChange={(e) => setSampleOnly(e.target.checked)} /> {t.onlyStartHere}</label>
        <label className="row tlr-tap" style={{ gap: 6 }}><input type="checkbox" checked={graphOnly} onChange={(e) => setGraphOnly(e.target.checked)} /> {t.onlyWithLinks}</label>
      </div>
      <p className="muted" style={{ fontSize: 12.5 }} data-testid="lesson-count">{shown.length} {t.lessons}</p>
      {shown.length === 0 && <p className="muted">{t.nothing}</p>}
      <ul className="tlr-list">
        {shown.map((l) => {
          const p = lessonProgress(l, latest)
          return (
            <li key={l.id} className="tlr-lesson">
              <Link to={`/dashboard/admin/teaching-lessons?lesson=${encodeURIComponent(l.id)}`} className="tlr-lesson-link" data-testid="lesson-link">
                <strong style={{ overflowWrap: 'anywhere' }}>{(lang === 'de' && l.data.title.de) || l.label}</strong>
                <span className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {l.link_count === 0
                    ? <span className="muted" style={{ fontSize: 12 }}>{t.noLinks}</span>
                    : <span className="muted" style={{ fontSize: 12 }}>{p.judged} {t.of} {p.total} {t.judgedOf}</span>}
                  {l.sample_count > 0 && <span className="chip chip-progress">{l.sample_count} {t.startHereCount}</span>}
                  {isLessonReviewed(l, latest) && <span className="chip chip-good">{t.reviewedOnly}</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
