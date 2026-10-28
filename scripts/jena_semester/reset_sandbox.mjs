#!/usr/bin/env node
// Resets the sandbox space between synthetic runs: removes every synthetic
// student's work, timeline, stars and groups, then (with --recopy) copies the
// Thuringia content over again from the real space. Refuses to run against
// any space other than the sandbox.
//
//   node scripts/jena_semester/reset_sandbox.mjs [--recopy]

import { getProjectId, has, REAL_SLUG, rest, SANDBOX_SLUG, serviceKey, SUPABASE_URL } from './lib.mjs'

const sandboxId = await getProjectId(SANDBOX_SLUG)
if (!sandboxId || SANDBOX_SLUG === REAL_SLUG) throw new Error('refusing: not the sandbox')

// Stars are not tied to the project row, so remove the synthetic members' stars too
// (contributors only; the owners' own stars are left alone).
const members = await rest('GET', 'project_members', { qs: `select=user_id&project_id=eq.${sandboxId}&role=eq.contributor` })
if (members.length) {
  await rest('DELETE', 'user_favorite_learning_goals', { qs: `user_id=in.(${members.map((m) => m.user_id).join(',')})` })
  console.log('cleared stars of', members.length, 'synthetic members')
}

for (const table of ['student_work_entries', 'student_activity_events', 'project_groups']) {
  await rest('DELETE', table, { qs: `project_id=eq.${sandboxId}` })
  console.log('cleared', table)
}

if (has('recopy')) {
  const realId = await getProjectId(REAL_SLUG)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/clone_project_content`, {
    method: 'POST',
    headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_source: realId, p_target: sandboxId }),
  })
  if (!res.ok) throw new Error(`clone failed: ${res.status} ${await res.text()}`)
  console.log('content re-copied:', JSON.stringify(await res.json()))
}
