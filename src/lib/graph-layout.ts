// Shared layout helper for every Cytoscape concept/learning-goal graph in
// this app (student Netz tab, researcher Concepts map) -- a deterministic
// tiered/staggered placement, not a force-directed physics layout. Dustin's
// own explicit, twice-given feedback (2026-09-30, Netz tab) rejected
// Cytoscape's 'cose' layout for exactly this reason: it scatters
// disconnected components unpredictably from render to render, which a
// real concept hierarchy (lots of real nodes sharing one parent, no direct
// edges between siblings) triggers constantly. A fixed, explainable
// algorithm reads as "organized" even when dense; a physics simulation
// reads as "random" even when it technically isn't.

export interface LaidOutPosition { x: number; y: number }

/**
 * Places `items` in rows under `centerX`, staggering every other row by
 * half a column so dense clusters don't read as a rigid grid. Wraps into
 * additional rows once `maxWidth` is used up at `nodeSpacing` per item.
 */
export function layoutTier(
  items: { id: string }[],
  centerX: number,
  startY: number,
  maxWidth: number,
  rowHeight: number,
  nodeSpacing: number
): { positions: Map<string, LaidOutPosition>; rows: number } {
  const positions = new Map<string, LaidOutPosition>()
  if (items.length === 0) return { positions, rows: 0 }
  const cols = Math.max(1, Math.min(Math.ceil(Math.sqrt(items.length)), Math.max(1, Math.floor(maxWidth / nodeSpacing))))
  const colW = Math.min(nodeSpacing, maxWidth / cols)
  let maxRow = 0
  items.forEach((item, i) => {
    const row = Math.floor(i / cols)
    maxRow = Math.max(maxRow, row)
    const col = i % cols
    const rowItemCount = Math.min(cols, items.length - row * cols)
    const rowWidth = rowItemCount * colW
    const stagger = row % 2 === 1 ? colW / 2 : 0
    const startX = centerX - rowWidth / 2 + colW / 2 + stagger
    positions.set(item.id, { x: startX + col * colW, y: startY + row * rowHeight })
  })
  return { positions, rows: maxRow + 1 }
}
