// Shared rules for every OpenLPM graph (Dustin's graph-standards request,
// feedback 2a3c04e3; decisions in lab_manager/docs/design-notes/
// openlpm-graph-visualization-standards-proposal-2026-10-25.md).
//
// Seven rules this file and components/graph-controls.tsx carry out:
//   1. Main structure first, other links on request (edge mode).
//   2. Cross-connections between big groups as a few counted arcs (bundles).
//   3. Line strength comes from the data, inside a fixed light range.
//   4. Labels never overlap (pickVisibleLabels).
//   5. One calm palette, same meaning everywhere (the --map-N colors).
//   6. The same control panel on every graph.
//   7. One shared kit, so a tweak reaches every graph.
//
// Only the Basiskonzepte Netz uses it so far; the other graph screens move
// over one at a time.

export type GraphEdgeMode = 'tree' | 'bundled' | 'all'
export type GraphLabelMode = 'few' | 'all'
export type GraphLayoutMode = 'fixed' | 'physics' | 'hierarchy'

export interface GraphViewSettings {
  /** tree = each item's strongest link only; bundled = tree plus counted arcs between groups; all = every link. */
  edges: GraphEdgeMode
  /** few = labels that fit without overlap; all = every label. */
  labels: GraphLabelMode
  /** fixed = the graph's own deterministic layout (default); physics = force simulation around pinned groups; hierarchy = general items at the top, specific ones below (only for a graph that has broader/narrower links). */
  layout: GraphLayoutMode
  /** 10 to 100. Scales how strong the thin relevance lines look. 50 is the standard look. */
  lineStrength: number
  /** 0 to 100. How far apart the physics layout pushes nodes. Only used when layout is physics. */
  spacing: number
}

export const DEFAULT_GRAPH_SETTINGS: GraphViewSettings = {
  edges: 'bundled',
  labels: 'few',
  layout: 'fixed',
  lineStrength: 50,
  spacing: 50,
}

const STORAGE_PREFIX = 'openlpm-graph-settings:'

/**
 * Reads a graph's remembered settings. Falls back to `defaults` (the standard
 * defaults unless the graph passes its own) if nothing is saved, storage is
 * blocked or the saved value is junk. A graph whose data has a different shape
 * can pass its own defaults, for example a flat concept list with no
 * hierarchy to bundle.
 */
export function loadGraphSettings(graphId: string, defaults: GraphViewSettings = DEFAULT_GRAPH_SETTINGS): GraphViewSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + graphId)
    if (!raw) return defaults
    return sanitizeGraphSettings(JSON.parse(raw), defaults)
  } catch {
    return defaults
  }
}

export function saveGraphSettings(graphId: string, settings: GraphViewSettings): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + graphId, JSON.stringify(settings))
  } catch {
    // Remembering the settings is a convenience; the graph works without it.
  }
}

/** Keeps only valid values, so an old or hand-edited saved setting can never break the graph. */
export function sanitizeGraphSettings(input: unknown, defaults: GraphViewSettings = DEFAULT_GRAPH_SETTINGS): GraphViewSettings {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const num = (v: unknown, lo: number, hi: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback
  return {
    edges: o.edges === 'tree' || o.edges === 'bundled' || o.edges === 'all' ? o.edges : defaults.edges,
    labels: o.labels === 'few' || o.labels === 'all' ? o.labels : defaults.labels,
    layout: o.layout === 'fixed' || o.layout === 'physics' || o.layout === 'hierarchy' ? o.layout : defaults.layout,
    lineStrength: num(o.lineStrength, 10, 100, defaults.lineStrength),
    spacing: num(o.spacing, 0, 100, defaults.spacing),
  }
}

// ---- Rule 3: line strength comes from the data -----------------------------

/**
 * Opacity of a relevance line. `weight` is the relevance score (0 to 3). The
 * range stays light (about 0.2 to 0.5 at the standard setting) so no single
 * line dominates; the strength control scales the whole range.
 */
export function lineOpacity(weight: number, lineStrength: number): number {
  const w = Math.min(3, Math.max(0, weight))
  return Math.min(0.9, (0.2 + 0.1 * w) * (lineStrength / 50))
}

/** Width in px of a relevance line for a 0 to 3 relevance score. */
export function lineWidth(weight: number): number {
  return 0.8 + (Math.min(3, Math.max(0, weight)) / 3) * 1.4
}

// ---- Rule 2: counted arcs between groups -----------------------------------

/**
 * How far above the row of groups an arc between two of them bows out, in px.
 * Wider gaps bow more, up to a cap. A graph much wider than the Netz (a deep
 * hierarchy laid out by dagre can run to several thousand px) passes a higher
 * cap so its arcs do not flatten into straight lines. A screen whose arcs
 * nest over each other (the Basiskonzepte Netz) passes a steeper slope so the
 * levels sit further apart.
 */
export function arcHeight(horizontalGap: number, cap = 95, slope = 0.09): number {
  return Math.min(cap, 22 + horizontalGap * slope)
}

// ---- Rule 4: labels never overlap -------------------------------------------

export interface LabelCandidate {
  id: string
  label: string
  /** Node centre and diameter in layout coordinates. */
  x: number
  y: number
  size: number
  /** Higher = keeps its label first when two collide. */
  priority: number
  /** Where the label sits relative to the node. Default 'above' (the hierarchy graphs); 'below' suits a ring or grid. */
  labelSide?: 'above' | 'below'
  /** True for items whose label is always shown (the top-level groups). They also block others. */
  alwaysShow?: boolean
  fontPx: number
  /** Cytoscape wraps a label at this width. */
  maxWidthPx: number
}

let measureCtx: CanvasRenderingContext2D | null | undefined
function textWidth(text: string, fontPx: number): number {
  if (measureCtx === undefined) {
    try { measureCtx = document.createElement('canvas').getContext('2d') } catch { measureCtx = null }
  }
  if (measureCtx) {
    measureCtx.font = `600 ${fontPx}px sans-serif`
    return measureCtx.measureText(text).width
  }
  return text.length * fontPx * 0.58
}

/** Shortens a long label with an ellipsis. The full text stays available on hover. */
export function truncateLabel(label: string, max = 18): string {
  return label.length > max ? label.slice(0, max - 1).trimEnd() + '…' : label
}

interface Box { x0: number; x1: number; y0: number; y1: number }

/**
 * Decides which labels to show so that none overlap. Labels sit above their
 * node (the style every group and sub-group label already uses). Always-show
 * items are placed first, then the rest in priority order; a label that would
 * collide with one already placed is left out and appears on hover instead.
 * Width is measured with a canvas, and a wrapped label counts its extra lines.
 */
export function pickVisibleLabels(items: LabelCandidate[]): Set<string> {
  const visible = new Set<string>()
  const placed: Box[] = []
  const boxFor = (c: LabelCandidate): Box => {
    // Always-show labels (top-level groups) wrap onto two lines instead of being cut.
    const text = c.alwaysShow ? c.label : truncateLabel(c.label)
    const natural = textWidth(text, c.fontPx)
    const w = Math.min(natural, c.maxWidthPx) + 6
    const lines = Math.max(1, Math.ceil(natural / c.maxWidthPx))
    const h = lines * c.fontPx * 1.2 + 4
    if (c.labelSide === 'below') return { x0: c.x - w / 2, x1: c.x + w / 2, y0: c.y + c.size / 2 + 3, y1: c.y + c.size / 2 + 3 + h }
    return { x0: c.x - w / 2, x1: c.x + w / 2, y0: c.y - c.size / 2 - 3 - h, y1: c.y - c.size / 2 - 3 }
  }
  const nodeBox = (c: LabelCandidate): Box => ({ x0: c.x - c.size / 2, x1: c.x + c.size / 2, y0: c.y - c.size / 2, y1: c.y + c.size / 2 })
  const hits = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
  const always = items.filter((i) => i.alwaysShow)
  for (const c of always) { placed.push(boxFor(c), nodeBox(c)); visible.add(c.id) }
  const rest = items.filter((i) => !i.alwaysShow).sort((a, b) => b.priority - a.priority)
  for (const c of rest) {
    if (!c.label) continue
    const box = boxFor(c)
    if (placed.some((p) => hits(box, p))) continue
    placed.push(box, nodeBox(c))
    visible.add(c.id)
  }
  return visible
}

// ---- Rule 6: physics, with the groups pinned ---------------------------------

/**
 * Cytoscape 'cose' options for the physics layout. The top-level groups are
 * locked in place by the caller, so the simulation only moves the smaller
 * nodes around them. That keeps the structure readable, unlike an
 * unconstrained simulation, which scatters everything (Dustin's earlier
 * feedback: it "reads as random"). The caller also leaves the hidden
 * cross-links and the arcs out of the simulation, since they would pull every
 * group's nodes toward the middle.
 */
export function physicsLayoutOptions(spacing: number, nodeCount = 0): Record<string, unknown> {
  return {
    name: 'cose',
    animate: false,
    fit: true,
    padding: 30,
    randomize: false,
    // Starts from the fixed layout's positions (randomize is off) and stays near them.
    nodeRepulsion: () => 3000 + spacing * 70,
    idealEdgeLength: () => 22 + spacing * 0.5,
    nodeOverlap: 12,
    gravity: 1.2,
    componentSpacing: 40,
    // A big graph starts from a grouped layout that is already close, so far fewer rounds are enough (about 6 seconds for 950 records instead of 10).
    numIter: nodeCount > 500 ? 200 : 1000,
  }
}

/**
 * Fixed layout for many items of which only some are linked: every group of linked items becomes its own block, biggest first,
 * and the blocks are packed into rows about as wide as a screen. Inside a block the items follow the links outward from the
 * best-linked one, so neighbours sit next to each other. Items with no link at all fill one block at the end. The same input
 * always gives the same picture.
 */
export function blockLayoutPositions(ids: string[], links: [string, string][], gap = 60): Map<string, { x: number; y: number }> {
  const adj = new Map<string, string[]>()
  for (const id of ids) adj.set(id, [])
  for (const [a, b] of links) {
    if (a === b || !adj.has(a) || !adj.has(b)) continue
    adj.get(a)!.push(b)
    adj.get(b)!.push(a)
  }
  const order = new Map(ids.map((id, i) => [id, i]))
  const byOrder = (a: string, b: string) => order.get(a)! - order.get(b)!
  const starts = [...ids].sort((a, b) => adj.get(b)!.length - adj.get(a)!.length || byOrder(a, b))
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const start of starts) {
    if (seen.has(start)) continue
    seen.add(start)
    const group: string[] = []
    for (let head = 0, queue = [start]; head < queue.length; head++) {
      const id = queue[head]
      group.push(id)
      for (const next of [...adj.get(id)!].sort(byOrder)) if (!seen.has(next)) { seen.add(next); queue.push(next) }
    }
    groups.push(group)
  }
  const linked = groups.filter((g) => g.length > 1).sort((a, b) => b.length - a.length)
  const alone = groups.filter((g) => g.length === 1).map((g) => g[0]).sort(byOrder)

  const blocks = linked.map((ids2) => ({ ids: ids2, cols: Math.max(1, Math.ceil(Math.sqrt(ids2.length))) }))
  if (alone.length > 0) blocks.push({ ids: alone, cols: Math.max(1, Math.ceil(Math.sqrt(alone.length * 2.2))) })
  const sized = blocks.map((b) => ({ ...b, w: b.cols * gap, h: Math.ceil(b.ids.length / b.cols) * gap }))
  const area = sized.reduce((sum, b) => sum + (b.w + gap) * (b.h + gap), 0)
  const rowWidth = Math.max(Math.sqrt(area * 2.2), ...sized.map((b) => b.w))
  const out = new Map<string, { x: number; y: number }>()
  let x = 0, y = 0, rowHeight = 0
  for (const b of sized) {
    if (x > 0 && x + b.w > rowWidth) { x = 0; y += rowHeight + gap; rowHeight = 0 }
    b.ids.forEach((id, i) => out.set(id, { x: x + (i % b.cols) * gap, y: y + Math.floor(i / b.cols) * gap }))
    x += b.w + gap
    rowHeight = Math.max(rowHeight, b.h)
  }
  return out
}

/**
 * Hierarchy layout (Dustin, 2026-11-13: "a hierarchy is a kind of graph, so within the graph view there should be a way to view hierarchical
 * relationships"). `links` are [narrower, broader] pairs: the first item is a special case of the second. The most general items sit at the
 * top of their tree and every item sits one tier below its deepest broader item, so a tier always reads as "more specific than the tier
 * above". An item with two broader items sits under the deeper one and keeps the line to the other. Every parent is centred over its
 * children. A parent with more than six children that have no children of their own (a list of competencies under one area, say) puts
 * them in a compact grid under it. Each tree is its own block and the blocks are packed into rows about as wide as a screen, so a forest of
 * many trees is not stretched into one long strip. Items that are in no link are placed in a grid under the trees. The same input always
 * gives the same picture. `tiersOut`, when given, receives the tier of every item in a tree (0 = the most general).
 */
export function hierarchyLayoutPositions(
  ids: string[],
  links: [string, string][],
  opts: { xGap?: number; yGap?: number; tiersOut?: Map<string, number> } = {},
): Map<string, { x: number; y: number }> {
  const xGap = opts.xGap ?? 130
  const yGap = opts.yGap ?? 120
  const order = new Map(ids.map((id, i) => [id, i]))
  const byOrder = (a: string, b: string) => order.get(a)! - order.get(b)!
  const parents = new Map<string, string[]>()
  const inLink = new Set<string>()
  for (const [child, parent] of links) {
    if (child === parent || !order.has(child) || !order.has(parent)) continue
    const list = parents.get(child) ?? []
    if (!list.includes(parent)) list.push(parent)
    parents.set(child, list)
    inLink.add(child)
    inLink.add(parent)
  }
  // Depth: one more than the deepest broader item. A cycle in the data is cut at the item that closes it.
  const depth = new Map<string, number>()
  const visiting = new Set<string>()
  const depthOf = (id: string): number => {
    const known = depth.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) return 0
    visiting.add(id)
    let d = 0
    for (const p of parents.get(id) ?? []) d = Math.max(d, depthOf(p) + 1)
    visiting.delete(id)
    depth.set(id, d)
    return d
  }
  for (const id of inLink) depthOf(id)
  // The item sits under its deepest broader item (ties: the first in input order).
  const primary = new Map<string, string>()
  for (const id of inLink) {
    const ps = [...(parents.get(id) ?? [])].sort(byOrder)
    if (ps.length === 0) continue
    primary.set(id, ps.reduce((best, p) => (depth.get(p)! > depth.get(best)! ? p : best), ps[0]))
  }
  const children = new Map<string, string[]>()
  for (const [child, parent] of primary) children.set(parent, [...(children.get(parent) ?? []), child])
  for (const list of children.values()) list.sort(byOrder)
  const roots = [...inLink].filter((id) => !primary.has(id)).sort(byOrder)

  // One tree at a time, in its own coordinates (the first leaf at x = 0, the root at y = 0).
  type Placed = Map<string, { x: number; y: number }>
  const placeTree = (root: string): Placed => {
    const local: Placed = new Map()
    const rootDepth = depth.get(root)!
    let nextLeaf = 0
    const place = (id: string, seen: Set<string>): number => {
      seen.add(id)
      const kids = (children.get(id) ?? []).filter((k) => !seen.has(k))
      const tier = depth.get(id)! - rootDepth
      let x: number
      if (kids.length === 0) {
        x = nextLeaf++ * xGap
      } else if (kids.length > 6 && kids.every((k) => (children.get(k) ?? []).filter((g) => !seen.has(g) && g !== id).length === 0)) {
        const cols = Math.ceil(Math.sqrt(kids.length * 1.6))
        const startX = nextLeaf * xGap
        kids.forEach((k, i) => {
          seen.add(k)
          local.set(k, { x: startX + (i % cols) * xGap, y: (tier + 1) * yGap + Math.floor(i / cols) * (yGap * 0.55) })
          opts.tiersOut?.set(k, tier + 1)
        })
        nextLeaf += Math.min(cols, kids.length)
        x = startX + ((Math.min(cols, kids.length) - 1) * xGap) / 2
      } else {
        const xs = kids.map((k) => place(k, seen))
        x = (xs[0] + xs[xs.length - 1]) / 2
      }
      local.set(id, { x, y: tier * yGap })
      opts.tiersOut?.set(id, tier)
      return x
    }
    place(root, new Set<string>())
    return local
  }
  const trees: { nodes: Placed; w: number; h: number }[] = []
  for (const r of roots) trees.push(measure(placeTree(r)))
  // A cycle has no root: the items on it that were not reached form a tree of their own, so nothing is left without a spot.
  const reached = new Set<string>()
  for (const t of trees) for (const id of t.nodes.keys()) reached.add(id)
  for (const id of [...inLink].sort(byOrder)) {
    if (reached.has(id)) continue
    const t = measure(placeTree(id))
    for (const k of t.nodes.keys()) reached.add(k)
    trees.push(t)
  }

  // Pack the trees into rows about as wide as a screen.
  const out = new Map<string, { x: number; y: number }>()
  const area = trees.reduce((sum, t) => sum + (t.w + xGap) * (t.h + yGap), 0)
  const rowWidth = Math.max(Math.sqrt(area * 2.2), ...trees.map((t) => t.w))
  let x = 0, y = 0, rowHeight = 0
  for (const t of trees) {
    if (x > 0 && x + t.w > rowWidth) { x = 0; y += rowHeight + yGap; rowHeight = 0 }
    for (const [id, p] of t.nodes) out.set(id, { x: x + p.x, y: y + p.y })
    x += t.w + xGap
    rowHeight = Math.max(rowHeight, t.h)
  }
  // Items that are in no link: a grid under the trees.
  const alone = ids.filter((id) => !inLink.has(id))
  if (alone.length > 0) {
    const top = trees.length > 0 ? y + rowHeight + yGap : 0
    const cols = Math.max(1, Math.ceil(Math.sqrt(alone.length * 2.2)))
    alone.forEach((id, i) => out.set(id, { x: (i % cols) * xGap, y: top + Math.floor(i / cols) * (yGap * 0.6) }))
  }
  return out

  // The tree's own box, with its left and top edge moved to 0.
  function measure(nodes: Placed): { nodes: Placed; w: number; h: number } {
    const xs = [...nodes.values()].map((p) => p.x)
    const ys = [...nodes.values()].map((p) => p.y)
    const minX = Math.min(...xs), minY = Math.min(...ys)
    const moved: Placed = new Map()
    for (const [id, p] of nodes) moved.set(id, { x: p.x - minX, y: p.y - minY })
    return { nodes: moved, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY }
  }
}
