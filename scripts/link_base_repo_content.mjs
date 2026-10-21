#!/usr/bin/env node
// Base Repo Explorer, step 1: pulls real content from a Foundational Repo's
// own sibling checkout into its OpenLPM snapshot table (migration 152),
// for the four repos that have never had a connection to OpenLPM in any
// form -- QuestionBase, QuoteBase, CompetencyBase, ProjectBase. Mirrors
// scripts/sync_theorybase_snapshot.mjs / sync_literaturebase_snapshot.mjs /
// sync_methodsbase_snapshot.mjs exactly in spirit (a human runs this
// periodically, reading a local sibling checkout's filesystem, writing via
// the service_role key since each snapshot table's RLS only grants writes
// to service_role) -- unified into one script, parameterized by --repo,
// rather than a fourth near-identical file, since these four repos split
// cleanly into the same two real shapes: QuestionBase/QuoteBase are ONE
// yaml file with an array key; CompetencyBase/ProjectBase are one yaml
// file PER record under records/.
//
// Scope: Base Repos only. Does not touch ccs-graph/openevo-graph/eva-graph
// (a separate layer, explicitly out of scope for the Base Repo Explorer).
//
// Defaults to a dry run -- prints what it would upsert. --yes actually writes.
//
// Usage:
//   node scripts/link_base_repo_content.mjs --repo questionbase [--yes]
//   node scripts/link_base_repo_content.mjs --repo quotebase [--yes]
//   node scripts/link_base_repo_content.mjs --repo competencybase [--yes]
//   node scripts/link_base_repo_content.mjs --repo projectbase [--yes]
//   node scripts/link_base_repo_content.mjs --repo all [--yes]

import { readFileSync, readdirSync, existsSync } from 'node:fs'
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
  console.error("No service_role key found -- see scripts/pull_feedback.mjs's own header for how to get one once.")
  process.exit(1)
}

// One entry per repo: where its records live, how to read them, and how to
// shape a snapshot row out of one real record.
const REPOS = {
  questionbase: {
    table: 'questionbase_snapshot',
    defaultPath: path.join(ROOT, '..', 'questionbase'),
    load(repoPath) {
      const file = path.join(repoPath, 'records', 'questions.yaml')
      if (!existsSync(file)) throw new Error(`No records/questions.yaml at ${file}`)
      const doc = yaml.load(readFileSync(file, 'utf8'))
      return doc?.questions ?? []
    },
    toRow(entry) {
      return {
        id: entry.id,
        slug: entry.slug ?? entry.id,
        label: entry.label ?? '(untitled question)',
        question_type: entry.questionType ?? null,
        status: entry.status ?? null,
        priority: entry.priority ?? null,
        review_status: entry.provenance?.review_status ?? null,
        data: entry,
      }
    },
  },
  quotebase: {
    table: 'quotebase_snapshot',
    defaultPath: path.join(ROOT, '..', 'quotebase'),
    load(repoPath) {
      const file = path.join(repoPath, 'records', 'quotes.yaml')
      if (!existsSync(file)) throw new Error(`No records/quotes.yaml at ${file}`)
      const doc = yaml.load(readFileSync(file, 'utf8'))
      return doc?.quotes ?? []
    },
    toRow(entry) {
      return {
        id: entry.id,
        slug: entry.slug ?? entry.id,
        label: entry.attribution ?? entry.slug ?? '(unattributed quote)',
        text: entry.text ?? null,
        attribution: entry.attribution ?? null,
        review_status: entry.provenance?.review_status ?? null,
        data: entry,
      }
    },
  },
  competencybase: {
    table: 'competencybase_snapshot',
    defaultPath: path.join(ROOT, '..', 'competencybase'),
    load(repoPath) {
      const dir = path.join(repoPath, 'records')
      if (!existsSync(dir)) throw new Error(`No records/ directory at ${dir}`)
      return readdirSync(dir)
        .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map((f) => yaml.load(readFileSync(path.join(dir, f), 'utf8')))
        .filter(Boolean)
    },
    toRow(entry) {
      return {
        id: entry.id,
        label: entry.statement?.en ?? entry.humanCodingScheme ?? '(untitled competency)',
        source_vocabulary: entry.sourceVocabulary ?? null,
        domain: entry.domain ?? null,
        record_status: entry.status ?? null,
        review_status: entry.provenance?.review_status ?? null,
        data: entry,
      }
    },
  },
  projectbase: {
    table: 'projectbase_snapshot',
    defaultPath: path.join(ROOT, '..', 'projectbase'),
    load(repoPath) {
      const dir = path.join(repoPath, 'records')
      if (!existsSync(dir)) throw new Error(`No records/ directory at ${dir}`)
      return readdirSync(dir)
        .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map((f) => yaml.load(readFileSync(path.join(dir, f), 'utf8')))
        .filter(Boolean)
    },
    toRow(entry) {
      return {
        id: entry.id,
        slug: entry.slug ?? entry.id,
        label: entry.label ?? '(untitled project)',
        status: entry.status ?? null,
        data: entry,
      }
    },
  },
}

function parseArgs(argv) {
  const out = { repo: null, repoPath: null, yes: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') out.repo = argv[++i]
    else if (argv[i] === '--path') out.repoPath = path.resolve(argv[++i])
    else if (argv[i] === '--yes') out.yes = true
  }
  if (!out.repo) {
    console.error('Usage: node scripts/link_base_repo_content.mjs --repo <questionbase|quotebase|competencybase|projectbase|all> [--path <sibling-checkout>] [--yes]')
    process.exit(1)
  }
  return out
}

async function upsert(table, rows, serviceKey) {
  if (rows.length === 0) return
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

async function runOne(repoKey, explicitPath, yes, serviceKey) {
  const repo = REPOS[repoKey]
  if (!repo) throw new Error(`Unknown --repo "${repoKey}". Valid: ${Object.keys(REPOS).join(', ')}, all`)
  const repoPath = explicitPath ?? repo.defaultPath
  console.log(`\n=== ${repoKey} (${repo.table}) ===`)
  console.log(`${yes ? 'LIVE RUN' : 'DRY RUN'} -- reading ${repoPath}`)

  if (!existsSync(repoPath)) {
    console.error(`${repoPath} doesn't exist. Pass --path if the sibling checkout lives somewhere else.`)
    return
  }

  const entries = repo.load(repoPath)
  const rows = []
  for (const entry of entries) {
    if (!entry?.id) { console.warn('  (skipping a record -- no id)'); continue }
    rows.push(repo.toRow(entry))
  }
  console.log(`Found ${rows.length} real ${repoKey} records.`)

  if (!yes) {
    console.log('Dry run only -- pass --yes to actually upsert.')
    return
  }

  await upsert(repo.table, rows, serviceKey)
  console.log(`Upserted ${rows.length} rows into ${repo.table}.`)
}

async function main() {
  const { repo, repoPath, yes } = parseArgs(process.argv.slice(2))
  const serviceKey = yes ? loadServiceRoleKey() : null
  const targets = repo === 'all' ? Object.keys(REPOS) : [repo]
  for (const key of targets) {
    await runOne(key, repoPath, yes, serviceKey)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
