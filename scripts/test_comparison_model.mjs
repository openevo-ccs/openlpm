#!/usr/bin/env node
// Tests for the comparison library (src/lib/comparison): statistics, graph measures, word matching and the
// model that turns links into a grid. Bundles the TypeScript with esbuild, then runs node:test.
//   node scripts/test_comparison_model.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'comparison-'))
const out = path.join(dir, 'comparison.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/comparison/index.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const C = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`)

// ---- statistics ---------------------------------------------------------------

test('entropy and evenness', () => {
  close(C.entropyBits([1, 1]), 1)
  close(C.entropyBits([1, 1, 1, 1]), 2)
  close(C.entropyBits([5, 0, 0]), 0)
  close(C.evenness([3, 3, 3]), 1)
  close(C.evenness([9, 0, 0]), 0)
  assert.equal(C.evenness([0, 0]), null)
  assert.equal(C.evenness([4], 1), null)
  // Zero rows still count as categories: two links in one of four rows is not "even".
  close(C.evenness([2, 0, 0, 0]), 0)
  close(C.evenness([1, 1, 0, 0]), 0.5)
})

test('Jensen-Shannon divergence', () => {
  close(C.jensenShannon([1, 2, 3], [2, 4, 6]), 0) // same shape, different size
  close(C.jensenShannon([1, 0], [0, 1]), 1) // no overlap = 1 bit
  assert.equal(C.jensenShannon([0, 0], [1, 1]), null)
  const a = C.jensenShannon([5, 1, 1], [1, 5, 1])
  const b = C.jensenShannon([1, 5, 1], [5, 1, 1])
  close(a, b) // symmetric
  assert.ok(a > 0 && a < 1)
  close(C.jsDistance([1, 0], [0, 1]), 1)
})

test('mutual information of simple tables', () => {
  const independent = C.mutualInformation([[5, 5], [5, 5]])
  close(independent.mi, 0)
  assert.equal(independent.nmi, 0)
  const perfect = C.mutualInformation([[10, 0], [0, 10]])
  close(perfect.mi, 1) // knowing the column tells you the row: 1 bit
  assert.ok(perfect.nmi > 0.85, `nmi ${perfect.nmi}`)
  const none = C.mutualInformation([[0, 0], [0, 0]])
  assert.equal(none.n, 0)
  assert.equal(none.nmi, null)
})

test('permutation test separates a strong association from noise', () => {
  const strong = C.permutationMutualInformation([[12, 1], [1, 12]], 200, 5)
  assert.ok(strong.p < 0.02, `p ${strong.p}`)
  const noise = C.permutationMutualInformation([[6, 7], [7, 6]], 200, 5)
  assert.ok(noise.p > 0.2, `p ${noise.p}`)
  const again = C.permutationMutualInformation([[12, 1], [1, 12]], 200, 5)
  assert.equal(again.p, strong.p) // seeded: same answer every time
})

test('permutation Jensen-Shannon: small samples drift by chance', () => {
  const r = C.permutationJsd([3, 1, 0], [0, 1, 3], 200, 3)
  assert.ok(r.observed > r.nullMean)
  const same = C.permutationJsd([4, 4, 4], [4, 4, 4], 200, 3)
  close(same.observed, 0)
  assert.ok(same.p > 0.9)
  assert.equal(C.permutationJsd([0, 0], [1, 1]), null)
  // Two tiny samples from one profile show a nonzero divergence by chance alone.
  const tiny = C.permutationJsd([1, 0, 1], [0, 1, 1], 200, 3)
  assert.ok(tiny.nullMean > 0.1, `chance level ${tiny.nullMean}`)
})

test('adjusted residuals flag the cells that stand out', () => {
  const res = C.adjustedResiduals([[20, 2], [2, 20]])
  assert.ok(res[0][0] > 2 && res[1][1] > 2)
  assert.ok(res[0][1] < -2 && res[1][0] < -2)
  const flat = C.adjustedResiduals([[5, 5], [5, 5]])
  for (const row of flat) for (const v of row) close(v, 0)
})

test('descriptive summary and Gini', () => {
  const s = C.describe([1, 2, 3, 4, 5])
  assert.equal(s.n, 5)
  close(s.mean, 3)
  close(s.median, 3)
  close(s.q1, 2)
  close(s.q3, 4)
  close(s.sd, Math.sqrt(2.5))
  assert.ok(Number.isNaN(C.describe([]).mean))
  close(C.gini([4, 4, 4, 4]), 0)
  close(C.gini([0, 0, 0, 12]), 0.75)
})

test('bootstrap interval is wide for few links and narrow for many', () => {
  const few = C.bootstrapEvenness([2, 1, 0, 0], 4, 300, 1)
  const many = C.bootstrapEvenness([200, 100, 0, 0], 4, 300, 1)
  assert.ok(few.hi - few.lo > many.hi - many.lo)
  assert.ok(few.lo <= few.value && few.value <= few.hi + 1e-9)
})

test('Jaccard overlap', () => {
  close(C.jaccard(new Set(['a', 'b']), new Set(['b', 'c'])), 1 / 3)
  close(C.jaccard(new Set(), new Set()), 0)
})

test('clustering keeps close items next to each other', () => {
  // Items 0 and 1 are close, 2 and 3 are close, the pairs are far apart.
  const d = [
    [0, 1, 9, 9],
    [1, 0, 9, 9],
    [9, 9, 0, 1],
    [9, 9, 1, 0],
  ]
  const { order, merges } = C.clusterOrder(d)
  assert.equal(order.length, 4)
  const pos = (x) => order.indexOf(x)
  assert.equal(Math.abs(pos(0) - pos(1)), 1)
  assert.equal(Math.abs(pos(2) - pos(3)), 1)
  assert.equal(merges.length, 3)
  close(merges[2].height, 9)
  assert.deepEqual(C.clusterOrder([[0]]).order, [0])
  assert.deepEqual(C.clusterOrder([]).order, [])
})

// ---- graph measures ---------------------------------------------------------------

const star = { nodes: ['c', 'a', 'b', 'd', 'e'], edges: ['a', 'b', 'd', 'e'].map((x) => ({ a: 'c', b: x })) }
const path4 = { nodes: ['1', '2', '3', '4'], edges: [{ a: '1', b: '2' }, { a: '2', b: '3' }, { a: '3', b: '4' }] }
const triangle = { nodes: ['x', 'y', 'z'], edges: [{ a: 'x', b: 'y' }, { a: 'y', b: 'z' }, { a: 'x', b: 'z' }] }

test('components, density and degrees', () => {
  const g = { nodes: ['a', 'b', 'c', 'd'], edges: [{ a: 'a', b: 'b' }] }
  const comps = C.components(g)
  assert.equal(comps.length, 3)
  assert.deepEqual(comps[0].sort(), ['a', 'b'])
  close(C.density(triangle), 1)
  close(C.density(star), 4 / 10)
  assert.equal(C.degrees(star).get('c').degree, 4)
})

test('betweenness: the hub of a star carries every route', () => {
  const bt = C.betweenness(star)
  close(bt.get('c'), 1)
  close(bt.get('a'), 0)
  const p = C.betweenness(path4)
  close(p.get('2'), 2 / 3)
  close(p.get('1'), 0)
})

test('clustering coefficient and cut vertices', () => {
  close(C.clustering(triangle).average, 1)
  close(C.clustering(star).average, 0)
  assert.deepEqual(Array.from(C.articulationPoints(path4)).sort(), ['2', '3'])
  assert.deepEqual(Array.from(C.articulationPoints(star)), ['c'])
  assert.equal(C.articulationPoints(triangle).size, 0)
})

test('modularity prefers the grouping that follows the structure', () => {
  const two = {
    nodes: ['a', 'b', 'c', 'd', 'e', 'f'],
    edges: [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'a', b: 'c' }, { a: 'd', b: 'e' }, { a: 'e', b: 'f' }, { a: 'd', b: 'f' }, { a: 'c', b: 'd' }],
  }
  const good = new Map([['a', 'L'], ['b', 'L'], ['c', 'L'], ['d', 'R'], ['e', 'R'], ['f', 'R']])
  const bad = new Map([['a', 'L'], ['b', 'R'], ['c', 'L'], ['d', 'R'], ['e', 'L'], ['f', 'R']])
  assert.ok(C.modularity(two, good) > 0.3)
  assert.ok(C.modularity(two, good) > C.modularity(two, bad))
})

test('bipartite projection weights by shared neighbours', () => {
  const g = C.projectOnto(['s1', 's2', 's3'], new Map([['r1', ['s1', 's2']], ['r2', ['s1', 's2']], ['r3', ['s2', 's3']]]))
  const w = Object.fromEntries(g.edges.map((e) => [`${e.a}-${e.b}`, e.w]))
  assert.equal(w['s1-s2'], 2)
  assert.equal(w['s2-s3'], 1)
})

// ---- word matching -------------------------------------------------------------------

test('stemming folds umlauts and plain endings', () => {
  assert.equal(C.stem('Normen'), C.stem('Norm'))
  assert.equal(C.stem('Lehrplänen'), C.stem('Lehrplanen'))
  assert.equal(C.stem('Gemeinschaften'), C.stem('gemeinschaften'))
  assert.ok(C.tokenize('Die Kinder lernen über Normen und Regeln').includes(C.stem('normen')))
  assert.ok(!C.tokenize('the and of in').length)
})

test('suggestions rank the related record first and say why', () => {
  const idx = C.buildIndex([
    { id: 'r1', text: 'Computer science standards for algorithms and programming in grades 6 to 8' },
    { id: 'r2', text: 'Evolution education controversy in school boards and courts' },
    { id: 'r3', text: 'Biology curriculum on natural selection and adaptation' },
  ])
  const hits = C.rank(idx, 'Algorithms and programs: students write simple programming sequences', { topK: 3 })
  assert.equal(hits[0].id, 'r1')
  assert.ok(hits[0].terms.length > 0)
  const none = C.rank(idx, 'zzzz qqqq', { topK: 3 })
  assert.equal(none.length, 0)
  const excluded = C.rank(idx, 'algorithms programming', { topK: 3, exclude: new Set(['r1']) })
  assert.ok(excluded.every((h) => h.id !== 'r1'))
})

// ---- model -----------------------------------------------------------------------------

const lang = 'en'
const objects = [
  { id: 'S1', title: 'Strand one', description: '', type: 'strand', gradeBand: 'K-12', parentId: null, conceptIds: [], threadIds: [], order: 0 },
  { id: 'S1a', title: 'One A', description: '', type: 'substrand', gradeBand: 'K-2', parentId: 'S1', conceptIds: [], threadIds: [], order: 1 },
  { id: 'S1b', title: 'One B', description: '', type: 'substrand', gradeBand: '3-5', parentId: 'S1', conceptIds: [], threadIds: [], order: 2 },
  { id: 'S2', title: 'Strand two', description: '', type: 'strand', gradeBand: 'K-12', parentId: null, conceptIds: [], threadIds: [], order: 3 },
  { id: 'S2a', title: 'Two A', description: '', type: 'substrand', gradeBand: 'K-2', parentId: 'S2', conceptIds: [], threadIds: [], order: 4 },
]
const mk = (id, jur, type = 'policy-timeline-event', date = null) => ({ id, title: id, type, family: C.familyOf(type), jurisdictions: C.splitJurisdictions(jur), date, dateEnd: null, summary: '' })
const records = [mk('R1', 'US-NY'), mk('R2', 'US-FL, US-PA'), mk('R3', 'DE-SN'), mk('R4', 'DE'), mk('R5', 'US'), mk('R6', 'IN-KL')]
const byId = new Map(records.map((r) => [r.id, r]))
const link = (id, objectId, recordId, extra = {}) => ({ id, objectId, recordId, relationType: 'relates_to', rationale: 'x'.repeat(80), createdAt: '2026-10-28', createdBy: null, proposed: false, ...extra })
const links = [link('L1', 'S1a', 'R1'), link('L2', 'S1a', 'R2'), link('L3', 'S1b', 'R2'), link('L4', 'S2a', 'R3'), link('L5', 'S2a', 'R4'), link('L6', 'S1', 'R5')]

test('records map to units by level', () => {
  const countries = new Set(['US', 'DE'])
  assert.deepEqual(C.recordUnitIds(byId.get('R2'), 'state', countries).sort(), ['US-FL', 'US-PA'])
  assert.deepEqual(C.recordUnitIds(byId.get('R2'), 'country', countries), ['US'])
  assert.deepEqual(C.recordUnitIds(byId.get('R6'), 'state', countries), []) // India is outside this view
  assert.deepEqual(C.recordUnitIds(byId.get('R4'), 'state', countries), ['DE'])
})

test('units are ordered by country, states first, national last', () => {
  const units = C.listUnits(records, 'state', ['DE', 'US'], lang)
  assert.deepEqual(units.map((u) => u.id), ['DE-SN', 'DE', 'US-FL', 'US-NY', 'US-PA', 'US'])
  const countries = C.listUnits(records, 'country', ['US', 'DE', 'IN'], lang)
  assert.deepEqual(countries.map((u) => u.id), ['US', 'DE', 'IN'])
  assert.equal(C.jurisdictionName('DE-TH', 'de'), 'Thüringen')
  assert.equal(C.jurisdictionName('US', 'en'), 'United States (national)')
})

test('dimensions group items so every item has exactly one key', () => {
  const strands = C.dimensionKeys(objects, 'strand')
  assert.deepEqual(strands.map((k) => k.objectIds.length), [3, 2])
  const bands = C.dimensionKeys(objects, 'band')
  assert.deepEqual(bands.map((k) => k.id), ['K-2', '3-5', 'K-12'])
  assert.equal(C.dimensionKeys(objects, 'item').length, 5)
})

test('the grid counts links per unit and rolls up by dimension', () => {
  const countries = new Set(['US', 'DE'])
  const units = C.listUnits(records, 'state', ['DE', 'US'], lang)
  const grid = C.buildGrid(units, links, byId, 'state', countries)
  const ids = units.map((u) => u.id)
  const m = C.countMatrix(grid, C.dimensionKeys(objects, 'strand'), ids)
  // Strand one: L1 (NY), L2 and L3 (FL and PA each), L6 (US national)
  assert.equal(m[0][ids.indexOf('US-NY')], 1)
  assert.equal(m[0][ids.indexOf('US-FL')], 2)
  assert.equal(m[0][ids.indexOf('US-PA')], 2)
  assert.equal(m[0][ids.indexOf('US')], 1)
  assert.equal(m[1][ids.indexOf('DE-SN')], 1)
  const cLevel = C.listUnits(records, 'country', ['DE', 'US'], lang)
  const gridC = C.buildGrid(cLevel, links, byId, 'country', countries)
  const mc = C.countMatrix(gridC, C.dimensionKeys(objects, 'strand'), cLevel.map((u) => u.id))
  assert.equal(mc[0][cLevel.findIndex((u) => u.id === 'US')], 4) // L1, L2, L3 and L6: each link counted once per country, so L2 and L3 do not double
})

test('measures hold together on a small example', () => {
  const countries = new Set(['US', 'DE'])
  const units = C.listUnits(records, 'country', ['DE', 'US'], lang)
  const grid = C.buildGrid(units, links, byId, 'country', countries)
  const m = C.computeMeasures(grid, objects, byId, 'strand', units.map((u) => u.id))
  assert.equal(m.keys.length, 2)
  assert.equal(m.pairs.length, 1)
  assert.equal(m.units.length, 2)
  assert.ok(m.pairs[0].jsd > 0)
  assert.equal(m.reliability, 'small') // 7 incidences is a small sample
  assert.equal(m.order.length, 2)
  assert.equal(m.units.find((u) => u.unitId === 'US').rowsCovered, 1)
})

test('network measures find the record that ties two strands together', () => {
  const extra = [...links, link('L7', 'S2a', 'R1')]
  const nm = C.computeNetworkMeasures(objects, extra, new Set(records.map((r) => r.id)))
  const bridge = nm.bridges.find((b) => b.recordId === 'R1')
  assert.equal(bridge.strands, 2)
  assert.ok(nm.isolated.includes('S2') === true)
  assert.ok(nm.density >= 0 && nm.density <= 1)
})

test('link issues', () => {
  assert.deepEqual(C.linkIssues(link('x', 'S1', 'R1', { rationale: '' }), []), ['no-rationale'])
  assert.ok(C.linkIssues(link('x', 'S1', 'R1', { rationale: 'short' }), []).includes('short-rationale'))
  assert.ok(C.linkIssues(link('x', 'S1', 'R1', { proposed: true }), []).includes('proposed'))
  assert.ok(C.linkIssues(link('x', 'S1', 'R1'), [{ id: 'v', linkId: 'x', verdict: 'questions', comment: null, reviewedBy: null, createdAt: '' }]).includes('questioned'))
  assert.ok(C.linkIssues(link('x', 'S1', 'R1', { rationale: 'Added by a one-time backfill (script)' }), []).includes('boilerplate'))
})

test('years from partial dates', () => {
  close(C.yearOf('2024'), 2024)
  assert.ok(C.yearOf('2024-07-01') > 2024.4 && C.yearOf('2024-07-01') < 2024.6)
  assert.equal(C.yearOf(null), null)
  assert.equal(C.yearOf('soon'), null)
})
