import { useEffect, useMemo, useState } from 'react'
import { GitCompare } from 'lucide-react'
import { KNOWN_COMPARISON_PAIRS, getProjectComparisonProfile, listComparativeLinksBetweenProjects, type ComparativeLinkWithTitles, type ProjectComparisonProfile } from '@/lib/supabase/comparative-analysis'
import { LpmComparisonProfileCard } from '@/components/lpm-comparison-profile-card'
import { cssVar } from '@/lib/comparison'
import { useComparison } from './context'
import { Sankey, type SankeyLink, type SankeyNode } from './sankey'
import { Explain, LoadGate, PageHeader } from './ui'

// Between two synthetic spaces (today Bio-Core and Interdisciplinary): the
// comparison notes the researchers wrote between their strands. Kept from the
// earlier Comparison page, now drawn with the shared flow diagram and the
// view's own colors. The relation colors reuse the shared concept palette, as
// the earlier page did.
const RELATION_TOKEN: Record<string, string> = {
  contrasting_treatment: '--map-2',
  assessment_item_divergence: '--map-5',
  assessment_scoring_divergence: '--map-4',
  complementary_emphasis: '--map-1',
  scope_divergence: '--map-3',
}
const relationLabel = (r: string) => r.replace(/_/g, ' ')

export default function SpacesPage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const { t, lang, project, supabase } = useComparison()
  const [profile, setProfile] = useState<ProjectComparisonProfile | null>(null)
  const [otherProfile, setOtherProfile] = useState<ProjectComparisonProfile | null>(null)
  const [otherName, setOtherName] = useState('')
  const [notes, setNotes] = useState<ComparativeLinkWithTitles[] | null>(null)
  const otherSlug = KNOWN_COMPARISON_PAIRS[project.slug]

  useEffect(() => {
    let alive = true
    getProjectComparisonProfile(supabase, project.id).then((p) => alive && setProfile(p))
    if (!otherSlug) return
    supabase.from('projects').select('id,name').eq('slug', otherSlug).maybeSingle().then(({ data }) => {
      if (!alive || !data) return
      setOtherName(data.name)
      getProjectComparisonProfile(supabase, data.id).then((p) => alive && setOtherProfile(p))
      listComparativeLinksBetweenProjects(supabase, project.id, data.id).then((l) => alive && setNotes(l))
    })
    return () => { alive = false }
  }, [supabase, project.id, otherSlug])

  const flow = useMemo(() => {
    const nodes = new Map<string, SankeyNode>()
    const counts = new Map<string, SankeyLink>()
    ;(notes ?? []).forEach((n) => {
      const own = n.from_project_id === project.id
      const left = own ? n.from_title : n.to_title
      const right = own ? n.to_title : n.from_title
      nodes.set(`l:${left}`, { id: `l:${left}`, label: left, column: 0, color: cssVar('--series-a', '#0f8a7a'), order: nodes.size })
      nodes.set(`r:${right}`, { id: `r:${right}`, label: right, column: 1, color: cssVar('--place-other', '#6f7d8c'), order: nodes.size })
      const key = `${left}\u0000${right}\u0000${n.relation_type}`
      const cur = counts.get(key)
      if (cur) cur.value += 1
      else counts.set(key, { source: `l:${left}`, target: `r:${right}`, value: 1, color: cssVar(RELATION_TOKEN[n.relation_type] ?? '--map-6', '#888') })
    })
    return { nodes: Array.from(nodes.values()), links: Array.from(counts.values()) }
  }, [notes, project.id])

  return (
    <div>
      <PageHeader icon={GitCompare} title={t('spacesTitle')} help={t('spacesHelp')} />
      {!profile || !otherProfile ? <p className="muted">{t('loading')}</p> : (
        <>
          <p className="muted row" style={{ gap: 5, marginBottom: 10 }}><GitCompare size={13} /> {t('spacesAgainst', { name: otherName })}</p>
          <div className="grid grid-2" style={{ marginBottom: 14 }}>
            <LpmComparisonProfileCard profile={profile} label={project.name} language={lang} />
            <LpmComparisonProfileCard profile={otherProfile} label={otherName} language={lang} />
          </div>
          <div className="cmp-panel">
            <h2>{t('spacesSankeyTitle')}</h2>
            <Explain what={t('spacesSankeyHint')} />
            <Sankey nodes={flow.nodes} links={flow.links} columnLabels={[project.name, otherName]} emptyLabel={t('spacesEmpty')} unit={` ${t('spacesNotesUnit')}`} width={900} />
            <div className="cmp-legend">
              {Array.from(new Set((notes ?? []).map((n) => n.relation_type))).map((rt) => (
                <span key={rt}><span className="cmp-dot" style={{ background: cssVar(RELATION_TOKEN[rt] ?? '--map-6', '#888') }} />{relationLabel(rt)}</span>
              ))}
            </div>
          </div>
          <div className="cmp-panel">
            <h2>{t('spacesNotes')}</h2>
            {notes === null ? <p className="muted">{t('loading')}</p> : notes.length === 0 ? <p className="muted">{t('spacesNoNotes')}</p> : notes.map((n) => (
              <div key={n.id} className="cmp-link-card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 12.5 }}>{n.from_title} <span className="muted">↔</span> {n.to_title}</strong>
                  <span className="muted" style={{ fontSize: 11 }}>{relationLabel(n.relation_type)}</span>
                </div>
                {n.divergence_label && <p className="muted" style={{ fontSize: 11.5, margin: '2px 0' }}>{t('spacesIllustrates')}: {n.divergence_label}</p>}
                <p style={{ fontSize: 12.5, margin: '4px 0 0' }}>{n.commentary}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
