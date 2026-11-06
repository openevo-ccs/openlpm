// Structure of one progression, measured so that two spaces of different size can be set side by side.
// Input is the parts of a space and the concepts tagged to each part (main or supporting). Everything here is plain
// data in and plain data out. The two corrections are:
//   - equal size: draw the same number of parts as the smaller space has, many times, from the larger space;
//   - stability: drop a tenth of the part-to-concept links at random, many times, and see how far each measure moves.
// Both report a range. A range is no verdict: it says how much a measure depends on which parts or links happened to be there.

import { evenness, jaccard, mulberry32, quantile } from './stats'

export interface PartTags {
  id: string
  concepts: { id: string; primary: boolean }[]
}

export interface StructureMeasures {
  /** Number of parts. */
  parts: number
  /** Distinct concepts tagged to at least one part. */
  conceptsUsed: number
  /** Mean number of concepts per part. */
  conceptsPerPart: number
  /** Share of part-to-concept links that are main (primary) rather than supporting. */
  mainShare: number | null
  /** How evenly the links spread over the concepts in use, 0 (one concept takes everything) to 1 (all equal). */
  conceptSpread: number | null
  /** Mean overlap (Jaccard) of the concept sets of two parts, over all pairs of parts. */
  partOverlap: number | null
  /** Share of part pairs that have at least one concept in common. */
  joinedPairs: number | null
  /** Share of parts that sit in the largest group of parts joined through shared concepts. */
  largestGroup: number | null
}

export type MeasureKey = Exclude<keyof StructureMeasures, 'parts'>
export const MEASURE_KEYS: MeasureKey[] = ['conceptsUsed', 'conceptsPerPart', 'mainShare', 'conceptSpread', 'partOverlap', 'joinedPairs', 'largestGroup']

export interface Range { mean: number; lo: number; hi: number }
export type RangeTable = Record<MeasureKey, Range | null>

export function measureStructure(parts: PartTags[]): StructureMeasures {
  const n = parts.length
  const sets = parts.map((p) => new Set(p.concepts.map((c) => c.id)))
  const weight = new Map<string, number>()
  let links = 0
  let primary = 0
  for (const p of parts) {
    for (const c of p.concepts) {
      weight.set(c.id, (weight.get(c.id) ?? 0) + 1)
      links += 1
      if (c.primary) primary += 1
    }
  }
  const pairs = (n * (n - 1)) / 2
  let overlapSum = 0
  let joined = 0
  // Union-find over parts joined by a shared concept.
  const root = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      overlapSum += jaccard(sets[i], sets[j])
      let shared = false
      for (const c of sets[i]) if (sets[j].has(c)) { shared = true; break }
      if (shared) { joined += 1; root[find(i)] = find(j) }
    }
  }
  const sizes = new Map<number, number>()
  for (let i = 0; i < n; i++) sizes.set(find(i), (sizes.get(find(i)) ?? 0) + 1)
  return {
    parts: n,
    conceptsUsed: weight.size,
    conceptsPerPart: n ? links / n : 0,
    mainShare: links ? primary / links : null,
    conceptSpread: weight.size > 1 ? evenness(Array.from(weight.values())) : null,
    partOverlap: pairs ? overlapSum / pairs : null,
    joinedPairs: pairs ? joined / pairs : null,
    largestGroup: n ? Math.max(...sizes.values()) / n : null,
  }
}

function rangeOf(samples: StructureMeasures[], key: MeasureKey): Range | null {
  const v = samples.map((s) => s[key]).filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  if (v.length === 0) return null
  const sorted = [...v].sort((a, b) => a - b)
  return { mean: v.reduce((a, b) => a + b, 0) / v.length, lo: quantile(sorted, 0.05), hi: quantile(sorted, 0.95) }
}

function toRanges(samples: StructureMeasures[]): RangeTable {
  return Object.fromEntries(MEASURE_KEYS.map((k) => [k, rangeOf(samples, k)])) as RangeTable
}

/** Draw k parts without replacement, reps times, and report each measure's mean and 5th to 95th percentile. */
export function subsampleParts(parts: PartTags[], k: number, reps = 200, seed = 17): RangeTable {
  const rnd = mulberry32(seed)
  const take = Math.min(k, parts.length)
  const samples: StructureMeasures[] = []
  for (let r = 0; r < reps; r++) {
    const pool = [...parts]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    samples.push(measureStructure(pool.slice(0, take)))
  }
  return toRanges(samples)
}

/** Drop a share of the part-to-concept links at random, reps times, and report each measure's mean and 5th to 95th percentile. */
export function dropLinks(parts: PartTags[], fraction = 0.1, reps = 200, seed = 29): RangeTable {
  const rnd = mulberry32(seed)
  const samples: StructureMeasures[] = []
  for (let r = 0; r < reps; r++) {
    samples.push(measureStructure(parts.map((p) => ({ id: p.id, concepts: p.concepts.filter(() => rnd() >= fraction) }))))
  }
  return toRanges(samples)
}
