#!/usr/bin/env node
// Writes each synthetic student's decisions (cache/decisions/<id>.json, made
// by an AI agent that read the curriculum files and the task) into the sandbox
// space, as that student, through the same data API and row-level security a
// real student's browser uses. Stars, judgments, topic, reflections and group
// sharing end up in the same tables the app writes.
//
// What this script cannot do is click through the pages, so the activity
// timeline it writes is a reconstruction: one event per step the agent
// declared (or a plain default order), spread over simulated days, and every
// event carries details.simulated = true so no analysis mistakes it for
// measured behavior. A few students are driven through the real pages with
// Playwright (export_handins.mjs does the final download that way) to check
// the real event logging separately.
//
//   node scripts/jena_semester/apply_decisions.mjs [--only p01,p02]

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { clientFor, flag, getProjectId, loadJson, SANDBOX_SLUG, SELF, SYNTH_EMAIL } from './lib.mjs'

const personas = loadJson('cohort_personas.json').personas
const only = flag('only', '')?.toString().split(',').filter(Boolean)

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function participantCode(rng) {
  const chars = Array.from({ length: 8 }, () => ALPHABET[Math.floor(rng() * ALPHABET.length)]).join('')
  return `JBD-${chars.slice(0, 4)}-${chars.slice(4)}`
}

// Small seeded generator so a re-run of the same persona gives the same timeline and code.
function seeded(seedText) {
  let h = 2166136261
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

function defaultTrace(d) {
  const steps = [{ event: 'page_view', details: { path: 'lernziele' } }]
  for (const id of d.starred_lernziel_ids ?? []) steps.push({ event: 'favorite_toggled', details: { lernziel_id: id, now_starred: true } })
  steps.push({ event: 'page_view', details: { path: 'basiskonzepte' } })
  steps.push({ event: 'page_view', details: { path: 'meine-arbeit' } })
  steps.push({ event: 'work_tab', details: { tab: 'thema' } }, { event: 'work_saved', details: { kind: 'topic' } })
  steps.push({ event: 'work_tab', details: { tab: 'beurteilen' } })
  for (const j of d.judgments ?? []) steps.push({ event: 'work_saved', details: { kind: 'link_judgment', entry_key: `${j.lernziel_id}|${j.basiskonzept_id}` } })
  steps.push({ event: 'work_tab', details: { tab: 'basiskonzepte' } })
  for (const b of d.topic_basiskonzepte ?? []) steps.push({ event: 'work_saved', details: { kind: 'topic_basiskonzept', entry_key: b.basiskonzept } })
  steps.push({ event: 'work_tab', details: { tab: 'reflexion' } }, { event: 'work_saved', details: { kind: 'reflection' } })
  steps.push({ event: 'work_tab', details: { tab: 'abgabe' } })
  return steps
}

async function applyOne(persona, projectId, groupName) {
  const file = path.join(SELF, 'cache', 'decisions', `${persona.id}.json`)
  if (!existsSync(file)) { console.log('no decisions yet:', persona.id); return }
  const d = JSON.parse(readFileSync(file, 'utf8'))
  const rng = seeded(persona.id)
  const email = SYNTH_EMAIL(persona.email_local)
  const { client, userId } = await clientFor(email)
  const must = (label, { error }) => { if (error && !/duplicate/i.test(error.message)) throw new Error(`${persona.id} ${label}: ${error.message}`) }

  // Stars
  for (const id of d.starred_lernziel_ids ?? []) {
    must('star', await client.from('user_favorite_learning_goals').insert({ user_id: userId, data_object_id: id }))
  }

  // Work entries, written with the same keys and payload shapes as the app.
  const entries = []
  const put = (kind, entry_key, payload) => entries.push({ project_id: projectId, user_id: userId, kind, entry_key, payload, updated_at: new Date().toISOString() })
  put('meta', 'participant', { participant_code: participantCode(rng) })
  if (d.topic) put('topic', 'main', { favorite_themes: d.topic.favorite_themes ?? [], own_topic: d.topic.own_topic ?? '', reasoning: d.topic.reasoning ?? '' })
  if (d.grade_bands) put('grade_bands', 'main', { bands: d.grade_bands.bands ?? [], note: d.grade_bands.note ?? '' })
  for (const j of d.judgments ?? []) {
    put('link_judgment', `${j.lernziel_id}|${j.basiskonzept_id}`, {
      lernziel_id: j.lernziel_id, lernziel_title: j.lernziel_title ?? '', basiskonzept_id: j.basiskonzept_id,
      correctness: j.correctness ?? null, own_knowledge: j.own_knowledge ?? null, didactic_relevance: j.didactic_relevance ?? null, note: j.note ?? '',
    })
  }
  ;(d.proposals ?? []).forEach((p, i) => put('link_proposal', `${persona.id}-prop-${i + 1}`, { lernziel_id: p.lernziel_id, basiskonzept: p.basiskonzept, description: p.description }))
  for (const b of d.topic_basiskonzepte ?? []) put('topic_basiskonzept', b.basiskonzept, { concrete_link: b.concrete_link ?? '' })
  for (const c of d.cross_cutting ?? []) put('cross_cutting', c.theme, { selected: true, note: c.note ?? '' })
  for (const [key, text] of Object.entries(d.reflections ?? {})) put('reflection', key, { text })
  if (entries.length) {
    must('work entries', await client.from('student_work_entries').upsert(entries, { onConflict: 'project_id,user_id,kind,entry_key' }))
  }

  // Group sharing (the student's own choice, on their own membership row)
  if (groupName) {
    const { data: grp } = await client.from('project_groups').select('id').eq('project_id', projectId).eq('name', groupName).maybeSingle()
    if (grp) must('share flag', await client.from('group_members').update({ share_favorites: d.share_with_group !== false }).eq('group_id', grp.id).eq('user_id', userId))
  }

  // A student who drops out of the group leaves it (their own membership row).
  if (d.leave_group && groupName) {
    const { data: grp } = await client.from('project_groups').select('id').eq('project_id', projectId).eq('name', groupName).maybeSingle()
    if (grp) must('leave group', await client.from('group_members').delete().eq('group_id', grp.id).eq('user_id', userId))
  }

  // Reconstructed timeline
  const trace = (d.trace?.length ? d.trace : defaultTrace(d))
  const day = 10 + Math.floor(rng() * 5)
  let t = Date.UTC(2026, 10, day, 8 + Math.floor(rng() * 12), Math.floor(rng() * 60))
  const events = trace.map((s) => {
    t += Math.round((0.5 + rng() * 3.5) * 60_000)
    return { project_id: projectId, user_id: userId, event_type: s.event, details: { ...(s.details ?? {}), simulated: true }, created_at: new Date(t).toISOString() }
  })
  must('events', await client.from('student_activity_events').insert(events))
  console.log('applied:', persona.id, `${(d.starred_lernziel_ids ?? []).length} stars, ${(d.judgments ?? []).length} judgments, ${events.length} events`)
}

const projectId = await getProjectId(SANDBOX_SLUG)
const groups = existsSync(path.join(SELF, 'cache', 'groups.json')) ? JSON.parse(readFileSync(path.join(SELF, 'cache', 'groups.json'), 'utf8')) : {}
const groupOf = (id) => Object.entries(groups).find(([, m]) => m.includes(id))?.[0] ?? null

for (const p of personas) {
  if (only.length && !only.includes(p.id)) continue
  try { await applyOne(p, projectId, groupOf(p.id)) } catch (e) { console.error('FAILED', p.id, e.message) }
}
if (!existsSync(path.join(SELF, 'cache', 'decisions'))) console.log('(no cache/decisions folder yet)')
else console.log(readdirSync(path.join(SELF, 'cache', 'decisions')).length, 'decision files present')
