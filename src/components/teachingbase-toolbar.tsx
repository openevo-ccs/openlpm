import { Download } from 'lucide-react'
import { DRAFT_LABEL } from '@/lib/supabase/curriculum-repository'
import { ReviewersPanel } from '@/components/teaching-reviewers-panel'
import { linkProgress, type LessonKey, type VerdictRow } from '@/lib/supabase/teaching-lessons-review'
import { T, type Lang } from '@/lib/teachingbase-review-strings'
import type { createClient } from '@/lib/supabase/client'

// What the TeachingBase tab shows above the lesson list: what the checking is, progress over every link, the "start here" and "still to
// check" filters, Download verdicts, and (admins only) the Reviewers section.

export function TeachingBaseToolbar({
  lessons, latest, lang, onlyStartHere, onlyOpen, onToggleStartHere, onToggleOpen, onDownload, supabase, adminId,
}: {
  lessons: LessonKey[]
  latest: Map<string, VerdictRow>
  lang: Lang
  onlyStartHere: boolean
  onlyOpen: boolean
  onToggleStartHere: () => void
  onToggleOpen: () => void
  onDownload: () => void
  supabase: ReturnType<typeof createClient>
  /** Set for admins; the Reviewers section shows only then. */
  adminId: string | null
}) {
  const t = T[lang]
  const overall = linkProgress(lessons, latest)
  const start = linkProgress(lessons, latest, true)
  const pct = overall.total === 0 ? 0 : Math.round((overall.judged / overall.total) * 100)
  return (
    <div data-testid="teachingbase-toolbar">
      <p className="muted" style={{ marginBottom: 6 }}>{t.intro}</p>
      <p className="muted" style={{ marginTop: 0 }}><span className="chip chip-draft">{DRAFT_LABEL[lang]}</span> {t.draftHint}</p>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ minWidth: 180, flex: '1 1 220px' }}>
            <strong data-testid="overall-progress">{overall.judged} {t.of} {overall.total} {t.overall}</strong>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-1)', border: '1px solid var(--border)', overflow: 'hidden', minWidth: 60 }} aria-hidden>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--series-a)' }} />
            </div>
          </div>
          <div className="muted" style={{ fontSize: 12.5 }} data-testid="start-progress">{t.startHere}: {start.judged} {t.of} {start.total}</div>
          <button type="button" className={`btn tlr-tap${onlyStartHere ? ' btn-primary' : ''}`} aria-pressed={onlyStartHere} onClick={onToggleStartHere}>{t.onlyStartHere}</button>
          <button type="button" className={`btn tlr-tap${onlyOpen ? ' btn-primary' : ''}`} aria-pressed={onlyOpen} onClick={onToggleOpen}>{t.stillOpen}</button>
          <button type="button" className="btn tlr-tap" onClick={onDownload} title={t.downloadHint}><Download size={14} /> {t.download}</button>
        </div>
      </div>
      {adminId && <ReviewersPanel lang={lang} adminId={adminId} supabase={supabase} />}
    </div>
  )
}
