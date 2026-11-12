import { useState } from 'react'
import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import { VERDICTS, readableTarget, type ItemKind, type LessonComponent, type LessonLink, type Verdict, type VerdictRow } from '@/lib/supabase/teaching-lessons-review'
import { T, reasonText, type Lang } from '@/lib/teachingbase-review-strings'

// One linked item (a suggested link or a part of a lesson) with its three verdict buttons. Once judged it shows who judged it and when;
// "Change verdict" shows the buttons again, and saving adds a new row, so the earlier verdicts stay on record.

type Strings = (typeof T)[Lang]

const VERDICT_ICON = { correct: CheckCircle2, wrong: XCircle, unsure: HelpCircle } as const
const VERDICT_COLOR: Record<Verdict, string> = { correct: 'var(--good)', wrong: 'var(--critical)', unsure: 'var(--warning-text)' }

function formatDate(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}

function QuoteCheck({ found, t }: { found: boolean | undefined; t: Strings }) {
  if (found === true) return <span className="chip chip-good">{t.quoteFound}</span>
  if (found === false) return <span className="chip chip-draft">{t.quoteMissing}</span>
  return <span className="chip chip-muted">{t.quoteUnchecked}</span>
}

export function ReviewItem({
  kind, item, lang, latest, onJudge, showReason = false,
}: {
  kind: ItemKind
  item: LessonLink | LessonComponent
  lang: Lang
  latest: VerdictRow | undefined
  onJudge: (verdict: Verdict, note: string | null) => Promise<string | null>
  /** Show the one-line reason for the "check first" marker. True only once this reviewer has judged the link. */
  showReason?: boolean
}) {
  const t = T[lang]
  const [changing, setChanging] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<Verdict | null>(null)
  const [error, setError] = useState<string | null>(null)
  const link = kind === 'link' ? (item as LessonLink) : null
  const comp = kind === 'component' ? (item as LessonComponent) : null
  const showButtons = !latest || changing

  const judge = async (v: Verdict) => {
    setBusy(v)
    setError(null)
    const err = await onJudge(v, note.trim() || null)
    setBusy(null)
    if (err) { setError(`${t.saveError}: ${err}`); return }
    setChanging(false)
    setNote('')
  }

  const title = link ? (link.label || readableTarget(link.to)) : (comp?.title ?? '')
  const confidence = link?.confidence ? ((t as Record<string, unknown>)[link.confidence] as string | undefined) ?? link.confidence : null

  return (
    <li className="tlr-item" data-testid="review-item" data-item-key={item.item_key}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ overflowWrap: 'anywhere' }}>{title}</strong>
        {link?.sample && <span className="chip chip-progress">{t.startHereTag}</span>}
        {link?.check_first && <span className="chip chip-draft" data-testid="check-first-badge">{t.checkFirst}</span>}
        {comp && <span className="chip chip-muted">{comp.type}</span>}
      </div>
      {link && (
        <p className="muted tlr-line">
          {t.kind[link.type] ?? link.type}: <span style={{ overflowWrap: 'anywhere' }}>{readableTarget(link.to)}</span>
          {link.relation ? <> &middot; {t.relation}: {link.relation.replace(/-/g, ' ')}</> : null}
          {confidence ? <> &middot; {t.confidence}: {confidence}</> : null}
        </p>
      )}
      {item.evidence && (
        <blockquote className="tlr-quote">
          <span className="muted" style={{ fontSize: 11.5 }}>{t.evidenceLabel}</span>
          <br />
          {item.evidence}
        </blockquote>
      )}
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '4px 0' }}>
        <QuoteCheck found={item.checks?.quote_found} t={t} />
        {link?.checks?.id_exists === false && <span className="chip chip-draft">{t.targetMissing}</span>}
      </div>
      {link?.why && <p className="tlr-line"><span className="muted">{t.why}: </span>{link.why}</p>}
      {showReason && link?.check_reason && <p className="tlr-line" data-testid="check-reason"><span className="muted">{t.checkReasonLabel}: </span>{reasonText(link.check_reason, lang)}</p>}

      {latest && !changing && (
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }} data-testid="verdict-line">
          {(() => {
            const Icon = VERDICT_ICON[latest.verdict]
            return <span className="row" style={{ gap: 4, color: VERDICT_COLOR[latest.verdict], fontWeight: 600 }}><Icon size={16} />{t[latest.verdict]}</span>
          })()}
          <span className="muted" style={{ fontSize: 12.5 }}>{t.judgedBy} {latest.reviewer_name} {t.on} {formatDate(latest.reviewed_at, lang)}</span>
          <button type="button" className="btn btn-mini tlr-tap" onClick={() => setChanging(true)}>{t.changeVerdict}</button>
          {latest.note && <p className="tlr-line" style={{ flexBasis: '100%', margin: 0 }}>&ldquo;{latest.note}&rdquo;</p>}
        </div>
      )}

      {showButtons && (
        <div style={{ marginTop: 6 }}>
          <label className="tlr-note">
            <span className="muted" style={{ fontSize: 12 }}>{t.note}</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.noteHint} />
          </label>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {VERDICTS.map((v) => {
              const Icon = VERDICT_ICON[v]
              return (
                <button key={v} type="button" className="btn tlr-tap" disabled={busy !== null} onClick={() => judge(v)} data-verdict={v} style={{ color: VERDICT_COLOR[v], borderColor: VERDICT_COLOR[v] }}>
                  <Icon size={15} /> {busy === v ? t.saving : t[v]}
                </button>
              )
            })}
            {changing && <button type="button" className="btn btn-mini tlr-tap" onClick={() => { setChanging(false); setNote('') }}>{t.cancel}</button>}
          </div>
          {error && <p style={{ color: 'var(--critical)', fontSize: 12.5, margin: '4px 0 0' }} role="alert">{error}</p>}
        </div>
      )}
    </li>
  )
}
