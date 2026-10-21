#!/usr/bin/env node
// Reads real, live curriculum_repository_records rows for a given project
// -- read-only, same auth/safety convention as read-feedback.mjs and
// read-project-content.mjs.
//
// Usage:
//   node scripts/read-curriculum-repository.mjs --project thuringia-curriculum-repository [--contains text]

import { createClient } from '@supabase/supabase-js'

const url = process.env.OPENLPM_URL
const serviceRoleKey = process.env.OPENLPM_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Missing OPENLPM_URL / OPENLPM_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const projectSlug = flag('project')
const contains = flag('contains')

if (!projectSlug) {
  console.error('Usage: node scripts/read-curriculum-repository.mjs --project <slug> [--contains text]')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

const { data: project, error: projectError } = await supabase
  .from('projects')
  .select('id, slug, name, description')
  .eq('slug', projectSlug)
  .maybeSingle()

if (projectError) {
  console.error('Project lookup failed:', projectError.message)
  process.exit(1)
}
if (!project) {
  console.error(`No project found with slug "${projectSlug}".`)
  process.exit(1)
}

console.error(`# Project: ${project.name} (${project.id})`)

let query = supabase
  .from('curriculum_repository_records')
  .select('id, record_type, jurisdiction, source_repo, source_record_id, title, access_tier, created_at, updated_at')
  .eq('project_id', project.id)
  .order('record_type', { ascending: true })
  .order('title', { ascending: true })
  .limit(500)

const { data, error } = await query
if (error) {
  console.error('Query failed:', error.message)
  process.exit(1)
}

console.error(`# ${data?.length ?? 0} rows total`)

const filtered = contains
  ? (data ?? []).filter(r => (r.title + ' ' + r.source_record_id).toLowerCase().includes(contains.toLowerCase()))
  : (data ?? [])

for (const row of filtered) {
  console.log(`[${row.record_type}] ${row.source_record_id} :: ${row.title} (updated ${row.updated_at})`)
}
