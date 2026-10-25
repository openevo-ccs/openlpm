import { generateSequencedPlacements, type OrderEdge } from './order'
import type { AxisDef, Placement, Range } from './types'

// Presets turn a few numbers into ordinary placements. They carry no special status in the data: a plan stores
// the placements, and the preset is only a quick way to write them.

export type Preset = 'capstone' | 'threaded' | 'spiral' | 'sequenced'

export interface StageRef {
  id: string
  title: string
  band: string
  strand: string
  concepts: { id: string; emphasis: string }[]
  outcomes: number
  required: boolean
}

export interface StarterParams {
  preset: Preset
  /** Evolution's share of biology teaching time. A range, because the true figure is unknown. */
  share: Range
  /** Spiral: number of short blocks per year. */
  returns_per_year?: number
  /** Spiral: fraction of the evolution time kept as a thread through the whole year. */
  thread_fraction?: number
  /** Fraction of a topic's time given to its reinforcing concepts as threaded time. */
  reinforcing_share?: number
  /** Sequenced: order of the stages inside each band. 'reverse' is a negative control for the order check. */
  sequence_order?: 'dependency' | 'reverse'
}

export const BAND_NAMES = ['K-2', '3-5', '6-8', '9-12']
export const GRADE_NAMES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((g) => `Grade ${g}`)

export interface TierHours {
  lower: Range
  middle: Range
  upper: Range
}

/** Hours of biology teaching per school year. Placeholders from Dustin's estimates (2026-10-25). */
export const DEFAULT_TIER_HOURS: TierHours = {
  lower: { low: 15, high: 45 },
  middle: { low: 40, high: 80 },
  upper: { low: 100, high: 150 },
}

/** K-12 axis: four grade bands of 3, 3, 3 and 4 years, with three tiers that sit beside the bands. */
export function k12TierAxis(tiers: TierHours = DEFAULT_TIER_HOURS): AxisDef {
  const h = (r: Range) => ({ low: `PT${r.low}H`, high: `PT${r.high}H` })
  return {
    kind: 'generated',
    levels: [
      { key: 'band', label: 'Grade band', per_parent: 4, names: BAND_NAMES },
      { key: 'year', label: 'Year', per_parent: [3, 3, 3, 4], names: GRADE_NAMES },
    ],
    segments: [
      { key: 'lower', label: 'Lower grades (K-4)', where: { year: { range: [1, 5], absolute: true } }, duration: h(tiers.lower), note: 'Placeholder from Dustin 2026-10-25: 15-45 hours a year.' },
      { key: 'middle', label: 'Middle grades (5-8)', where: { year: { range: [6, 9], absolute: true } }, duration: h(tiers.middle), note: 'Default 40-80 hours a year, adjustable to local conditions.' },
      { key: 'upper', label: 'Upper grades (9-12)', where: { year: { range: [10, 13], absolute: true } }, duration: h(tiers.upper), note: 'Placeholder from Dustin 2026-10-25: 100-150 hours a year.' },
    ],
  }
}

function ratio(share: Range, m: number, n: number): { low: number; high: number } {
  return { low: share.low / m / n, high: share.high / m / n }
}

/** Starter placements: each stage of a band takes an equal part of the band's evolution time. */
export function generateStarterPlacements(stages: StageRef[], params: StarterParams, bandNames: string[] = BAND_NAMES, orderEdges: OrderEdge[] = []): Placement[] {
  const m = (params.share.low + params.share.high) / 2
  if (m <= 0) return []
  if (params.preset === 'sequenced') return generateSequencedPlacements(stages, params, orderEdges, bandNames)
  const out: Placement[] = []
  bandNames.forEach((band, bi) => {
    const inBand = stages.filter((s) => s.band === band)
    const n = inBand.length
    if (n === 0) return
    const where = { band: { eq: bi + 1 } }
    for (const s of inBand) {
      const base = { target_type: 'topic', target_id: s.id, resource: 'instructional_time' }
      if (params.preset === 'capstone') {
        const r = ratio(params.share, m, n)
        out.push({ ...base, role: 'dedicated', selector: { where, span: { from: 1 - m, to: 1 }, spanWithin: 'year' }, amount: { kind: 'share', low: r.low, high: r.high }, note: 'One unit in the last part of each year.' })
      } else if (params.preset === 'threaded') {
        out.push({ ...base, role: 'threaded', selector: { where }, amount: { kind: 'share', low: params.share.low / n, high: params.share.high / n }, note: 'A slice of every session, all year.' })
      } else {
        const k = Math.max(1, Math.round(params.returns_per_year ?? 2))
        const t = Math.min(0.9, Math.max(0, params.thread_fraction ?? 0.25))
        const w = (m * (1 - t)) / k
        const r = ratio(params.share, m, n)
        for (let j = 1; j <= k; j++) {
          const c = (j - 0.5) / k
          out.push({ ...base, role: 'dedicated', selector: { where, span: { from: c - w / 2, to: c + w / 2 }, spanWithin: 'year' }, amount: { kind: 'share', low: r.low, high: r.high }, note: `Block ${j} of ${k} in each year.` })
        }
        if (t > 0) {
          out.push({ ...base, role: 'threaded', selector: { where }, amount: { kind: 'share', low: (params.share.low * t) / n, high: (params.share.high * t) / n }, note: 'A small thread through the whole year.' })
        }
      }
    }
  })
  return out
}
