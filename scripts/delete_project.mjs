#!/usr/bin/env node
// Permanently deletes one project via the service_role key -- the scripted
// counterpart to the real "Delete this project" buttons now in the app
// itself (Dashboard page's Danger Zone for a project's own owner, the admin
// Projects section for any project), for a Claude Code session, which has
// no signed-in browser session of its own to click either of those with.
// Same shape as resolve_feedback.mjs/051: a standing, narrowly-scoped
// service_role grant (054) rather than a one-off privilege escalation.
//
// This is real, irreversible deletion of a real project and everything in
// it (every project-scoped table cascades on projects.id -- see migration
// 052's own comment). Only ever run this against a project Dustin has
// explicitly directed or agreed to delete in the current conversation --
// never as a standing "clean up whatever looks like clutter" sweep, and
// never without saying plainly, in that same conversation, exactly which
// project (name + slug) is about to go. Dry-run (the default) shows what
// would be deleted without deleting anything; --yes actually does it.
//
// Usage:
//   node scripts/delete_project.mjs --slug <slug>          (dry run)
//   node scripts/delete_project.mjs --slug <slug> --yes    (actually deletes)

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
  console.error(`No service_role key found. See resolve_feedback.mjs's own header for where this lives.`)
  process.exit(1)
}

function parseArgs(argv) {
  let slug = null
  let yes = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--slug') slug = argv[++i]
    else if (argv[i] === '--yes') yes = true
  }
  return { slug, yes }
}

async function main() {
  const { slug, yes } = parseArgs(process.argv.slice(2))
  if (!slug) {
    console.error('Usage: node scripts/delete_project.mjs --slug <slug> [--yes]')
    process.exit(1)
  }

  const key = loadServiceRoleKey()
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

  const projRes = await fetch(
    `${SUPABASE_URL}/rest/v1/projects?slug=eq.${encodeURIComponent(slug)}&select=id,name,slug,parent_project_id,is_private,created_at`,
    { headers }
  )
  if (!projRes.ok) {
    console.error(`${projRes.status} ${projRes.statusText}: ${await projRes.text()}`)
    process.exit(1)
  }
  const [project] = await projRes.json()
  if (!project) {
    console.log(`No project with slug "${slug}" -- nothing to do.`)
    return
  }

  const childRes = await fetch(
    `${SUPABASE_URL}/rest/v1/projects?parent_project_id=eq.${project.id}&select=id,name,slug`,
    { headers }
  )
  const children = childRes.ok ? await childRes.json() : []

  console.log(`Project: ${project.name} (${project.slug})`)
  console.log(`  id: ${project.id}`)
  console.log(`  private: ${project.is_private}, created: ${project.created_at}`)
  console.log(`  sub-projects inside it: ${children.length}`)
  if (children.length > 0) {
    for (const c of children) console.log(`    - ${c.name} (${c.slug})`)
    console.log(
      `\nRefusing to delete -- ${children.length} sub-project(s) would be orphaned (made top-level), not deleted ` +
        `(projects.parent_project_id is ON DELETE SET NULL, not CASCADE -- see migration 052's own comment). ` +
        `Delete or re-parent them first.`
    )
    process.exit(1)
  }

  console.log(
    `\nThis script can't preview member or content counts (service_role only has SELECT on projects itself, ` +
      `not project_members/lpm_data_objects/etc. -- deliberately narrow, see migration 054's own comment). ` +
      `Check the admin Projects section or this project's own Dashboard page first if you need those numbers ` +
      `before confirming.`
  )

  if (!yes) {
    console.log(`\nDry run only -- nothing deleted. Re-run with --yes to actually delete this project.`)
    return
  }

  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${project.id}`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=representation' },
  })
  if (!delRes.ok) {
    console.error(`${delRes.status} ${delRes.statusText}: ${await delRes.text()}`)
    process.exit(1)
  }
  const deleted = await delRes.json()
  console.log(`\nDeleted: ${deleted.map((r) => `${r.name} (${r.slug})`).join(', ') || '(no rows returned)'}`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
