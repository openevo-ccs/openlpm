#!/usr/bin/env node
// Carries out a request to delete a person's account and data (GDPR Art. 17). The request itself
// is filed by the person on the Profile page and shows in the admin Accounts page with a due date
// one month after it was filed (table data_deletion_requests, migration 238).
//
// Usage:
//   node scripts/execute_data_deletion.mjs --list                    open requests, earliest due date first
//   node scripts/execute_data_deletion.mjs --request <id>            show what would be deleted (changes nothing)
//   node scripts/execute_data_deletion.mjs --request <id> --execute  delete, then close the request
//   node scripts/execute_data_deletion.mjs --request <id> --decline "reason"   close it without deleting
//
// What --execute does, in this order:
//   1. Deletes the person's feedback screenshots from storage (they can show a name or an email).
//   2. Clears the page text and page list saved with their feedback. The comment text stays without
//      the name (the feedback.user_id foreign key sets itself to NULL). Use --drop-feedback to delete
//      the feedback rows as well, when the person asked for that.
//   2b. Deletes saved prompts, discussion posts and activity-log rows. The database would only clear the
//      name on these and keep the text, so they are deleted first.
//   3. Deletes the account through the Supabase admin API. Work entries, activity timeline, notebooks,
//      memberships, favourites, groups and privacy settings are keyed to the account and go with it.
//      Contributions to shared project content keep their text and lose the name.
//   4. Closes the request (status done) and empties the reason and note, so only the dates remain.
//
// The script prints the person's email address before step 3 so a confirmation can be sent, because
// the address is gone afterwards. Send the confirmation before or right after --execute, and write
// down in the request note what was and was not deleted. Copies outside OpenLPM (documents handed in
// on Moodle, text an AI assistant read earlier in a working session) are not reachable from here. Say
// so in the confirmation when they apply.
//
// Uses the service key from .supabase-secrets/service-role-key.txt (never printed).

import { SUPABASE_URL, serviceKey } from './jena_semester/lib.mjs'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const has = (name) => args.includes(`--${name}`)

// [table, column that holds the person's id] for tables that keep the row when an account is deleted.
// Re-check with the foreign-key query in the migration 238 pull request when a new table that stores
// people's own text is added.
const PERSONAL_TEXT_TABLES = [
  ['prompt_experiments', 'created_by'],
  ['discussion_posts', 'user_id'],
  ['activity_log', 'user_id'],
]

const key = serviceKey()
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

async function rest(method, pathAndQuery, body) {
  const res = await fetch(`${SUPABASE_URL}${pathAndQuery}`, {
    method,
    headers: { ...headers, Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${pathAndQuery} failed: ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  if (has('list')) {
    const rows = await rest(
      'GET',
      '/rest/v1/data_deletion_requests?status=eq.open&select=id,requested_at,due_at,user:user_id(name,email)&order=due_at.asc',
    )
    if (!rows.length) return console.log('No open deletion requests.')
    for (const r of rows) {
      const overdue = new Date(r.due_at) < new Date() ? '  OVERDUE' : ''
      console.log(`${r.id}  due ${r.due_at.slice(0, 10)}${overdue}  ${r.user?.name ?? '?'} <${r.user?.email ?? '?'}>`)
    }
    return
  }

  const id = flag('request')
  if (!id) {
    console.error('Usage: --list | --request <id> [--execute | --decline "reason"] [--drop-feedback]')
    process.exitCode = 1
    return
  }

  const [req] = await rest('GET', `/rest/v1/data_deletion_requests?id=eq.${id}&select=*,user:user_id(id,name,email)`)
  if (!req) throw new Error(`No request ${id}`)
  if (req.status !== 'open') throw new Error(`Request ${id} is already ${req.status}`)
  if (!req.user_id) throw new Error(`Request ${id} has no account attached`)
  const userId = req.user_id

  if (has('decline')) {
    const note = flag('decline') ?? ''
    await rest('PATCH', `/rest/v1/data_deletion_requests?id=eq.${id}`, {
      status: 'declined',
      handled_at: new Date().toISOString(),
      handling_note: note,
    })
    console.log(`Declined. Tell ${req.user.email} why: Art. 12(4) GDPR requires the reasons and the right to complain.`)
    return
  }

  const count = async (table, col) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${userId}&select=id`, {
      headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
    })
    return Number((res.headers.get('content-range') ?? '*/0').split('/')[1])
  }
  const feedbackRows = await rest('GET', `/rest/v1/feedback?user_id=eq.${userId}&select=id,screenshot_path`)
  console.log(`Request ${id}, filed ${req.requested_at.slice(0, 10)}, due ${req.due_at.slice(0, 10)}`)
  console.log(`Person: ${req.user.name ?? '?'} <${req.user.email}>   (send the confirmation to this address)`)
  console.log(`Will delete: work entries ${await count('student_work_entries', 'user_id')}, activity events ${await count('student_activity_events', 'user_id')}, saved prompts ${await count('prompt_experiments', 'created_by')}, feedback rows ${feedbackRows.length} (screenshots ${feedbackRows.filter((f) => f.screenshot_path).length})`)

  if (!has('execute')) {
    console.log('\nNothing changed. Add --execute to delete.')
    return
  }

  // 1. Screenshots.
  const paths = feedbackRows.map((f) => f.screenshot_path).filter(Boolean)
  if (paths.length) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/feedback-screenshots`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ prefixes: paths }),
    })
    if (!res.ok) throw new Error(`Deleting screenshots failed: ${res.status} ${await res.text()}`)
    console.log(`Deleted ${paths.length} screenshot(s).`)
  }

  // 2. Feedback rows: drop them, or keep the comment without name, page text or page list.
  if (has('drop-feedback')) {
    if (feedbackRows.length) await rest('DELETE', `/rest/v1/feedback?user_id=eq.${userId}`)
    console.log(`Deleted ${feedbackRows.length} feedback row(s).`)
  } else if (feedbackRows.length) {
    await rest('PATCH', `/rest/v1/feedback?user_id=eq.${userId}`, { context: {}, screenshot_path: null })
    console.log(`Cleared page text and screenshot links on ${feedbackRows.length} feedback row(s); comments stay without a name.`)
  }

  // 2b. Tables where the database only clears the name when an account goes (foreign key SET NULL,
  //     checked against the live database 2026-11-09) but the row holds the person's own words.
  //     Delete these rows first. Contributions to shared project content (curriculum entries,
  //     frameworks, theories and so on) keep their text and lose the name by themselves.
  for (const [table, col] of PERSONAL_TEXT_TABLES) {
    const gone = await rest('DELETE', `/rest/v1/${table}?${col}=eq.${userId}`)
    console.log(`Deleted ${gone.length} row(s) from ${table}.`)
  }

  // 3. The account. Everything keyed to it goes with it.
  const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers })
  if (!del.ok) throw new Error(`Deleting the account failed: ${del.status} ${await del.text()}`)
  console.log('Deleted the account and everything keyed to it.')

  // 4. Close the request with no personal details left on it.
  await rest('PATCH', `/rest/v1/data_deletion_requests?id=eq.${id}`, {
    status: 'done',
    handled_at: new Date().toISOString(),
    reason: null,
    handling_note: has('drop-feedback') ? 'Account and feedback deleted.' : 'Account deleted; feedback comments kept without a name.',
  })
  console.log('Request closed. Send the person their confirmation now.')
}

main().catch((e) => {
  console.error(e.message)
  process.exitCode = 1
})
