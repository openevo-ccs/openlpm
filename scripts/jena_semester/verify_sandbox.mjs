#!/usr/bin/env node
// Read-only check that the sandbox space matches the real space row for row.
import { getProjectId, REAL_SLUG, rest, SANDBOX_SLUG } from './lib.mjs'
const real = await getProjectId(REAL_SLUG)
const sb = await getProjectId(SANDBOX_SLUG)
const count = async (table, col, id) => {
  const rows = await rest('GET', table, { qs: `select=id&${col}=eq.${id}&limit=5000` })
  return rows.length
}
for (const t of ['lpm_schema_elements', 'lpm_data_objects', 'lpm_connections', 'lpm_threads', 'lpm_concept_relations', 'method_lernziel_links', 'method_basiskonzept_links', 'project_source_declarations']) {
  const a = await count(t, 'project_id', real), b = await count(t, 'project_id', sb)
  console.log(t.padEnd(30), String(a).padStart(5), String(b).padStart(5), a === b ? 'ok' : 'DIFFERENT')
}
const [proj] = await rest('GET', 'projects', { qs: `select=slug,name,is_private,groups_enabled,student_view_template,parent_project_id&id=eq.${sb}` })
console.log(proj)
console.log(await rest('GET', 'project_dashboard_views', { qs: `select=name,kind,template_id,is_forced&project_id=eq.${sb}` }))
console.log((await rest('GET', 'branches', { qs: `select=slug,is_trunk&project_id=eq.${sb}` })))
console.log((await rest('GET', 'project_members', { qs: `select=role&project_id=eq.${sb}` })).map((m) => m.role))
for (const t of ['student_work_entries', 'student_activity_events']) console.log(t, 'readable, rows:', (await rest('GET', t, { qs: 'select=id&limit=1' })).length)
