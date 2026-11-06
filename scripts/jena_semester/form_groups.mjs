#!/usr/bin/env node
// Forms the sandbox class's project groups from what each synthetic student
// said they want (cache/wishes/<id>.json) and from the persona file's friend
// pairs, then creates the groups and memberships in the sandbox space.
//
// The rule is simple and written down so it can be criticised: friend pairs
// stay together; people who asked to work alone are spread over the groups
// that end up smallest; everyone else goes to the open group whose members
// share the most favorite themes with them. Real students form groups on
// Moodle before the seminar, so this step only simulates the outcome.
//
//   node scripts/jena_semester/form_groups.mjs [--groups 6] [--apply]
// Without --apply it only writes cache/groups.json.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { clientFor, flag, getProjectId, has, loadJson, rest, SANDBOX_SLUG, SELF, SYNTH_EMAIL } from './lib.mjs'

const personas = loadJson('cohort_personas.json').personas
const nGroups = Number(flag('groups', 6))
const capacity = Math.ceil(personas.length / nGroups)

function wishFor(id) {
  const p = path.join(SELF, 'cache', 'wishes', `${id}.json`)
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null
}
const themesOf = (p) => new Set(wishFor(p.id)?.favorite_themes ?? p.favorite_themes)
const jaccard = (a, b) => {
  const inter = [...a].filter((x) => b.has(x)).length
  const union = new Set([...a, ...b]).size
  return union ? inter / union : 0
}

const byId = new Map(personas.map((p) => [p.id, p]))
const groups = Array.from({ length: nGroups }, () => [])
const placed = new Set()

// 1. Mutual friend pairs go together, spread over the groups.
let g = 0
for (const p of personas) {
  const f = p.group_preference?.friend_of
  if (f && byId.get(f)?.group_preference?.friend_of === p.id && !placed.has(p.id) && !placed.has(f)) {
    groups[g % nGroups].push(p.id, f)
    placed.add(p.id); placed.add(f)
    g++
  }
}
// 2. People who prefer to work alone fill the currently smallest groups.
for (const p of personas) {
  if (placed.has(p.id)) continue
  if (/alone|solo|by (him|her|them)self/i.test(p.group_preference?.wants ?? '')) {
    groups.sort((a, b) => a.length - b.length)[0].push(p.id)
    placed.add(p.id)
  }
}
// 3. Everyone else: the open group with the most theme overlap.
for (const p of personas) {
  if (placed.has(p.id)) continue
  const open = groups.filter((grp) => grp.length < capacity)
  const score = (grp) => (grp.length ? grp.reduce((s, id) => s + jaccard(themesOf(p), themesOf(byId.get(id))), 0) / grp.length : 0.01)
  open.sort((a, b) => score(b) - score(a) || a.length - b.length)
  open[0].push(p.id)
  placed.add(p.id)
}

const named = Object.fromEntries(groups.map((members, i) => [`Gruppe ${i + 1}`, members.sort()]))
mkdirSync(path.join(SELF, 'cache'), { recursive: true })
writeFileSync(path.join(SELF, 'cache', 'groups.json'), JSON.stringify(named, null, 2), 'utf8')
console.log(JSON.stringify(named, null, 2))

if (has('apply')) {
  const projectId = await getProjectId(SANDBOX_SLUG)
  for (const [name, members] of Object.entries(named)) {
    await rest('POST', 'project_groups', { qs: 'on_conflict=project_id,name', body: { project_id: projectId, name }, prefer: 'resolution=ignore-duplicates,return=minimal' })
    const [grp] = await rest('GET', 'project_groups', { qs: `select=id&project_id=eq.${projectId}&name=eq.${encodeURIComponent(name)}` })
    for (const id of members) {
      // Each student joins their own group as themselves, through the same
      // row-level security a real student's browser is under.
      const { client, userId } = await clientFor(SYNTH_EMAIL(byId.get(id).email_local))
      const { error } = await client.from('group_members').insert({ group_id: grp.id, user_id: userId })
      if (error && !/duplicate/i.test(error.message)) throw new Error(`${id} could not join ${name}: ${error.message}`)
    }
    console.log('group ready:', name, members.length)
  }
}
