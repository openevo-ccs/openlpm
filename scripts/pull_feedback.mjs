#!/usr/bin/env node
// Reads real submitted in-app Feedback directly, the way ask-eva-design-
// session's sync_feedback.py / session_timeline.py do for Ask Eva -- a
// standalone script using a real, standing, already-scoped-for-exactly-
// this-purpose credential (the Supabase project's own service_role key,
// which bypasses RLS by design -- see migration 026's own comment: "meant
// to be read by whoever maintains OpenLPM via the project's own
// service_role key... no new credential to create"), not a per-session
// database privilege grant to some other account. Never run through the
// app itself and never touches any user's `role` column -- there's
// nothing to revoke afterward, unlike the admin-role-grant approach tried
// and correctly blocked earlier (2026-09-30): that mutated real account
// state for a one-off read; this reads with a credential built for
// exactly this and changes nothing.
//
// Setup (one time): put the project's service_role key (Supabase dashboard
// -> Project Settings -> API -> service_role, "secret" key) in
// .supabase-secrets/service-role-key.txt -- gitignored, matching this
// repo's existing convention for access-token.txt/db-pwassword.txt in the
// same folder. Never paste this key into chat or a committed file.
//
// Usage:
//   node scripts/pull_feedback.mjs [--recent N] [--open-only] [--all] [--id <uuid>]
//   node scripts/pull_feedback.mjs --screenshot <screenshot_path> [--out <path>]
//     (screenshot_path is exactly the value a listing prints, e.g. "abcd.../ef01....jpg")

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SECRET_PATH = path.join(ROOT, '.supabase-secrets', 'service-role-key.txt')
const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'

function loadServiceRoleKey() {
  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (fromEnv) return fromEnv.trim()
  if (existsSync(SECRET_PATH)) return readFileSync(SECRET_PATH, 'utf8').trim()
  console.error(
    `No service_role key found.\n\n` +
      `Get it once from the Supabase dashboard -> Project Settings -> API -> ` +
      `"service_role" secret key, then either:\n` +
      `  - save it to ${SECRET_PATH} (gitignored, matches this repo's existing\n` +
      `    .supabase-secrets/ convention), or\n` +
      `  - set SUPABASE_SERVICE_ROLE_KEY in your shell for this one run.\n\n` +
      `Never paste this key into chat or a committed file -- it bypasses RLS entirely.`
  )
  process.exit(1)
}

async function sb(pathAndQuery, key, init = {}) {
  const res = await fetch(`${SUPABASE_URL}${pathAndQuery}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...init.headers },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`)
  return res
}

function parseArgs(argv) {
  const args = { recent: 20, openOnly: false, all: false, id: null, screenshot: null, out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--recent') args.recent = Number(argv[++i])
    else if (a === '--open-only') args.openOnly = true
    else if (a === '--all') args.all = true
    else if (a === '--id') args.id = argv[++i]
    else if (a === '--screenshot') args.screenshot = argv[++i]
    else if (a === '--out') args.out = argv[++i]
  }
  return args
}

function fmt(entry) {
  const ctx = entry.context || {}
  const lines = []
  lines.push(`── ${entry.id} ${'─'.repeat(Math.max(0, 60 - entry.id.length))}`)
  lines.push(`${entry.created_at}  [${entry.tag}]  status=${entry.status}`)
  lines.push(`from: ${entry.submitter?.name ?? '?'} <${entry.submitter?.email ?? '?'}>` +
    (entry.project ? `  project: ${entry.project.name} (${entry.project.slug})` : '  project: (none)'))
  if (ctx.page_title || ctx.path) lines.push(`page: "${ctx.page_title ?? ''}" (${ctx.path ?? ''})`)
  if (entry.comment) lines.push(`comment: ${entry.comment}`)
  if (entry.screenshot_path) lines.push(`screenshot: yes (${entry.screenshot_path}) -- fetch with --screenshot "${entry.screenshot_path}"`)
  if (Array.isArray(ctx.recent_pages) && ctx.recent_pages.length) {
    lines.push(`recent pages: ${ctx.recent_pages.map((p) => p.path).join(' -> ')}`)
  }
  if (ctx.visible_text) {
    const excerpt = ctx.visible_text.length > 300 ? ctx.visible_text.slice(0, 300) + '…' : ctx.visible_text
    lines.push(`on screen: ${excerpt}`)
  }
  return lines.join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const key = loadServiceRoleKey()

  if (args.screenshot) {
    const res = await sb(`/storage/v1/object/feedback-screenshots/${args.screenshot}`, key)
    const buf = Buffer.from(await res.arrayBuffer())
    const safeName = args.screenshot.replace(/[\/\\]/g, '-')
    const out = args.out || path.join(process.cwd(), `feedback-screenshot-${safeName}`)
    writeFileSync(out, buf)
    console.log(`Saved ${buf.length} bytes to ${out}`)
    return
  }

  let query = `/rest/v1/feedback?select=*,submitter:users(name,email),project:projects(name,slug)&order=created_at.desc`
  if (!args.all) query += `&limit=${args.id ? 1 : args.recent}`
  if (args.openOnly) query += `&status=eq.open`
  if (args.id) query += `&id=eq.${args.id}`

  const res = await sb(query, key)
  const rows = await res.json()

  if (rows.length === 0) {
    console.log(args.openOnly ? 'No open feedback.' : 'No feedback found.')
    return
  }
  console.log(`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}${args.openOnly ? ' (open only)' : ''}:\n`)
  for (const entry of rows) console.log(fmt(entry) + '\n')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
