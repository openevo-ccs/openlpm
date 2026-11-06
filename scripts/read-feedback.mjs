#!/usr/bin/env node
// Reads real, live feedback rows out of the OpenLPM database for a Claude
// Code session to act on -- the whole point of the feedback table (see
// supabase/migrations/025_feedback.sql) being real, structured data rather
// than a chat transcript. Deliberately NOT the anon key the app itself uses
// (feedback.md has no SELECT policy at all -- feedback isn't meant to be
// browsable by regular users), and NOT a new restricted database role
// either -- unlike the LocalLPM detour this replaced, this reuses a
// credential that already exists for every Supabase project from day one:
// Project Settings -> API -> "service_role" secret key. Copy it once into
// a local .env file (OPENLPM_SERVICE_ROLE_KEY=..., OPENLPM_URL=... --
// same values already in .env.local, just the service_role key instead of
// the anon key), never committed. Nothing here blocks on that key existing
// -- the feature works without it; this script is only how a future
// session reads what accumulated.
//
// Usage: node scripts/read-feedback.mjs [--tag Problem|Request|Other] [--since 2026-09-01] [--limit 50]

import { createClient } from '@supabase/supabase-js'

const url = process.env.OPENLPM_URL
const serviceRoleKey = process.env.OPENLPM_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error(
    'Missing OPENLPM_URL / OPENLPM_SERVICE_ROLE_KEY.\n' +
    'Get the service_role key from the Supabase dashboard: Project Settings -> API.\n' +
    'This key bypasses Row Level Security -- keep it out of git, same discipline as any other API key in this ecosystem.'
  )
  process.exit(1)
}

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const tag = flag('tag')
const since = flag('since')
const limit = Number(flag('limit') ?? 50)

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

let query = supabase
  .from('feedback')
  .select('id, tag, comment, context, screenshot_path, project_id, created_at, users:user_id(name, email)')
  .order('created_at', { ascending: false })
  .limit(limit)

if (tag) query = query.eq('tag', tag)
if (since) query = query.gte('created_at', since)

const { data, error } = await query

// From here on, never call process.exit() directly. createClient() above
// leaves an async handle open (an auth/realtime timer, even with
// persistSession: false and no channel ever opened) that races a forced
// exit on Windows: reproduced live 2026-10-09, "Assertion failed:
// !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94" --
// right after the real output already printed. Confirmed by isolating it:
// the same query with no explicit exit call completes cleanly every time;
// only the process.exit() calls crashed. Set process.exitCode instead and
// let the event loop drain on its own -- a few ms slower, never crashes.
if (error) {
  console.error('Query failed:', error.message)
  process.exitCode = 1
} else if (!data || data.length === 0) {
  console.log('No feedback rows match.')
} else {
  for (const row of data) {
    console.log(`\n[${row.created_at}] ${row.tag}${row.project_id ? ` (project ${row.project_id})` : ''}`)
    console.log(`  from: ${row.users?.name ?? 'unknown'} <${row.users?.email ?? '?'}>`)
    console.log(`  page: ${row.context?.page ?? '?'} (${row.context?.path ?? '?'})`)
    if (row.comment) console.log(`  comment: ${row.comment}`)
    if (row.screenshot_path) {
      // A signed URL, not the bucket's public URL -- the bucket is private
      // (migration 025), so this is the only way to actually view the image.
      const { data: signed } = await supabase.storage
        .from('feedback-screenshots')
        .createSignedUrl(row.screenshot_path, 3600)
      if (signed?.signedUrl) console.log(`  screenshot: ${signed.signedUrl} (expires in 1h)`)
    }
  }
}
