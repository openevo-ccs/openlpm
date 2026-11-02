#!/usr/bin/env node
// Tests for the stage-to-topic link library (src/lib/supabase/curriculum-node-links.ts): row mapping, grouping, roll-up to ancestors, plain-words
// labels, the exact draft tag, and the two fetchers staying quiet while the table or function does not exist yet (migration 225 not pushed).
//   node scripts/test_node_links.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'curriculum-node-links-'))
const out = path.join(dir, 'links.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/supabase/curriculum-node-links.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const L = await import(pathToFileURL(out).href)
const outS = path.join(dir, 'structure.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/supabase/curriculum-structure.ts')], bundle: true, format: 'esm', platform: 'node', outfile: outS, logLevel: 'error' })
const S = await import(pathToFileURL(outS).href)
// The components import react, so their bundle sits inside the repo (node_modules/.cache) where react resolves.
const cacheRoot = path.join(root, 'node_modules', '.cache')
mkdirSync(cacheRoot, { recursive: true })
const dirC = mkdtempSync(path.join(cacheRoot, 'node-links-'))
const outC = path.join(dirC, 'components.mjs')
await build({
  entryPoints: [path.join(root, 'src/components/node-links.tsx')], bundle: true, format: 'esm', platform: 'node', outfile: outC, logLevel: 'error',
  jsx: 'automatic', alias: { '@': path.join(root, 'src') }, external: ['react', 'react-dom', 'lucide-react'],
})
const C = await import(pathToFileURL(outC).href)
const { renderToStaticMarkup } = await import('react-dom/server')
const { createElement } = await import('react')
process.on('exit', () => { rmSync(dir, { recursive: true, force: true }); rmSync(dirC, { recursive: true, force: true }) })

const node = (id, parent, level, key, extra = {}) => ({
  id, parent_id: parent, level, node_key: key, sort_order: 0, label_de: null, label_en: key, summary_de: null, summary_en: null, subject: null, grade_band: null, ...extra,
})
const nodes = [
  node('e', null, 'edition', 'e'),
  node('b', 'e', 'grade_band', 'e/b'),
  node('t1', 'b', 'topic', 'e/b/t1', { sort_order: 1 }),
  node('s1', 't1', 'subtopic', 'e/b/t1/s1', { sort_order: 1 }),
  node('s2', 't1', 'subtopic', 'e/b/t1/s2', { sort_order: 2 }),
  node('t2', 'b', 'topic', 'e/b/t2', { sort_order: 2 }),
]
const roots = S.buildTree(nodes, new Map())

const raw = (id, nodeId, extra = {}) => ({
  id, node_id: nodeId, project_id: 'p1', relation_type: 'proposed_partly', share: 0.346, shared_concepts: ['Drift', 'Mutation'], review_status: 'ai-draft',
  project: { name: 'Bio-Core' }, stage: { title: 'Selection', grade_band: '6-8' }, ...extra,
})

test('a row becomes a link with names, band, share and concepts', () => {
  const l = L.toNodeLink(raw('1', 's1'))
  assert.deepEqual(l, {
    id: '1', nodeId: 's1', projectId: 'p1', projectName: 'Bio-Core', stageTitle: 'Selection', gradeBand: '6-8', relationType: 'proposed_partly',
    share: 0.346, sharedConcepts: ['Drift', 'Mutation'], reviewStatus: 'ai-draft',
  })
})

test('missing names and odd values do not break a row', () => {
  const l = L.toNodeLink(raw('2', 's1', { project: null, stage: null, share: 'abc', shared_concepts: { not: 'a list' }, relation_type: null, review_status: null }))
  assert.equal(l.projectName, '?')
  assert.equal(l.stageTitle, '?')
  assert.equal(l.gradeBand, null)
  assert.equal(l.share, null)
  assert.deepEqual(l.sharedConcepts, [])
  assert.equal(l.relationType, 'proposed_covers')
  assert.equal(l.reviewStatus, 'ai-draft')
})

test('concept names keep only non-empty strings', () => {
  assert.deepEqual(L.conceptNames(['Gene', '', '  ', 3, null, 'Allele']), ['Gene', 'Allele'])
  assert.deepEqual(L.conceptNames(null), [])
})

test('share parses numbers and numeric strings between 0 and 1 and rounds to a percent', () => {
  assert.equal(L.parseShare(0.5), 0.5)
  assert.equal(L.parseShare('0.346'), 0.346)
  assert.equal(L.parseShare(1.2), null)
  assert.equal(L.parseShare(-0.1), null)
  assert.equal(L.parseShare(null), null)
  assert.equal(L.parseShare(''), null)
  assert.equal(L.sharePercent(0.346), 35)
  assert.equal(L.sharePercent(0.5), 50)
  assert.equal(L.sharePercent(null), null)
})

test('links group by node, ordered by space, then highest share, then stage title', () => {
  const links = [
    L.toNodeLink(raw('a', 's1', { project: { name: 'Interdisciplinary' }, share: 0.9 })),
    L.toNodeLink(raw('b', 's1', { share: 0.3, stage: { title: 'Zeta', grade_band: '9-12' } })),
    L.toNodeLink(raw('c', 's1', { share: 0.8, stage: { title: 'Alpha', grade_band: '3-5' } })),
    L.toNodeLink(raw('d', 's2')),
  ]
  const grouped = L.groupLinksByNode(links)
  assert.deepEqual(grouped.get('s1').map((l) => l.id), ['c', 'b', 'a'])
  assert.deepEqual(grouped.get('s2').map((l) => l.id), ['d'])
})

test('counts roll up to every ancestor, mine and others apart, and keep the own count', () => {
  const links = [L.toNodeLink(raw('a', 's1')), L.toNodeLink(raw('b', 's1')), L.toNodeLink(raw('c', 't1')), L.toNodeLink(raw('d', 't2'))]
  const others = new Map([['s2', 4], ['t1', 1]])
  const totals = L.linkTotals(roots, L.groupLinksByNode(links), others)
  assert.deepEqual(totals.get('s1'), { mine: 2, others: 0, ownMine: 2, ownOthers: 0 })
  assert.deepEqual(totals.get('s2'), { mine: 0, others: 4, ownMine: 0, ownOthers: 4 })
  assert.deepEqual(totals.get('t1'), { mine: 3, others: 5, ownMine: 1, ownOthers: 1 })
  assert.deepEqual(totals.get('t2'), { mine: 1, others: 0, ownMine: 1, ownOthers: 0 })
  assert.deepEqual(totals.get('b'), { mine: 4, others: 5, ownMine: 0, ownOthers: 0 })
  assert.deepEqual(totals.get('e'), { mine: 4, others: 5, ownMine: 0, ownOthers: 0 })
})

test('no links gives zero counts and the empty value is shared', () => {
  const data = L.buildNodeLinkData(roots, [], new Map())
  assert.equal(data.totals.get('e').mine + data.totals.get('e').others, 0)
  assert.equal(L.EMPTY_NODE_LINKS.totals.size, 0)
})

test('the draft tag says exactly what Dustin set, in both languages', () => {
  assert.equal(L.linkTag('ai-draft', 'en'), 'LLM synthesized draft, awaiting review')
  assert.equal(L.linkTag('ai-draft', 'de'), 'LLM-erzeugter Entwurf, Prüfung ausstehend')
  assert.equal(L.linkTag('something-new', 'en'), 'LLM synthesized draft, awaiting review')
  assert.equal(L.linkTag('expert-reviewed', 'en'), 'Reviewed by an expert')
})

test('relation labels are plain words; an unknown relation still shows', () => {
  assert.equal(L.relationLabel('proposed_covers', 'en'), 'Fits well')
  assert.equal(L.relationLabel('proposed_partly', 'de'), 'Passt teilweise')
  assert.equal(L.relationLabel('proposed_contrasts_with', 'en'), 'contrasts with')
})

// A stand-in for the Supabase client. The query builder is thenable at the end, like the real one.
function fakeClient({ rows = [], error = null, throws = false, rpcRows = [], rpcError = null, rpcThrows = false } = {}) {
  const calls = { ranges: [], eq: [], rpc: [] }
  const builder = {
    select() { return builder },
    eq(col, val) { calls.eq.push([col, val]); return builder },
    order() { return builder },
    range(from, to) {
      calls.ranges.push([from, to])
      if (throws) throw new Error('boom')
      return Promise.resolve({ data: error ? null : rows.slice(from, to + 1), error })
    },
  }
  return {
    calls,
    from: () => builder,
    rpc: (name, args) => {
      calls.rpc.push([name, args])
      if (rpcThrows) throw new Error('boom')
      return Promise.resolve({ data: rpcError ? null : rpcRows, error: rpcError })
    },
  }
}

test('listNodeLinks reads the rows of one repository and maps them', async () => {
  const client = fakeClient({ rows: [raw('1', 's1'), raw('2', 's2')] })
  const links = await L.listNodeLinks(client, 'repo-1')
  assert.deepEqual(links.map((l) => l.id), ['1', '2'])
  assert.deepEqual(client.calls.eq, [['node.project_id', 'repo-1']])
})

test('listNodeLinks pages through more than 1000 rows', async () => {
  const rows = Array.from({ length: 1203 }, (_, i) => raw(String(i), 's1'))
  const links = await L.listNodeLinks(fakeClient({ rows }), 'repo-1')
  assert.equal(links.length, 1203)
})

test('listNodeLinks returns nothing, quietly, when the table is missing or the call fails', async () => {
  assert.deepEqual(await L.listNodeLinks(fakeClient({ error: { code: 'PGRST205', message: 'table not found' } }), 'repo-1'), [])
  assert.deepEqual(await L.listNodeLinks(fakeClient({ throws: true }), 'repo-1'), [])
})

test('listOtherSpaceLinkCounts maps the function result, and is quiet when the function is missing', async () => {
  const ok = fakeClient({ rpcRows: [{ node_id: 's1', links: 3, spaces: 2 }, { node_id: 't2', links: 1, spaces: 1 }] })
  const counts = await L.listOtherSpaceLinkCounts(ok, 'repo-1')
  assert.deepEqual([...counts], [['s1', 3], ['t2', 1]])
  assert.deepEqual(ok.calls.rpc, [['curriculum_repository_node_link_counts', { p_repository_project_id: 'repo-1' }]])
  assert.equal((await L.listOtherSpaceLinkCounts(fakeClient({ rpcError: { message: 'function not found' } }), 'repo-1')).size, 0)
  assert.equal((await L.listOtherSpaceLinkCounts(fakeClient({ rpcThrows: true }), 'repo-1')).size, 0)
})

// ---- the two small components, rendered to HTML ----
const link = (id, extra = {}) => L.toNodeLink(raw(id, 's1', extra))
const html = (el) => renderToStaticMarkup(el)

test('the section lists space, stage, grade band, plain relation, share, shared concepts and the exact draft tag', () => {
  const links = [link('1', { share: 0.538, relation_type: 'proposed_covers', shared_concepts: ['Fitness', 'Natural Selection'] })]
  const totals = { mine: 1, others: 0, ownMine: 1, ownOthers: 0 }
  const en = html(createElement(C.NodeLinksSection, { id: 'x', lang: 'en', links, totals }))
  for (const text of ['Stages that link here', 'Bio-Core', 'Selection', 'Grades 6-8', 'Fits well', '54 % of the stage&#x27;s concepts', 'Fitness', 'Natural Selection', 'LLM synthesized draft, awaiting review']) {
    assert.ok(en.includes(text), text)
  }
  const de = html(createElement(C.NodeLinksSection, { id: 'x', lang: 'de', links, totals }))
  for (const text of ['Stufen mit Verbindung hierher', 'Klassenstufen 6-8', 'Passt gut', '54 % der Begriffe der Stufe', 'LLM-erzeugter Entwurf, Prüfung ausstehend']) {
    assert.ok(de.includes(text), text)
  }
  assert.ok(!/AI draft\. No expert/.test(en + de))
})

test('spaces the viewer does not belong to show as a bare count, with no name', () => {
  const totals = { mine: 0, others: 3, ownMine: 0, ownOthers: 3 }
  const en = html(createElement(C.NodeLinksSection, { id: 'x', lang: 'en', links: [], totals }))
  assert.ok(en.includes('Plus 3 stage links from spaces you are not a member of (count only).'))
  assert.ok(!en.includes('No stage is linked at this level itself'))
  const de = html(createElement(C.NodeLinksSection, { id: 'x', lang: 'de', links: [], totals: { ...totals, others: 1, ownOthers: 1 } }))
  assert.ok(de.includes('Dazu 1 Stufen-Verknüpfung aus Räumen, in denen Sie nicht Mitglied sind (nur die Anzahl).'))
})

test('a node with links only below says so', () => {
  const totals = { mine: 2, others: 1, ownMine: 0, ownOthers: 0 }
  const en = html(createElement(C.NodeLinksSection, { id: 'x', lang: 'en', links: [], totals }))
  assert.ok(en.includes('No stage is linked at this level itself.'))
  assert.ok(en.includes('3 stage links in the parts below.'))
})

test('the chip shows the total, singular and plural, and nothing for zero', () => {
  const chip = (totals, lang = 'en') => html(createElement(C.NodeLinkChip, { totals, lang, expanded: false, controls: 'c', onToggle: () => {} }))
  assert.ok(chip({ mine: 1, others: 0, ownMine: 1, ownOthers: 0 }).includes('1 stage link<'))
  assert.ok(chip({ mine: 2, others: 3, ownMine: 0, ownOthers: 0 }).includes('5 stage links<'))
  assert.ok(chip({ mine: 2, others: 3, ownMine: 0, ownOthers: 0 }, 'de').includes('5 Stufen-Verknüpfungen<'))
  assert.equal(chip({ mine: 0, others: 0, ownMine: 0, ownOthers: 0 }), '')
  assert.ok(chip({ mine: 1, others: 0, ownMine: 1, ownOthers: 0 }).includes('aria-expanded="false"'))
})

test('concept names are escaped in the markup', () => {
  const links = [link('1', { shared_concepts: ['<b>x</b>'] })]
  const out = html(createElement(C.NodeLinksSection, { id: 'x', lang: 'en', links, totals: { mine: 1, others: 0, ownMine: 1, ownOthers: 0 } }))
  assert.ok(!out.includes('<b>x</b>') && out.includes('&lt;b&gt;x&lt;/b&gt;'))
})
