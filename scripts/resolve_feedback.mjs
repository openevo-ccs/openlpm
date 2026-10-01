#!/usr/bin/env node
// Marks real submitted Feedback rows resolved (or reopens them), using the
// same standing service_role credential pull_feedback.mjs already reads
// with -- see that script's own header for why this key and not a new
// credential or a per-user privilege grant. Needs migration 051's narrow
// `GRANT UPDATE (status) ON feedback TO service_role` to actually be live;
// without it this fails with "permission denied for table feedback", same
// as pull_feedback.mjs did before migrations 047/048.
//
// This changes real status on real submitted feedback. Only mark something
// resolved after it's actually been verified live (per
// openlpm-design-session's Step 5) -- never as a bulk "assume these are all
// fine" sweep. Reversible (--status open undoes it), but still real state
// a real person (Dustin, or whoever else reads /dashboard/admin/feedback)
// will read as "this is done."
//
// Usage:
//   node scripts/resolve_feedback.mjs --id <uuid> [--id <uuid> ...] [--status resolved|open]
//   node scripts/resolve_feedback.mjs --id <uuid1> --id <uuid2> --status open   (reopen)

import { readFileSync, existsSync } from 'node:fs'
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
      `"service_role" secret key, then either save it to ${SECRET_PATH} or set ` +
      `SUPABASE_SERVICE_ROLE_KEY for this one run.`
  )
  process.exit(1)
}

function parseArgs(argv) {
  const ids = []
  let status = 'resolved'
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--id') ids.push(argv[++i])
    else if (a === '--status') status = argv[++i]
  }
  return { ids, status }
}

async function main() {
  const { ids, status } = parseArgs(process.argv.slice(2))
  if (ids.length === 0) {
    console.error('Usage: node scripts/resolve_feedback.mjs --id <uuid> [--id <uuid> ...] [--status resolved|open]')
    process.exit(1)
  }
  if (status !== 'resolved' && status !== 'open') {
    console.error(`--status must be "resolved" or "open", got "${status}"`)
    process.exit(1)
  }

  const key = loadServiceRoleKey()
  const idList = ids.join(',')

  const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback?id=in.(${idList})`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ status }),
  })

  if (!res.ok) {
    console.error(`${res.status} ${res.statusText}: ${await res.text()}`)
    process.exit(1)
  }

  const rows = await res.json()
  if (rows.length === 0) {
    console.log('No matching feedback rows found -- check the id(s).')
    return
  }
  console.log(`Set status=${status} on ${rows.length} row${rows.length === 1 ? '' : 's'}:`)
  for (const r of rows) console.log(`  ${r.id}  (${r.tag})`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
