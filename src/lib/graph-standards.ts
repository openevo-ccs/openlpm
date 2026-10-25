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
export type GraphLayoutMode = 'fixed' | 'physics'

export interface GraphViewSettings {
  /** tree = each item's strongest link only; bundled = tree plus counted arcs between groups; all = every link. */
  edges: GraphEdgeMode
  /** few = labels that fit without overlap; all = every label. */
  labels: GraphLabelMode
  /** fixed = the graph's own deterministic layout (default); physics = force simulation around pinned groups. */
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
    layout: o.layout === 'fixed' || o.layout === 'physics' ? o.layout : defaults.layout,
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
 * cap so its arcs do not flatten into straight lines.
 */
export function arcHeight(horizontalGap: number, cap = 95): number {
  return Math.min(cap, 22 + horizontalGap * 0.09)
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
export function physicsLayoutOptions(spacing: number): Record<string, unknown> {
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
    numIter: 1000,
  }
}
