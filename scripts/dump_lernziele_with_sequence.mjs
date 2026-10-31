#!/usr/bin/env node
// Read-only dump of every Lernziel row of one project, including the columns
// scripts/read-project-content.mjs leaves out (curriculum_sequence, status,
// branch_id). Input for scripts/generate_lernziele_order_migration.py.
//
// Usage (same environment variables as read-project-content.mjs):
//   node scripts/dump_lernziele_with_sequence.mjs --project evomentor-thuringia > live.json
//
// It only reads. It never writes to the database.

import { createClient } from '@supabase/supabase-js'

const url = process.env.OPENLPM_URL
const key = process.env.OPENLPM_SERVICE_ROLE_KEY
const args = process.argv.slice(2)
const slug = args[args.indexOf('--project') + 1]

if (!url || !key || args.indexOf('--project') < 0 || !slug) {
  console.error('Usage: OPENLPM_URL=... OPENLPM_SERVICE_ROLE_KEY=... node scripts/dump_lernziele_with_sequence.mjs --project <slug>')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const { data: project, error: pe } = await supabase.from('projects').select('id, slug').eq('slug', slug).maybeSingle()
if (pe || !project) {
  console.error('Project lookup failed:', pe?.message ?? `no project "${slug}"`)
  process.exit(1)
}

const rows = []
const PAGE = 500
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from('lpm_data_objects')
    .select('id, project_id, branch_id, object_type, title, description, grade_band, status, curriculum_sequence, content')
    .eq('project_id', project.id)
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1)
  if (error) {
    console.error('Read failed:', error.message)
    process.exit(1)
  }
  rows.push(...data)
  if (data.length < PAGE) break
}

console.error(`# ${slug} (${project.id}): ${rows.length} rows`)
process.stdout.write(JSON.stringify(rows, null, 1))
