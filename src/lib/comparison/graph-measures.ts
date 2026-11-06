// Graph measures for the comparison views: which records tie several parts of a
// progression together, which parts are cut off, how clustered a network is.
// Undirected graphs only. Pure functions, run under node:test.

export interface GEdge { a: string; b: string; w?: number }
export interface Graph { nodes: string[]; edges: GEdge[] }

export function adjacency(g: Graph): Map<string, Map<string, number>> {
  const adj = new Map<string, Map<string, number>>()
  for (const n of g.nodes) adj.set(n, new Map())
  for (const e of g.edges) {
    if (e.a === e.b || !adj.has(e.a) || !adj.has(e.b)) continue
    const w = e.w ?? 1
    adj.get(e.a)!.set(e.b, (adj.get(e.a)!.get(e.b) ?? 0) + w)
    adj.get(e.b)!.set(e.a, (adj.get(e.b)!.get(e.a) ?? 0) + w)
  }
  return adj
}

/** Connected components, largest first. */
export function components(g: Graph): string[][] {
  const adj = adjacency(g)
  const seen = new Set<string>()
  const out: string[][] = []
  for (const start of g.nodes) {
    if (seen.has(start)) continue
    const comp: string[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const v = stack.pop()!
      comp.push(v)
      for (const u of adj.get(v)!.keys()) if (!seen.has(u)) { seen.add(u); stack.push(u) }
    }
    out.push(comp)
  }
  return out.sort((a, b) => b.length - a.length)
}

/** Share of possible edges that exist (0 to 1). */
export function density(g: Graph): number {
  const n = g.nodes.length
  if (n < 2) return 0
  const adj = adjacency(g)
  let m = 0
  for (const nb of adj.values()) m += nb.size
  return m / 2 / ((n * (n - 1)) / 2)
}

export function degrees(g: Graph): Map<string, { degree: number; strength: number }> {
  const adj = adjacency(g)
  const out = new Map<string, { degree: number; strength: number }>()
  for (const [v, nb] of adj) {
    let s = 0
    for (const w of nb.values()) s += w
    out.set(v, { degree: nb.size, strength: s })
  }
  return out
}

/**
 * Betweenness centrality (Brandes, unweighted shortest paths), scaled to 0..1.
 * A node scores high when many shortest routes between other nodes pass
 * through it, which in these networks marks a part that holds two clusters
 * together.
 */
export function betweenness(g: Graph): Map<string, number> {
  const adj = adjacency(g)
  const cb = new Map<string, number>(g.nodes.map((n) => [n, 0]))
  for (const s of g.nodes) {
    const stack: string[] = []
    const pred = new Map<string, string[]>(g.nodes.map((n) => [n, []]))
    const sigma = new Map<string, number>(g.nodes.map((n) => [n, 0]))
    const dist = new Map<string, number>(g.nodes.map((n) => [n, -1]))
    sigma.set(s, 1)
    dist.set(s, 0)
    const queue = [s]
    for (let qi = 0; qi < queue.length; qi++) {
      const v = queue[qi]
      stack.push(v)
      for (const w of adj.get(v)!.keys()) {
        if (dist.get(w)! < 0) { queue.push(w); dist.set(w, dist.get(v)! + 1) }
        if (dist.get(w) === dist.get(v)! + 1) { sigma.set(w, sigma.get(w)! + sigma.get(v)!); pred.get(w)!.push(v) }
      }
    }
    const delta = new Map<string, number>(g.nodes.map((n) => [n, 0]))
    while (stack.length) {
      const w = stack.pop()!
      for (const v of pred.get(w)!) delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!))
      if (w !== s) cb.set(w, cb.get(w)! + delta.get(w)!)
    }
  }
  const n = g.nodes.length
  const scale = n > 2 ? 1 / ((n - 1) * (n - 2)) : 1 // each pair is counted from both ends, so /2 cancels with the pair count
  const out = new Map<string, number>()
  for (const [v, x] of cb) out.set(v, x * scale)
  return out
}

/** Local clustering coefficient per node (share of a node's neighbour pairs that are also linked) and the average. */
export function clustering(g: Graph): { local: Map<string, number>; average: number } {
  const adj = adjacency(g)
  const local = new Map<string, number>()
  let sum = 0
  let counted = 0
  for (const [v, nbMap] of adj) {
    const nb = Array.from(nbMap.keys())
    if (nb.length < 2) { local.set(v, 0); continue }
    let links = 0
    for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) if (adj.get(nb[i])!.has(nb[j])) links++
    const c = links / ((nb.length * (nb.length - 1)) / 2)
    local.set(v, c)
    sum += c
    counted++
  }
  return { local, average: counted ? sum / counted : 0 }
}

/** Nodes whose removal would split their component (cut vertices), by Tarjan's method. */
export function articulationPoints(g: Graph): Set<string> {
  const adj = adjacency(g)
  const disc = new Map<string, number>()
  const low = new Map<string, number>()
  const result = new Set<string>()
  let time = 0
  const visit = (u: string, parent: string | null) => {
    disc.set(u, ++time)
    low.set(u, time)
    let children = 0
    for (const v of adj.get(u)!.keys()) {
      if (!disc.has(v)) {
        children++
        visit(v, u)
        low.set(u, Math.min(low.get(u)!, low.get(v)!))
        if (parent !== null && low.get(v)! >= disc.get(u)!) result.add(u)
      } else if (v !== parent) {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!))
      }
    }
    if (parent === null && children > 1) result.add(u)
  }
  for (const n of g.nodes) if (!disc.has(n)) visit(n, null)
  return result
}

/**
 * Newman modularity of a partition: how much more of the edge weight stays
 * inside groups than a random wiring with the same degrees would give. Above
 * about 0.3 the groups hold together as clusters; near 0 the grouping says little.
 */
export function modularity(g: Graph, partition: Map<string, string>): number {
  const adj = adjacency(g)
  let m2 = 0
  const strength = new Map<string, number>()
  for (const [v, nb] of adj) {
    let s = 0
    for (const w of nb.values()) s += w
    strength.set(v, s)
    m2 += s
  }
  if (m2 === 0) return 0
  let q = 0
  for (const [v, nb] of adj) {
    for (const [u, w] of nb) if (partition.get(v) !== undefined && partition.get(v) === partition.get(u)) q += w
  }
  q /= m2
  const groupStrength = new Map<string, number>()
  for (const [v, s] of strength) { const grp = partition.get(v); if (grp !== undefined) groupStrength.set(grp, (groupStrength.get(grp) ?? 0) + s) }
  let expected = 0
  for (const s of groupStrength.values()) expected += (s / m2) ** 2
  return q - expected
}

/**
 * Projects a two-sided network onto its left side. `neighbours` maps each right
 * node to the left nodes it touches. Two left nodes get an edge weighted by the
 * number of right nodes they share.
 */
export function projectOnto(left: string[], neighbours: Map<string, string[]>): Graph {
  const weights = new Map<string, number>()
  for (const group of neighbours.values()) {
    const uniq = Array.from(new Set(group)).sort()
    for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
      const k = `${uniq[i]}\u0000${uniq[j]}`
      weights.set(k, (weights.get(k) ?? 0) + 1)
    }
  }
  const edges: GEdge[] = []
  for (const [k, w] of weights) { const [a, b] = k.split('\u0000'); edges.push({ a, b, w }) }
  return { nodes: left, edges }
}
