#!/usr/bin/env node
// Refreshes literaturebase_snapshot (migration 109) from the real
// literaturebase repo's own YAML records -- the "checking in" half of
// feedback 36f3fe54 ("integrate with OpenEvo's LiteratureBase"). Mirrors
// scripts/sync_theorybase_snapshot.mjs exactly, adapted to LiteratureBase's
// real shape: one YAML file per record under records/*.yaml, not a
// handful of combined per-type files.
//
// Reads directly off a sibling checkout's filesystem, not a live GitHub
// API call -- same "a human runs this periodically" shape as every other
// cross-repo sync in this lab. Writes via the service_role key, since
// literaturebase_snapshot's own RLS (migration 109) only grants writes to
// service_role -- it's a cache table, not user content.
//
// Defaults to a dry run -- prints what it would upsert. --yes actually writes.
//
// Usage:
//   node scripts/sync_literaturebase_snapshot.mjs [--literaturebase-path ../literaturebase] [--yes]

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import yaml from 'js-yaml'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'

function loadServiceRoleKey() {
  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (fromEnv) return fromEnv.trim()
  const p = path.join(ROOT, '.supabase-secrets', 'service-role-key.txt')
  if (existsSync(p)) return readFileSync(p, 'utf8').trim()
  console.error('No service_role key found -- see scripts/pull_feedback.mjs\'s own header for how to get one once.')
  process.exit(1)
}

function parseArgs(argv) {
  const out = { literaturebasePath: path.join(ROOT, '..', 'literaturebase'), yes: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--literaturebase-path') out.literaturebasePath = path.resolve(argv[++i])
    else if (argv[i] === '--yes') out.yes = true
  }
  return out
}

function loadSnapshotRows(literaturebasePath) {
  const recordsDir = path.join(literaturebasePath, 'records')
  if (!existsSync(recordsDir)) throw new Error(`No records/ directory found at ${recordsDir} -- is --literaturebase-path correct?`)
  const rows = []
  for (const file of readdirSync(recordsDir)) {
    if (!file.endsWith('.yaml')) continue
    const full = path.join(recordsDir, file)
    const entry = yaml.load(readFileSync(full, 'utf8'))
    if (!entry?.id) { console.warn(`(skipping ${file} -- no id)`); continue }
    rows.push({
      id: entry.id,
      slug: entry.slug ?? entry.id,
      title: entry.citation?.title ?? '(untitled)',
      authors: entry.citation?.authors ?? [],
      year: entry.citation?.year ?? null,
      venue: entry.citation?.venue ?? null,
      doi: entry.citation?.doi ?? null,
      type: entry.type ?? null,
      license: entry.license ?? null,
      domains: entry.domains ?? [],
      status: entry.status ?? null,
      review_status: entry.provenance?.review_status ?? null,
      data: entry,
    })
  }
  return rows
}

async function main() {
  const { literaturebasePath, yes } = parseArgs(process.argv.slice(2))
  console.log(`${yes ? 'LIVE RUN' : 'DRY RUN'} -- reading ${literaturebasePath}\n`)

  if (!existsSync(literaturebasePath)) {
    console.error(`${literaturebasePath} doesn't exist. Pass --literaturebase-path if the sibling checkout lives somewhere else.`)
    process.exit(1)
  }

  const rows = loadSnapshotRows(literaturebasePath)
  console.log(`Found ${rows.length} real LiteratureBase records.\n`)
  const withDoi = rows.filter((r) => r.doi).length
  console.log(`  with a DOI: ${withDoi}`)
  console.log(`  without a DOI: ${rows.length - withDoi}`)

  if (!yes) {
    console.log('\nDry run only -- pass --yes to actually upsert into literaturebase_snapshot.')
    return
  }

  const serviceKey = loadServiceRoleKey()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/literaturebase_snapshot`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`Upsert failed: ${res.status} ${await res.text()}`)
  console.log(`\nUpserted ${rows.length} rows into literaturebase_snapshot.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
