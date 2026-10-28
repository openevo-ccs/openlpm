#!/usr/bin/env node
// Creates (or removes) the synthetic student accounts for the sandbox space
// and makes them members of it, the way a real student ends up after the
// join page: role contributor, joined_via 'self_join_rule' (that value is what
// assigns them the forced Sandbox view).
//
// Accounts are plus-addresses on Dustin's own domain (dustin+sandbox-pNN@...),
// created through the admin API with the address pre-confirmed, so no email is
// ever sent. Every account is tagged in its user metadata as synthetic.
//
// Usage:
//   node scripts/jena_semester/provision_cohort.mjs add [--limit N]
//   node scripts/jena_semester/provision_cohort.mjs remove
//   node scripts/jena_semester/provision_cohort.mjs list

import { authAdmin, getProjectId, loadJson, rest, SANDBOX_SLUG, SYNTH_EMAIL, flag } from './lib.mjs'

const personas = () => loadJson('cohort_personas.json').personas

async function findUserByEmail(email) {
  const rows = await rest('GET', 'users', { qs: `select=id,email,name&email=eq.${encodeURIComponent(email)}` })
  return rows[0] ?? null
}

async function add() {
  const projectId = await getProjectId(SANDBOX_SLUG)
  const limit = Number(flag('limit', 1000))
  for (const p of personas().slice(0, limit)) {
    const email = SYNTH_EMAIL(p.email_local)
    let user = await findUserByEmail(email)
    if (!user) {
      await authAdmin('POST', 'users', {
        email,
        email_confirm: true,
        user_metadata: { full_name: `${p.first_name} ${p.last_name}`, synthetic: true, batch_id: 'jena-ws2026-sandbox-cohort-1' },
      })
      // The sync trigger (migration 003) writes the users row; poll briefly.
      for (let i = 0; i < 10 && !user; i++) {
        user = await findUserByEmail(email)
        if (!user) await new Promise((r) => setTimeout(r, 300))
      }
      if (!user) throw new Error(`users row for ${email} did not appear`)
    }
    await rest('POST', 'project_members', {
      body: { project_id: projectId, user_id: user.id, role: 'contributor', joined_via: 'self_join_rule' },
      prefer: 'resolution=ignore-duplicates,return=minimal',
    })
    console.log('ready:', p.id, p.first_name, p.last_name, email)
  }
}

async function remove() {
  for (const p of personas()) {
    const email = SYNTH_EMAIL(p.email_local)
    const user = await findUserByEmail(email)
    if (!user) { console.log('absent:', email); continue }
    await authAdmin('DELETE', `users/${user.id}`)
    console.log('removed:', email)
  }
}

async function list() {
  const projectId = await getProjectId(SANDBOX_SLUG)
  const rows = await rest('GET', 'project_members', { qs: `select=role,joined_via,user:users(name,email)&project_id=eq.${projectId}` })
  for (const r of rows) console.log(r.role.padEnd(12), String(r.joined_via ?? '-').padEnd(16), r.user?.name, r.user?.email)
  console.log(rows.length, 'members')
}

const cmd = process.argv[2]
const fn = { add, remove, list }[cmd]
if (!fn) { console.error('Usage: node provision_cohort.mjs <add|remove|list> [--limit N]'); process.exit(1) }
fn().catch((e) => { console.error(e); process.exit(1) })
