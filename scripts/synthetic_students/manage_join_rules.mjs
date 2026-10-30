#!/usr/bin/env node
// Adds/removes the temporary, per-email project_join_rules rows for the
// synthetic-student batch on evomentor-thuringia -- same mechanism as
// migration 036 (the real QA-account join rule) and its migration-037
// cleanup, just as a plain reversible script instead of a numbered
// migration, since this is temporary test setup, not schema evolution.
// Plain service-role table reads/writes via the data REST API. Needs
// migration 121 (service_role_default_grants_sweep) applied first --
// without it, project_join_rules returns a real Postgres "permission
// denied" (missing GRANT), not a code bug in this script.
//
// Usage:
//   node scripts/synthetic_students/manage_join_rules.mjs provision
//   node scripts/synthetic_students/manage_join_rules.mjs add
//   node scripts/synthetic_students/manage_join_rules.mjs remove
//   node scripts/synthetic_students/manage_join_rules.mjs list
//
// `provision` creates each account via the ordinary admin/users endpoint,
// pre-confirmed -- needed because the real app's own account-creation
// relies on a real sign-up flow (or GitHub OAuth) that a disposable test
// address can't complete. mintQaSession's magic-link flow (reused
// unmodified from scripts/mint_qa_session.mjs) was only ever exercised
// against an account that already existed; against a brand-new email it
// fails with a real "otp_expired" 403 -- not a permissions problem, just an
// untested case. Provisioning first closes that gap.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'
const PROJECT_SLUG = 'evomentor-thuringia'

function serviceKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? readFileSync(path.join(ROOT, '.supabase-secrets', 'service-role-key.txt'), 'utf8')).trim()
}

async function rest(method, table, { qs = '', body, prefer } = {}) {
  const key = serviceKey()
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  if (prefer) headers.Prefer = prefer
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) throw new Error(`${method} ${table} failed: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function loadPersonas() {
  return JSON.parse(readFileSync(path.join(ROOT, 'scripts', 'synthetic_students', 'personas.json'), 'utf8')).personas
}

async function getProjectId() {
  const [project] = await rest('GET', 'projects', { qs: `select=id&slug=eq.${PROJECT_SLUG}` })
  if (!project) throw new Error(`${PROJECT_SLUG} project not found`)
  return project.id
}

async function findUserIdByEmail(key, email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const { users } = await res.json()
  return (users ?? []).find((u) => u.email.toLowerCase() === email.toLowerCase())?.id ?? null
}

async function provision() {
  const key = serviceKey()
  const personas = loadPersonas()
  for (const p of personas) {
    const email = p.email.toLowerCase()
    const existingId = await findUserIdByEmail(key, email)
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
    if (existingId) {
      // Earlier failed sign-in attempt (generate_link) auto-created this
      // user unconfirmed -- PUT to set email_confirm now that it exists.
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existingId}`, {
        method: 'PUT', headers, body: JSON.stringify({ email_confirm: true }),
      })
      console.log(res.ok ? `confirmed (already existed): ${email}` : `FAILED to confirm ${email}: ${res.status} ${await res.text()}`)
    } else {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST', headers, body: JSON.stringify({ email, email_confirm: true }),
      })
      console.log(res.ok ? `provisioned: ${email}` : `FAILED to provision ${email}: ${res.status} ${await res.text()}`)
    }
  }
}

async function add() {
  const projectId = await getProjectId()
  const personas = loadPersonas()
  for (const p of personas) {
    await rest('POST', 'project_join_rules', {
      body: { project_id: projectId, rule_type: 'email', value: p.email.toLowerCase(), role: 'contributor' },
      prefer: 'resolution=ignore-duplicates,return=minimal',
    })
    console.log('join rule ready:', p.email)
  }
}

async function remove() {
  const projectId = await getProjectId()
  const personas = loadPersonas()
  for (const p of personas) {
    await rest('DELETE', 'project_join_rules', {
      qs: `project_id=eq.${projectId}&rule_type=eq.email&value=eq.${encodeURIComponent(p.email.toLowerCase())}`,
    })
    console.log('join rule removed:', p.email)
  }
}

async function list() {
  const projectId = await getProjectId()
  const rows = await rest('GET', 'project_join_rules', { qs: `select=*&project_id=eq.${projectId}&order=created_at` })
  console.log(JSON.stringify(rows, null, 2))
}

const cmd = process.argv[2]
const fn = { provision, add, remove, list }[cmd]
if (!fn) { console.error('Usage: node manage_join_rules.mjs <provision|add|remove|list>'); process.exit(1) }
fn().catch((e) => { console.error(e); process.exit(1) })
