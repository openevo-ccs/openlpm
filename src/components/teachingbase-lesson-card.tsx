import { ExternalLink } from 'lucide-react'
import { DRAFT_LABEL } from '@/lib/supabase/curriculum-repository'
import { lessonProgress, verdictKey, type ItemKind, type LessonData, type LessonLink, type Verdict, type VerdictRow } from '@/lib/supabase/teaching-lessons-review'
import { KIND_ORDER, T, type Lang } from '@/lib/teachingbase-review-strings'
import { ReviewItem } from '@/components/teaching-review-item'

// The inside of a TeachingBase record card in the Base Repo Explorer: the lesson, then the links a language model drafted from it to the
// other bases, each with Correct / Wrong / Unsure. Verdicts are append-only rows (migration 240); the newest per item counts.

function ProgressBar({ judged, total }: { judged: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((judged / total) * 100)
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-1)', border: '1px solid var(--border)', overflow: 'hidden', minWidth: 60 }} aria-hidden>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--series-a)' }} />
    </div>
  )
}

export function TeachingBaseLessonBody({
  lessonId, data, lang, latest, onJudge,
}: {
  lessonId: string
  data: LessonData
  lang: Lang
  latest: Map<string, VerdictRow>
  onJudge: (kind: ItemKind, item: LessonLink | LessonData['components'][number], verdict: Verdict, note: string | null) => Promise<string | null>
}) {
  const t = T[lang]
  const p = lessonProgress({ id: lessonId, data }, latest)
  const description = ((lang === 'de' && data.description?.de) || data.description?.en || '').trim()
  const shortDescription = description.length > 420 ? `${description.slice(0, 420)}…` : description
  const pageUrl = data.source_pages?.[lang] ?? data.source_pages?.en
  const links = data.links ?? []
  const components = data.components ?? []
  const assets = data.assets ?? []
  const rightsFlags = data.rights_flags ?? []
  const byType = KIND_ORDER.map((k) => ({ kind: k, links: links.filter((l) => l.type === k) })).filter((g) => g.links.length > 0)
  const known = new Set(KIND_ORDER)
  const other = links.filter((l) => !known.has(l.type))
  if (other.length > 0) byType.push({ kind: 'other', links: other })

  return (
    <div data-testid="teachingbase-card">
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <span className="chip chip-draft" data-testid="draft-tag">{DRAFT_LABEL[lang]}</span>
        {(data.collections ?? []).map((c) => <span key={c} className="chip">{c.replace(/-/g, ' ')}</span>)}
      </div>
      {shortDescription && <p style={{ margin: '0 0 8px', fontSize: 13 }}>{shortDescription}</p>}
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
        {(data.grades ?? []).length > 0 && <>{t.grades}: {data.grades.join(', ')}. </>}
        {(data.subjects ?? []).length > 0 && <>{t.subjects}: {data.subjects.join(', ')}. </>}
        {(data.material_types ?? []).length > 0 && <>{t.types}: {data.material_types.join(', ')}.</>}
      </p>
      {pageUrl && <p style={{ margin: '8px 0 0' }}><a href={pageUrl} target="_blank" rel="noreferrer" className="row tlr-link" style={{ gap: 4 }}>{t.openLesson} <ExternalLink size={12} /></a></p>}
      <p style={{ margin: '10px 0 2px', fontWeight: 600 }} data-testid="lesson-progress">{p.judged} {t.of} {p.total} {t.judgedOf}</p>
      <ProgressBar {...p} />

      {links.length === 0 && components.length === 0 && <p className="muted">{t.noLinks}</p>}

      {components.length > 0 && (
        <section style={{ marginTop: 12 }}>
          <h4 style={{ marginBottom: 2 }}>{t.components} ({components.length})</h4>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{t.componentsHint}</p>
          <ul className="tlr-list">
            {components.map((c) => (
              <ReviewItem key={c.item_key} kind="component" item={c} lang={lang} latest={latest.get(verdictKey(lessonId, 'component', c.item_key))}
                onJudge={(v, n) => onJudge('component', c, v, n)} />
            ))}
          </ul>
        </section>
      )}

      {byType.length > 0 && (
        <section style={{ marginTop: 12 }}>
          <h4 style={{ marginBottom: 2 }}>{t.links} ({links.length})</h4>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{t.linksHint}</p>
          {byType.map((g) => (
            <div key={g.kind} style={{ marginBottom: 8 }}>
              <h5 style={{ margin: '8px 0 0' }}>{t.kind[g.kind] ?? g.kind} ({g.links.length})</h5>
              <ul className="tlr-list">
                {g.links.map((l) => (
                  <ReviewItem key={l.item_key} kind="link" item={l} lang={lang} latest={latest.get(verdictKey(lessonId, 'link', l.item_key))}
                    onJudge={(v, n) => onJudge('link', l, v, n)} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section style={{ marginTop: 12 }}>
        <h4>{t.assets} ({assets.length})</h4>
        {assets.length === 0 ? <p className="muted">{t.none}</p> : (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {assets.map((a, i) => (
              <li key={a.id ?? i} style={{ overflowWrap: 'anywhere', marginBottom: 4 }} className="tlr-asset">
                {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="tlr-link">{a.label || a.anchor_text || a.url}</a> : (a.label || a.anchor_text)}
                <span className="muted" style={{ fontSize: 12 }}> &middot; {a.kind} &middot; {t.rightsStatus}: {a.rights?.status ?? t.unknown}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 12 }}>
        <h4>{t.rights} ({rightsFlags.length})</h4>
        {rightsFlags.length === 0 ? <p className="muted">{t.none}</p> : (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {rightsFlags.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r.issue}</li>)}
          </ul>
        )}
      </section>
    </div>
  )
}
