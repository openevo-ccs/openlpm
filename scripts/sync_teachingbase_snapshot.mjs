#!/usr/bin/env node
// Refreshes teachingbase_snapshot (migration 240) from a sibling checkout of the teachingbase repo: one row per lesson record in
// records/*.yaml, merged with its drafted-links file graph/<slug>.yaml when there is one. Every link and component gets a stable
// item_key, and about 150 links are flagged `sample: true` as the "start here" set for the Teaching lessons review page.
// Same shape as scripts/sync_theorybase_snapshot.mjs: reads the local filesystem, writes with the service_role key.
//
// Dry run by default (prints counts, writes nothing). --yes upserts into teachingbase_snapshot.
//
// Usage:
//   node scripts/sync_teachingbase_snapshot.mjs [--repo ../teachingbase] [--sample 150] [--seed 20261111] [--out rows.json] [--yes]

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import yaml from 'js-yaml'
import { keysFor, pickSample } from './lib/teachingbase-review.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'

function loadServiceRoleKey() {
  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (fromEnv) return fromEnv.trim()
  const p = path.join(ROOT, '.supabase-secrets', 'service-role-key.txt')
  if (existsSync(p)) return readFileSync(p, 'utf8').trim()
  console.error("No service_role key found -- see scripts/pull_feedback.mjs's own header for how to get one once.")
  process.exit(1)
}

function parseArgs(argv) {
  const out = { repo: path.join(ROOT, '..', 'teachingbase'), sample: 150, seed: 20261111, out: null, yes: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') out.repo = path.resolve(argv[++i])
    else if (argv[i] === '--sample') out.sample = Number(argv[++i])
    else if (argv[i] === '--seed') out.seed = Number(argv[++i])
    else if (argv[i] === '--out') out.out = path.resolve(argv[++i])
    else if (argv[i] === '--yes') out.yes = true
  }
  return out
}

const readYaml = (p) => yaml.load(readFileSync(p, 'utf8'))

function buildLessons(repo) {
  const recordsDir = path.join(repo, 'records')
  const graphDir = path.join(repo, 'graph')
  if (!existsSync(recordsDir)) throw new Error(`No records/ directory at ${recordsDir} -- is --repo correct?`)
  const lessons = []
  for (const file of readdirSync(recordsDir).filter((f) => f.endsWith('.yaml')).sort()) {
    const rec = readYaml(path.join(recordsDir, file))
    const slug = rec.slug ?? file.replace(/\.yaml$/, '')
    const graphFile = path.join(graphDir, `${slug}.yaml`)
    const graph = existsSync(graphFile) ? readYaml(graphFile) : null
    const de = rec.translations?.de ?? {}
    const materials = [
      ...(Array.isArray(rec.materials) ? rec.materials.map((m) => ({ label: m.label ?? null, url: m.url ?? null })) : []),
      ...Object.entries(rec.teaching_materials ?? {}).map(([k, v]) => ({ label: k, url: typeof v === 'string' ? v : null })),
    ]
    const components = (graph?.components ?? []).map((c) => ({ ...c }))
    const links = (graph?.links ?? []).map((l) => ({ ...l }))
    const cKeys = keysFor(components)
    components.forEach((c, i) => { c.item_key = cKeys[i] })
    const lKeys = keysFor(links)
    links.forEach((l, i) => { l.item_key = lKeys[i]; l.sample = false })
    lessons.push({
      slug,
      rec,
      graph,
      title: { en: rec.title ?? slug, de: de.title ?? null },
      description: { en: rec.description ?? null, de: de.description ?? null },
      collections: rec.terms?.collections ?? [],
      components,
      links,
      materials,
    })
  }
  return lessons
}

function markSample(lessons, target, seed) {
  const candidates = []
  for (const l of lessons) {
    const lessonType = l.rec.material_types?.[0] ?? 'none'
    for (const link of l.links) {
      candidates.push({ lesson: l.slug, lessonType, key: link.item_key, type: link.type, confidence: link.confidence, quoteFound: link.checks?.quote_found })
    }
  }
  const picked = pickSample(candidates, { target, seed })
  for (const l of lessons) for (const link of l.links) link.sample = picked.has(`${l.slug}|${link.item_key}`)
}

function toRow(l) {
  return {
    id: l.slug,
    label: l.title.en,
    collections: l.collections,
    graph_present: l.graph !== null,
    link_count: l.links.length,
    sample_count: l.links.filter((x) => x.sample).length,
    data: {
      slug: l.slug,
      title: l.title,
      description: l.description,
      grades: l.rec.grades ?? [],
      subjects: l.rec.subjects ?? [],
      material_types: l.rec.material_types ?? [],
      collections: l.collections,
      source_pages: l.rec.source?.pages ?? (l.rec.source?.page ? { en: l.rec.source.page } : {}),
      materials: l.materials,
      components: l.components,
      assets: l.graph?.assets ?? [],
      links: l.links,
      rights_flags: l.graph?.rights_flags ?? [],
      graph_version: l.graph?.graph_version ?? null,
    },
  }
}

function count(rows, pick, onlySample) {
  const out = {}
  for (const r of rows) for (const link of r.data.links) {
    if (onlySample && !link.sample) continue
    const k = pick(link, r)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

function show(title, rows, pick) {
  const all = count(rows, pick, false)
  const sample = count(rows, pick, true)
  console.log(`\n${title} (all / sample)`)
  for (const k of Object.keys(all).sort()) console.log(`  ${k}: ${all[k]} / ${sample[k] ?? 0}`)
}

async function main() {
  const { repo, sample, seed, out, yes } = parseArgs(process.argv.slice(2))
  console.log(`${yes ? 'LIVE RUN' : 'DRY RUN'} -- reading ${repo}\n`)
  if (!existsSync(repo)) { console.error(`${repo} does not exist. Pass --repo if the teachingbase checkout lives somewhere else.`); process.exit(1) }

  const lessons = buildLessons(repo)
  markSample(lessons, sample, seed)
  const rows = lessons.map(toRow)

  const allLinks = rows.flatMap((r) => r.data.links)
  console.log(`Lessons: ${rows.length} (${rows.filter((r) => r.graph_present).length} with drafted links)`)
  console.log(`Components: ${rows.reduce((n, r) => n + r.data.components.length, 0)}`)
  console.log(`Links: ${allLinks.length}, "start here" sample: ${allLinks.filter((l) => l.sample).length} (seed ${seed})`)
  show('By link type', rows, (l) => l.type)
  show('By confidence', rows, (l) => l.confidence ?? 'none')
  show('By quote check', rows, (l) => (l.checks?.quote_found === true ? 'quote found' : l.checks?.quote_found === false ? 'quote not found' : 'not checked'))
  show('By lesson type (first material type)', rows, (l, r) => r.data.material_types[0] ?? 'none')
  console.log(`\nLessons with at least one sampled link: ${rows.filter((r) => r.sample_count > 0).length}`)

  if (out) { writeFileSync(out, JSON.stringify(rows, null, 2)); console.log(`\nWrote the rows to ${out} (a local file, nothing sent anywhere).`) }
  if (!yes) { console.log('\nDry run only -- pass --yes to upsert into teachingbase_snapshot.'); return }

  const serviceKey = loadServiceRoleKey()
  for (let i = 0; i < rows.length; i += 25) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/teachingbase_snapshot`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 25)),
    })
    if (!res.ok) throw new Error(`Upsert failed: ${res.status} ${await res.text()}`)
  }
  console.log(`\nUpserted ${rows.length} rows into teachingbase_snapshot.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
