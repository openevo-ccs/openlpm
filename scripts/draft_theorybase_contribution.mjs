#!/usr/bin/env node
// Takes a drafted theory_contributions row (created from a project's
// Theories page via the "Propose to TheoryBase" action) and actually
// lands it as a real commit in the real theorybase repo, on its own
// dedicated branch -- Option 2 from feedback 35924e8a ("drive cycles of
// TheoryBase data quality improvement"). Mirrors the precedent already
// set 2026-10-01 for EvoMentor Thuringia's own TheoryBase/ProjectBase
// contributions: a real local commit, never a push, never main directly.
//
// This is a LOCAL commit only. It never pushes and never opens a PR --
// pushing a branch and opening the actual PR is a human's own hands, the
// same boundary every other write to a shared governed resource hits in
// this lab. What this script buys: the mechanical, error-prone part (id
// collision check, correct indentation, schema validation) done
// correctly and reproducibly, so a human's remaining job is review and
// push, not transcription.
//
// Refuses to run against a theorybase checkout with any other uncommitted
// changes already sitting in it -- this lab's checkouts are shared across
// concurrent sessions, and this script has no business committing
// something else's in-progress work alongside its own.
//
// Usage:
//   node scripts/draft_theorybase_contribution.mjs --contribution-id <uuid> [--theorybase-path ../theorybase] [--yes]

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
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
  const out = { contributionId: null, theorybasePath: path.join(ROOT, '..', 'theorybase'), yes: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--contribution-id') out.contributionId = argv[++i]
    else if (argv[i] === '--theorybase-path') out.theorybasePath = path.resolve(argv[++i])
    else if (argv[i] === '--yes') out.yes = true
  }
  return out
}

function restHeaders(serviceKey) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
}

async function fetchContribution(serviceKey, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/theory_contributions?id=eq.${encodeURIComponent(id)}&select=*`, { headers: restHeaders(serviceKey) })
  if (!res.ok) throw new Error(`GET theory_contributions -> ${res.status}: ${await res.text()}`)
  const rows = await res.json()
  if (!rows.length) throw new Error(`No theory_contributions row with id ${id}`)
  return rows[0]
}

async function patchContribution(serviceKey, id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/theory_contributions?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { ...restHeaders(serviceKey), Prefer: 'return=minimal' }, body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`PATCH theory_contributions -> ${res.status}: ${await res.text()}`)
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

/** Appends `entryYaml` (a single record, already yaml.dump'd at 0-indent) to the real theories.yaml's `theories:` list, re-indented to match the file's existing 2-space list-item style -- a text splice, not a parse+re-dump of the whole file, so every existing comment and the file's own formatting survive untouched. */
function appendTheoryEntry(theorybasePath, entryYaml) {
  const filePath = path.join(theorybasePath, 'records', 'theories.yaml')
  const original = readFileSync(filePath, 'utf8')
  const indented = entryYaml
    .trimEnd()
    .split('\n')
    .map((line, i) => (i === 0 ? `  - ${line}` : `    ${line}`))
    .join('\n')
  const updated = `${original.trimEnd()}\n\n${indented}\n`
  writeFileSync(filePath, updated)
}

function nextAvailableId(theorybasePath, proposedId) {
  const filePath = path.join(theorybasePath, 'records', 'theories.yaml')
  const doc = yaml.load(readFileSync(filePath, 'utf8'))
  const existingIds = new Set((doc?.theories ?? []).map((t) => t.id))
  if (!existingIds.has(proposedId)) return proposedId
  let n = 2
  while (existingIds.has(`${proposedId}-${n}`)) n++
  return `${proposedId}-${n}`
}

async function main() {
  const { contributionId, theorybasePath, yes } = parseArgs(process.argv.slice(2))
  if (!contributionId) {
    console.error('Usage: node scripts/draft_theorybase_contribution.mjs --contribution-id <uuid> [--theorybase-path ../theorybase] [--yes]')
    process.exit(1)
  }
  if (!existsSync(theorybasePath)) throw new Error(`${theorybasePath} doesn't exist. Pass --theorybase-path if the sibling checkout lives somewhere else.`)

  const dirty = git(theorybasePath, ['status', '--porcelain'])
  if (dirty) {
    console.error(`${theorybasePath} already has uncommitted changes -- refusing to touch a checkout that isn't clean:\n${dirty}`)
    console.error('This lab\'s checkouts are shared across concurrent sessions; use an isolated worktree instead of this path.')
    process.exit(1)
  }

  const serviceKey = loadServiceRoleKey()
  const contribution = await fetchContribution(serviceKey, contributionId)
  console.log(`${yes ? 'LIVE RUN' : 'DRY RUN'} -- contribution ${contributionId} (status: ${contribution.status})\n`)

  const record = yaml.load(contribution.draft_yaml)
  const finalId = nextAvailableId(theorybasePath, record.id)
  if (finalId !== record.id) {
    console.log(`Note: ${record.id} already exists in TheoryBase -- using ${finalId} instead.`)
    record.id = finalId
    record.slug = finalId.replace(/^OE-THEORY-/, '')
  }
  const branch = `theorybase-contribution-${record.slug}`
  const finalYaml = yaml.dump(record, { lineWidth: 100, noRefs: true })

  console.log(`Branch: ${branch}`)
  console.log(`Record:\n${finalYaml}`)

  if (!yes) {
    console.log('Dry run only -- pass --yes to actually create the branch and commit.')
    return
  }

  git(theorybasePath, ['checkout', '-b', branch])
  appendTheoryEntry(theorybasePath, finalYaml)
  try {
    execFileSync('python', ['scripts/validate.py'], { cwd: theorybasePath, stdio: 'inherit' })
  } catch (e) {
    console.error('\nvalidate.py failed against the appended record -- not committing. Fix the draft and re-run.')
    throw e
  }
  git(theorybasePath, ['add', 'records/theories.yaml'])
  git(theorybasePath, ['commit', '-m', `Add ${record.id} (proposed from an OpenLPM project, contribution ${contributionId})\n\nDrafted via OpenLPM's "Propose to TheoryBase" action (feedback 35924e8a).\nNot pushed -- needs human review before it goes further.`])
  const sha = git(theorybasePath, ['rev-parse', '--short', 'HEAD'])

  await patchContribution(serviceKey, contributionId, { status: 'branch_committed', target_branch: branch, target_record_id: record.id })
  console.log(`\nCommitted ${sha} on branch "${branch}" in ${theorybasePath}. Not pushed.`)
  console.log(`Review the diff, then: cd ${theorybasePath} && git push -u origin ${branch}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
