import type { ConceptRef } from './measures'
import type { OrderEdge } from './order'
import type { StageRef } from './presets'

// Structural profile of an LPM: the numbers a generalized time model takes as input, read from the content alone.
// None of them involves time. They describe how concepts are spread over stages (reach), how concentrated the
// vocabulary is, and how much order the LPM asserts. The same function runs on any LPM, so two spaces with different
// aims can be compared on the same measures.

export interface ReachSummary {
  mean: number
  median: number
  max: number
  /** Share of concepts that appear in three or more stages. */
  shareInThreePlus: number
  /** Concepts that appear in exactly one stage. */
  appearOnce: number
  /** Entropy in bits of the distribution of concept-stage links over concepts (higher means evenly spread). */
  entropyBits: number
  /** Gini coefficient of reach over concepts (0 even, 1 concentrated in one concept). */
  gini: number
  /** Share of all concept-stage links held by the three most used concepts. */
  topThreeShare: number
}

export interface StructuralProfile {
  stages: number
  concepts: number
  conceptsUsed: number
  strands: number
  bands: number
  outcomes: number
  primaryPerStage: number
  reinforcingPerStage: number
  conceptStageLinks: number
  neverMain: number
  reachStages: ReachSummary
  reachStrands: ReachSummary
  reachBands: ReachSummary
  /** Per concept: stages, strands and bands it appears in. */
  perConcept: { id: string; label: string; stages: number; strands: number; bands: number; mainStages: number }[]
  orderEdges: number
}

function summarize(values: number[]): ReachSummary {
  const n = values.length
  if (n === 0) return { mean: 0, median: 0, max: 0, shareInThreePlus: 0, appearOnce: 0, entropyBits: 0, gini: 0, topThreeShare: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const total = values.reduce((a, b) => a + b, 0)
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  let entropy = 0
  for (const v of values) if (v > 0) { const p = v / total; entropy -= p * Math.log2(p) }
  let gini = 0
  if (total > 0) {
    let cum = 0
    sorted.forEach((v, i) => { cum += (i + 1) * v })
    gini = (2 * cum) / (n * total) - (n + 1) / n
  }
  const top3 = [...sorted].reverse().slice(0, 3).reduce((a, b) => a + b, 0)
  return {
    mean: total / n, median, max: sorted[n - 1],
    shareInThreePlus: values.filter((v) => v >= 3).length / n,
    appearOnce: values.filter((v) => v === 1).length,
    entropyBits: entropy, gini: Math.max(0, gini), topThreeShare: total > 0 ? top3 / total : 0,
  }
}

export function structuralProfile(stages: StageRef[], concepts: ConceptRef[], edges: OrderEdge[] = [], bandNames: string[] = []): StructuralProfile {
  const label = new Map(concepts.map((c) => [c.id, c.label]))
  const per = new Map<string, { stages: Set<string>; strands: Set<string>; bands: Set<string>; main: number }>()
  let links = 0
  let primary = 0
  for (const s of stages) {
    for (const c of s.concepts) {
      links += 1
      if (c.emphasis === 'primary') primary += 1
      const cur = per.get(c.id) ?? { stages: new Set(), strands: new Set(), bands: new Set(), main: 0 }
      cur.stages.add(s.id); cur.strands.add(s.strand); cur.bands.add(s.band)
      if (c.emphasis === 'primary') cur.main += 1
      per.set(c.id, cur)
    }
  }
  const rows = [...per.entries()].map(([id, v]) => ({ id, label: label.get(id) ?? id, stages: v.stages.size, strands: v.strands.size, bands: v.bands.size, mainStages: v.main }))
  const n = stages.length
  return {
    stages: n,
    concepts: concepts.length,
    conceptsUsed: rows.length,
    strands: new Set(stages.map((s) => s.strand)).size,
    bands: bandNames.length || new Set(stages.map((s) => s.band)).size,
    outcomes: stages.reduce((a, s) => a + s.outcomes, 0),
    primaryPerStage: n ? primary / n : 0,
    reinforcingPerStage: n ? (links - primary) / n : 0,
    conceptStageLinks: links,
    neverMain: rows.filter((r) => r.mainStages === 0).length,
    reachStages: summarize(rows.map((r) => r.stages)),
    reachStrands: summarize(rows.map((r) => r.strands)),
    reachBands: summarize(rows.map((r) => r.bands)),
    perConcept: rows.sort((a, b) => b.stages - a.stages || a.label.localeCompare(b.label)),
    orderEdges: edges.length,
  }
}
