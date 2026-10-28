#!/usr/bin/env node
// Re-runs the test behind the figure on the Curate drawer: "tested on the 38 earlier links, the right record was in the top 10 for X%".
// For each confirmed link of Bio-Core and Interdisciplinary it hides the link, ranks the records of the same place by shared words with
// the part (the way the suggestions do) and checks whether the linked record is in the top 10. It also prints the chance level.
//   node scripts/eval_suggestions.mjs [--as-of 2026-10-28T08:30:00Z]
// Read-only: GET requests with the service key from .supabase-secrets. --as-of keeps only records created before that time,
// which reproduces the corpus of the original test (407 records, 20 of 38 hits). Without it the corpus is today's.
import { build } from 'esbuild'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'eval-suggest-'))
await build({ entryPoints: [path.join(root, 'src/lib/comparison/index.ts')], bundle: true, format: 'esm', platform: 'node', outfile: path.join(dir, 'lib.mjs'), logLevel: 'error' })
const lib = await import(pathToFileURL(path.join(dir, 'lib.mjs')).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const env = Object.fromEntries(readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const base = (env.VITE_SUPABASE_URL || env.SUPABASE_URL).replace(/\/$/, '')
const key = readFileSync(path.join(root, '.supabase-secrets', 'service-role-key.txt'), 'utf8').trim()
async function get(query) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${base}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } })
    if (!r.ok) throw new Error(`${query} -> ${r.status}`)
    const page = await r.json(); rows.push(...page)
    if (page.length < 1000) return rows
  }
}

const asOf = process.argv.includes('--as-of') ? process.argv[process.argv.indexOf('--as-of') + 1] : null
const all = await get('curriculum_repository_records?select=id,title,record_type,jurisdiction,created_at,summary:content->>summary,description:content->>description,statementTextEn:content->>statementTextEn')
const corpus = asOf ? all.filter((r) => r.created_at < asOf) : all
const projects = await get('projects?select=id,slug&slug=in.(bio-core-lpm-synth,interdisciplinary-lpm-synth)')
const spaces = []
for (const p of projects) {
  const objs = await get(`lpm_data_objects?select=id,title,description&project_id=eq.${p.id}&status=eq.accepted`)
  const concepts = await get(`lpm_schema_elements?select=id,label&project_id=eq.${p.id}&element_type=eq.concept`)
  const tags = await get(`lpm_object_tags?select=data_object_id,schema_element_id&project_id=eq.${p.id}`)
  const links = await get(`curriculum_repository_links?select=id,data_object_id,repository_record_id,relation_type&project_id=eq.${p.id}`)
  spaces.push({ slug: p.slug, objs, label: new Map(concepts.map((c) => [c.id, c.label])), tags, links })
}

const confirmed = (l) => !l.relation_type.startsWith('proposed_') && l.relation_type !== 'built_from'
const index = lib.buildIndex(corpus.map((r) => ({ id: r.id, text: `${r.title} ${r.title} ${r.summary ?? r.description ?? r.statementTextEn ?? ''}` })))
const jur = new Map(corpus.map((r) => [r.id, (r.jurisdiction ?? '').split(',').map((x) => x.trim()).filter(Boolean)]))
const famOf = new Map(corpus.map((r) => [r.id, lib.familyOf(r.record_type)]))
const famCorpus = {}
for (const r of corpus) famCorpus[famOf.get(r.id)] = (famCorpus[famOf.get(r.id)] || 0) + 1
const links = spaces.flatMap((s) => s.links.filter(confirmed))

function run(useFamilyLift) {
  const out = []
  for (const s of spaces) {
    for (const l of s.links.filter(confirmed)) {
      const o = s.objs.find((x) => x.id === l.data_object_id)
      if (!o) continue
      const text = `${o.title} ${o.title} ${o.description ?? ''} ${s.tags.filter((t) => t.data_object_id === o.id).map((t) => s.label.get(t.schema_element_id) ?? '').join(' ')}`
      const js = jur.get(l.repository_record_id) ?? []
      const only = new Set(corpus.filter((r) => (jur.get(r.id) ?? []).some((j) => js.includes(j))).map((r) => r.id))
      const famLinked = {}; let others = 0
      for (const m of links) { if (m === l) continue; famLinked[famOf.get(m.repository_record_id)] = (famLinked[famOf.get(m.repository_record_id)] || 0) + 1; others++ }
      const lift = (fm) => Math.min(3, Math.max(0.25, (((famLinked[fm] || 0) + 0.5) / (others + 3)) / ((famCorpus[fm] || 1) / corpus.length)))
      const weight = useFamilyLift ? (id) => lift(famOf.get(id)) : undefined
      const ranked = lib.rank(index, text, { topK: corpus.length, minScore: 0, only, weight })
      const pos = ranked.findIndex((m) => m.id === l.repository_record_id)
      out.push({ rank: pos < 0 ? Infinity : pos + 1, pool: only.size })
    }
  }
  return out
}

for (const useLift of [true, false]) {
  const r = run(useLift)
  const hits = r.filter((x) => x.rank <= 10).length
  const chance = r.reduce((a, x) => a + (x.pool === 0 ? 0 : Math.min(1, 10 / x.pool)), 0)
  const certain = r.filter((x) => x.pool <= 10 && x.rank <= 10).length
  console.log(`${useLift ? 'with' : 'without'} the kind-of-record lift: ${hits} of ${r.length} in the top 10 (${Math.round((100 * hits) / r.length)}%), chance ${chance.toFixed(1)} (${Math.round((100 * chance) / r.length)}%), ${certain} hits were certain because the pool held 10 records or fewer. Corpus: ${corpus.length} records${asOf ? ` created before ${asOf}` : ''}.`)
}
