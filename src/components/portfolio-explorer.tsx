import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { createClient } from '@/lib/supabase/client'
import { Chip } from '@/components/chip'
import { LayoutGrid, Network, Plus, Search, X } from 'lucide-react'
import type { PortfolioEdge, PortfolioNode } from '@/lib/supabase/portfolios'

function token(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

type CtxMenu = { x: number; y: number; kind: 'node' | 'edge'; id: string } | null
type View = 'graph' | 'cards'

export function PortfolioExplorer({
  portfolioId,
  initialNodes,
  initialEdges,
}: {
  portfolioId: string
  initialNodes: PortfolioNode[]
  initialEdges: PortfolioEdge[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)
  const [view, setView] = useState<View>('graph')
  const [query, setQuery] = useState('')
  const [showCanonical, setShowCanonical] = useState(true)
  const [showPrivate, setShowPrivate] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [multiSelect, setMultiSelect] = useState<string[]>([])
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    const [{ data: items }, { data: privateNodes }, { data: links }] = await Promise.all([
      supabase.from('portfolio_items').select('*').eq('portfolio_id', portfolioId),
      supabase.from('portfolio_private_nodes').select('*').eq('portfolio_id', portfolioId),
      supabase.from('portfolio_links').select('*').eq('portfolio_id', portfolioId),
    ])
    const schemaIds = (items ?? []).filter((i) => i.target_type === 'schema_element').map((i) => i.target_id)
    const objectIds = (items ?? []).filter((i) => i.target_type === 'data_object').map((i) => i.target_id)
    const [{ data: schemaEls }, { data: dataObjs }] = await Promise.all([
      schemaIds.length
        ? supabase.from('lpm_schema_elements').select('id, label, element_type').in('id', schemaIds)
        : Promise.resolve({ data: [] as { id: string; label: string; element_type: string }[] }),
      objectIds.length
        ? supabase.from('lpm_data_objects').select('id, title, object_type').in('id', objectIds)
        : Promise.resolve({ data: [] as { id: string; title: string; object_type: string }[] }),
    ])
    const schemaById = new Map((schemaEls ?? []).map((s) => [s.id, s]))
    const objectById = new Map((dataObjs ?? []).map((o) => [o.id, o]))

    const nextNodes: PortfolioNode[] = []
    for (const item of items ?? []) {
      const resolved = item.target_type === 'schema_element' ? schemaById.get(item.target_id) : objectById.get(item.target_id)
      nextNodes.push({
        id: `item-${item.id}`,
        label: resolved ? ('label' in resolved ? resolved.label : resolved.title) : '(deleted canonical item)',
        kind: 'canonical',
        subtype: resolved ? ('element_type' in resolved ? resolved.element_type : resolved.object_type) : 'unknown',
        annotation: item.custom_annotation,
        posX: item.pos_x,
        posY: item.pos_y,
      })
    }
    for (const node of privateNodes ?? []) {
      nextNodes.push({
        id: `priv-${node.id}`,
        label: node.label,
        kind: 'private',
        subtype: node.node_type,
        annotation: node.content,
        posX: node.pos_x,
        posY: node.pos_y,
      })
    }
    const nextEdges: PortfolioEdge[] = (links ?? []).map((link) => ({
      id: link.id,
      source: link.from_item_id ? `item-${link.from_item_id}` : `priv-${link.from_private_id}`,
      target: link.to_item_id ? `item-${link.to_item_id}` : `priv-${link.to_private_id}`,
      label: link.label,
      rationale: link.rationale,
    }))
    setNodes(nextNodes)
    setEdges(nextEdges)
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const vn = nodes.filter(
      (n) =>
        (n.kind === 'canonical' ? showCanonical : showPrivate) &&
        (!q || n.label.toLowerCase().includes(q))
    )
    const ids = new Set(vn.map((n) => n.id))
    return { nodes: vn, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) }
  }, [nodes, edges, query, showCanonical, showPrivate])

  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])

  // ---- Cytoscape mount + selection/context-menu wiring ----
  useEffect(() => {
    if (!containerRef.current) return
    const elements: ElementDefinition[] = [
      ...visible.nodes.map((n) => ({ data: { id: n.id, label: n.label, kind: n.kind, subtype: n.subtype } })),
      ...visible.edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, label: e.label ?? '' } })),
    ]
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: true,
      layout: { name: 'cose', animate: false },
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)', 'font-size': 10, 'text-wrap': 'wrap', 'text-max-width': '80px',
            'text-valign': 'bottom', 'text-margin-y': 6, color: token('--text-primary', '#0b0b0b'),
            width: 32, height: 32,
          },
        },
        { selector: 'node[kind = "canonical"]', style: { 'background-color': token('--series-a', '#006c66'), shape: 'ellipse' } },
        { selector: 'node[kind = "private"]', style: { 'background-color': token('--text-muted', '#898781'), shape: 'round-rectangle' } },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': token('--series-a', '#006c66') } },
        {
          selector: 'edge',
          style: {
            width: 1.5, 'line-color': token('--baseline', '#c3c2b7'), 'target-arrow-color': token('--baseline', '#c3c2b7'),
            'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)', 'font-size': 9,
            color: token('--text-secondary', '#52514e'),
          },
        },
        { selector: 'edge:selected', style: { 'line-color': token('--series-a', '#006c66'), width: 2.5 } },
      ],
    })

    cy.on('tap', 'node', (evt) => { setSelectedId(evt.target.id()); setCtxMenu(null) })
    cy.on('tap', 'edge', () => { setCtxMenu(null) })
    cy.on('tap', (evt) => { if (evt.target === cy) { setSelectedId(null); setCtxMenu(null) } })
    cy.on('select unselect', () => { setMultiSelect(cy.nodes(':selected').map((n) => n.id())) })
    cy.on('cxttap', 'node', (evt) => {
      const pos = evt.renderedPosition ?? evt.position
      setCtxMenu({ x: pos.x, y: pos.y, kind: 'node', id: evt.target.id() })
    })

    cyRef.current = cy
    return () => { cy.destroy() }
  }, [visible])

  // ---- mutations ----
  const NODE_TYPES = ['note', 'question', 'draft_concept', 'draft_lesson'] as const
  const addNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setBusy(true); setNotice(null)
    const label = String(formData.get('label') ?? '').trim()
    const rawNodeType = String(formData.get('node_type') ?? 'note')
    const nodeType = (NODE_TYPES as readonly string[]).includes(rawNodeType)
      ? (rawNodeType as (typeof NODE_TYPES)[number])
      : 'note'
    const content = String(formData.get('content') ?? '').trim() || null
    if (!label) { setBusy(false); return }
    const { error } = await supabase.from('portfolio_private_nodes').insert({ portfolio_id: portfolioId, label, node_type: nodeType, content })
    if (error) setNotice({ kind: 'bad', text: error.message })
    else { setNotice({ kind: 'ok', text: `Added "${label}".` }); setAddOpen(false); await reload() }
    setBusy(false)
  }

  const deleteNode = async (id: string) => {
    setBusy(true); setNotice(null)
    const [kind, rawId] = id.split('-', 2)
    const table = kind === 'item' ? 'portfolio_items' : 'portfolio_private_nodes'
    const { error } = await supabase.from(table).delete().eq('id', rawId)
    if (error) setNotice({ kind: 'bad', text: error.message })
    else { setSelectedId(null); await reload() }
    setBusy(false)
  }

  const linkSelected = async () => {
    if (multiSelect.length !== 2) return
    setBusy(true); setNotice(null)
    const parse = (ref: string) => {
      const [kind, id] = ref.split('-', 2)
      return kind === 'item' ? { item: id } : { priv: id }
    }
    const a = parse(multiSelect[0]); const b = parse(multiSelect[1])
    const { error } = await supabase.from('portfolio_links').insert({
      portfolio_id: portfolioId,
      from_item_id: 'item' in a ? a.item : null, from_private_id: 'priv' in a ? a.priv : null,
      to_item_id: 'item' in b ? b.item : null, to_private_id: 'priv' in b ? b.priv : null,
    })
    if (error) setNotice({ kind: 'bad', text: error.message })
    else { setNotice({ kind: 'ok', text: 'Linked.' }); await reload() }
    setBusy(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setCtxMenu(null); setAddOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selected = selectedId ? nodesById[selectedId] : null

  return (
    <div className="explorer" onClick={() => ctxMenu && setCtxMenu(null)}>
      <div className="toolbar">
        <span className="tip" data-tip="Search node labels">
          <input type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </span>
        <label><input type="checkbox" checked={showCanonical} onChange={() => setShowCanonical((v) => !v)} />canonical</label>
        <label><input type="checkbox" checked={showPrivate} onChange={() => setShowPrivate((v) => !v)} />private</label>
        <span style={{ position: 'relative' }}>
          <button className="btn btn-mini" onClick={(e) => { e.stopPropagation(); setAddOpen(!addOpen) }}>
            <Plus size={12} />
            Add note
          </button>
          {addOpen && (
            <div className="popover" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={addNote}>
                <div className="field">
                  <label>Type</label>
                  <select name="node_type">
                    <option value="note">Note</option>
                    <option value="question">Question</option>
                    <option value="draft_concept">Draft concept</option>
                    <option value="draft_lesson">Draft lesson</option>
                  </select>
                </div>
                <div className="field"><label>Label</label><input name="label" required /></div>
                <div className="field"><label>Details</label><textarea name="content" rows={3} /></div>
                <button type="submit" className="btn btn-primary" disabled={busy}>Add</button>
              </form>
            </div>
          )}
        </span>
        <span className="row" style={{ marginLeft: 'auto', gap: 4 }}>
          <button className={`btn btn-mini${view === 'graph' ? ' active' : ''}`} onClick={() => setView('graph')}><Network size={12} />Graph</button>
          <button className={`btn btn-mini${view === 'cards' ? ' active' : ''}`} onClick={() => setView('cards')}><LayoutGrid size={12} />Cards</button>
        </span>
        <span className="muted">{visible.nodes.length} nodes · {visible.edges.length} edges</span>
      </div>

      {multiSelect.length > 0 && (
        <div className="selbar">
          <b>{multiSelect.length} selected</b>
          <span className="muted">Shift+click to add to selection · Esc clears</span>
          {multiSelect.length === 2 && <button className="btn btn-mini btn-primary" disabled={busy} onClick={linkSelected}>Link these two</button>}
        </div>
      )}

      {notice && (
        <div className={`notice notice-${notice.kind}`}>
          {notice.text}
          <button className="btn btn-mini" onClick={() => setNotice(null)} style={{ marginLeft: 'auto' }}><X size={10} /></button>
        </div>
      )}

      {view === 'cards' ? (
        <div className="grid grid-3" style={{ padding: 12 }}>
          {visible.nodes.map((n) => (
            <div key={n.id} className="card" onClick={() => setSelectedId(n.id)} style={{ cursor: 'pointer' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3>{n.label}</h3>
                <span className="chip capitalize">{n.subtype.replace('_', ' ')}</span>
              </div>
              {n.annotation && <p className="muted">{n.annotation}</p>}
            </div>
          ))}
          {visible.nodes.length === 0 && <div className="empty"><p>Nothing here yet.</p></div>}
        </div>
      ) : (
        <div className="explorer-body">
          <div className="graph-host">
            <div ref={containerRef} className="graph-canvas" />
            {visible.nodes.length === 0 && (
              <div className="empty" style={{ position: 'absolute', inset: 0 }}>
                <Network size={32} />
                <p>Nothing in this portfolio yet — add a note above.</p>
              </div>
            )}
            <div className="legend">
              <span><span className="dept-sw" style={{ background: 'var(--series-a)' }} />canonical (referenced)</span>
              <span><span className="dept-sw" style={{ background: 'var(--text-muted)', borderRadius: 3 }} />private (yours)</span>
              <span className="muted">Click: select · Shift+click: multi-select · right-click: menu</span>
            </div>
            {ctxMenu && (
              <div className="ctxmenu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setSelectedId(ctxMenu.id); setCtxMenu(null) }}>Open</button>
                <button className="danger" disabled={busy} onClick={() => { deleteNode(ctxMenu.id); setCtxMenu(null) }}>Delete</button>
              </div>
            )}
          </div>

          <div className="drawer-shell">
            <div className="drawer">
              {selected ? (
                <>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <h2>{selected.label}</h2>
                    <button className="btn btn-mini" onClick={() => setSelectedId(null)}>×</button>
                  </div>
                  <div className="row">
                    <span className="chip capitalize">{selected.kind}</span>
                    <span className="chip capitalize">{selected.subtype.replace('_', ' ')}</span>
                  </div>
                  {selected.annotation && <p style={{ marginTop: 10 }}>{selected.annotation}</p>}
                  {selected.kind === 'canonical' && (
                    <p className="muted" style={{ marginTop: 10 }}>
                      This references a canonical item from the project&apos;s Schema page — edit it there, not here.
                    </p>
                  )}
                  <button className="btn btn-danger" style={{ marginTop: 12 }} disabled={busy} onClick={() => deleteNode(selected.id)}>
                    Remove from portfolio
                  </button>
                </>
              ) : (
                <>
                  <h2>Portfolio graph</h2>
                  <p className="muted">
                    Click a node for details. Shift+click several to multi-select, then link them. Right-click for
                    quick actions.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
