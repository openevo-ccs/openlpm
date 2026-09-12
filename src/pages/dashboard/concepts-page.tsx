import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ChevronDown, ChevronRight, Layers, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'

type SchemaElement = Database['public']['Tables']['lpm_schema_elements']['Row']
type ProjectRow = Database['public']['Tables']['projects']['Row']

interface BkbEntry {
  basiskonzept_id: string
  relevanz_beurteilung: number
  begruendung: string
  relevante_unterkonzepte_taxonomie?: { value: string; taxonomyElementId: string | null }[]
  relevante_evolutionskonzepte_taxonomie?: { value: string; taxonomyElementId: string | null }[]
}

interface Hit {
  projectSlug: string
  projectName: string
  objectId: string
  title: string
  gradeBand: string | null
  relevance: number
  reasoning: string
}

// Every real Lernziel/standard this page pulls in, across every regional
// sub-project under this Project Space, tagged against the ONE shared
// Basiskonzepte taxonomy (schema-page.tsx's own comment explains why it
// lives on the Space, not any one region) -- built 2026-09-12 once all
// three German states carried the same full judgment set Thuringia already
// had, specifically so this became possible.
export default function ConceptsPage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const [taxonomy, setTaxonomy] = useState<SchemaElement[] | null>(null)
  const [children, setChildren] = useState<ProjectRow[]>([])
  const [hitsByTaxId, setHitsByTaxId] = useState<Map<string, Hit[]>>(new Map())
  const [hitsByBk, setHitsByBk] = useState<Map<string, Map<string, { sum: number; count: number }>>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<SchemaElement | null>(null)
  const [hubName, setHubName] = useState<string>(project.name)

  // The shared taxonomy and its full sibling list live on the Project Space
  // (see schema-page.tsx's own comment) -- viewing this tab from inside a
  // regional sub-project (Thuringia, Bayern, Sachsen...) still needs the
  // Space-level picture, not just that one sub-project's own (empty) schema
  // rows, so this always resolves up to the Space first.
  const hubProjectId = project.parent_project_id ?? project.id

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: hub } = await supabase.from('projects').select('*').eq('id', hubProjectId).maybeSingle()
      const hubProject = hub ?? project

      const { data: tax } = await supabase
        .from('lpm_schema_elements')
        .select('*')
        .eq('project_id', hubProjectId)
        .order('created_at', { ascending: true })

      const { data: kids } = await supabase
        .from('projects')
        .select('*')
        .eq('parent_project_id', hubProjectId)

      const projectIds = [hubProjectId, ...(kids ?? []).map((k) => k.id)]
      const { data: objects } = await supabase
        .from('lpm_data_objects')
        .select('id, title, grade_band, project_id, content')
        .in('project_id', projectIds)

      if (cancelled) return

      const projById = new Map<string, ProjectRow>()
      if (kids) for (const k of kids) projById.set(k.id, k)
      projById.set(hubProjectId, hubProject)

      const byTaxId = new Map<string, Hit[]>()
      const byBk = new Map<string, Map<string, { sum: number; count: number }>>()

      for (const obj of objects ?? []) {
        const bkb: BkbEntry[] = (obj.content as any)?.basiskonzeptbezug ?? []
        const p = projById.get(obj.project_id)
        if (!p) continue
        for (const entry of bkb) {
          if (!entry.basiskonzept_id) continue
          if (!byBk.has(entry.basiskonzept_id)) byBk.set(entry.basiskonzept_id, new Map())
          const perProject = byBk.get(entry.basiskonzept_id)!
          const cur = perProject.get(p.slug) ?? { sum: 0, count: 0 }
          cur.sum += entry.relevanz_beurteilung ?? 0
          cur.count += 1
          perProject.set(p.slug, cur)

          if ((entry.relevanz_beurteilung ?? 0) < 2) continue
          const subTags = [...(entry.relevante_unterkonzepte_taxonomie ?? []), ...(entry.relevante_evolutionskonzepte_taxonomie ?? [])]
          const hit: Hit = {
            projectSlug: p.slug,
            projectName: p.name,
            objectId: obj.id,
            title: obj.title,
            gradeBand: obj.grade_band,
            relevance: entry.relevanz_beurteilung,
            reasoning: entry.begruendung,
          }
          for (const tag of subTags) {
            if (!tag.taxonomyElementId) continue
            if (!byTaxId.has(tag.taxonomyElementId)) byTaxId.set(tag.taxonomyElementId, [])
            byTaxId.get(tag.taxonomyElementId)!.push(hit)
          }
        }
      }

      setTaxonomy(tax ?? [])
      setChildren(kids ?? [])
      setHitsByTaxId(byTaxId)
      setHitsByBk(byBk)
      setHubName(hubProject.name)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, hubProjectId])

  const roots = useMemo(() => (taxonomy ?? []).filter((e) => !e.parent_id), [taxonomy])
  const childrenOf = (id: string) => (taxonomy ?? []).filter((e) => e.parent_id === id)

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (taxonomy === null) return <p className="muted">Loading…</p>

  return (
    <div>
      <h1 className="row"><Layers size={18} style={{ color: 'var(--text-muted)' }} />Shared concept map</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        One concept structure, shared across every real regional curriculum in {hubName} — for
        finding what a specific concept looks like across states, and for comparing how much weight
        each state's curriculum actually gives it.
      </p>

      {children.length > 1 && (
        <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
          <h3 style={{ marginTop: 0 }}>How much each state emphasizes each concept</h3>
          <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
            Average relevance (1 = not relevant, 3 = central), from every real item's own judgment — not a guess.
          </p>
          <table>
            <thead>
              <tr>
                <th>Concept</th>
                {children.map((c) => <th key={c.id}>{c.name.replace('EvoMentor ', '')}</th>)}
              </tr>
            </thead>
            <tbody>
              {roots.map((bk) => {
                const canonicalId = (bk.metadata as any)?.canonical_id
                const perProject = hitsByBk.get(canonicalId)
                return (
                  <tr key={bk.id}>
                    <th>{bk.label}</th>
                    {children.map((c) => {
                      const cell = perProject?.get(c.slug)
                      const avg = cell ? cell.sum / cell.count : null
                      const color = avg === null ? 'var(--text-muted)' : avg >= 2.2 ? 'var(--good)' : avg >= 1.5 ? 'var(--series-a)' : 'var(--text-muted)'
                      return (
                        <td key={c.id} style={{ color, fontWeight: avg && avg >= 2.2 ? 700 : 400 }}>
                          {avg === null ? '—' : avg.toFixed(1)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: 'flex-start' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Browse the concept tree</h3>
          {roots.map((bk) => (
            <ConceptNode
              key={bk.id}
              node={bk}
              depth={0}
              childrenOf={childrenOf}
              expanded={expanded}
              onToggle={toggle}
              onSelect={setSelectedNode}
              selectedId={selectedNode?.id ?? null}
              hitsByTaxId={hitsByTaxId}
            />
          ))}
        </div>

        <div className="card" style={{ minHeight: 200 }}>
          {!selectedNode ? (
            <p className="muted">Pick a concept on the left to see which real learning goals, across which states, connect to it.</p>
          ) : (
            <ConceptDetail node={selectedNode} hits={hitsByTaxId.get(selectedNode.id) ?? []} onClose={() => setSelectedNode(null)} />
          )}
        </div>
      </div>
    </div>
  )
}

function ConceptNode({
  node,
  depth,
  childrenOf,
  expanded,
  onToggle,
  onSelect,
  selectedId,
  hitsByTaxId,
}: {
  node: SchemaElement
  depth: number
  childrenOf: (id: string) => SchemaElement[]
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (n: SchemaElement) => void
  selectedId: string | null
  hitsByTaxId: Map<string, Hit[]>
}) {
  const kids = childrenOf(node.id)
  const isOpen = expanded.has(node.id)
  const count = hitsByTaxId.get(node.id)?.length ?? 0
  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="row" style={{ gap: 4, padding: '3px 0' }}>
        {kids.length > 0 ? (
          <button className="btn-linklike" onClick={() => onToggle(node.id)} style={{ textDecoration: 'none' }}>
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span style={{ width: 13 }} />
        )}
        <button
          className="btn-linklike"
          style={{ textDecoration: node.id === selectedId ? 'underline' : 'none', fontWeight: depth === 0 ? 600 : 400 }}
          onClick={() => onSelect(node)}
        >
          {node.label}
        </button>
        {count > 0 && <span className="chip" style={{ fontSize: 10 }}>{count}</span>}
      </div>
      {isOpen && kids.map((k) => (
        <ConceptNode key={k.id} node={k} depth={depth + 1} childrenOf={childrenOf} expanded={expanded} onToggle={onToggle} onSelect={onSelect} selectedId={selectedId} hitsByTaxId={hitsByTaxId} />
      ))}
    </div>
  )
}

function ConceptDetail({ node, hits, onClose }: { node: SchemaElement; hits: Hit[]; onClose: () => void }) {
  const byProject = useMemo(() => {
    const m = new Map<string, Hit[]>()
    for (const h of hits) {
      if (!m.has(h.projectName)) m.set(h.projectName, [])
      m.get(h.projectName)!.push(h)
    }
    return m
  }, [hits])

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ marginTop: 0 }}>{node.label}</h3>
        <button className="btn btn-mini" onClick={onClose}><X size={11} /></button>
      </div>
      {node.definition && <p className="muted">{node.definition}</p>}
      {hits.length === 0 ? (
        <p className="muted">No real learning goal has been tagged to this specific concept yet — it may still be relevant, just not tied to it at this level of detail.</p>
      ) : (
        Array.from(byProject.entries()).map(([projectName, list]) => (
          <div key={projectName} style={{ marginBottom: 14 }}>
            <h4 style={{ marginBottom: 4 }}>{projectName} ({list.length})</h4>
            {list.map((h) => (
              <div key={h.objectId} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 13 }}>{h.title}</strong>
                  <span className="muted" style={{ fontSize: 11 }}>{h.gradeBand ? `Grade ${h.gradeBand}` : ''} · relevance {h.relevance}/3</span>
                </div>
                <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>{h.reasoning}</p>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
