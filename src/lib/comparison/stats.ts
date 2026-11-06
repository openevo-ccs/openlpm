// Statistics for the comparison views: descriptive summaries, information-theory
// measures and a small clustering routine. Pure functions, no React, no browser
// APIs, so they run under node:test (scripts/test_comparison_model.mjs).
//
// Every measure that can mislead on small samples comes with a way to see how
// small: bootstrap intervals, permutation baselines, and plain counts. The
// views show those next to the number. The data these views usually carry is a
// few dozen links, so a difference that a permutation test cannot separate from
// chance is reported as "within chance" instead of as a finding.

export const LOG2E = Math.LOG2E

// ---- Seeded random numbers (same answer on every render and every machine) ----

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- Descriptive statistics -------------------------------------------------

export interface Summary {
  n: number
  sum: number
  mean: number
  median: number
  sd: number
  min: number
  max: number
  q1: number
  q3: number
}

export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export function describe(values: number[]): Summary {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  const n = xs.length
  if (n === 0) return { n: 0, sum: 0, mean: NaN, median: NaN, sd: NaN, min: NaN, max: NaN, q1: NaN, q3: NaN }
  const sum = xs.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0
  return { n, sum, mean, median: quantile(xs, 0.5), sd, min: xs[0], max: xs[n - 1], q1: quantile(xs, 0.25), q3: quantile(xs, 0.75) }
}

/**
 * Gini coefficient of a list of non-negative counts. 0 = every row has the same
 * number, 1 = everything sits in one row. Used for "how concentrated".
 */
export function gini(values: number[]): number {
  const xs = values.filter((v) => v >= 0).sort((a, b) => a - b)
  const n = xs.length
  const total = xs.reduce((a, b) => a + b, 0)
  if (n < 2 || total === 0) return 0
  let acc = 0
  for (let i = 0; i < n; i++) acc += (2 * (i + 1) - n - 1) * xs[i]
  return acc / (n * total)
}

// ---- Information theory (all in bits) ---------------------------------------

const xlog2 = (x: number) => (x > 0 ? x * Math.log2(x) : 0)

export function total(counts: number[]): number {
  let s = 0
  for (const c of counts) s += c
  return s
}

/** Shannon entropy of a count vector, in bits. */
export function entropyBits(counts: number[]): number {
  const n = total(counts)
  if (n <= 0) return 0
  let h = 0
  for (const c of counts) if (c > 0) h -= (c / n) * Math.log2(c / n)
  return h
}

/**
 * Entropy divided by its maximum, log2(categories). 1 = the links spread
 * evenly over every row, 0 = all in one row. `categories` defaults to the length
 * of the vector. Null when there is nothing to measure.
 */
export function evenness(counts: number[], categories = counts.length): number | null {
  if (categories < 2 || total(counts) <= 0) return null
  return entropyBits(counts) / Math.log2(categories)
}

/** Jensen-Shannon divergence in bits (0 = identical, 1 = no overlap). Inputs are counts or probabilities. Null when either side is empty. */
export function jensenShannon(p: number[], q: number[]): number | null {
  const sp = total(p)
  const sq = total(q)
  if (sp <= 0 || sq <= 0 || p.length !== q.length) return null
  let d = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i] / sp
    const b = q[i] / sq
    const m = (a + b) / 2
    if (a > 0) d += 0.5 * a * Math.log2(a / m)
    if (b > 0) d += 0.5 * b * Math.log2(b / m)
  }
  return Math.max(0, Math.min(1, d))
}

/** Square root of the divergence: a true distance, 0 to 1. */
export function jsDistance(p: number[], q: number[]): number | null {
  const d = jensenShannon(p, q)
  return d === null ? null : Math.sqrt(d)
}

export interface MutualInfo {
  /** Total count. */
  n: number
  rows: number
  cols: number
  hRows: number
  hCols: number
  /** Plug-in mutual information in bits. Biased upward on small tables. */
  mi: number
  /** Plug-in value minus the first-order bias, floored at 0. */
  miCorrected: number
  /** Corrected value divided by the smaller of the two entropies (0 to 1). Null when either entropy is 0. */
  nmi: number | null
}

/** Mutual information of a contingency table (rows x columns), with the Miller-Madow style bias correction. */
export function mutualInformation(table: number[][]): MutualInfo {
  const R = table.length
  const C = R ? table[0].length : 0
  const rowSums = table.map((r) => total(r))
  const colSums: number[] = Array.from({ length: C }, (_, j) => table.reduce((a, r) => a + r[j], 0))
  const n = total(rowSums)
  if (n <= 0) return { n: 0, rows: R, cols: C, hRows: 0, hCols: 0, mi: 0, miCorrected: 0, nmi: null }
  let mi = 0
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < C; j++) {
      const c = table[i][j]
      if (c > 0) mi += (c / n) * Math.log2((c * n) / (rowSums[i] * colSums[j]))
    }
  }
  const nzR = rowSums.filter((x) => x > 0).length
  const nzC = colSums.filter((x) => x > 0).length
  const bias = ((nzR - 1) * (nzC - 1)) / (2 * n * Math.LN2)
  const miCorrected = Math.max(0, mi - bias)
  const hRows = entropyBits(rowSums)
  const hCols = entropyBits(colSums)
  const denom = Math.min(hRows, hCols)
  return { n, rows: R, cols: C, hRows, hCols, mi, miCorrected, nmi: denom > 0 ? Math.min(1, miCorrected / denom) : null }
}

export interface PermutationResult {
  observed: number
  nullMean: number
  nullP95: number
  /** Share of shuffles at least as large as the observed value (with the +1 correction). */
  p: number
  permutations: number
}

function shuffleInPlace<T>(xs: T[], rand: () => number) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[xs[i], xs[j]] = [xs[j], xs[i]]
  }
}

/** Expands a count table into one (row, column) pair per observation. Counts are rounded. */
function expandTable(table: number[][]): Array<[number, number]> {
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < table.length; i++) for (let j = 0; j < table[i].length; j++) for (let k = 0; k < Math.round(table[i][j]); k++) pairs.push([i, j])
  return pairs
}

function tableFrom(pairs: Array<[number, number]>, rows: number, cols: number): number[][] {
  const t = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
  for (const [i, j] of pairs) t[i][j]++
  return t
}

/**
 * Is the link between rows and columns bigger than chance? Shuffles the column
 * label of every observation and recomputes the bias-corrected mutual
 * information. A p-value near 1 means the table looks like a random draw.
 */
export function permutationMutualInformation(table: number[][], permutations = 400, seed = 7): PermutationResult {
  const rows = table.length
  const cols = rows ? table[0].length : 0
  const pairs = expandTable(table)
  const observed = mutualInformation(tableFrom(pairs, rows, cols)).miCorrected
  if (pairs.length < 2) return { observed, nullMean: 0, nullP95: 0, p: 1, permutations: 0 }
  const rand = mulberry32(seed)
  const colLabels = pairs.map((p) => p[1])
  const draws: number[] = []
  let atLeast = 0
  for (let b = 0; b < permutations; b++) {
    shuffleInPlace(colLabels, rand)
    const v = mutualInformation(tableFrom(pairs.map((p, i) => [p[0], colLabels[i]] as [number, number]), rows, cols)).miCorrected
    draws.push(v)
    if (v >= observed - 1e-12) atLeast++
  }
  draws.sort((a, b) => a - b)
  return { observed, nullMean: total(draws) / draws.length, nullP95: quantile(draws, 0.95), p: (atLeast + 1) / (permutations + 1), permutations }
}

/**
 * Is unit A's profile different from unit B's by more than chance? Pools the
 * two units' observations, deals them out again at random in the same group
 * sizes, and compares the Jensen-Shannon divergence. Also gives the divergence
 * you would see by chance alone, which is not zero on small samples.
 */
export function permutationJsd(a: number[], b: number[], permutations = 400, seed = 11): (PermutationResult & { n1: number; n2: number }) | null {
  const observed = jensenShannon(a, b)
  if (observed === null) return null
  const pool: number[] = []
  a.forEach((c, i) => { for (let k = 0; k < Math.round(c); k++) pool.push(i) })
  const n1 = pool.length
  b.forEach((c, i) => { for (let k = 0; k < Math.round(c); k++) pool.push(i) })
  const n2 = pool.length - n1
  const rand = mulberry32(seed)
  const draws: number[] = []
  let atLeast = 0
  for (let t = 0; t < permutations; t++) {
    shuffleInPlace(pool, rand)
    const pa = new Array<number>(a.length).fill(0)
    const pb = new Array<number>(a.length).fill(0)
    for (let i = 0; i < n1; i++) pa[pool[i]]++
    for (let i = n1; i < pool.length; i++) pb[pool[i]]++
    const v = jensenShannon(pa, pb) ?? 0
    draws.push(v)
    if (v >= observed - 1e-12) atLeast++
  }
  draws.sort((x, y) => x - y)
  return { observed, nullMean: total(draws) / draws.length, nullP95: quantile(draws, 0.95), p: (atLeast + 1) / (permutations + 1), permutations, n1, n2 }
}

/**
 * Adjusted standardized residuals (Haberman) for a contingency table. A cell
 * above +2 holds clearly more than independence predicts, below -2 clearly
 * fewer. Cells with a zero row or column total get 0.
 */
export function adjustedResiduals(table: number[][]): number[][] {
  const R = table.length
  const C = R ? table[0].length : 0
  const rowSums = table.map((r) => total(r))
  const colSums: number[] = Array.from({ length: C }, (_, j) => table.reduce((a, r) => a + r[j], 0))
  const n = total(rowSums)
  return table.map((row, i) =>
    row.map((o, j) => {
      if (n <= 0 || rowSums[i] === 0 || colSums[j] === 0) return 0
      const e = (rowSums[i] * colSums[j]) / n
      const v = e * (1 - rowSums[i] / n) * (1 - colSums[j] / n)
      return v > 0 ? (o - e) / Math.sqrt(v) : 0
    })
  )
}

/** Bootstrap interval for the evenness of a count vector, resampling its observations. */
export function bootstrapEvenness(counts: number[], categories = counts.length, resamples = 400, seed = 3, alpha = 0.1): { value: number; lo: number; hi: number } | null {
  const point = evenness(counts, categories)
  if (point === null) return null
  const n = Math.round(total(counts))
  if (n < 2) return { value: point, lo: 0, hi: 1 }
  const cumulative: number[] = []
  let acc = 0
  for (const c of counts) { acc += c / total(counts); cumulative.push(acc) }
  const rand = mulberry32(seed)
  const draws: number[] = []
  for (let b = 0; b < resamples; b++) {
    const sample = new Array<number>(counts.length).fill(0)
    for (let k = 0; k < n; k++) {
      const u = rand()
      let idx = cumulative.findIndex((c) => u <= c)
      if (idx < 0) idx = counts.length - 1
      sample[idx]++
    }
    draws.push(evenness(sample, categories) ?? 0)
  }
  draws.sort((a, b) => a - b)
  return { value: point, lo: quantile(draws, alpha / 2), hi: quantile(draws, 1 - alpha / 2) }
}

// ---- Set overlap ------------------------------------------------------------

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

// ---- Clustering (average linkage) ---------------------------------------------

export interface Merge { a: number; b: number; height: number; size: number }

/**
 * Average-linkage agglomerative clustering on a distance matrix. Returns the
 * order of leaves that keeps similar items next to each other (for a reordered
 * heat map) and the merge list (for a small tree). Items are 0..n-1; each merge
 * creates a new node numbered n, n+1, ...
 */
export function clusterOrder(dist: number[][]): { order: number[]; merges: Merge[] } {
  const n = dist.length
  if (n === 0) return { order: [], merges: [] }
  if (n === 1) return { order: [0], merges: [] }
  const members = new Map<number, number[]>()
  for (let i = 0; i < n; i++) members.set(i, [i])
  const d = new Map<string, number>()
  const key = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) d.set(key(i, j), dist[i][j])
  const merges: Merge[] = []
  const active = new Set<number>(members.keys())
  let next = n
  while (active.size > 1) {
    let best: [number, number] | null = null
    let bestD = Infinity
    const ids = Array.from(active).sort((a, b) => a - b)
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
      const v = d.get(key(ids[x], ids[y])) ?? Infinity
      if (v < bestD - 1e-12) { bestD = v; best = [ids[x], ids[y]] }
    }
    if (!best) break
    const [a, b] = best
    const ma = members.get(a)!
    const mb = members.get(b)!
    for (const c of active) {
      if (c === a || c === b) continue
      const da = d.get(key(a, c)) ?? 0
      const db = d.get(key(b, c)) ?? 0
      d.set(key(next, c), (da * ma.length + db * mb.length) / (ma.length + mb.length))
    }
    members.set(next, [...ma, ...mb])
    merges.push({ a, b, height: bestD, size: ma.length + mb.length })
    active.delete(a); active.delete(b); active.add(next)
    next++
  }
  const root = Array.from(active)[0]
  return { order: members.get(root) ?? [], merges }
}
