#!/usr/bin/env node
// Reads real, live lpm_data_objects rows for a given project out of the
// OpenLPM database -- read-only, same auth/safety convention as
// read-feedback.mjs (service_role key, never committed, no mutation).
// Built for comparing a project's live curriculum content against a real
// source document (e.g. reconciling evomentor-thuringia's MNT content
// against a new Lehrplan revision) without guessing at what's already live.
//
// Usage:
//   node scripts/read-project-content.mjs --project evomentor-thuringia [--subject MNT] [--grade 5/6] [--format json|list] [--limit 500]

import { createClient } from '@supabase/supabase-js'

const url = process.env.OPENLPM_URL
const serviceRoleKey = process.env.OPENLPM_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error(
    'Missing OPENLPM_URL / OPENLPM_SERVICE_ROLE_KEY.\n' +
    'Get the service_role key from the Supabase dashboard: Project Settings -> API.'
  )
  process.exit(1)
}

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const projectSlug = flag('project')
const subject = flag('subject')
const grade = flag('grade')
const format = flag('format') ?? 'list'
const limit = Number(flag('limit') ?? 500)

if (!projectSlug) {
  console.error('Usage: node scripts/read-project-content.mjs --project <slug> [--subject X] [--grade Y] [--format json|list]')
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
console.error(`# ${project.description ?? ''}`)

let query = supabase
  .from('lpm_data_objects')
  .select('id, object_type, title, description, grade_band, subject_area, content, status, created_at, updated_at')
  .eq('project_id', project.id)
  .order('grade_band', { ascending: true })
  .order('subject_area', { ascending: true })
  .order('title', { ascending: true })
  .limit(limit)

if (subject) query = query.ilike('subject_area', `%${subject}%`)
if (grade) query = query.eq('grade_band', grade)

const { data, error } = await query
if (error) {
  console.error('Query failed:', error.message)
  process.exit(1)
}

console.error(`# ${data?.length ?? 0} rows`)

if (format === 'json') {
  console.log(JSON.stringify(data, null, 2))
  process.exit(0)
}

for (const row of data ?? []) {
  console.log(`\n[${row.object_type}] ${row.id}`)
  console.log(`  title: ${row.title}`)
  if (row.description) console.log(`  description: ${row.description}`)
  console.log(`  grade_band: ${row.grade_band ?? '?'}  subject_area: ${row.subject_area ?? '?'}  status: ${row.status}`)
  const orig = row.content?.originaltext
  if (orig) console.log(`  originaltext: ${orig}`)
  const thema = row.content?.thema ?? row.content?.modul
  if (thema) console.log(`  thema/modul: ${thema}`)
}
