import { useMemo, useState } from 'react'
import { FileEdit } from 'lucide-react'
import { groupDraftLinks } from '@/lib/comparison'
import { useComparison } from './context'
import { LinkCard } from './drawer'
import { Explain, LoadGate, PageHeader } from './ui'
import type { StringKey } from './strings'

// Links to parts nobody has accepted yet. The other comparison pages read accepted parts only, so a link from a draft part never
// shows on them. This page lists those links by strand and part, with the same read-and-question controls as the link drawer, so the
// review of AI-drafted parts can start inside the project space. It changes no figure anywhere else.

const STATUS_KEY: Record<string, StringKey> = { draft: 'draftStatusDraft', submitted: 'draftStatusSubmitted', under_review: 'draftStatusUnderReview' }

export default function DraftLinksPage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const { t, lang, draftParts, draftLinks, recordsById, reviewsByLink, canEdit, canCritique, refresh } = useComparison()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [strand, setStrand] = useState<string>('all')

  const groups = useMemo(() => groupDraftLinks(draftParts, draftLinks), [draftParts, draftLinks])
  const shown = strand === 'all' ? groups.strands : groups.strands.filter((g) => (g.strandId ?? '__none__') === strand)
  const withVerdict = draftLinks.filter((l) => (reviewsByLink.get(l.id)?.length ?? 0) > 0).length

  const run = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true); setError(null)
    const { error: e } = await fn()
    setBusy(false)
    if (e) { setError(e); return false }
    refresh()
    return true
  }

  return (
    <div>
      <PageHeader icon={FileEdit} title={t('draftLinksTitle')} help={t('draftLinksHelp')} />
      <p className="muted" style={{ margin: '0 0 10px' }}>{canEdit ? t('curRoleEdit') : canCritique ? t('curRoleCritic') : t('curRoleView')}</p>
      <Explain what={t('draftLinksWhat')} />
      <div className="cmp-stats">
        <div className="cmp-stat"><div className="cmp-stat-value">{groups.strands.reduce((n, g) => n + g.parts.length, 0)}</div><div className="cmp-stat-label">{t('draftStatParts')}</div></div>
        <div className="cmp-stat"><div className="cmp-stat-value">{groups.linkCount}</div><div className="cmp-stat-label">{t('draftStatLinks')}</div></div>
        <div className="cmp-stat"><div className="cmp-stat-value">{withVerdict}</div><div className="cmp-stat-label">{t('draftStatVerdicts')}</div></div>
      </div>

      {groups.strands.length > 1 && (
        <div className="cmp-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={strand === 'all'} className={`cmp-chip${strand === 'all' ? ' on' : ''}`} onClick={() => setStrand('all')}>{t('draftFilterAll')}</button>
          {groups.strands.map((g) => {
            const id = g.strandId ?? '__none__'
            return (
              <button key={id} type="button" role="tab" aria-selected={strand === id} className={`cmp-chip${strand === id ? ' on' : ''}`} onClick={() => setStrand(id)}>
                {g.strandTitle ?? t('draftStrandNone')} <span className="cmp-count">{g.linkCount}</span>
              </button>
            )
          })}
        </div>
      )}

      {error && <div className="notice notice-bad" role="alert">{error}</div>}

      {groups.strands.length === 0 ? (
        <div className="cmp-panel"><p className="muted">{t('draftNone')}</p></div>
      ) : shown.map((g) => (
        <section key={g.strandId ?? '__none__'} className="cmp-panel" style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>{g.strandTitle ?? t('draftStrandNone')}</h2>
          {g.parts.map(({ part, links }) => (
            <div key={part.id} style={{ marginTop: 12 }}>
              <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                {part.gradeBand && <span className="cmp-issue">{part.gradeBand}</span>}
                <strong style={{ fontSize: 13.5 }}>{part.title}</strong>
                <span className="cmp-draft-badge" style={{ marginLeft: 0 }}>{t(STATUS_KEY[part.status] ?? 'draftStatusDraft')}</span>
                <span className="muted" style={{ fontSize: 11.5 }}>{t('draftPartLinks', { n: links.length })}</span>
              </div>
              {links.map((l) => <LinkCard key={l.id} link={l} record={recordsById.get(l.recordId)} busy={busy} run={run} />)}
            </div>
          ))}
        </section>
      ))}

      {groups.withoutLinks.length > 0 && (
        <p className="muted" style={{ fontSize: 12 }} lang={lang}>{t('draftWithout', { n: groups.withoutLinks.length })}</p>
      )}
    </div>
  )
}
