#!/usr/bin/env node
// Refreshes theorybase_snapshot (migration 094) from the real theorybase
// repo's own YAML records -- Option 1 (findability) from feedback
// 35924e8a. TheoryBase is a private repo, so this reads it the same way
// scripts/link_base_repo_content.mjs's manifest content was sourced:
// directly off the local filesystem, from a sibling checkout, not a live
// GitHub API call. That means this only ever reflects what's on disk at
// sync time -- re-run it after TheoryBase changes, the same "a human runs
// this periodically" shape as every other cross-repo sync in this lab.
//
// Writes via the service_role key (same pattern as
// scripts/link_base_repo_content.mjs's loadServiceRoleKey/pull_feedback.mjs),
// since theorybase_snapshot's own RLS (migration 094) only grants writes
// to service_role -- it's a cache table, not user content.
//
// Defaults to a dry run -- prints what it would upsert. --yes actually writes.
//
// Usage:
//   node scripts/sync_theorybase_snapshot.mjs [--theorybase-path ../theorybase] [--yes]

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
  const out = { theorybasePath: path.join(ROOT, '..', 'theorybase'), yes: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--theorybase-path') out.theorybasePath = path.resolve(argv[++i])
    else if (argv[i] === '--yes') out.yes = true
  }
  return out
}

// Each file's top-level YAML key and which real field(s) to read a
// record_type/label/summary from when the entry itself has no explicit
// recordType (only propositions.yaml/assumptions.yaml's entries do).
const FILES = [
  { file: 'theories.yaml', key: 'theories', fallbackType: 'theory' },
  { file: 'propositions.yaml', key: 'propositions', fallbackType: 'proposition' },
  { file: 'assumptions.yaml', key: 'assumptions', fallbackType: 'assumption' },
  { file: 'misconceptions.yaml', key: 'misconceptions', fallbackType: 'misconception' },
  { file: 'cross-domain-constructs.yaml', key: 'crossDomainConstructs', fallbackType: 'cross_domain_construct' },
  { file: 'design-principles.yaml', key: 'designPrinciples', fallbackType: 'design_principle' },
  { file: 'curriculum-decisions.yaml', key: 'curriculumDecisions', fallbackType: 'curriculum_decision' },
]

function summarize(entry) {
  const raw = entry.description ?? entry.statement ?? entry.scope ?? ''
  const collapsed = String(raw).replace(/\s+/g, ' ').trim()
  return collapsed.length > 600 ? `${collapsed.slice(0, 600)}…` : (collapsed || null)
}

function loadSnapshotRows(theorybasePath) {
  const recordsDir = path.join(theorybasePath, 'records')
  if (!existsSync(recordsDir)) throw new Error(`No records/ directory found at ${recordsDir} -- is --theorybase-path correct?`)
  const rows = []
  for (const { file, key, fallbackType } of FILES) {
    const full = path.join(recordsDir, file)
    if (!existsSync(full)) { console.warn(`(skipping missing ${file})`); continue }
    const doc = yaml.load(readFileSync(full, 'utf8'))
    const entries = doc?.[key]
    if (!Array.isArray(entries)) { console.warn(`(no "${key}" array in ${file}, skipping)`); continue }
    for (const entry of entries) {
      if (!entry?.id) continue
      rows.push({
        id: entry.id,
        record_type: entry.recordType ?? fallbackType,
        label: entry.label ?? entry.slug ?? entry.id,
        short_label: entry.shortLabel ?? null,
        summary: summarize(entry),
        data: entry,
        status: entry.status ?? null,
        authorship_provenance: entry.authorshipProvenance ?? null,
        characterization_status: entry.characterizationStatus ?? null,
      })
    }
  }
  return rows
}

async function main() {
  const { theorybasePath, yes } = parseArgs(process.argv.slice(2))
  console.log(`${yes ? 'LIVE RUN' : 'DRY RUN'} -- reading ${theorybasePath}\n`)

  if (!existsSync(theorybasePath)) {
    console.error(`${theorybasePath} doesn't exist. Pass --theorybase-path if the sibling checkout lives somewhere else.`)
    process.exit(1)
  }

  const rows = loadSnapshotRows(theorybasePath)
  console.log(`Found ${rows.length} real TheoryBase records across ${readdirSync(path.join(theorybasePath, 'records')).length} record files.\n`)
  const byType = {}
  for (const r of rows) byType[r.record_type] = (byType[r.record_type] ?? 0) + 1
  for (const [type, count] of Object.entries(byType)) console.log(`  ${type}: ${count}`)

  if (!yes) {
    console.log('\nDry run only -- pass --yes to actually upsert into theorybase_snapshot.')
    return
  }

  const serviceKey = loadServiceRoleKey()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/theorybase_snapshot`, {
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
  console.log(`\nUpserted ${rows.length} rows into theorybase_snapshot.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
