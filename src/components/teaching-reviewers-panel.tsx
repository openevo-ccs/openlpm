import { useCallback, useEffect, useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { addReviewer, candidatesFor, listReviewers, removeReviewer, searchPeople, type PersonHit, type ReviewerRow } from '@/lib/supabase/teaching-lessons-review'
import { T, type Lang } from '@/lib/teachingbase-review-strings'

// The "Reviewers" section of the TeachingBase tab. Shown to admins only (the database rules allow only admins to change the
// list, whatever the page shows). Migration 241.

function formatDate(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}

export function ReviewersPanel({ lang, adminId, supabase }: { lang: Lang; adminId: string; supabase: ReturnType<typeof createClient> }) {
  const t = T[lang]
  const [reviewers, setReviewers] = useState<ReviewerRow[] | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PersonHit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => { setReviewers(await listReviewers(supabase)) }, [supabase])
  useEffect(() => { void reload() }, [reload])

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const found = await searchPeople(supabase, query)
    setHits(candidatesFor(found, new Set((reviewers ?? []).map((r) => r.user_id))))
  }

  const add = async (p: PersonHit) => {
    setBusy(true); setError(null)
    const err = await addReviewer(supabase, p.id, adminId)
    if (err) setError(`${t.reviewerError}: ${err}`)
    else { setHits(null); setQuery(''); await reload() }
    setBusy(false)
  }

  const remove = async (r: ReviewerRow) => {
    setBusy(true); setError(null)
    const err = await removeReviewer(supabase, r.user_id)
    if (err) setError(`${t.reviewerError}: ${err}`)
    else await reload()
    setBusy(false)
  }

  return (
    <section className="card" data-testid="reviewers-panel" style={{ marginBottom: 12 }}>
      <h3>{t.reviewers}</h3>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{t.reviewersHint}</p>
      {reviewers !== null && reviewers.length === 0 && <p className="muted">{t.reviewersNone}</p>}
      {reviewers !== null && reviewers.length > 0 && (
        <ul className="tlr-list">
          {reviewers.map((r) => (
            <li key={r.user_id} className="tlr-item tlr-reviewer" data-testid="reviewer-row">
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <strong style={{ overflowWrap: 'anywhere' }}>{r.name || r.email}</strong>
                {r.name && <div className="muted" style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>{r.email}</div>}
                <div className="muted" style={{ fontSize: 12 }}>{t.reviewerAddedOn} {formatDate(r.added_at, lang)}</div>
              </div>
              <button type="button" className="btn tlr-tap" disabled={busy} onClick={() => remove(r)} aria-label={`${t.reviewerRemove}: ${r.name || r.email}`}>
                <Trash2 size={14} /> {t.reviewerRemove}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={search} className="tlr-filters" style={{ marginTop: 10 }}>
        <label className="field"><span>{t.reviewerSearch}</span>
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setHits(null) }} />
        </label>
        <button type="submit" className="btn tlr-tap" disabled={busy}>{t.reviewerSearchGo}</button>
      </form>
      <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>{t.reviewerSearchHint}</p>
      {hits !== null && hits.length === 0 && <p className="muted" data-testid="reviewer-no-hits">{t.reviewerNoHits}</p>}
      {hits !== null && hits.length > 0 && (
        <ul className="tlr-list" data-testid="reviewer-hits">
          {hits.map((h) => (
            <li key={h.id} className="tlr-item tlr-reviewer">
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <strong style={{ overflowWrap: 'anywhere' }}>{h.name || h.email}</strong>
                {h.name && <div className="muted" style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>{h.email}</div>}
              </div>
              <button type="button" className="btn tlr-tap" disabled={busy} onClick={() => add(h)} aria-label={`${t.reviewerAdd}: ${h.name || h.email}`}>
                <UserPlus size={14} /> {t.reviewerAdd}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" style={{ color: 'var(--critical)', margin: '8px 0 0' }}>{error}</p>}
    </section>
  )
}
