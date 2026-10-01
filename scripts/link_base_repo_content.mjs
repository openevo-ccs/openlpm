#!/usr/bin/env node
// Loads a manifest describing real TheoryBase/LiteratureBase content --
// theories, literature, and the relations linking them to each other and
// to a project's own curriculum -- and writes it into one OpenLPM
// project's local Theories/Literature tables. This is the general tool
// behind theories.base_repo/base_repo_ref (wired into theories-page.tsx
// 2026-10-01): a reusable, repeatable way to bring real ecosystem content
// into a project, rather than a one-off script for a single project.
//
// Reusable for any project: write a new manifest file next to this one
// (see scripts/base-repo-links/evomentor-thuringia.json for the real
// shape), point --manifest at it.
//
// Authenticates as a real project member -- the standing QA contributor
// account by default, same account and mint-session pattern as
// scripts/mint_qa_session.mjs -- and writes through the ordinary REST API
// with that user's own access token. This is NOT a service_role bypass:
// it's exactly what a real signed-in maintainer clicking through the
// Theories/Literature pages would do, just scripted. RLS applies
// normally; it will fail loudly if the account isn't actually a member
// with write access to the target project.
//
// literature_references.doi is a GLOBAL unique column (migration 001),
// never updated to be per-project when project_id was added later
// (migration 004) -- a real, pre-existing schema quirk, not something
// this script papers over. If a DOI already exists under a DIFFERENT
// project, this script reports the conflict and skips it rather than
// reusing that other project's row id here.
//
// Defaults to a dry run -- prints exactly what already exists vs. what
// it would create, and never calls POST. --yes actually writes.
//
// Usage:
//   node scripts/link_base_repo_content.mjs --manifest scripts/base-repo-links/evomentor-thuringia.json [--yes] [--as <email>]

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'
const DEFAULT_EMAIL = 'dustin+openlpmtest2@globalesd.org'

function loadServiceRoleKey() {
  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (fromEnv) return fromEnv.trim()
  const p = path.join(ROOT, '.supabase-secrets', 'service-role-key.txt')
  if (existsSync(p)) return readFileSync(p, 'utf8').trim()
  console.error('No service_role key found -- see scripts/pull_feedback.mjs\'s own header for how to get one once.')
  process.exit(1)
}

function loadAnonKey() {
  const env = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  const m = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)
  if (!m) throw new Error('VITE_SUPABASE_ANON_KEY not found in .env.local')
  return m[1].trim()
}

/** Mints a real session for `email` via Supabase's Admin API, the same magic-link pattern as scripts/mint_qa_session.mjs -- no password, no email round-trip. */
async function mintAccessToken(email) {
  const serviceKey = loadServiceRoleKey()
  const anonKey = loadAnonKey()
  const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  })
  if (!genRes.ok) throw new Error(`generate_link failed: ${genRes.status} ${await genRes.text()}`)
  const emailOtp = (await genRes.json()).email_otp
  if (!emailOtp) throw new Error('No email_otp in generate_link response')
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token: emailOtp, email }),
  })
  if (!verifyRes.ok) throw new Error(`verify failed: ${verifyRes.status} ${await verifyRes.text()}`)
  const session = await verifyRes.json()
  if (!session.access_token) throw new Error('No access_token in verify response')
  return { accessToken: session.access_token, userId: session.user.id, anonKey }
}

function makeRest(anonKey, accessToken) {
  return async function call(method, pathAndQuery, body) {
    const headers = { apikey: anonKey, Authorization: `Bearer ${accessToken}` }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      headers['Prefer'] = 'return=representation'
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
    if (!res.ok) throw new Error(`${method} ${pathAndQuery} -> ${res.status}: ${await res.text()}`)
    const text = await res.text()
    return text ? JSON.parse(text) : null
  }
}

function parseArgs(argv) {
  const out = { manifest: null, yes: false, email: DEFAULT_EMAIL }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--manifest') out.manifest = argv[++i]
    else if (argv[i] === '--yes') out.yes = true
    else if (argv[i] === '--as') out.email = argv[++i]
  }
  return out
}

async function resolveProject(rest, slug) {
  const rows = await rest('GET', `projects?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name`)
  if (!rows || rows.length === 0) throw new Error(`No project found with slug "${slug}"`)
  return rows[0]
}

/** Finds an existing literature row by DOI (globally -- see header note) or, for a DOI-less entry, by title within this project. */
async function findLiterature(rest, projectId, entry) {
  if (entry.doi) {
    const rows = await rest('GET', `literature_references?doi=eq.${encodeURIComponent(entry.doi)}&select=id,project_id,title`)
    return rows?.[0] ?? null
  }
  const rows = await rest(
    'GET',
    `literature_references?project_id=eq.${projectId}&title=eq.${encodeURIComponent(entry.title)}&select=id,project_id,title`
  )
  return rows?.[0] ?? null
}

async function findTheory(rest, projectId, baseRepoRef) {
  const rows = await rest(
    'GET',
    `theories?project_id=eq.${projectId}&base_repo_ref=eq.${encodeURIComponent(baseRepoRef)}&select=id,label`
  )
  return rows?.[0] ?? null
}

async function findSchemaElementByLabel(rest, projectId, labelLike) {
  const rows = await rest(
    'GET',
    `lpm_schema_elements?project_id=eq.${projectId}&label=ilike.*${encodeURIComponent(labelLike)}*&select=id,label`
  )
  return rows ?? []
}

async function main() {
  const { manifest: manifestPath, yes, email } = parseArgs(process.argv.slice(2))
  if (!manifestPath) {
    console.error('Usage: node scripts/link_base_repo_content.mjs --manifest <path> [--yes] [--as <email>]')
    process.exit(1)
  }
  const manifest = JSON.parse(readFileSync(path.resolve(ROOT, manifestPath), 'utf8'))
  console.log(`${yes ? 'LIVE RUN' : 'DRY RUN'} -- manifest: ${manifestPath}, project: ${manifest.project_slug}, as: ${email}\n`)

  const { accessToken, userId, anonKey } = await mintAccessToken(email)
  const rest = makeRest(anonKey, accessToken)
  const project = await resolveProject(rest, manifest.project_slug)
  console.log(`Project: ${project.name} (${project.id})\n`)

  const literatureIdByDoi = new Map() // doi -> id; null-doi entries keyed by title instead
  const literatureKey = (e) => e.doi ?? `title:${e.title}`

  console.log('-- Literature --')
  for (const entry of manifest.literature ?? []) {
    const existing = await findLiterature(rest, project.id, entry)
    if (existing) {
      if (entry.doi && existing.project_id !== project.id) {
        console.log(`  CONFLICT  "${entry.title}" -- this DOI already exists under a different project (${existing.project_id}). Not reusing that row here; skipping.`)
        continue
      }
      console.log(`  exists    "${entry.title}"`)
      literatureIdByDoi.set(literatureKey(entry), existing.id)
      continue
    }
    console.log(`  ${yes ? 'creating ' : 'would create'} "${entry.title}"${entry.doi ? ` (${entry.doi})` : ' (no DOI)'}`)
    if (!yes) continue
    const [row] = await rest('POST', 'literature_references', {
      project_id: project.id,
      doi: entry.doi,
      title: entry.title,
      authors: entry.authors ?? [],
      year: entry.year ?? null,
      venue: entry.venue ?? null,
      type: entry.type ?? null,
      status: 'draft',
      submitted_by: userId,
    })
    literatureIdByDoi.set(literatureKey(entry), row.id)
  }

  console.log('\n-- Theories --')
  const theoryIdByRef = new Map()
  for (const entry of manifest.theories ?? []) {
    const existing = await findTheory(rest, project.id, entry.base_repo_ref)
    if (existing) {
      console.log(`  exists    "${existing.label}"`)
      theoryIdByRef.set(entry.base_repo_ref, existing.id)
      continue
    }
    console.log(`  ${yes ? 'creating ' : 'would create'} "${entry.label}" (${entry.base_repo_ref})`)
    if (!yes) continue
    const [row] = await rest('POST', 'theories', {
      project_id: project.id,
      label: entry.label,
      description: entry.description,
      evidentiary_maturity: entry.evidentiary_maturity ?? null,
      evidentiary_maturity_note: entry.evidentiary_maturity_note ?? null,
      base_repo: 'theorybase',
      base_repo_ref: entry.base_repo_ref,
      created_by: userId,
    })
    theoryIdByRef.set(entry.base_repo_ref, row.id)
  }

  console.log('\n-- Theory <-> literature links --')
  for (const link of manifest.theory_literature_links ?? []) {
    const theoryId = theoryIdByRef.get(link.theory_ref)
    if (!theoryId) { console.log(`  SKIP  theory ${link.theory_ref} not resolved (see above)`); continue }
    const litKey = link.literature_doi ?? `title:${link.literature_title}`
    const referenceId = literatureIdByDoi.get(litKey)
    if (!referenceId) { console.log(`  SKIP  literature ${litKey} not resolved (see above)`); continue }
    const existing = await rest('GET', `theory_literature_links?theory_id=eq.${theoryId}&reference_id=eq.${referenceId}&select=id`)
    if (existing?.length) { console.log(`  exists    ${link.theory_ref} <-> ${litKey}`); continue }
    console.log(`  ${yes ? 'creating ' : 'would create'} ${link.theory_ref} <-> ${litKey} (${link.relation_type})`)
    if (!yes) continue
    await rest('POST', 'theory_literature_links', {
      theory_id: theoryId,
      reference_id: referenceId,
      relation_type: link.relation_type,
      note: link.note ?? null,
      created_by: userId,
    })
  }

  console.log('\n-- Theory relations --')
  for (const rel of manifest.theory_relations ?? []) {
    const theoryId = theoryIdByRef.get(rel.theory_ref)
    if (!theoryId) { console.log(`  SKIP  theory ${rel.theory_ref} not resolved (see above)`); continue }

    let targetId = null
    let targetDesc = null
    if (rel.target_type === 'theory') {
      targetId = theoryIdByRef.get(rel.target_ref)
      targetDesc = rel.target_ref
      if (!targetId) { console.log(`  SKIP  target theory ${rel.target_ref} not resolved`); continue }
    } else if (rel.target_type === 'schema_element') {
      const matches = await findSchemaElementByLabel(rest, project.id, rel.target_label_like)
      if (matches.length !== 1) {
        console.log(`  SKIP  schema_element label-like "${rel.target_label_like}" matched ${matches.length} rows (need exactly 1) -- not guessing.`)
        continue
      }
      targetId = matches[0].id
      targetDesc = matches[0].label
    } else {
      console.log(`  SKIP  unsupported target_type "${rel.target_type}" in manifest`)
      continue
    }

    const existing = await rest('GET', `theory_relations?theory_id=eq.${theoryId}&target_type=eq.${rel.target_type}&target_id=eq.${targetId}&select=id`)
    if (existing?.length) { console.log(`  exists    ${rel.theory_ref} -[${rel.relation_label}]-> ${targetDesc}`); continue }
    console.log(`  ${yes ? 'creating ' : 'would create'} ${rel.theory_ref} -[${rel.relation_label}]-> ${targetDesc} (${rel.target_type})`)
    if (!yes) continue
    try {
      await rest('POST', 'theory_relations', {
        theory_id: theoryId,
        target_type: rel.target_type,
        target_id: targetId,
        relation_label: rel.relation_label,
        annotation: rel.annotation ?? null,
        created_by: userId,
      })
    } catch (e) {
      if (rel.target_type === 'theory' && /theory_relations_target_type_check/.test(String(e.message))) {
        console.log(`  FAILED  needs migration 071 (adds 'theory' to theory_relations.target_type) pushed to production first.`)
      } else {
        console.log(`  FAILED  ${e.message}`)
      }
    }
  }

  console.log(yes ? '\nDone.' : '\nDry run only -- re-run with --yes to actually write.')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
