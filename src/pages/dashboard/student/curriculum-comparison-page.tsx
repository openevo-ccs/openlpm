import { useMemo, useState } from 'react'
import { GitCompare } from 'lucide-react'
import { useCurriculumConnectionsData } from './use-curriculum-connections-data'
import { STRINGS } from './curriculum-connections-strings'
import { LpmComparisonProfileCard } from '@/components/lpm-comparison-profile-card'
import type { ComparativeLinkWithTitles } from '@/lib/supabase/comparative-analysis'

// The "Comparison" / "Vergleich" page -- promoted out of
// curriculum-connections-page.tsx into its own sidebar nav item on
// 2026-10-20, now with a real flow (Sankey-style) diagram showing which
// strand pairs across the two LPMs already have comparison notes, and how
// many. Hand-rolled rather than a d3-sankey dependency: the graph is always
// small and strictly bipartite (one LPM's strands on the left, the other's
// on the right), which a general-purpose multi-stage Sankey layout library
// would be overkill for.
const RELATION_COLOR_TOKENS: Record<string, string> = {
  contrasting_treatment: '--map-2',
  assessment_item_divergence: '--map-5',
  assessment_scoring_divergence: '--map-4',
  complementary_emphasis: '--map-1',
  scope_divergence: '--map-3',
}
const FALLBACK_COLOR_TOKEN = '--map-6'

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function relationColor(relationType: string) {
  return cssVar(RELATION_COLOR_TOKENS[relationType] ?? FALLBACK_COLOR_TOKEN, '#888')
}

function relationLabel(relationType: string) {
  return relationType.replace(/_/g, ' ')
}

interface SankeyNode {
  title: string
  side: 'left' | 'right'
  value: number
  y0: number
  y1: number
}

function buildNodes(links: ComparativeLinkWithTitles[], ownProjectId: string): { left: SankeyNode[]; right: SankeyNode[]; flows: { left: string; right: string; relationType: string; link: ComparativeLinkWithTitles }[] } {
  const flows = links.map((l) => {
    const ownIsFrom = l.from_project_id === ownProjectId
    return {
      left: ownIsFrom ? l.from_title : l.to_title,
      right: ownIsFrom ? l.to_title : l.from_title,
      relationType: l.relation_type,
      link: l,
    }
  })

  const leftTotals = new Map<string, number>()
  const rightTotals = new Map<string, number>()
  for (const f of flows) {
    leftTotals.set(f.left, (leftTotals.get(f.left) ?? 0) + 1)
    rightTotals.set(f.right, (rightTotals.get(f.right) ?? 0) + 1)
  }

  const UNIT = 26
  const GAP = 14
  function layOut(totals: Map<string, number>, side: 'left' | 'right'): SankeyNode[] {
    let y = 0
    const nodes: SankeyNode[] = []
    for (const [title, value] of totals) {
      const height = Math.max(value * UNIT, 30)
      nodes.push({ title, side, value, y0: y, y1: y + height })
      y += height + GAP
    }
    return nodes
  }

  return { left: layOut(leftTotals, 'left'), right: layOut(rightTotals, 'right'), flows }
}

function SankeyDiagram({
  links,
  ownProjectId,
  ownName,
  compareName,
  emptyLabel,
}: {
  links: ComparativeLinkWithTitles[]
  ownProjectId: string
  ownName: string
  compareName: string
  emptyLabel: string
}) {
  const [activeTitle, setActiveTitle] = useState<string | null>(null)
  const { left, right, flows } = useMemo(() => buildNodes(links, ownProjectId), [links, ownProjectId])

  if (links.length === 0) return <p className="muted" style={{ fontSize: 13 }}>{emptyLabel}</p>

  const maxY = Math.max(left.length ? left[left.length - 1].y1 : 0, right.length ? right[right.length - 1].y1 : 0)
  const height = Math.max(maxY, 60) + 24
  const width = 820
  const nodeW = 10
  const leftX = 210
  const rightX = width - 210 - nodeW

  // Running per-node offset so multiple flows touching the same node stack
  // without overlapping, instead of all starting at y0.
  const leftOffset = new Map<string, number>()
  const rightOffset = new Map<string, number>()
  const nodeByTitle = new Map<string, SankeyNode>()
  for (const n of [...left, ...right]) nodeByTitle.set(`${n.side}:${n.title}`, n)

  const FLOW_UNIT = 26

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height + 12} style={{ fontFamily: 'inherit' }}>
        {flows.map((f, i) => {
          const ln = nodeByTitle.get(`left:${f.left}`)!
          const rn = nodeByTitle.get(`right:${f.right}`)!
          const lOff = leftOffset.get(f.left) ?? 0
          const rOff = rightOffset.get(f.right) ?? 0
          leftOffset.set(f.left, lOff + FLOW_UNIT)
          rightOffset.set(f.right, rOff + FLOW_UNIT)
          const y0a = ln.y0 + lOff + 12
          const y0b = y0a + FLOW_UNIT - 4
          const y1a = rn.y0 + rOff + 12
          const y1b = y1a + FLOW_UNIT - 4
          const x0 = leftX + nodeW
          const x1 = rightX
          const cx = (x0 + x1) / 2
          const dim = activeTitle && activeTitle !== f.left && activeTitle !== f.right
          const path = `M${x0},${y0a} C${cx},${y0a} ${cx},${y1a} ${x1},${y1a} L${x1},${y1b} C${cx},${y1b} ${cx},${y0b} ${x0},${y0b} Z`
          return (
            <path key={f.link.id ?? i} d={path} fill={relationColor(f.relationType)} opacity={dim ? 0.08 : 0.55}
              style={{ transition: 'opacity 150ms' }}>
              <title>{`${f.left} ↔ ${f.right} (${relationLabel(f.relationType)})`}</title>
            </path>
          )
        })}

        {left.map((n) => (
          <g key={`l-${n.title}`} style={{ cursor: 'pointer' }} onClick={() => setActiveTitle((t) => (t === n.title ? null : n.title))}>
            <rect x={leftX} y={n.y0 + 12} width={nodeW} height={n.y1 - n.y0} rx={2}
              fill={cssVar('--series-a', '#006c66')} opacity={activeTitle && activeTitle !== n.title ? 0.25 : 1} />
            <text x={leftX - 8} y={(n.y0 + n.y1) / 2 + 16} textAnchor="end" fontSize={11}
              fontWeight={activeTitle === n.title ? 700 : 500}
              fill={cssVar('--text-primary', '#0b0b0b')}>
              {n.title.length > 30 ? `${n.title.slice(0, 29)}…` : n.title}
            </text>
          </g>
        ))}
        {right.map((n) => (
          <g key={`r-${n.title}`} style={{ cursor: 'pointer' }} onClick={() => setActiveTitle((t) => (t === n.title ? null : n.title))}>
            <rect x={rightX} y={n.y0 + 12} width={nodeW} height={n.y1 - n.y0} rx={2}
              fill="#3fae70" opacity={activeTitle && activeTitle !== n.title ? 0.25 : 1} />
            <text x={rightX + nodeW + 8} y={(n.y0 + n.y1) / 2 + 16} textAnchor="start" fontSize={11}
              fontWeight={activeTitle === n.title ? 700 : 500}
              fill={cssVar('--text-primary', '#0b0b0b')}>
              {n.title.length > 30 ? `${n.title.slice(0, 29)}…` : n.title}
            </text>
          </g>
        ))}

        <text x={leftX} y={10} fontSize={10} fontWeight={700} fill={cssVar('--text-muted', '#777')}>{ownName}</text>
        <text x={rightX + nodeW} y={10} fontSize={10} fontWeight={700} fill={cssVar('--text-muted', '#777')} textAnchor="end">{compareName}</text>
      </svg>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 11 }}>
        {Array.from(new Set(flows.map((f) => f.relationType))).map((rt) => (
          <span key={rt} className="row" style={{ gap: 4 }}>
            <span className="dept-sw" style={{ background: relationColor(rt) }} />
            {relationLabel(rt)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function CurriculumComparisonPage() {
  const { project, config, profile, compareProfile, compareName, comparativeLinks } = useCurriculumConnectionsData()
  const t = STRINGS[config?.language ?? 'en']

  if (!config) return <p className="muted">Unknown view configuration.</p>

  return (
    <div>
      <h1 className="row"><GitCompare size={18} style={{ color: 'var(--text-muted)' }} />{t.comparisonTitle}</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 680 }}>{t.comparisonHelp}</p>

      {!profile || !compareProfile ? (
        <p className="muted">…</p>
      ) : (
        <>
          <p className="muted row" style={{ gap: 5, marginBottom: 10 }}>
            <GitCompare size={13} /> {t.comparingAgainst(compareName)}
          </p>
          <div className="grid grid-2" style={{ marginBottom: 14 }}>
            <LpmComparisonProfileCard profile={profile} label={project.name} language={config.language} />
            <LpmComparisonProfileCard profile={compareProfile} label={compareName} language={config.language} />
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <strong style={{ fontSize: 13 }}>{t.sankeyTitle}</strong>
            <p className="muted" style={{ fontSize: 12, margin: '2px 0 10px' }}>{t.sankeyHint}</p>
            {comparativeLinks === null ? (
              <p className="muted">…</p>
            ) : (
              <SankeyDiagram
                links={comparativeLinks}
                ownProjectId={project.id}
                ownName={project.name}
                compareName={compareName}
                emptyLabel={t.sankeyEmpty}
              />
            )}
          </div>

          <div className="card">
            <strong style={{ fontSize: 13 }}>{t.comparisonNotes}</strong>
            {comparativeLinks === null ? (
              <p className="muted">…</p>
            ) : comparativeLinks.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>{t.noComparisonNotes}</p>
            ) : (
              comparativeLinks.map((l) => (
                <div key={l.id} className="card" style={{ marginTop: 8, padding: 8 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{l.from_title} <span className="muted">↔</span> {l.to_title}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{relationLabel(l.relation_type)}</span>
                  </div>
                  {l.divergence_label && <p className="muted" style={{ fontSize: 11, margin: '2px 0' }}>{t.illustrates}: {l.divergence_label}</p>}
                  <p style={{ fontSize: 12, margin: '4px 0 0' }}>{l.commentary}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
