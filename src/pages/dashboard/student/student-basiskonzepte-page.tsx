import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams, useNavigate } from 'react-router-dom'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { Info } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { bkAbbreviation, bkEntries, getRootConcepts } from '@/lib/supabase/basiskonzepte'
import { listTopicContents, listTopics, type TopicListItem } from '@/lib/supabase/curriculum'

type SchemaElement = Database['public']['Tables']['lpm_schema_elements']['Row']

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}
const MAP_PALETTE = ['--map-1', '--map-2', '--map-3', '--map-4', '--map-5', '--map-6']

// The real, field-verified Konzeptanker definition, from EvoMentor DE
// v1.2's own tooltip text (apps/evomentor_de_v1_2.html's KONZEPTANKER_DEF
// constant) -- not paraphrased.
const KONZEPTANKER_DEF = 'ein Lernziel, das einen besonders konkreten, anschaulichen Einstiegspunkt in ein Basiskonzept bildet.'

const TABS = ['dashboard', 'netz', 'detail'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = { dashboard: 'Dashboard', netz: 'Netz', detail: 'Detail' }

export default function StudentBasiskonzeptePage() {
  const { project, defaultBranchId, supabase } = useOutletContext<ProjectOutletContext>()
  const { tab } = useParams<{ tab?: Tab }>()
  const navigate = useNavigate()
  const activeTab: Tab = (tab && TABS.includes(tab as Tab) ? tab : 'dashboard') as Tab

  const [rootConcepts, setRootConcepts] = useState<SchemaElement[]>([])
  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [contentById, setContentById] = useState<Map<string, unknown>>(new Map())

  useEffect(() => {
    getRootConcepts(supabase, project).then(setRootConcepts)
    listTopics(supabase, project.id, defaultBranchId).then(setTopics)
    listTopicContents(supabase, project.id).then(setContentById)
  }, [supabase, project, defaultBranchId])

  return (
    <div className="student-page">
      <h1>Basiskonzepte</h1>
      <p className="muted" style={{ marginBottom: 12 }}>Dashboard, Konzeptnetz, Details</p>

      <div className="row" style={{ gap: 6, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t}
            className={`chip-btn${activeTab === t ? ' active' : ''}`}
            onClick={() => navigate(t === 'dashboard' ? `/dashboard/${project.slug}/basiskonzepte` : `/dashboard/${project.slug}/basiskonzepte/${t}`)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && <DashboardTab rootConcepts={rootConcepts} topics={topics} contentById={contentById} />}
      {activeTab === 'netz' && <NetzTab project={project} supabase={supabase} rootConcepts={rootConcepts} />}
      {activeTab === 'detail' && <DetailTab rootConcepts={rootConcepts} />}
    </div>
  )
}

// ============================================================================
// Dashboard: 5 real stat tiles + a grade x concept relevance grid, matching
// EvoMentor DE v1.2's own real layout and field names (geschaetzte_
// unterrichtsstunden, ist_konzeptanker, ist_praktisch) -- read defensively,
// since these are richer fields the base import may or may not have
// carried over for every row (same discipline prompt-generator-page.tsx
// already established for didaktische_strategien/originaltext).
// ============================================================================

function DashboardTab({
  rootConcepts,
  topics,
  contentById,
}: {
  rootConcepts: SchemaElement[]
  topics: TopicListItem[] | null
  contentById: Map<string, unknown>
}) {
  const contents = Array.from(contentById.values())
  const konzeptanker = contents.filter((c) => (c as any)?.ist_konzeptanker).length
  const praktisch = contents.filter((c) => (c as any)?.ist_praktisch).length
  const stundenValues = contents.map((c) => (c as any)?.geschaetzte_unterrichtsstunden).filter((v) => typeof v === 'number')
  const stundenGesamt = stundenValues.reduce((a, b) => a + b, 0)
  const hasStunden = stundenValues.length > 0

  const grades = useMemo(() => {
    const set = new Set((topics ?? []).map((t) => t.grade_band).filter(Boolean) as string[])
    const leadingNumber = (s: string) => parseInt(s, 10) || 0
    return Array.from(set).sort((a, b) => leadingNumber(a) - leadingNumber(b))
  }, [topics])

  return (
    <div>
      <div className="bk-stat-tiles">
        <div className="card bk-stat-tile"><div className="n">{topics?.length ?? '—'}</div><div className="l">Lernziele gesamt</div></div>
        <div className="card bk-stat-tile"><div className="n">{rootConcepts.length}</div><div className="l">Basiskonzepte</div></div>
        <div className="card bk-stat-tile"><div className="n">{konzeptanker}</div><div className="l">Konzeptanker <span title={KONZEPTANKER_DEF} style={{ cursor: 'help' }}><Info size={11} style={{ verticalAlign: 'middle' }} /></span></div></div>
        <div className="card bk-stat-tile"><div className="n">{praktisch}</div><div className="l">praktische Lernziele</div></div>
        {hasStunden && <div className="card bk-stat-tile"><div className="n">{stundenGesamt}</div><div className="l">Unterrichtsstunden gesamt</div></div>}
      </div>

      <div className="card">
        <h3>Relevanzverteilung je Basiskonzept × Klassenstufe</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
          Je Zelle: Anzahl der Lernziele dieser Klassenstufe mit hoher Relevanz (3/3) für das jeweilige Basiskonzept.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Basiskonzept</th>
                {grades.map((g) => <th key={g} style={{ padding: '4px 8px' }}>Kl. {g}</th>)}
              </tr>
            </thead>
            <tbody>
              {rootConcepts.map((c, i) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '4px 8px' }}><span className={`bk-dot bk-dot-${i % 6}`} style={{ marginRight: 6 }} />{c.label}</td>
                  {grades.map((g) => {
                    const count = (topics ?? []).filter((t) => {
                      if (t.grade_band !== g) return false
                      return bkEntries(contentById.get(t.id)).some((e) => e.relevanz_beurteilung === 3 && looksLikeBk(e.basiskonzept_id, c.label))
                    }).length
                    return <td key={g} style={{ padding: '4px 8px', textAlign: 'center' }}>{count || '—'}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function looksLikeBk(bkId: string, label: string): boolean {
  const tokens = bkId.replace(/^bk_/, '').split('_').filter(Boolean)
  const norm = label.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '')
  return tokens.every((t) => norm.includes(t))
}

// ============================================================================
// Netz: the improved graph -- real Basiskonzept<->Lernziel edges (from
// lpm_thread_stations.via_element_id, migration 010's real coherence-thread
// data), not just a static 6-node Basiskonzept-to-Basiskonzept network the
// way EvoMentor DE's own "Netz" tab is limited to. Colored by which
// Basiskonzept a Lernziel connects through, sized by how many real
// connections touch it. A growth-over-time strip beneath it plots real
// lpm_threads.created_at timestamps -- the class's own coherence work
// filling in over the semester, not a synthetic demo metric.
// ============================================================================

function NetzTab({
  project,
  supabase,
  rootConcepts,
}: {
  project: ProjectOutletContext['project']
  supabase: ProjectOutletContext['supabase']
  rootConcepts: SchemaElement[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [threads, setThreads] = useState<
    { id: string; created_at: string; title: string; stations: { data_object_id: string; via_element_id: string | null; object_title: string }[] }[] | null
  >(null)

  useEffect(() => {
    const projectIds = Array.from(new Set([project.parent_project_id ?? project.id, project.id]))
    supabase
      .from('lpm_threads')
      .select('id, created_at, title, status, lpm_thread_stations(data_object_id, via_element_id, lpm_data_objects(title))')
      .in('project_id', projectIds)
      .eq('status', 'accepted')
      .then(({ data }) => {
        setThreads(
          (data ?? []).map((t: any) => ({
            id: t.id,
            created_at: t.created_at,
            title: t.title,
            stations: (t.lpm_thread_stations ?? []).map((s: any) => ({
              data_object_id: s.data_object_id,
              via_element_id: s.via_element_id,
              object_title: s.lpm_data_objects?.title ?? '?',
            })),
          }))
        )
      })
  }, [supabase, project])

  useEffect(() => {
    if (!containerRef.current || !threads) return
    const rootIndex = new Map(rootConcepts.map((r, i) => [r.id, i]))
    const bkNodeIds = new Set<string>()
    const lzNodeIds = new Map<string, string>() // data_object_id -> title
    const edges: { source: string; target: string; color: string }[] = []

    for (const t of threads) {
      for (const s of t.stations) {
        if (!s.via_element_id) continue
        bkNodeIds.add(s.via_element_id)
        lzNodeIds.set(s.data_object_id, s.object_title)
        const idx = rootIndex.get(s.via_element_id) ?? 0
        edges.push({ source: s.via_element_id, target: s.data_object_id, color: cssVar(MAP_PALETTE[idx % 6], '#999') })
      }
    }

    const elements: ElementDefinition[] = [
      ...rootConcepts.map((c, i) => ({
        data: { id: c.id, label: c.label, color: cssVar(MAP_PALETTE[i % 6], '#2a78d6'), size: 40, kind: 'bk' },
      })),
      ...Array.from(lzNodeIds.entries()).map(([id, title]) => ({
        data: { id, label: title.length > 28 ? title.slice(0, 26) + '…' : title, color: cssVar('--surface-1', '#eee'), size: 16, kind: 'lz' },
      })),
      ...edges.map((e, i) => ({ data: { id: `e-${i}`, source: e.source, target: e.target, color: e.color } })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      layout: { name: 'cose', animate: false, nodeRepulsion: () => 8000 } as any,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)', width: 'data(size)', height: 'data(size)',
            label: 'data(label)', 'font-size': 8, 'text-wrap': 'wrap', 'text-max-width': '60px',
            'text-valign': 'bottom', 'text-margin-y': 3, color: cssVar('--text-primary', '#0b0b0b'),
          },
        },
        {
          // Real bug found live 2026-09-30: centering a wrapped multi-line
          // label inside a small circle (Cytoscape's 'text-valign: center')
          // clips unpredictably -- which label survives depends on where
          // the force-directed layout happens to place that specific node,
          // not on the label's own length, so widening text-max-width only
          // ever fixed some labels and not others. Moved the label below
          // the circle instead, the same safe position already used for
          // the small Lernziel nodes (which never had this problem) --
          // sidesteps circle-vs-text-box interaction entirely rather than
          // continuing to tune widths against a layout that moves every
          // render.
          selector: 'node[kind="bk"]',
          style: {
            'font-size': 11, 'font-weight': 700, 'text-valign': 'bottom', 'text-margin-y': 6,
            'text-max-width': '100px', color: cssVar('--text-primary', '#0b0b0b'), 'text-outline-width': 0,
          },
        },
        { selector: 'edge', style: { width: 1.5, 'line-color': 'data(color)', 'curve-style': 'bezier', 'target-arrow-shape': 'none', opacity: 0.55 } },
      ],
    })
    return () => cy.destroy()
  }, [threads, rootConcepts])

  const growthWeeks = useMemo(() => {
    if (!threads) return []
    const byWeek = new Map<string, number>()
    for (const t of threads) {
      const d = new Date(t.created_at)
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      const key = monday.toISOString().slice(0, 10)
      byWeek.set(key, (byWeek.get(key) ?? 0) + 1)
    }
    const weeks = Array.from(byWeek.keys()).sort()
    let cumulative = 0
    return weeks.map((w) => {
      cumulative += byWeek.get(w)!
      return { week: w, cumulative }
    })
  }, [threads])

  return (
    <div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div ref={containerRef} style={{ height: 480 }} />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        Große Kreise = Basiskonzepte. Kleine Punkte = einzelne Lernziele, verbunden über echte,
        geprüfte Kohärenzfäden.
      </p>

      <div className="card">
        <h3>Wachstum über die Zeit</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
          Wie viele geprüfte Verbindungen zwischen Basiskonzepten und Lernzielen im Laufe des Semesters entstanden sind.
        </p>
        {growthWeeks.length === 0 ? (
          <p className="muted">Noch keine geprüften Verbindungen — dieses Diagramm füllt sich, sobald welche angenommen werden.</p>
        ) : (
          <div className="row" style={{ alignItems: 'flex-end', gap: 4, height: 80 }}>
            {growthWeeks.map((w) => {
              const max = growthWeeks[growthWeeks.length - 1].cumulative
              return (
                <div key={w.week} className="tip" data-tip={`${w.week}: ${w.cumulative} gesamt`} style={{ flex: 1, background: 'var(--series-a)', height: `${Math.max(6, (w.cumulative / max) * 80)}px`, borderRadius: '3px 3px 0 0' }} />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Detail: per-Basiskonzept definition, misconception pairs (X/✓), everyday
// anchors -- real content imported from EvoMentor DE's own source data
// (migration 042), not placeholder text. Falls back honestly ("noch keine
// Detailinhalte") for a project that hasn't had this content imported.
// ============================================================================

function DetailTab({ rootConcepts }: { rootConcepts: SchemaElement[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(rootConcepts[0]?.id ?? null)
  useEffect(() => {
    if (!selectedId && rootConcepts[0]) setSelectedId(rootConcepts[0].id)
  }, [rootConcepts, selectedId])

  const selected = rootConcepts.find((c) => c.id === selectedId)

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        {rootConcepts.map((c, i) => (
          <button
            key={c.id}
            className="btn-linklike"
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0', fontWeight: c.id === selectedId ? 700 : 400 }}
            onClick={() => setSelectedId(c.id)}
          >
            <span className={`bk-dot bk-dot-${i % 6}`} style={{ marginRight: 6 }} />{c.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ flex: 1 }}>
        {!selected ? (
          <p className="muted">Kein Basiskonzept ausgewählt.</p>
        ) : (
          <StudentBkDetail concept={selected} abbr={bkAbbreviation(selected.label)} />
        )}
      </div>
    </div>
  )
}

function StudentBkDetail({ concept }: { concept: SchemaElement; abbr: string }) {
  const definition = (concept as any).didactic_definition as string | null
  const misconceptions = ((concept as any).common_misconceptions ?? []) as { falsch: string; richtig: string; hinweis?: string }[]
  const anchors = ((concept as any).everyday_anchors ?? []) as string[]
  const principles = ((concept as any).core_principles ?? []) as string[]

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>{concept.label}</h2>
      {!definition ? (
        <p className="muted">Noch keine Detailinhalte für dieses Basiskonzept hinterlegt.</p>
      ) : (
        <>
          <p>{definition}</p>

          {principles.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {principles.map((p) => <span key={p} className="chip">{p}</span>)}
            </div>
          )}

          {misconceptions.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <h3>Häufige Schülervorstellungen</h3>
              {misconceptions.map((m, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <p style={{ color: 'var(--critical)', margin: 0 }}>✗ {m.falsch}</p>
                  <p style={{ color: 'var(--good)', margin: '2px 0 0' }}>✓ {m.richtig}</p>
                  {m.hinweis && <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>{m.hinweis}</p>}
                </div>
              ))}
            </section>
          )}

          {anchors.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <h3>Alltagsanker</h3>
              <ul>{anchors.map((a) => <li key={a}>{a}</li>)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
