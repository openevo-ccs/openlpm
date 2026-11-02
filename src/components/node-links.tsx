import { Link2 } from 'lucide-react'
import { linkTag, relationLabel, sharePercent, type NodeLink, type NodeLinkTotals } from '@/lib/supabase/curriculum-node-links'

// The two small pieces that show stage-to-topic links (migration 225) on the Structure page of a Curriculum Repository: a count chip on the
// node row, and the section "Stages that link here" that opens under it. A viewer sees the details of the spaces they belong to and only a
// count for the others. Every link is an LLM synthesized draft until a person has checked it, and the section says so with the agreed tag.

type Lang = 'de' | 'en'

export const NODE_LINK_TEXT = {
  de: {
    one: 'Stufen-Verknüpfung',
    many: 'Stufen-Verknüpfungen',
    title: 'Stufen mit Verbindung hierher',
    intro: 'Stufen aus Ihren Projekträumen, die zu diesem Eintrag passen könnten. Die Vorschläge stammen von einem Sprachmodell.',
    below: 'in den Teilen darunter',
    none: 'Hier selbst ist keine Stufe verknüpft.',
    plus: 'Dazu',
    fromOthers: 'aus Räumen, in denen Sie nicht Mitglied sind (nur die Anzahl)',
    gradeBand: 'Klassenstufen',
    ofStage: 'der Begriffe der Stufe',
    concepts: 'Gemeinsame Begriffe',
    shareHint: 'Anteil der Begriffe der Stufe, die auch in diesem Eintrag vorkommen',
  },
  en: {
    one: 'stage link',
    many: 'stage links',
    title: 'Stages that link here',
    intro: 'Stages from your project spaces that may fit this entry. The suggestions come from a language model.',
    below: 'in the parts below',
    none: 'No stage is linked at this level itself.',
    plus: 'Plus',
    fromOthers: 'from spaces you are not a member of (count only)',
    gradeBand: 'Grades',
    ofStage: "of the stage's concepts",
    concepts: 'Shared concepts',
    shareHint: "Share of the stage's concepts that also appear in this entry",
  },
} as const

/** The count chip of a node row. It opens and closes the section below it. */
export function NodeLinkChip({ totals, lang, expanded, controls, onToggle }: {
  totals: NodeLinkTotals
  lang: Lang
  expanded: boolean
  controls: string
  onToggle: () => void
}) {
  const t = NODE_LINK_TEXT[lang]
  const total = totals.mine + totals.others
  if (total === 0) return null
  return (
    <button type="button" className="chip chip-button" style={{ fontSize: 10.5 }} aria-expanded={expanded} aria-controls={controls} onClick={onToggle}>
      <Link2 size={10} />{total} {total === 1 ? t.one : t.many}
    </button>
  )
}

/** "Stages that link here": the links of the spaces the viewer belongs to in detail, and a bare count for the spaces they do not belong to. */
export function NodeLinksSection({ id, lang, links, totals }: {
  id: string
  lang: Lang
  links: NodeLink[]
  totals: NodeLinkTotals
}) {
  const t = NODE_LINK_TEXT[lang]
  const below = totals.mine + totals.others - totals.ownMine - totals.ownOthers
  return (
    <div id={id} style={{ margin: '6px 0', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-1)', minWidth: 0 }}>
      <strong style={{ fontSize: 12.5 }}>{t.title}</strong>
      {links.length > 0 && <p className="muted" style={{ margin: '2px 0 6px' }}>{t.intro}</p>}
      {links.length === 0 && totals.ownOthers === 0 && <p className="muted" style={{ margin: '2px 0 4px' }}>{t.none}</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {links.map((l) => {
          const pct = sharePercent(l.share)
          return (
            <li key={l.id} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <strong style={{ fontSize: 12.5 }}>{l.projectName}</strong>
                <span style={{ fontSize: 12.5 }}>{l.stageTitle}</span>
                {l.gradeBand && <span className="chip" style={{ fontSize: 10 }}>{t.gradeBand} {l.gradeBand}</span>}
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 3, fontSize: 11.5, alignItems: 'center' }}>
                <span className="muted" title={t.shareHint}>{relationLabel(l.relationType, lang)}{pct != null ? ` · ${pct} % ${t.ofStage}` : ''}</span>
                {l.sharedConcepts.length > 0 && (
                  <span className="row" style={{ gap: 4, flexWrap: 'wrap' }} aria-label={t.concepts}>
                    {l.sharedConcepts.map((c) => <span key={c} className="chip" style={{ fontSize: 10 }}>{c}</span>)}
                  </span>
                )}
                <span className="chip chip-draft" style={{ fontSize: 10 }}>{linkTag(l.reviewStatus, lang)}</span>
              </div>
            </li>
          )
        })}
      </ul>
      {totals.ownOthers > 0 && (
        <p className="muted" style={{ margin: '6px 0 0' }}>{t.plus} {totals.ownOthers} {totals.ownOthers === 1 ? t.one : t.many} {t.fromOthers}.</p>
      )}
      {below > 0 && <p className="muted" style={{ margin: '6px 0 0' }}>{below} {below === 1 ? t.one : t.many} {t.below}.</p>}
    </div>
  )
}
