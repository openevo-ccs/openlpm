// Suggestions: which real-world records look related to a part of a progression?
//
// Deterministic word matching (TF-IDF weights, cosine similarity) over English
// and German text. No model call, so the same data always gives the same list,
// it runs instantly in the browser, and every suggestion can say which words
// made it. It is a pointer for a person to check, nothing more: a match on
// words is evidence of shared vocabulary, which is weaker than shared meaning.

const STOP = new Set((
  'a an and are as at be been but by can for from has have how if in into is it its of on or such than that the their then there these they this to was were what when where which while who why will with within without ' +
  'also each both more most other some any all about after before between over under per via not no yes use used using one two new ' +
  'aber als am an auch auf aus bei bis das dass dem den der des die dies diese dieser durch ein eine einer eines einem einen er es für hat im in ist kann mit nach nicht noch nur oder sich sie sind so über um und von vor wie wird zu zum zur'
).split(/\s+/))

const FOLD: Record<string, string> = { ä: 'a', ö: 'o', ü: 'u', ß: 'ss', é: 'e', è: 'e', á: 'a', à: 'a', ñ: 'n' }

/** Lower-cases, folds umlauts and accents, strips light word endings in English and German. */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[äöüßéèáàñ]/g, (c) => FOLD[c] ?? c)
  if (w.length <= 3) return w
  const suffixes = ['ization', 'isation', 'ations', 'ation', 'keiten', 'heiten', 'ungen', 'lichen', 'ischen', 'ments', 'ment', 'ness', 'ities', 'ity', 'ings', 'ing', 'ung', 'keit', 'heit', 'lich', 'isch', 'ers', 'er', 'ed', 'es', 'en', 'ly', 's', 'e', 'n']
  for (const s of suffixes) {
    if (w.length - s.length >= 4 && w.endsWith(s)) { w = w.slice(0, -s.length); break }
  }
  return w
}

export function tokenize(text: string): string[] {
  const out: string[] = []
  for (const raw of text.toLowerCase().split(/[^a-zäöüßéèáàñ0-9]+/)) {
    if (raw.length < 3 || STOP.has(raw) || /^\d+$/.test(raw)) continue
    out.push(stem(raw))
  }
  return out
}

export interface IndexDoc { id: string; text: string }

export interface TextIndex {
  idf: Map<string, number>
  vectors: Map<string, Map<string, number>>
  norms: Map<string, number>
  /** A readable word for each stem, for showing why a suggestion appears. */
  surface: Map<string, string>
}

export function buildIndex(docs: IndexDoc[]): TextIndex {
  const df = new Map<string, number>()
  const tfs = new Map<string, Map<string, number>>()
  const surface = new Map<string, string>()
  for (const d of docs) {
    const tf = new Map<string, number>()
    for (const raw of d.text.toLowerCase().split(/[^a-zäöüßéèáàñ0-9]+/)) {
      if (raw.length < 3 || STOP.has(raw) || /^\d+$/.test(raw)) continue
      const t = stem(raw)
      tf.set(t, (tf.get(t) ?? 0) + 1)
      const seen = surface.get(t)
      if (seen === undefined || raw.length < seen.length) surface.set(t, raw)
    }
    tfs.set(d.id, tf)
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1)
  }
  const N = Math.max(1, docs.length)
  const idf = new Map<string, number>()
  for (const [t, c] of df) idf.set(t, Math.log(1 + N / c))
  const vectors = new Map<string, Map<string, number>>()
  const norms = new Map<string, number>()
  for (const [id, tf] of tfs) {
    const v = new Map<string, number>()
    let sq = 0
    for (const [t, c] of tf) { const w = (1 + Math.log(c)) * (idf.get(t) ?? 0); v.set(t, w); sq += w * w }
    vectors.set(id, v)
    norms.set(id, Math.sqrt(sq))
  }
  return { idf, vectors, norms, surface }
}

export interface Match { id: string; score: number; terms: string[] }

/**
 * Ranks the indexed documents against a query text. `terms` are the shared
 * word stems that contributed most, so a suggestion can show why it appears.
 * Words that occur in a large share of the documents carry little weight.
 */
export function rank(index: TextIndex, queryText: string, options: { topK?: number; exclude?: Set<string>; only?: Set<string>; minScore?: number; weight?: (id: string) => number } = {}): Match[] {
  const { topK = 5, exclude, only, minScore = 0.08, weight } = options
  const qtf = new Map<string, number>()
  for (const t of tokenize(queryText)) qtf.set(t, (qtf.get(t) ?? 0) + 1)
  const q = new Map<string, number>()
  let qsq = 0
  for (const [t, c] of qtf) {
    const idf = index.idf.get(t)
    if (idf === undefined) continue
    const w = (1 + Math.log(c)) * idf
    q.set(t, w)
    qsq += w * w
  }
  const qn = Math.sqrt(qsq)
  if (qn === 0) return []
  const out: Match[] = []
  for (const [id, v] of index.vectors) {
    if (exclude?.has(id)) continue
    if (only && !only.has(id)) continue
    const dn = index.norms.get(id) ?? 0
    if (dn === 0) continue
    let dot = 0
    const contrib: Array<[string, number]> = []
    for (const [t, w] of q) {
      const dw = v.get(t)
      if (dw !== undefined) { dot += w * dw; contrib.push([t, w * dw]) }
    }
    const score = (dot / (qn * dn)) * (weight ? weight(id) : 1)
    if (score >= minScore) out.push({ id, score, terms: contrib.sort((a, b) => b[1] - a[1]).slice(0, 4).map((c) => index.surface.get(c[0]) ?? c[0]) })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, topK)
}
