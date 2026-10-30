#!/usr/bin/env node
// Generates the migration that adds two extension strands to the Interdisciplinary model: The Nature of Schooling and
// The Languages of Being Human.
//
//   node scripts/generate_schooling_language_strands_migration.mjs scripts/data/schooling-language-strands-2026-10-30.json scripts/data/schooling-language-thinking-tools-2026-10-30.json > supabase/migrations/<n>_schooling_and_language_strands.sql
//
// What it writes, all AI-drafted, unreviewed and in draft or proposed status:
//   1. 17 new concepts (level 'extension', status proposed) with domain meanings and a "does not carry over" note.
//   2. Per strand one strand record and four grade-band parts (status draft), each with indicators, concept tags, a guardrail list,
//      an assessment item and the thinking tools it uses. Drafts stay out of the comparison views, which read accepted rows only.
//   3. Connections: part to strand (isChildOf), the order between parts (prerequisiteOf) and two links from existing parts
//      (foundationalTo). All status proposed.
//   4. Threads (status proposed): one per strand, five storyline threads and four thinking-tool threads covering both strands,
//      plus the strand-level prerequisites the Strands page reads.
//   5. One paragraph in the project introduction.
// Literature is not attached here. The follow-up migration adds the rows once LiteratureBase holds the sources.
// Project, branch, concept, part and thread ids are read live (service_role key from the main openlpm checkout, never printed).
// Ids are uuid5-derived, so running again against unchanged content gives identical SQL.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { v5 as uuid5 } from 'uuid'

const secretsRoot = process.env.OPENLPM_SECRETS_ROOT || 'D:/dev/openevo-ccs-lab/openlpm'
const data = JSON.parse(readFileSync(path.resolve(process.argv[2]), 'utf8'))
const tools = JSON.parse(readFileSync(path.resolve(process.argv[3]), 'utf8'))
const env = readFileSync(path.join(secretsRoot, '.env.local'), 'utf8')
const URL_ = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '')
const KEY = readFileSync(path.join(secretsRoot, '.supabase-secrets', 'service-role-key.txt'), 'utf8').trim()
async function rest(p) {
  const r = await fetch(`${URL_}/rest/v1/${p}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  if (!r.ok) throw new Error(`${p}: ${r.status}`)
  return r.json()
}

const PID = '371fce26-d1f3-439b-95df-0a0e38b8a824' // interdisciplinary-lpm-synth
const VOCAB = 'OE-INTERDISCIPLINARY-v1.0.0'
const ON = '2026-10-30'
const NS = uuid5('https://openevo-ccs.github.io/openlpm/schooling-language-strands-2026-10-30', uuid5.URL)
const uid = (...parts) => uuid5(parts.join('/'), NS)
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const jq = (o) => q(JSON.stringify(o)) + '::jsonb'
const arr = (xs) => 'ARRAY[' + xs.map(q).join(', ') + ']::text[]'
const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const DOMAIN_SLUG = { biology: 'biology', culture: 'culture', technology: 'technology', education: 'education', 'AI and computation': 'ai', cognition: 'cognition' }
const BANDS = ['K-2', '3-5', '6-8', '9-12']
const TOOL_LABEL = { tinbergen: "Tinbergen's Questions", causal: 'Causal Mapping', payoff: 'Payoff Matrices', analogy: 'Analogy Mapping' }
const TOOL_METHOD = { tinbergen: 'OE-METHOD-tinbergens-questions', causal: 'OE-METHOD-causal-mapping', payoff: 'OE-METHOD-payoff-matrices', analogy: 'OE-METHOD-analogy-mapping' }
const NOTE = data.draftNote

const [project] = await rest(`projects?select=id,introduction&id=eq.${PID}`)
const [branch] = await rest(`branches?select=id&project_id=eq.${PID}&is_trunk=eq.true`)
const BRANCH = branch.id
const els = await rest(`lpm_schema_elements?select=id,label,parent_id,metadata&project_id=eq.${PID}&element_type=eq.concept&limit=1000`)
const liveByLabel = new Map(els.filter((e) => e.metadata?.level !== 'discipline-facet').map((e) => [e.label, e]))
const facetLabels = new Set(els.filter((e) => e.metadata?.level === 'discipline-facet').map((e) => e.label))
const elById = new Map(els.map((e) => [e.id, e]))
const objs = await rest(`lpm_data_objects?select=id,title,object_type,grade_band,status&project_id=eq.${PID}&branch_id=eq.${BRANCH}&limit=500`)
const threadsLive = await rest(`lpm_threads?select=id,slug&project_id=eq.${PID}`)
const threadBySlug = new Map(threadsLive.map((t) => [t.slug, t.id]))

const objByTitle = (title) => {
  const m = objs.filter((o) => o.title === title)
  if (m.length !== 1) throw new Error(`expected exactly one live record titled "${title}", found ${m.length}`)
  return m[0]
}

// ---- concept ids: live ones and the 17 new ones
const newConcept = new Map()
for (const c of data.concepts) {
  if (liveByLabel.has(c.label)) throw new Error(`concept ${c.label} already exists`)
  newConcept.set(c.label, { ...c, id: uid('concept', slugify(c.label)), cbId: `OE-CONCEPT-oe-interdisciplinary-${slugify(c.label)}` })
}
const conceptRef = (label) => {
  if (newConcept.has(label)) { const n = newConcept.get(label); return { id: n.id, cbId: n.cbId, organizing: n.organizing } }
  const e = liveByLabel.get(label)
  if (!e) throw new Error(`unknown concept ${label}`)
  const parent = e.parent_id ? elById.get(e.parent_id) : null
  return { id: e.id, cbId: e.metadata?.conceptbase_id ?? `OE-CONCEPT-oe-interdisciplinary-${slugify(label)}`, organizing: parent?.label ?? null }
}
const organizingRef = (label) => {
  const e = liveByLabel.get(label)
  if (!e) throw new Error(`unknown organizing concept ${label}`)
  return { id: e.id, cbId: e.metadata?.conceptbase_id }
}

const lines = []
const w = (s = '') => lines.push(s)
const stats = { concepts: 0, facets: 0, strands: 0, parts: 0, connections: 0, tags: 0, threads: 0, stations: 0, strandParents: 0 }
const rollbackIds = { elements: [], objects: [], threads: [] }

w(`-- Two extension strands for the Interdisciplinary model: The Nature of Schooling and The Languages of Being Human.
-- Generated by scripts/generate_schooling_language_strands_migration.mjs; do not hand-edit.
--
-- Each strand has four grade-band parts, tagged to the shared concepts and to 17 new proposed concepts, with the four OpenEvo
-- thinking tools woven in (Tinbergen's Questions, Causal Mapping, Payoff Matrices, Analogy Mapping) as threads of stations.
-- Parts have status 'draft', so the comparison views, which read accepted rows only, do not count them. Threads and connections
-- have status 'proposed'. Concepts have status 'proposed'. Accepted records are not changed.
-- Everything is AI-drafted and unreviewed by a subject expert. No classroom has tested it.
-- Source of the design: lab_manager docs/design-notes/interdisciplinary-strands-nature-of-schooling-and-languages-of-being-human-2026-10-30.md.
-- Literature rows are added by a follow-up migration once LiteratureBase holds the sources.

SET search_path = public, extensions;
`)

// ---- 1. concepts and facets
w('-- 1. New proposed concepts and their domain meanings')
for (const n of newConcept.values()) {
  const org = organizingRef(n.organizing)
  const meta = {
    level: 'extension', definition: n.general, vocabulary: VOCAB, conceptbase_id: n.cbId, proposed_not_in_conceptbase: true, proposed_on: ON,
    excludes: n.excludes, core_counterparts: [], curriculum_use: `Used by the ${n.strand === 'schooling' ? 'Nature of Schooling' : 'Languages of Being Human'} strand.`,
    grounding: ['AI-drafted on 2026-10-30 from the lab design note. Sources are attached once LiteratureBase holds them.'], confidence: n.confidence, draft_note: NOTE,
    organizing_concept: n.organizing, extension_strand: n.strand === 'schooling' ? 'nature-of-schooling' : 'languages-of-being-human',
    ...(n.sandboxConceptbaseId ? { sandbox_conceptbase_id: n.sandboxConceptbaseId } : {}),
  }
  rollbackIds.elements.push(n.id)
  w('INSERT INTO lpm_schema_elements (id, project_id, branch_id, element_type, label, definition, parent_id, metadata, status)')
  w(`VALUES (${q(n.id)}, ${q(PID)}, ${q(BRANCH)}, 'concept', ${q(n.label)}, ${q(n.general)}, ${q(org.id)}, ${jq(meta)}, 'proposed') ON CONFLICT (id) DO NOTHING;`)
  stats.concepts++
  for (const [d, t] of Object.entries(n.facets)) {
    const label = `${n.label} (${d})`
    if (facetLabels.has(label)) continue
    if (!DOMAIN_SLUG[d]) throw new Error(`unknown domain ${d}`)
    const slug = `${slugify(n.label)}-${DOMAIN_SLUG[d]}`
    const fm = { level: 'discipline-facet', facet_of: n.label, definition: t, vocabulary: VOCAB, conceptbase_id: `OE-CONCEPT-oe-interdisciplinary-${slug}`, proposed_not_in_conceptbase: true, proposed_on: ON, grounding: NOTE }
    rollbackIds.elements.push(uid('facet', slug))
    w('INSERT INTO lpm_schema_elements (id, project_id, branch_id, element_type, label, definition, parent_id, metadata, status)')
    w(`VALUES (${q(uid('facet', slug))}, ${q(PID)}, ${q(BRANCH)}, 'concept', ${q(label)}, ${q(t)}, ${q(n.id)}, ${jq(fm)}, 'proposed') ON CONFLICT (id) DO NOTHING;`)
    stats.facets++
  }
}
w('')

// ---- part registry (needed by threads)
const partInfo = new Map() // `${strand}|${suffix}` -> {id,title,band,strandKey}
const strandInfo = new Map()
for (const s of data.strands) {
  strandInfo.set(s.key, { id: uid('strand', s.key), title: s.title, slug: s.slug })
  for (const p of s.parts) partInfo.set(`${s.key}|${p.suffix}`, { id: uid('part', s.key, p.suffix), title: p.title, band: p.band, strand: s.key })
}
const partByBand = (strandKey, band) => [...partInfo.values()].find((p) => p.strand === strandKey && p.band === band)

// tool use per part, for the part records
const toolUse = new Map()
for (const [tkey, t] of Object.entries(tools.tools)) {
  for (const s of t.stations) {
    const part = partByBand(s.strand, s.band)
    if (!part) throw new Error(`tool station for ${s.strand} ${s.band} has no part`)
    const k = part.id
    if (!toolUse.has(k)) toolUse.set(k, [])
    toolUse.get(k).push({ tool: TOOL_LABEL[tkey], level: s.level, move: s.move })
  }
}

// ---- 2. strands and parts
w('-- 2. Strand and part records (status draft)')
for (const s of data.strands) {
  const sid = strandInfo.get(s.key).id
  const content = {
    source_id: s.sourceId, description: s.description, associatedDomains: s.associatedDomains, epistemicStatus: 'designed-thought-experiment',
    track: 'extension-strands', connecting_idea: s.connectingIdea, narrative: s.narrative, guardrails: s.guardrails, draft_note: NOTE,
    relations: { builtOnStrands: s.parents }, literature_ids: [], sources_note: 'Sources are attached by a follow-up migration once LiteratureBase holds them.',
  }
  rollbackIds.objects.push(sid)
  w('INSERT INTO lpm_data_objects (id, project_id, branch_id, object_type, title, description, grade_band, subject_area, content, status)')
  w(`VALUES (${q(sid)}, ${q(PID)}, ${q(BRANCH)}, 'strand', ${q(s.title)}, ${q(s.description)}, 'K-12', ${q(s.subjectArea)}, ${jq(content)}, 'draft') ON CONFLICT (id) DO NOTHING;`)
  stats.strands++
  for (const p of s.parts) {
    const pid = partInfo.get(`${s.key}|${p.suffix}`).id
    const cref = p.concepts.map(([label, emphasis]) => ({ label, emphasis, ...conceptRef(label) }))
    const orgSeen = new Map()
    for (const c of cref) {
      if (!c.organizing) continue
      const prev = orgSeen.get(c.organizing)
      orgSeen.set(c.organizing, prev === 'primary' || c.emphasis === 'primary' ? 'primary' : 'reinforcing')
    }
    const content = {
      source_id: `${s.sourceId}-${p.suffix}`, track: 'extension-strands', required: true,
      performanceIndicators: p.indicators,
      concepts: cref.map((c) => ({ id: c.cbId, emphasis: c.emphasis })),
      organizingConcepts: [...orgSeen].map(([label, emphasis]) => ({ id: organizingRef(label).cbId, emphasis })),
      organizingConceptsNote: `AI-drafted on ${ON} from the stage links in content.concepts. No subject-matter expert has reviewed it.`,
      guardrails: s.guardrails, assessmentItem: p.assessment, thinkingTools: toolUse.get(pid) ?? [],
      literature_ids: [], sources_note: 'Sources are attached by a follow-up migration once LiteratureBase holds them.',
      draft_note: NOTE,
    }
    rollbackIds.objects.push(pid)
    w('INSERT INTO lpm_data_objects (id, project_id, branch_id, object_type, title, description, grade_band, subject_area, content, status)')
    w(`VALUES (${q(pid)}, ${q(PID)}, ${q(BRANCH)}, 'substrand', ${q(p.title)}, ${q('Key concepts: ' + p.concepts.map((c) => c[0]).join(', '))}, ${q(p.band)}, ${q(p.subjectArea)}, ${jq(content)}, 'draft') ON CONFLICT (id) DO NOTHING;`)
    stats.parts++
    w(`INSERT INTO lpm_connections (project_id, branch_id, from_object_id, to_object_id, relation_type, kind, rationale, status) VALUES (${q(PID)}, ${q(BRANCH)}, ${q(pid)}, ${q(sid)}, 'isChildOf', 'asserted', NULL, 'proposed') ON CONFLICT DO NOTHING;`)
    stats.connections++
    for (const c of cref) {
      w(`INSERT INTO lpm_object_tags (project_id, data_object_id, schema_element_id, role) VALUES (${q(PID)}, ${q(pid)}, ${q(c.id)}, ${q(c.emphasis)}) ON CONFLICT (data_object_id, schema_element_id) DO NOTHING;`)
      stats.tags++
    }
  }
}
w('')

// ---- 3. order and cross links
w('-- 3. Order between parts, and links from existing parts (all proposed)')
for (const pr of data.partPrerequisites) {
  const a = partInfo.get(pr.from.join('|')); const b = partInfo.get(pr.to.join('|'))
  if (!a || !b) throw new Error(`prerequisite ${pr.from} -> ${pr.to} has no part`)
  w(`INSERT INTO lpm_connections (project_id, branch_id, from_object_id, to_object_id, relation_type, kind, rationale, status) VALUES (${q(PID)}, ${q(BRANCH)}, ${q(a.id)}, ${q(b.id)}, 'prerequisiteOf', 'asserted', ${q(pr.why)}, 'proposed') ON CONFLICT DO NOTHING;`)
  stats.connections++
}
for (const cl of data.crossLinks) {
  const from = objByTitle(cl.fromTitle); const to = partInfo.get(cl.to.join('|'))
  if (!to) throw new Error(`cross link target ${cl.to} missing`)
  w(`INSERT INTO lpm_connections (project_id, branch_id, from_object_id, to_object_id, relation_type, kind, rationale, status) VALUES (${q(PID)}, ${q(BRANCH)}, ${q(from.id)}, ${q(to.id)}, ${q(cl.relation)}, 'asserted', ${q(cl.why)}, 'proposed') ON CONFLICT DO NOTHING;`)
  stats.connections++
}
w('')

// ---- 4. threads
const resolveRef = (ref) => {
  if (ref.part) { const p = partInfo.get(ref.part.join('|')); if (!p) throw new Error(`no part ${ref.part}`); return { id: p.id, title: p.title } }
  const o = objByTitle(ref.title); return { id: o.id, title: o.title }
}
function thread({ slug, title, type = 'vertical_horizontal', idea, narrative, teachingPrompt, evidenceNote, gaps = [], stations }) {
  const tid = uid('thread', slug)
  rollbackIds.threads.push(slug)
  w('INSERT INTO lpm_threads (id, project_id, branch_id, slug, title, thread_type, connecting_idea, narrative, teaching_prompt, evidence_note, gaps, status)')
  w(`VALUES (${q(tid)}, ${q(PID)}, ${q(BRANCH)}, ${q(slug)}, ${q(title)}, ${q(type)}, ${q(idea)}, ${q(narrative)}, ${teachingPrompt ? q(teachingPrompt) : 'NULL'}, ${evidenceNote ? q(evidenceNote) : 'NULL'}, ${jq(gaps)}, 'proposed')`)
  w('ON CONFLICT (project_id, slug) DO NOTHING;')
  stats.threads++
  stations.forEach((s, i) => {
    const next = stations[i + 1]
    w('INSERT INTO lpm_thread_stations (id, thread_id, data_object_id, sequence, role_note, via_element_id, relation_to_next)')
    w(`VALUES (${q(uid('station', slug, String(i + 1)))}, ${q(tid)}, ${q(s.objectId)}, ${i + 1}, ${q(s.note)}, ${s.via ? q(s.via) : 'NULL'}, ${next && next.title ? q(`Leads into ${next.title}.`) : 'NULL'})`)
    w('ON CONFLICT (thread_id, sequence) DO NOTHING;')
    stats.stations++
  })
  return tid
}

w('-- 4. Threads. Strand threads first (the Strands page reads these), then storyline threads, then thinking-tool threads')
const strandThreadId = new Map()
for (const s of data.strands) {
  const stations = s.parts.map((p) => {
    const part = partInfo.get(`${s.key}|${p.suffix}`)
    return { objectId: part.id, title: `${p.title} (${p.band})`, note: `${p.band}, ${p.title}. Key concepts: ${p.concepts.map((c) => c[0]).join(', ')}.` }
  })
  strandThreadId.set(s.key, thread({ slug: s.slug, title: s.title, idea: s.connectingIdea, narrative: `${s.description} ${s.narrative}`, evidenceNote: NOTE, stations }))
}
for (const t of data.threads) {
  const stations = t.stations.map((s) => {
    const r = resolveRef(s.ref)
    return { objectId: r.id, title: r.title, note: s.note }
  })
  thread({ slug: t.slug, title: t.title, idea: t.idea, narrative: `${t.idea} ${NOTE}`, evidenceNote: NOTE, stations })
}
for (const [tkey, t] of Object.entries(tools.tools)) {
  const ordered = t.stations.map((s, i) => ({ s, i })).sort((a, b) => BANDS.indexOf(a.s.band) - BANDS.indexOf(b.s.band) || a.i - b.i).map((x) => x.s)
  const stations = ordered.map((s) => {
    const part = partByBand(s.strand, s.band)
    const via = (s.concepts ?? []).map((c) => { try { return conceptRef(c).id } catch { return null } }).find(Boolean)
    const strandName = strandInfo.get(s.strand).title
    return {
      objectId: part.id, title: `${part.title} (${s.band})`, via,
      note: `${s.band}, ${part.title} in ${strandName} (${s.level}). ${s.move} Example: ${s.example} Shown as: ${s.representation} New demand: ${s.challenge} Concepts: ${s.concepts.join(', ')}.`,
    }
  })
  const narrative = `${TOOL_LABEL[tkey]} in the two extension strands. Role here: ${t.role}. ${t.roleReason} Form: ${t.form} What it must not bring in: ${t.mustNotImport}`
  thread({
    slug: `thinking-tool-${tkey}-extension-strands`, title: `Thinking tool: ${TOOL_LABEL[tkey]} (Schooling and Languages strands)`, idea: t.form, narrative,
    teachingPrompt: t.teachingPrompt, evidenceNote: `${NOTE} No evidence source is attached to the stations yet. MethodsBase record: ${TOOL_METHOD[tkey]}.`, gaps: t.gaps, stations,
  })
}
w('')

// ---- 5. strand-level prerequisites
w('-- 5. What each new strand builds on (the Strands page reads these)')
for (const s of data.strands) {
  for (const parentSlug of s.parents) {
    const pid = threadBySlug.get(parentSlug)
    if (!pid) throw new Error(`no live strand thread ${parentSlug}`)
    w(`INSERT INTO strand_parents (id, strand_id, parent_strand_id) VALUES (${q(uid('strand-parent', s.key, parentSlug))}, ${q(strandThreadId.get(s.key))}, ${q(pid)}) ON CONFLICT (strand_id, parent_strand_id) DO NOTHING;`)
    stats.strandParents++
  }
}
w('')

// ---- 6. introduction
w('-- 6. Introduction paragraph')
w(`UPDATE projects SET introduction = introduction || ${q('\n\n' + data.introAddition)} WHERE id = ${q(PID)} AND introduction NOT LIKE ${q('%' + data.introAddition.slice(0, 40) + '%')};`)
w('')

w('-- ROLLBACK (run by hand to remove everything this migration added):')
w(`--   DELETE FROM lpm_threads WHERE project_id = ${q(PID)} AND slug IN (${rollbackIds.threads.map(q).join(', ')});  -- stations and strand_parents by cascade`)
w(`--   DELETE FROM lpm_data_objects WHERE id IN (${rollbackIds.objects.map(q).join(', ')});  -- connections and tags by cascade`)
w(`--   DELETE FROM lpm_schema_elements WHERE id IN (${rollbackIds.elements.map(q).join(', ')});`)
w('--   (The introduction paragraph is removed by editing the project introduction by hand.)')
process.stdout.write(lines.join('\n') + '\n')
process.stderr.write(`${JSON.stringify(stats)}\n`)
