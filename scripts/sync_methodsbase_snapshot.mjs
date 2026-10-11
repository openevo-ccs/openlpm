#!/usr/bin/env node
// Refreshes methodsbase_snapshot (migration 121) from the real methodsbase
// repo's own records/methods.yaml -- closing the gap Dustin named
// 2026-10-10: EvoMentor Thuringia's didactic methods need a real, citable
// description somewhere an LLM (or a researcher) can actually read, not
// just a bare German label. Mirrors scripts/sync_theorybase_snapshot.mjs
// and scripts/sync_literaturebase_snapshot.mjs exactly, adapted to
// MethodsBase's real shape: ONE yaml file (records/methods.yaml) holding
// a `methods:` array, not one file per record.
//
// Reads directly off a sibling checkout's filesystem, not a live GitHub
// API call -- same "a human runs this periodically" shape as every other
// cross-repo sync in this lab. Writes via the service_role key, since
// methodsbase_snapshot's own RLS (migration 121) only grants writes to
// service_role -- it's a cache table, not user content.
//
// Defaults to a dry run -- prints what it would upsert. --yes actually writes.
// --seed-vocabulary-links additionally upserts method_vocabulary_links
// (migration 122) with the real 15-method mapping for OpenLPM's EvoMentor
// Thuringia vocabulary, AFTER the snapshot upsert succeeds in the same run,
// so the FK it depends on always already exists -- see migration 122's
// own comment on why that seeding isn't done directly in SQL.
//
// Usage:
//   node scripts/sync_methodsbase_snapshot.mjs [--methodsbase-path ../methodsbase] [--yes] [--seed-vocabulary-links]

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import yaml from 'js-yaml'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'

// OpenLPM's EvoMentor Thuringia didactic-method vocabulary (migration 078)
// mapped onto the real MethodsBase record that now describes each one --
// 3 already existed, 12 were authored specifically to close this gap
// (methodsbase PR #1, 2026-10-10). Kept here, not in a migration, because
// a methodsbase_id only resolves once this same script's snapshot upsert
// has run -- see migration 122's header comment.
const VOCABULARY_MAPPING = {
  'Forschendes Lernen': 'OE-METHOD-inquiry-based-learning',
  'Erfahrungs-/handlungsorientiertes Lernen': 'OE-METHOD-experiential-action-oriented-learning',
  'Problembasiertes Lernen': 'OE-METHOD-problem-based-learning',
  'Projektbasiertes Lernen': 'OE-METHOD-project-based-learning',
  'Kooperative Lernformen': 'OE-METHOD-cooperative-learning',
  'Konzeptuelles Lernen': 'OE-METHOD-concept-based-teaching',
  'Analogien und Vergleiche': 'OE-METHOD-analogy-mapping',
  'Narrativer Zugang': 'OE-METHOD-narrative-pedagogy',
  // Broader than this specific MethodsBase record (NetLogo ABMs
  // specifically) -- closest real match available, not an exact one. See
  // this script's own README note / methodsbase PR #1's discussion.
  'Modelle und Simulationen': 'OE-METHOD-agent-based-modeling-netlogo',
  '(bioethische) Diskussion': 'OE-METHOD-structured-ethical-discussion',
  'Digitale Medien': 'OE-METHOD-digital-media-integration',
  'Außerschulische Lernorte': 'OE-METHOD-out-of-school-learning',
  'Recherche': 'OE-METHOD-guided-information-research',
  'Stationenlernen': 'OE-METHOD-station-based-learning',
  'Gestalterische/kreative Aufgaben': 'OE-METHOD-creative-design-tasks',
}

function loadServiceRoleKey() {
  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (fromEnv) return fromEnv.trim()
  const p = path.join(ROOT, '.supabase-secrets', 'service-role-key.txt')
  if (existsSync(p)) return readFileSync(p, 'utf8').trim()
  console.error('No service_role key found -- see scripts/pull_feedback.mjs\'s own header for how to get one once.')
  process.exit(1)
}

function parseArgs(argv) {
  const out = { methodsbasePath: path.join(ROOT, '..', 'methodsbase'), yes: false, seedVocabularyLinks: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--methodsbase-path') out.methodsbasePath = path.resolve(argv[++i])
    else if (argv[i] === '--yes') out.yes = true
    else if (argv[i] === '--seed-vocabulary-links') out.seedVocabularyLinks = true
  }
  return out
}

function loadSnapshotRows(methodsbasePath) {
  const recordsFile = path.join(methodsbasePath, 'records', 'methods.yaml')
  if (!existsSync(recordsFile)) throw new Error(`No records/methods.yaml found at ${recordsFile} -- is --methodsbase-path correct?`)
  const doc = yaml.load(readFileSync(recordsFile, 'utf8'))
  const entries = doc?.methods ?? []
  const rows = []
  for (const entry of entries) {
    if (!entry?.id) { console.warn('(skipping a record -- no id)'); continue }
    rows.push({
      id: entry.id,
      slug: entry.slug ?? entry.id,
      label: entry.label ?? '(untitled)',
      method_class: entry.methodClass ?? null,
      description: entry.description ?? null,
      when_to_use: entry.whenToUse ?? null,
      discipline: entry.discipline ?? null,
      status: entry.status ?? null,
      review_status: entry.provenance?.review_status ?? null,
      data: entry,
    })
  }
  return rows
}

async function upsert(table, rows, serviceKey) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`Upsert into ${table} failed: ${res.status} ${await res.text()}`)
}

async function main() {
  const { methodsbasePath, yes, seedVocabularyLinks } = parseArgs(process.argv.slice(2))
  console.log(`${yes ? 'LIVE RUN' : 'DRY RUN'} -- reading ${methodsbasePath}\n`)

  if (!existsSync(methodsbasePath)) {
    console.error(`${methodsbasePath} doesn't exist. Pass --methodsbase-path if the sibling checkout lives somewhere else.`)
    process.exit(1)
  }

  const rows = loadSnapshotRows(methodsbasePath)
  console.log(`Found ${rows.length} real MethodsBase records.\n`)
  const byClass = new Map()
  for (const r of rows) byClass.set(r.method_class, (byClass.get(r.method_class) ?? 0) + 1)
  for (const [cls, count] of byClass) console.log(`  ${cls ?? '(no class)'}: ${count}`)

  const presentIds = new Set(rows.map((r) => r.id))
  const unmapped = Object.entries(VOCABULARY_MAPPING).filter(([, id]) => !presentIds.has(id))
  if (unmapped.length) {
    console.warn(`\nWARNING: ${unmapped.length} vocabulary mapping(s) point at an id not found in methodsbase_snapshot content:`)
    for (const [label, id] of unmapped) console.warn(`  "${label}" -> ${id}`)
    console.warn('These will fail the FK on seeding unless methodsbase PR #1 (or its id\'s current home) has actually landed.')
  }

  if (!yes) {
    console.log('\nDry run only -- pass --yes to actually upsert into methodsbase_snapshot.')
    if (seedVocabularyLinks) console.log('(--seed-vocabulary-links has no effect without --yes.)')
    return
  }

  const serviceKey = loadServiceRoleKey()
  await upsert('methodsbase_snapshot', rows, serviceKey)
  console.log(`\nUpserted ${rows.length} rows into methodsbase_snapshot.`)

  if (seedVocabularyLinks) {
    const mappingRows = Object.entries(VOCABULARY_MAPPING).map(([method_key, methodsbase_id]) => ({ method_key, methodsbase_id }))
    await upsert('method_vocabulary_links', mappingRows, serviceKey)
    console.log(`Upserted ${mappingRows.length} rows into method_vocabulary_links.`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
