import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, HelpCircle, Map as MapIcon, X, XCircle } from 'lucide-react'
import type { createClient } from '@/lib/supabase/client'
import { InfoTip } from '@/components/info-tip'
import { TeachingCueMap, ReviewMap } from '@/components/teachingbase-maps'
import {
  isJudged, lessonLinkOrder, lessonStatus, nextInLesson, nextOptions, savePointer, screenGroup, startingRef, topicChoices, firstOfTopic,
  type Latest, type NextOption, type Ref, type ReviewLesson,
} from '@/lib/teachingbase-review-mode'
import { loadTargetInfo, TYPES_WITHOUT_RECORDS, type TargetInfo } from '@/lib/teachingbase-targets'
import { linkProgress, readableTarget, showCheckReason, verdictKey, type LessonLink, type Verdict } from '@/lib/supabase/teaching-lessons-review'
import { RM, T, TYPE_GUIDANCE, reasonText, type Lang } from '@/lib/teachingbase-review-strings'

// Review mode: the front door of the TeachingBase tab. A full-screen view with one question at a time (at most three, and only when they share
// the lesson and the quote). Answers are saved at once as rows in the existing verdict table (append-only: changing an answer adds a row).
// Only the resume pointer goes to localStorage.

type Client = ReturnType<typeof createClient>
type View = 'decide' | 'map'

const VERDICT_OF = { yes: 'correct', no: 'wrong', unsure: 'unsure' } as const
type Answer = keyof typeof VERDICT_OF
const ANSWER_OF: Record<Verdict, Answer> = { correct: 'yes', wrong: 'no', unsure: 'unsure' }
const INTRO_KEY = 'openlpm:teachingbase-review-intro-seen'

const readFlag = (k: string) => { try { return window.localStorage.getItem(k) === '1' } catch { return false } }
const writeFlag = (k: string) => { try { window.localStorage.setItem(k, '1') } catch { /* fine */ } }

const firstSentence = (s: string, max = 150) => {
  const t = s.trim().replace(/\s+/g, ' ')
  const m = /^(.+?[.!?])(\s|$)/.exec(t)
  const one = m ? m[1] : t
  return one.length > max ? `${one.slice(0, max).trimEnd()}…` : one
}

export function TeachingBaseReviewMode({
  lessons, latest, ownJudged, lang, onLang, reviewerId, supabase, onJudge, onClose, initial, initialView = 'decide',
}: {
  lessons: ReviewLesson[]
  latest: Latest
  ownJudged: Set<string>
  lang: Lang
  onLang: (l: Lang) => void
  reviewerId: string | null
  supabase: Client
  onJudge: (lessonId: string, link: LessonLink, verdict: Verdict, note: string | null) => Promise<string | null>
  onClose: () => void
  initial: Ref | null
  initialView?: View
}) {
  const t = RM[lang]
  const tt = T[lang]
  const [view, setView] = useState<View>(initialView)
  const [cursor, setCursor] = useState<{ lessonId: string; keys: string[] } | null>(null)
  const [history, setHistory] = useState<{ lessonId: string; keys: string[] }[]>([])
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [help, setHelp] = useState(false)
  const [intro, setIntro] = useState(() => !readFlag(INTRO_KEY))
  const [changing, setChanging] = useState<Set<string>>(new Set())
  const [details, setDetails] = useState<Set<string>>(new Set())
  const [noteOpen, setNoteOpen] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, { picks: string[]; text: string; saved: boolean }>>({})
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [targets, setTargets] = useState<Record<string, TargetInfo>>({})
  const firstNextRef = useRef<HTMLButtonElement>(null)

  const lessonById = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons])
  const lesson = cursor ? lessonById.get(cursor.lessonId) ?? null : null

  const enter = useCallback((ref: Ref, push: boolean) => {
    const l = lessonById.get(ref.lessonId)
    if (!l) return
    const keys = screenGroup(l, ref.itemKey, latest).map((x) => x.item_key)
    if (keys.length === 0) return
    if (push && cursor) setHistory((h) => [...h, cursor])
    setCursor({ lessonId: ref.lessonId, keys })
    setChanging(new Set()); setNoteOpen(null); setPicking(false); setError(null); setView('decide')
    savePointer(reviewerId, { lessonId: ref.lessonId, itemKey: keys[0] })
  }, [lessonById, latest, reviewerId, cursor])

  // First screen.
  useEffect(() => {
    if (cursor) return
    const start = initial ?? startingRef(lessons, latest, skipped)
    if (start) enter(start, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const links = useMemo(() => (lesson && cursor ? cursor.keys.map((k) => lesson.data.links.find((l) => l.item_key === k)).filter((l): l is LessonLink => !!l) : []), [lesson, cursor])

  // Descriptions of what the suggestions point at.
  useEffect(() => {
    let alive = true
    for (const l of links) {
      loadTargetInfo(supabase, l, lang).then((info) => { if (alive) setTargets((cur) => (cur[`${l.item_key}|${lang}`] === info ? cur : { ...cur, [`${l.item_key}|${lang}`]: info })) })
    }
    return () => { alive = false }
  }, [links, lang, supabase])

  const judgedNow = (l: LessonLink) => !!lesson && isJudged(latest, lesson.id, l) && !changing.has(l.item_key)
  const allDone = links.length > 0 && links.every(judgedNow)
  const activeLink = links.find((l) => !judgedNow(l)) ?? null
  const current: Ref | null = lesson && links.length ? { lessonId: lesson.id, itemKey: links[links.length - 1].item_key } : null
  const options: NextOption[] = useMemo(() => (current && allDone ? nextOptions(lessons, latest, skipped, current) : []), [current?.lessonId, current?.itemKey, allDone, lessons, latest, skipped]) // eslint-disable-line react-hooks/exhaustive-deps
  const overall = useMemo(() => linkProgress(lessons, latest), [lessons, latest])
  const status = lesson ? lessonStatus(lesson, latest) : null

  useEffect(() => { if (allDone && !picking) firstNextRef.current?.focus() }, [allDone, picking, cursor])

  const answer = useCallback(async (link: LessonLink, a: Answer, note: string | null = null) => {
    if (!lesson || busy) return
    setBusy(true); setError(null)
    const err = await onJudge(lesson.id, link, VERDICT_OF[a], note)
    setBusy(false)
    if (err) { setError(`${t.saveFailed}: ${err}`); return }
    setChanging((cur) => { const n = new Set(cur); n.delete(link.item_key); return n })
    if (note === null) setNotes((cur) => ({ ...cur, [link.item_key]: { picks: [], text: '', saved: false } }))
  }, [lesson, busy, onJudge, t])

  const choose = useCallback((opt: NextOption) => {
    if (opt.kind === 'topic') { setPicking(true); return }
    if (opt.ref) enter(opt.ref, true)
  }, [enter])

  const skip = useCallback(() => {
    if (!lesson || !cursor) return
    const next = new Set(skipped)
    for (const l of links) if (!isJudged(latest, lesson.id, l)) next.add(`${lesson.id}|${l.item_key}`)
    setSkipped(next)
    const after = links[links.length - 1]
    const inLesson = nextInLesson(lesson, latest, next, after.item_key)
    const target: Ref | null = inLesson ? { lessonId: lesson.id, itemKey: inLesson.item_key } : (nextOptions(lessons, latest, next, { lessonId: lesson.id, itemKey: after.item_key }).find((o) => o.ref)?.ref ?? null)
    if (target) enter(target, true)
  }, [lesson, cursor, links, skipped, latest, lessons, enter])

  const back = useCallback(() => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory(history.slice(0, -1))
    setCursor(prev); setChanging(new Set()); setNoteOpen(null); setPicking(false); setView('decide')
    savePointer(reviewerId, { lessonId: prev.lessonId, itemKey: prev.keys[0] })
  }, [history, reviewerId])

  // Keyboard: Y (or J) = yes, N = no, U = not sure, S = skip, arrows = back or skip, 1 to 3 = the next choices, ? = help.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === '?') { setHelp((v) => !v); return }
      if (k === 'escape') { if (help) setHelp(false); return }
      if (view !== 'decide') return
      if (k === 'arrowleft') { e.preventDefault(); back(); return }
      if (k === 'arrowright') { e.preventDefault(); skip(); return }
      if (activeLink) {
        if (k === 'y' || k === 'j') { e.preventDefault(); void answer(activeLink, 'yes') }
        else if (k === 'n') { e.preventDefault(); void answer(activeLink, 'no') }
        else if (k === 'u') { e.preventDefault(); void answer(activeLink, 'unsure') }
        else if (k === 's') { e.preventDefault(); skip() }
      } else if (allDone && !picking && ['1', '2', '3'].includes(k)) {
        const opt = options[Number(k) - 1]
        if (opt) { e.preventDefault(); choose(opt) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, activeLink, allDone, picking, options, answer, skip, back, choose, help])

  const dismissIntro = () => { writeFlag(INTRO_KEY); setIntro(false) }
  const toggle = (set: Set<string>, key: string, apply: (s: Set<string>) => void) => { const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); apply(n) }

  const typeName = (type: string) => tt.kind[type] ?? type
  const topics = useMemo(() => (picking ? topicChoices(lessons, latest) : null), [picking, lessons, latest])

  // ---------------------------------------------------------------------------------------------------------------------------------
  const title = lesson ? ((lang === 'de' && lesson.data.title?.de) || lesson.data.title?.en || lesson.label) : ''
  const description = lesson ? firstSentence(((lang === 'de' && lesson.data.description?.de) || lesson.data.description?.en || '')) : ''
  const grades = lesson?.data.grades ?? []
  const quote = links[0]?.evidence ?? ''
  const single = links.length === 1

  const bar = (
    <div className="tb-review-bar">
      <span className="tb-bar-title">{t.title}</span>
      <span style={{ fontSize: 14 }} data-testid="review-overall">{overall.judged} {t.of} {overall.total} {t.progressAll} <InfoTip term="progress" lang={lang} /></span>
      <button type="button" className="tb-btn small" onClick={() => setHelp((v) => !v)} aria-pressed={help} data-testid="how-to-judge"><HelpCircle size={16} />{t.howToJudge}</button>
      <button type="button" className="tb-btn small" onClick={() => setView(view === 'map' ? 'decide' : 'map')} data-testid="open-map"><MapIcon size={16} />{view === 'map' ? t.mapBackToReview : t.reviewMap}</button>
      <span className="row" style={{ gap: 4 }}>
        <button type="button" className={`chip-btn${lang === 'en' ? ' active' : ''}`} style={{ minHeight: 44 }} onClick={() => onLang('en')} aria-label="English">EN</button>
        <button type="button" className={`chip-btn${lang === 'de' ? ' active' : ''}`} style={{ minHeight: 44 }} onClick={() => onLang('de')} aria-label="Deutsch">DE</button>
      </span>
      <button type="button" className="tb-btn small" onClick={onClose} data-testid="close-review"><X size={16} />{t.close}</button>
    </div>
  )

  const helpPanel = help && (
    <div className="tb-help" data-testid="help-panel">
      <h3>{t.howToJudge}</h3>
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{t.basis}</p>
      <p style={{ margin: '0 0 8px' }}>{t.helpBasis}</p>
      <p style={{ margin: '0 0 8px' }}>{t.helpAnswers}</p>
      <p style={{ margin: '0 0 8px' }}>{t.helpSaved}</p>
      <h3 style={{ marginTop: 12 }}>{t.helpPerType}</h3>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {Object.entries(TYPE_GUIDANCE[lang]).map(([type, line]) => <li key={type} style={{ marginBottom: 4 }}><strong>{typeName(type)}.</strong> {line}</li>)}
      </ul>
      <p className="muted" style={{ margin: '10px 0 0', fontSize: 14 }}>{t.keys}: {t.keyYes} &middot; {t.keyNo} &middot; {t.keyUnsure} &middot; {t.keySkip} &middot; {t.keyArrows}</p>
      <button type="button" className="tb-btn small" style={{ marginTop: 10 }} onClick={() => setHelp(false)}>{t.helpClose}</button>
    </div>
  )

  if (view === 'map') {
    return (
      <div className="tb-review" data-testid="review-mode" role="dialog" aria-label={t.title}>
        {bar}
        <div className="tb-review-body">
          {helpPanel}
          <h2 style={{ margin: 0, fontSize: 22 }}>{t.mapTitle} <InfoTip term="map" lang={lang} /></h2>
          <ReviewMap lessons={lessons} latest={latest} lang={lang} onPick={(id) => {
            const l = lessonById.get(id)
            const link = l ? (nextInLesson(l, latest, new Set()) ?? lessonLinkOrder(l)[0]) : null
            if (l && link) enter({ lessonId: l.id, itemKey: link.item_key }, true)
          }} />
        </div>
      </div>
    )
  }

  if (!lesson || links.length === 0) {
    return (
      <div className="tb-review" data-testid="review-mode" role="dialog" aria-label={t.title}>
        {bar}
        <div className="tb-review-body">
          {helpPanel}
          <p style={{ fontSize: 20 }}>{startingRef(lessons, latest, new Set()) ? t.nothingLeft : t.allDone}</p>
          <button type="button" className="tb-btn" onClick={onClose}>{t.close}</button>
        </div>
      </div>
    )
  }

  const block = (link: LessonLink) => {
    const info = targets[`${link.item_key}|${lang}`]
    const name = info?.name ?? (link.label || readableTarget(link.to))
    const isNew = info?.isNew ?? (link.to === 'NEW' || link.to.startsWith('NEW'))
    const own = judgedNow(link)
    const verdict = latest.get(verdictKey(lesson.id, 'link', link.item_key))
    const noDesc = TYPES_WITHOUT_RECORDS.includes(link.type) ? t.noDescriptionNoRecord : t.noDescription
    const open = details.has(link.item_key)
    const note = notes[link.item_key] ?? { picks: [], text: '', saved: false }
    const quick = verdict ? (verdict.verdict === 'correct' ? t.quickYes : verdict.verdict === 'wrong' ? t.quickNo : t.quickUnsure) : []
    return (
      <div key={link.item_key} className="tb-decision" data-testid="decision" data-item-key={link.item_key}>
        <div className="tb-target" data-testid="target-name">
          {!single && <span className="tb-label" style={{ fontWeight: 400, marginRight: 6 }}>{t.suggestedLead[link.type] ?? ''}:</span>}
          {name}
          {link.check_first && <span className="chip chip-draft" style={{ marginLeft: 10, fontSize: 13, verticalAlign: 'middle' }} data-testid="check-first-badge">{t.checkFirst}</span>}
          {link.check_first && <InfoTip term="checkFirst" lang={lang} />}
        </div>
        {isNew
          ? <p className="tb-warn">{t.newTarget}</p>
          : <p className="tb-desc" data-testid="target-description">
              <span className="tb-label">{t.whatItMeans}:</span>{' '}
              {info === undefined ? '…' : info.description ?? info.reference ?? noDesc}
              {info?.reference && info.description && <span className="muted" style={{ display: 'block', fontSize: 15, marginTop: 4 }}>{info.reference}</span>}
            </p>}
        {link.checks?.quote_found === false && <p className="tb-warn" data-testid="quote-warning">{t.quoteNotFound}</p>}
        {link.checks?.id_exists === false && !isNew && <p className="tb-warn">{t.targetMissing}</p>}

        {own && verdict ? (
          <div data-testid="verdict-line">
            <div className="tb-done-line">
              {verdict.verdict === 'correct' ? <CheckCircle2 size={22} color="var(--good)" /> : verdict.verdict === 'wrong' ? <XCircle size={22} color="var(--critical)" /> : <HelpCircle size={22} color="var(--warning-text)" />}
              <strong>{t.youSaid}: {verdict.verdict === 'correct' ? t.answerYes : verdict.verdict === 'wrong' ? t.answerNo : t.answerUnsure}</strong>
              <button type="button" className="tb-btn small" onClick={() => toggle(changing, link.item_key, setChanging)}>{t.changeAnswer}</button>
              <button type="button" className="tb-btn small" onClick={() => setNoteOpen(noteOpen === link.item_key ? null : link.item_key)} aria-expanded={noteOpen === link.item_key} data-testid="add-note">{t.addNote}</button>
              {verdict.note && <span className="muted" style={{ fontSize: 15 }}>&ldquo;{verdict.note}&rdquo;</span>}
            </div>
            {showCheckReason(link, lesson.id, ownJudged) && link.check_reason && (
              <p className="tb-desc" style={{ marginTop: 8 }} data-testid="check-reason"><span className="tb-label">{t.whyMarked}:</span>{' '}{reasonText(link.check_reason, lang)}</p>
            )}
            {noteOpen === link.item_key && (
              <div style={{ marginTop: 8 }} data-testid="note-box">
                <p className="muted" style={{ margin: '0 0 4px', fontSize: 14 }}>{t.noteOptional}</p>
                <div className="tb-quick">
                  {quick.map((q) => {
                    const on = note.picks.includes(q)
                    return <button key={q} type="button" className={`tb-btn${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setNotes((cur) => ({ ...cur, [link.item_key]: { ...note, saved: false, picks: on ? note.picks.filter((p) => p !== q) : [...note.picks, q] } }))}>{q}</button>
                  })}
                </div>
                <input className="tb-note" type="text" value={note.text} placeholder={t.noteFree} aria-label={t.noteFree} onChange={(e) => setNotes((cur) => ({ ...cur, [link.item_key]: { ...note, saved: false, text: e.target.value } }))} />
                <div className="row" style={{ gap: 10, marginTop: 8, alignItems: 'center' }}>
                  <button type="button" className="tb-btn small" disabled={busy || (note.picks.length === 0 && !note.text.trim())} onClick={async () => {
                    const text = [...note.picks, note.text.trim()].filter(Boolean).join('. ')
                    await answer(link, ANSWER_OF[verdict.verdict], text)
                    setNotes((cur) => ({ ...cur, [link.item_key]: { ...note, saved: true } }))
                  }} data-testid="save-note">{t.saveNote}</button>
                  {note.saved && <span className="muted" style={{ fontSize: 15 }}>{t.noteSaved}</span>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
          <p className="tb-q" style={{ margin: '10px 0 0', fontWeight: 600 }}>{t.goodMatch}</p>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 8 }} data-testid="answer-buttons">
            <button type="button" className="tb-btn tb-answer yes" disabled={busy} onClick={() => answer(link, 'yes')} data-answer="yes"><CheckCircle2 size={22} />{t.yes} <kbd>Y</kbd></button>
            <button type="button" className="tb-btn tb-answer no" disabled={busy} onClick={() => answer(link, 'no')} data-answer="no"><XCircle size={22} />{t.no} <kbd>N</kbd></button>
            <button type="button" className="tb-btn tb-answer unsure" disabled={busy} onClick={() => answer(link, 'unsure')} data-answer="unsure"><HelpCircle size={22} />{t.notSure} <kbd>U</kbd></button>
            <InfoTip term="unsure" lang={lang} />
            {changing.has(link.item_key) && <button type="button" className="tb-btn small" onClick={() => toggle(changing, link.item_key, setChanging)}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>}
          </div>
          </>
        )}

        <button type="button" className="tb-btn small" style={{ marginTop: 10, minHeight: 44 }} onClick={() => toggle(details, link.item_key, setDetails)} aria-expanded={open} data-testid="more-detail">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{open ? t.lessDetail : t.moreDetail}
        </button>
        {open && (
          <dl className="tb-desc" style={{ fontSize: 16, margin: '8px 0 0' }} data-testid="detail-list">
            {link.relation && <div><dt className="tb-label">{t.detailHow} <InfoTip term="relation" lang={lang} /></dt><dd style={{ margin: '0 0 6px' }}>{link.relation.replace(/-/g, ' ')}</dd></div>}
            {link.confidence && <div><dt className="tb-label">{t.detailSure} <InfoTip term="confidence" lang={lang} /></dt><dd style={{ margin: '0 0 6px' }}>{(tt as Record<string, unknown>)[link.confidence] as string ?? link.confidence}</dd></div>}
            {link.why && <div><dt className="tb-label">{t.detailWhy} <InfoTip term="why" lang={lang} /></dt><dd style={{ margin: '0 0 6px' }}>{link.why}</dd></div>}
            <div><dt className="tb-label">{t.detailId} <InfoTip term="technicalName" lang={lang} /></dt><dd style={{ margin: '0 0 6px', overflowWrap: 'anywhere' }}>{link.to}</dd></div>
            {link.sample && <div><dt className="tb-label">{t.detailStartHere} <InfoTip term="startHere" lang={lang} /></dt></div>}
          </dl>
        )}
      </div>
    )
  }

  const nextLabel = (o: NextOption) => (o.kind === 'inLesson' ? t.nextInLesson : o.kind === 'nextLesson' ? t.nextLesson : o.kind === 'doubtful' ? t.doubtful : t.pickTopic)

  return (
    <div className="tb-review" data-testid="review-mode" role="dialog" aria-label={t.title}>
      {bar}
      <div className="tb-review-body has-cue">
        <div style={{ minWidth: 0 }}>
          {helpPanel}
          {intro && (
            <div className="tb-banner" style={{ marginBottom: 14 }} data-testid="basis-banner">
              <strong>{t.basisTitle}.</strong> {t.basis}
              <div className="row" style={{ gap: 10, marginTop: 8 }}>
                <button type="button" className="tb-btn small primary" onClick={dismissIntro}>{t.gotIt}</button>
                <button type="button" className="tb-btn small" onClick={() => setHelp(true)}>{t.howToJudge}</button>
              </div>
            </div>
          )}

          <p className="tb-q" style={{ marginBottom: 2 }} data-testid="lesson-line">
            <span className="tb-label">{t.lessonLabel}:</span> <strong>{title}</strong>
            {grades.length > 0 && <span className="muted"> ({t.grades} {grades.join(', ')})</span>}
          </p>
          {description && <p className="muted" style={{ margin: '0 0 12px', fontSize: 16 }}>{description}</p>}

          {quote && (
            <>
              <span className="tb-label">{t.fromLesson} <InfoTip term="fromLesson" lang={lang} /></span>
              <blockquote className="tb-quote" data-testid="quote">&ldquo;{quote}&rdquo;</blockquote>
            </>
          )}

          <p className="tb-q" data-testid="question">
            {t.computerSuggested}{single ? ` ${t.suggestedLead[links[0].type] ?? ''}` : ''}: <InfoTip term="suggestion" lang={lang} />
          </p>
          {links.map(block)}

          {error && <p role="alert" style={{ color: 'var(--critical)', fontSize: 16 }}>{error}</p>}

          {allDone && !picking && (
            <div style={{ marginTop: 18 }} data-testid="next-panel">
              <p className="tb-q" style={{ fontWeight: 600 }}>{t.next}</p>
              <div className="tb-next">
                {options.map((o, i) => (
                  <button key={`${o.kind}-${i}`} type="button" ref={i === 0 ? firstNextRef : undefined} className={`tb-btn${i === 0 ? ' primary' : ''}`} onClick={() => choose(o)} data-next={o.kind}>
                    <span className="tb-kbd">{i + 1}</span> {nextLabel(o)}
                  </button>
                ))}
                {options.every((o) => o.kind === 'topic') && <p className="muted" style={{ margin: 0 }}>{startingRef(lessons, latest, skipped) ? t.nothingLeft : t.allDone}</p>}
              </div>
            </div>
          )}

          {allDone && picking && topics && (
            <div style={{ marginTop: 18 }} data-testid="topic-chooser">
              <p className="tb-q" style={{ fontWeight: 600 }}>{t.pickTopic}</p>
              <p className="tb-label" style={{ margin: '4px 0' }}>{t.pickByType}</p>
              <div className="tb-quick">
                {topics.types.map((c) => <button key={c.id} type="button" className="tb-btn" onClick={() => { const r = firstOfTopic(lessons, latest, skipped, { type: c.id }); if (r) enter(r, true) }}>{typeName(c.id)} ({c.remaining} {t.remainingWord})</button>)}
              </div>
              <p className="tb-label" style={{ margin: '10px 0 4px' }}>{t.pickByCollection} <InfoTip term="collection" lang={lang} /></p>
              <div className="tb-quick">
                {topics.collections.map((c) => <button key={c.id} type="button" className="tb-btn" onClick={() => { const r = firstOfTopic(lessons, latest, skipped, { collection: c.id }); if (r) enter(r, true) }}>{c.id.replace(/-/g, ' ')} ({c.remaining} {t.remainingWord})</button>)}
              </div>
              <button type="button" className="tb-btn small" onClick={() => setPicking(false)}>{t.back}</button>
            </div>
          )}

          <div className="row" style={{ gap: 10, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="tb-btn" onClick={back} disabled={history.length === 0} data-testid="back-button"><ArrowLeft size={18} />{t.back}</button>
            {!allDone && <button type="button" className="tb-btn" onClick={skip} data-testid="skip-button">{t.skip} <kbd>S</kbd></button>}
            <button type="button" className="tb-btn" onClick={onClose}>{t.stopForNow}</button>
          </div>
          <p className="muted" style={{ fontSize: 14, marginTop: 12 }} data-testid="shortcut-line">{t.keys}: {t.keyYes} &middot; {t.keyNo} &middot; {t.keyUnsure} &middot; {t.keySkip} &middot; {t.keyArrows}</p>
        </div>

        <aside className="tb-cue" aria-label={t.cueTitle} data-testid="cue-panel">
          <strong style={{ fontSize: 16 }}>{t.cueTitle}</strong>
          <TeachingCueMap lesson={lesson} currentKey={links[0].item_key} latest={latest} lang={lang} />
          <p className="muted" style={{ fontSize: 13, margin: '6px 0 8px' }}>{t.cueHint}</p>
          {status && (
            <>
              <div style={{ fontSize: 16, fontWeight: 600 }} data-testid="lesson-progress-line">{t.thisLesson}: {status.judged} {t.of} {status.total} {t.checked}</div>
              <div className="tb-progress" aria-hidden><div style={{ width: `${status.total ? Math.round((status.judged / status.total) * 100) : 0}%` }} /></div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

