#!/usr/bin/env node
// Takes a drafted literature_contributions row (created from a project's
// Literature page via the "Propose to LiteratureBase" action) and lands
// it as a real commit in the real literaturebase repo, on its own
// dedicated branch -- the "sending back out" half of feedback 36f3fe54.
// Mirrors scripts/draft_theorybase_contribution.mjs, adapted to
// LiteratureBase's own real workflow: one real file per record (a new
// records/<slug>.yaml, not a text splice into a shared file), and no
// standing submissions branch (retired 2026-08-04) -- a short-lived
// feature branch, meant to become a normal PR against main.
//
// This is a LOCAL commit only. It never pushes and never opens a PR --
// pushing a branch and opening the actual PR is a human's own hands, the
// same boundary every other write to a shared governed resource hits in
// this lab. What this script buys: the mechanical, error-prone part (id/
// slug collision check, schema validation, Crossref re-verification) done
// correctly and reproducibly, so a human's remaining job is review and
// push, not transcription.
//
// Refuses to run against a literaturebase checkout with any other
// uncommitted changes already sitting in it -- this lab's checkouts are
// shared across concurrent sessions, and this script has no business
// committing something else's in-progress work alongside its own.
//
// Usage:
//   node scripts/draft_literaturebase_contribution.mjs --contribution-id <uuid> [--literaturebase-path ../literaturebase] [--yes]

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
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
  const out = { contributionId: null, literaturebasePath: path.join(ROOT, '..', 'literaturebase'), yes: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--contribution-id') out.contributionId = argv[++i]
    else if (argv[i] === '--literaturebase-path') out.literaturebasePath = path.resolve(argv[++i])
    else if (argv[i] === '--yes') out.yes = true
  }
  return out
}

function restHeaders(serviceKey) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
}

async function fetchContribution(serviceKey, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/literature_contributions?id=eq.${encodeURIComponent(id)}&select=*`, { headers: restHeaders(serviceKey) })
  if (!res.ok) throw new Error(`GET literature_contributions -> ${res.status}: ${await res.text()}`)
  const rows = await res.json()
  if (!rows.length) throw new Error(`No literature_contributions row with id ${id}`)
  return rows[0]
}

async function patchContribution(serviceKey, id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/literature_contributions?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { ...restHeaders(serviceKey), Prefer: 'return=minimal' }, body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`PATCH literature_contributions -> ${res.status}: ${await res.text()}`)
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function existingIdsAndSlugs(literaturebasePath) {
  const recordsDir = path.join(literaturebasePath, 'records')
  const ids = new Set()
  const slugs = new Set()
  for (const file of readdirSync(recordsDir)) {
    if (!file.endsWith('.yaml')) continue
    const entry = yaml.load(readFileSync(path.join(recordsDir, file), 'utf8'))
    if (entry?.id) ids.add(entry.id)
    if (entry?.slug) slugs.add(entry.slug)
  }
  return { ids, slugs }
}

function nextAvailable(proposedSlug, taken) {
  if (!taken.has(proposedSlug)) return proposedSlug
  let n = 2
  while (taken.has(`${proposedSlug}-${n}`)) n++
  return `${proposedSlug}-${n}`
}

async function main() {
  const { contributionId, literaturebasePath, yes } = parseArgs(process.argv.slice(2))
  if (!contributionId) {
    console.error('Usage: node scripts/draft_literaturebase_contribution.mjs --contribution-id <uuid> [--literaturebase-path ../literaturebase] [--yes]')
    process.exit(1)
  }
  if (!existsSync(literaturebasePath)) throw new Error(`${literaturebasePath} doesn't exist. Pass --literaturebase-path if the sibling checkout lives somewhere else.`)

  const dirty = git(literaturebasePath, ['status', '--porcelain'])
  if (dirty) {
    console.error(`${literaturebasePath} already has uncommitted changes -- refusing to touch a checkout that isn't clean:\n${dirty}`)
    console.error('This lab\'s checkouts are shared across concurrent sessions; use an isolated worktree instead of this path.')
    process.exit(1)
  }

  const serviceKey = loadServiceRoleKey()
  const contribution = await fetchContribution(serviceKey, contributionId)
  console.log(`${yes ? 'LIVE RUN' : 'DRY RUN'} -- contribution ${contributionId} (status: ${contribution.status})\n`)

  const record = yaml.load(contribution.draft_yaml)
  const { ids, slugs } = existingIdsAndSlugs(literaturebasePath)
  const finalSlug = nextAvailable(record.slug, slugs)
  if (finalSlug !== record.slug) {
    console.log(`Note: slug "${record.slug}" already exists in LiteratureBase -- using "${finalSlug}" instead.`)
    record.slug = finalSlug
    record.id = `OE-LITERATURE-${finalSlug}`
  }
  if (ids.has(record.id)) throw new Error(`Id collision on ${record.id} even after slug dedup -- investigate by hand.`)

  const branch = `literaturebase-contribution-${record.slug}`
  const finalYaml = `$schema: ../schema/literature-record.schema.json\n${yaml.dump(record, { lineWidth: 100, noRefs: true })}`
  const filePath = path.join('records', `${record.slug}.yaml`)

  console.log(`Branch: ${branch}`)
  console.log(`File: ${filePath}`)
  console.log(`Record:\n${finalYaml}`)

  if (!yes) {
    console.log('Dry run only -- pass --yes to actually create the branch and commit.')
    return
  }

  git(literaturebasePath, ['checkout', '-b', branch])
  writeFileSync(path.join(literaturebasePath, filePath), finalYaml)
  try {
    execFileSync('python', ['scripts/validate.py'], { cwd: literaturebasePath, stdio: 'inherit' })
    if (record.citation?.doi) {
      execFileSync('python', ['scripts/verify_crossref.py'], { cwd: literaturebasePath, stdio: 'inherit' })
    }
  } catch (e) {
    console.error('\nvalidate.py or verify_crossref.py failed against the new record -- not committing. Fix the draft and re-run.')
    git(literaturebasePath, ['checkout', 'main'])
    git(literaturebasePath, ['branch', '-D', branch])
    throw e
  }
  git(literaturebasePath, ['add', filePath])
  git(literaturebasePath, ['commit', '-m', `Add ${record.id} (proposed from an OpenLPM project, contribution ${contributionId})\n\nDrafted via OpenLPM's "Propose to LiteratureBase" action (feedback 36f3fe54).\nNot pushed -- needs human review before it goes further. review_status is\nauthor-draft; this repo's own promotion gate requires at least\npeer-nominated before a merge into main.`])
  const sha = git(literaturebasePath, ['rev-parse', '--short', 'HEAD'])

  await patchContribution(serviceKey, contributionId, { status: 'branch_committed', target_branch: branch, target_record_id: record.id })
  console.log(`\nCommitted ${sha} on branch "${branch}" in ${literaturebasePath}. Not pushed.`)
  console.log(`Review the diff, then: cd ${literaturebasePath} && git push -u origin ${branch}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
