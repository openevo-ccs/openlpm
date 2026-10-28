import { useMemo, useState } from 'react'
import { Check, Flag, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { cellLinks, linkIssues, rank, recordUnitIds, yearOf, type CmpLink, type CmpRecord, type DimKey, type Unit } from '@/lib/comparison'
import { createContentLink, deleteContentLink, updateContentLinkRationale, RECORD_TYPE_LABEL } from '@/lib/supabase/curriculum-repository'
import { addLinkReview, confirmProposedLink, deleteLinkReview, markCheckedNoMatch, type LinkVerdict } from '@/lib/supabase/comparison'
import { RecordKindIcon } from '@/lib/record-type-display'
import { useComparison } from './context'
import type { StringKey } from './strings'
import { jurisdictionName } from '@/lib/comparison'

const ISSUE_KEY: Record<string, StringKey> = {
  'no-rationale': 'issueNoRationale',
  'short-rationale': 'issueShort',
  boilerplate: 'issueBoilerplate',
  proposed: 'issueProposed',
  questioned: 'issueQuestioned',
}
const VERDICTS: LinkVerdict[] = ['supports', 'questions', 'too_broad', 'wrong_place']
const VERDICT_KEY: Record<LinkVerdict, StringKey> = {
  supports: 'verdictSupports', questions: 'verdictQuestions', too_broad: 'verdictTooBroad', wrong_place: 'verdictWrongPlace',
}

export function RecordBlock({ record, lang }: { record: CmpRecord; lang: 'en' | 'de' }) {
  const y = yearOf(record.date)
  return (
    <div>
      <div className="row" style={{ gap: 6, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <RecordKindIcon type={record.type as never} size={14} />
        <strong style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{record.title}</strong>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
        {RECORD_TYPE_LABEL[record.type as keyof typeof RECORD_TYPE_LABEL] ?? record.type}
        {' · '}{record.jurisdictions.map((j) => jurisdictionName(j, lang)).join(', ')}
        {y !== null ? ` · ${Math.floor(y)}` : ''}
      </div>
      {record.summary && <p className="muted" style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.45 }}>{record.summary.length > 280 ? `${record.summary.slice(0, 279)}…` : record.summary}</p>}
    </div>
  )
}

export function LinkDrawer({ dimKey, unit, onClose }: { dimKey: DimKey; unit: Unit; onClose: () => void }) {
  const c = useComparison()
  const { t, lang, grid, recordsById, objectsById, reviewsByLink, canEdit, canCritique, source, supabase, project, branchId, refresh, level, countries, scopeRecords, recordIndex, recordWeight, links: allLinks } = c
  const links = useMemo(() => cellLinks(grid, dimKey, unit.id).sort((a, b) => Number(a.proposed) - Number(b.proposed)), [grid, dimKey, unit.id])
  const countrySet = useMemo(() => new Set(countries), [countries])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(links.length === 0)
  const checked = source?.checkedNoMatch.has(`${dimKey.id}|${unit.id}`) ?? false

  const linkedRecordIds = useMemo(() => {
    const s = new Set<string>()
    for (const l of allLinks) if (dimKey.objectIds.includes(l.objectId)) s.add(l.recordId)
    return s
  }, [allLinks, dimKey.objectIds])
  const unitRecordIds = useMemo(() => new Set(scopeRecords.filter((r) => recordUnitIds(r, level, countrySet).includes(unit.id)).map((r) => r.id)), [scopeRecords, level, countrySet, unit.id])

  const queryText = useMemo(() => {
    const parts: string[] = []
    for (const oid of dimKey.objectIds) {
      const o = objectsById.get(oid)
      if (!o) continue
      parts.push(o.title, o.title, o.description)
      for (const cid of o.conceptIds) parts.push(c.concepts.find((x) => x.id === cid)?.label ?? '')
    }
    return parts.join(' ')
  }, [dimKey.objectIds, objectsById, c.concepts])
  const suggestions = useMemo(() => (showSuggestions ? rank(recordIndex, queryText, { topK: 6, exclude: linkedRecordIds, only: unitRecordIds, weight: recordWeight }) : []), [showSuggestions, recordIndex, queryText, linkedRecordIds, unitRecordIds, recordWeight])

  const run = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true); setError(null)
    const { error: e } = await fn()
    setBusy(false)
    if (e) { setError(e); return false }
    refresh()
    return true
  }

  return (
    <>
      <div className="cmp-drawer-back" onClick={onClose} />
      <aside className="cmp-drawer" role="dialog" aria-label={`${dimKey.label} · ${unit.label}`}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <div>
            <h2>{dimKey.label}</h2>
            <p className="muted" style={{ margin: 0 }}>{unit.label} · {t('unitLinksN', { n: links.length })} · {t('unitRecordsN', { n: unitRecordIds.size })}</p>
          </div>
          <button type="button" className="btn btn-mini" onClick={onClose} aria-label={t('close')}><X size={13} /></button>
        </div>
        {error && <div className="notice notice-bad" style={{ marginTop: 8 }}>{error}</div>}
        {!canEdit && <p className="muted" style={{ marginTop: 8 }}>{canCritique ? t('drawerCriticNote') : t('drawerViewerNote')}</p>}

        {links.length === 0 && <p className="muted" style={{ marginTop: 12 }}>{checked ? t('drawerCheckedDone') : t('drawerNoLinks')}</p>}
        {links.map((l) => (
          <LinkCard key={l.id} link={l} record={recordsById.get(l.recordId)} objectTitle={dimKey.objectIds.length > 1 ? objectsById.get(l.objectId)?.title : undefined}
            busy={busy} run={run} />
        ))}

        {canEdit && (
          <div style={{ marginTop: 14 }}>
            {!showSuggestions ? (
              <button type="button" className="btn btn-mini" onClick={() => setShowSuggestions(true)}><Sparkles size={12} />{t('drawerSuggest')}</button>
            ) : (
              <>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 12.5 }}><Sparkles size={12} style={{ verticalAlign: -1 }} /> {t('drawerSuggestions')}</strong>
                </div>
                <p className="muted" style={{ fontSize: 11.5, margin: '2px 0 4px' }}>{t('drawerSuggestionsHint')}</p>
                {suggestions.length === 0 && <p className="muted" style={{ fontSize: 12 }}>{t('drawerNoSuggestions')}</p>}
                {suggestions.map((m) => {
                  const rec = recordsById.get(m.id)
                  if (!rec) return null
                  return (
                    <SuggestionRow key={m.id} record={rec} score={m.score} terms={m.terms} dimKey={dimKey} busy={busy}
                      onAdd={(objectId, why) => run(() => createContentLink(supabase, { projectId: project.id, dataObjectId: objectId, repositoryRecordId: rec.id, rationale: why }))} />
                  )
                })}
                {!checked && dimKey.objectIds.length > 0 && (
                  <button type="button" className="btn-linklike" style={{ fontSize: 12, marginTop: 8 }} disabled={busy}
                    onClick={() => run(() => markCheckedNoMatch(supabase, { projectId: project.id, branchId, objectId: dimKey.id, unitId: unit.id, note: '' }))}>
                    {t('drawerCheckedNone')}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </aside>
    </>
  )
}

function SuggestionRow({ record, score, terms, dimKey, busy, onAdd }: {
  record: CmpRecord; score: number; terms: string[]; dimKey: DimKey; busy: boolean; onAdd: (objectId: string, why: string) => Promise<boolean>
}) {
  const { t, lang, objectsById } = useComparison()
  const [open, setOpen] = useState(false)
  const [why, setWhy] = useState('')
  const [objectId, setObjectId] = useState(dimKey.objectIds[0])
  return (
    <div className="cmp-suggest" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <RecordBlock record={record} lang={lang} />
          <div className="cmp-terms">{t('drawerSharedWords')}: {terms.join(', ')} <span className="cmp-score" style={{ width: Math.round(score * 90) + 6 }} title={score.toFixed(2)} /></div>
        </div>
        {!open && <button type="button" className="btn btn-mini" onClick={() => setOpen(true)}><Plus size={11} />{t('link')}</button>}
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          {dimKey.objectIds.length > 1 && (
            <select value={objectId} onChange={(e) => setObjectId(e.target.value)} style={{ width: '100%', marginBottom: 4 }}>
              {dimKey.objectIds.map((id) => <option key={id} value={id}>{objectsById.get(id)?.title ?? id}</option>)}
            </select>
          )}
          <textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t('drawerWhyPlaceholder')} style={{ width: '100%' }} />
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <button type="button" className="btn btn-mini btn-primary" disabled={busy || why.trim().length < 20}
              onClick={async () => { if (await onAdd(objectId, why.trim())) setOpen(false) }}>{t('drawerAdd')}</button>
            <button type="button" className="btn-linklike" onClick={() => setOpen(false)}>{t('cancel')}</button>
            {why.trim().length < 20 && <span className="muted" style={{ fontSize: 11 }}>{t('drawerNeedsReason')}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function LinkCard({ link, record, objectTitle, busy, run }: {
  link: CmpLink; record: CmpRecord | undefined; objectTitle?: string; busy: boolean; run: (fn: () => Promise<{ error: string | null }>) => Promise<boolean>
}) {
  const { t, lang, reviewsByLink, canEdit, canCritique, supabase, project, source } = useComparison()
  const reviews = reviewsByLink.get(link.id) ?? []
  const issues = linkIssues(link, reviews)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(link.rationale ?? '')
  const [questioning, setQuestioning] = useState(false)
  const [verdict, setVerdict] = useState<LinkVerdict>('questions')
  const [comment, setComment] = useState('')
  if (!record) return null
  const reviewsOk = source?.reviewsAvailable ?? false
  return (
    <div className={`cmp-link-card${link.proposed ? ' proposed' : ''}`}>
      <RecordBlock record={record} lang={lang} />
      {objectTitle && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t('drawerLinkedTo')}: {objectTitle}</div>}
      {editing ? (
        <div style={{ marginTop: 6 }}>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} style={{ width: '100%' }} />
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <button type="button" className="btn btn-mini btn-primary" disabled={busy} onClick={async () => { if (await run(() => updateContentLinkRationale(supabase, link.id, text))) setEditing(false) }}>{t('save')}</button>
            <button type="button" className="btn-linklike" onClick={() => { setEditing(false); setText(link.rationale ?? '') }}>{t('cancel')}</button>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12.5, margin: '6px 0 0', lineHeight: 1.45 }}>
          <span className="muted">{t('drawerWhy')}: </span>{link.rationale || '–'}
        </p>
      )}
      <div className="cmp-issues">
        {issues.map((i) => <span key={i} className={`cmp-issue${i === 'proposed' || i === 'questioned' ? ' warn' : ''}`}>{t(ISSUE_KEY[i])}</span>)}
        {reviews.map((v) => (
          <span key={v.id} className="cmp-issue" title={v.comment ?? ''}>
            {t(VERDICT_KEY[(v.verdict as LinkVerdict)] ?? 'verdictQuestions')}{v.comment ? `: ${v.comment.slice(0, 60)}` : ''}
            {canEdit && v.reviewedBy && (
              <button type="button" className="btn-linklike" style={{ marginLeft: 4, textDecoration: 'none' }} aria-label={t('remove')} onClick={() => run(() => deleteLinkReview(supabase, v.id))}>×</button>
            )}
          </span>
        ))}
      </div>
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        {canEdit && link.proposed && <button type="button" className="btn btn-mini" disabled={busy} onClick={() => run(() => confirmProposedLink(supabase, link))}><Check size={11} />{t('drawerConfirm')}</button>}
        {canEdit && !editing && <button type="button" className="btn btn-mini" onClick={() => setEditing(true)}><Pencil size={11} />{t('drawerEdit')}</button>}
        {canCritique && reviewsOk && !questioning && <button type="button" className="btn btn-mini" onClick={() => setQuestioning(true)}><Flag size={11} />{t('drawerQuestion')}</button>}
        {canEdit && (
          <button type="button" className="btn btn-mini" disabled={busy} onClick={() => { if (window.confirm(t('drawerRemoveConfirm'))) run(() => deleteContentLink(supabase, link.id)) }}>
            <Trash2 size={11} />{t('remove')}
          </button>
        )}
      </div>
      {questioning && (
        <div style={{ marginTop: 8 }}>
          <select value={verdict} onChange={(e) => setVerdict(e.target.value as LinkVerdict)} style={{ width: '100%', marginBottom: 4 }}>
            {VERDICTS.map((v) => <option key={v} value={v}>{t(VERDICT_KEY[v])}</option>)}
          </select>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('drawerCommentPlaceholder')} style={{ width: '100%' }} />
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <button type="button" className="btn btn-mini btn-primary" disabled={busy}
              onClick={async () => { if (await run(() => addLinkReview(supabase, { projectId: project.id, linkId: link.id, verdict, comment }))) { setQuestioning(false); setComment('') } }}>{t('save')}</button>
            <button type="button" className="btn-linklike" onClick={() => setQuestioning(false)}>{t('cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
