// Shared helpers for the Jena semester scripts (sandbox cohort provisioning,
// applying synthetic students' decisions, exporting their hand-ins).
// Credentials are read from files by this module and never printed. The
// worktree has no secrets folder of its own, so it falls back to the main
// checkout's copy three levels up (.claude/worktrees/<name> -> repo root).

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

export const SELF = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.dirname(path.dirname(SELF))
export const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'
export const PROJECT_REF = 'tfynvjjxyluzorigyfsp'
export const SANDBOX_SLUG = 'evomentor-thuringia-sandbox'
export const REAL_SLUG = 'evomentor-thuringia'

function secretPath(...parts) {
  const candidates = [ROOT, path.resolve(ROOT, '..', '..', '..')]
  for (const base of candidates) {
    const p = path.join(base, ...parts)
    if (existsSync(p)) return p
  }
  throw new Error(`missing ${parts.join('/')} (looked in ${candidates.join(' and ')})`)
}

export function serviceKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? readFileSync(secretPath('.supabase-secrets', 'service-role-key.txt'), 'utf8')).trim()
}

export function anonKey() {
  const env = readFileSync(secretPath('.env.local'), 'utf8')
  return env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()
}

export const SYNTH_EMAIL = (emailLocal) => `dustin+${emailLocal}@globalesd.org`

/** Plain data-API call with the service role (bypasses RLS). */
export async function rest(method, table, { qs = '', body, prefer } = {}) {
  const key = serviceKey()
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  if (prefer) headers.Prefer = prefer
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) throw new Error(`${method} ${table} failed: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function authAdmin(method, subpath, body) {
  const key = serviceKey()
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${subpath}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`auth admin ${method} ${subpath} failed: ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** A session for an existing account, minted without ever touching its password. Waits and retries when the auth service rate-limits. */
export async function sessionFor(email, attempt = 0) {
  try {
    return await mintSession(email)
  } catch (e) {
    if (/429|rate limit/i.test(String(e.message)) && attempt < 5) {
      await sleep(60_000)
      return sessionFor(email, attempt + 1)
    }
    throw e
  }
}

async function mintSession(email) {
  const gen = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  })
  if (!gen.ok) throw new Error(`generate_link failed for ${email}: ${gen.status} ${await gen.text()}`)
  const otp = (await gen.json()).email_otp
  const ver = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token: otp, email }),
  })
  if (!ver.ok) throw new Error(`verify failed for ${email}: ${ver.status} ${await ver.text()}`)
  return ver.json()
}

/** A supabase-js client acting as that user, so every call goes through the same row-level security a student's browser does. */
export async function clientFor(email) {
  const session = await sessionFor(email)
  const client = createClient(SUPABASE_URL, anonKey(), { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
  if (error) throw error
  return { client, userId: session.user.id, session }
}

export async function getProjectId(slug) {
  const [p] = await rest('GET', 'projects', { qs: `select=id&slug=eq.${slug}` })
  if (!p) throw new Error(`project ${slug} not found`)
  return p.id
}

export function loadJson(...parts) {
  return JSON.parse(readFileSync(path.join(SELF, ...parts), 'utf8'))
}

export const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] ?? true : fallback
}
export const has = (name) => process.argv.includes(`--${name}`)
