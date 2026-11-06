// Cytoscape side of the shared graph kit (see graph-standards.ts for the rules
// and lab_manager/docs/design-notes/openlpm-graph-visualization-standards-
// proposal-2026-10-25.md for the tracker). The smaller graph screens (theory
// relations, literature relations, group notebook) all need the same four
// steps, so they live here once:
//   1. start from a fixed, always-the-same layout (rule 6, "fixed by default"),
//   2. optionally let physics move things from there,
//   3. show only the labels that fit without overlap (rule 4),
//   4. keep link names and full labels for hover (rule 1, "other links on request").

import type { Core, LayoutOptions } from 'cytoscape'
import { lineOpacity, physicsLayoutOptions, pickVisibleLabels, truncateLabel, type GraphViewSettings, type LabelCandidate } from '@/lib/graph-standards'

export function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** Above this many items the physics simulation freezes the page, so the fixed layout stays. */
export const PHYSICS_MAX_NODES = 500

export interface NodeLabelInfo {
  /** Full text, kept in data('fullLabel') for hover and the detail card. */
  full: string
  /** Higher keeps its label first when two collide. */
  priority: number
  /** True for items whose label is always shown. */
  alwaysShow?: boolean
  /** Where the label sits. Default below the dot. A style must read the same choice from data('valign'). */
  labelSide?: 'above' | 'below'
  fontPx?: number
  maxWidthPx?: number
  /** Longest label before it is cut with an ellipsis. */
  maxChars?: number
}

/**
 * Lays out, applies the settings and decides the labels. `fixedLayout` is the
 * graph's own deterministic layout. Node `width` data must hold the diameter.
 */
export function applyGraphSettings(
  cy: Core,
  settings: GraphViewSettings,
  fixedLayout: LayoutOptions,
  info: Map<string, NodeLabelInfo>,
  /** Nodes physics must not move (the groups), so the structure stays readable. */
  pinned: (nodeId: string) => boolean = () => false,
): { physicsSkipped: boolean } {
  cy.layout({ ...fixedLayout, animate: false } as LayoutOptions).run()
  const physicsSkipped = settings.layout === 'physics' && cy.nodes().length > PHYSICS_MAX_NODES
  if (settings.layout === 'physics' && !physicsSkipped) {
    const locked = cy.nodes().filter((n) => pinned(n.id()))
    locked.lock()
    cy.layout({ ...physicsLayoutOptions(settings.spacing), fit: false } as unknown as LayoutOptions).run()
    locked.unlock()
  }
  const candidates: LabelCandidate[] = cy.nodes().map((n) => {
    const i = info.get(n.id())
    return {
      id: n.id(),
      label: i?.full ?? '',
      x: n.position('x'),
      y: n.position('y'),
      size: Number(n.data('size')) || 14,
      priority: i?.priority ?? 0,
      alwaysShow: i?.alwaysShow,
      fontPx: i?.fontPx ?? 10,
      maxWidthPx: i?.maxWidthPx ?? 100,
      labelSide: i?.labelSide ?? 'below',
    }
  })
  const visible = settings.labels === 'few' ? pickVisibleLabels(candidates) : null
  cy.nodes().forEach((n) => {
    const i = info.get(n.id())
    const full = i?.full ?? ''
    n.data('fullLabel', full)
    n.data('label', visible && !visible.has(n.id()) ? '' : i?.alwaysShow ? full : truncateLabel(full, i?.maxChars ?? 28))
  })
  cy.fit(undefined, 50)
  return { physicsSkipped }
}

/** Sets each link's opacity from its 0 to 3 weight and the strength control. */
export function applyLineLooks(cy: Core, lineStrength: number, weightOf: (edgeData: Record<string, unknown>) => number): void {
  cy.edges().forEach((e) => { e.data('op', lineOpacity(weightOf(e.data()), lineStrength)) })
}

/**
 * Hover shows the full label and the names of that item's links, and lights
 * the item's neighbourhood. Moving away clears it. Opacity goes through
 * data('op'), never a direct style, so the hover style can win.
 */
export function attachHover(cy: Core): void {
  cy.on('mouseover', 'node', (evt) => {
    const n = evt.target
    n.addClass('hover-label')
    n.connectedEdges().addClass('show-name')
  })
  cy.on('mouseout', 'node', (evt) => {
    const n = evt.target
    n.removeClass('hover-label')
    n.connectedEdges().removeClass('show-name')
  })
}

/** Style rules every kit graph shares for the hover classes above. */
export function hoverStyles(): { selector: string; style: Record<string, unknown> }[] {
  const surface = cssVar('--surface-0', '#fff')
  const border = cssVar('--border', '#ccc')
  return [
    { selector: 'node.hover-label', style: { label: 'data(fullLabel)', 'z-index': 999, 'text-background-color': surface, 'text-background-opacity': 1, 'text-background-padding': '2px', 'text-border-width': 1, 'text-border-color': border } },
    { selector: 'edge.show-name', style: { label: 'data(name)', opacity: 1, 'z-index': 998, 'text-background-color': surface, 'text-background-opacity': 0.9, 'text-background-padding': '1px' } },
  ]
}
