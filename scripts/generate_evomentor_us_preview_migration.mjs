#!/usr/bin/env node
// Generates the EvoMentor US (preview) migration (2026-11-13):
//   node scripts/generate_evomentor_us_preview_migration.mjs > supabase/migrations/243_evomentor_us_preview.sql
//
// Input: scripts/data/ngss-evolution-thread-us-2026-11-13.json
//   items               the evolution thread of the US Next Generation Science Standards: each performance expectation with its exact
//                       text, the three foundation box names, an evolution relevance level (1 to 3) with the reason, and evolution concepts
//   crosscuttingConcepts  the seven NGSS crosscutting concepts, used as this space's basic concepts (a hypothesis, see the space description)
//   evolutionConcepts   an English draft of the German list in EvoMentor_DE/data/evolutionskonzepte.json (same ids, same two levels)
//   threads             two paths across the grades, built from the core idea codes in the foundation boxes
//
// What the migration builds, with no new table and no new screen:
//   a private project space "EvoMentor US (preview)" (maturity draft, owner Dustin as in the sibling migrations);
//   concepts (lpm_schema_elements): 7 crosscutting concepts and one root "Evolution concepts" with 52 concepts under it;
//   one learning goal (lpm_data_objects, type performance_indicator) per expectation, on the trunk branch with status accepted so
//   Browse lists it (migration 235 explains why);
//   concept links in content.basiskonzeptbezug (the shape the Thuringia goals use, with relevance 1 to 3 and a reason) and in
//   lpm_object_tags; two threads for the Strands tab; the NGSS source and its licence terms in project_source_declarations.
//
// Review state: every goal, concept, link and thread carries the agreed tag "LLM synthesized draft, awaiting review". The standards
// text belongs to NGSS Lead States. Everything else here is the lab's own draft.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const data = JSON.parse(readFileSync(path.join(root, 'scripts/data/ngss-evolution-thread-us-2026-11-13.json'), 'utf8'))

const TAG = 'LLM synthesized draft, awaiting review'
const SLUG = 'evomentor-us-preview'
const NAME = 'EvoMentor US (preview)'
const SOURCE_URL = 'https://www.nextgenscience.org/'
const LICENSE_URL = 'https://www.nextgenscience.org/ngss-trademarks-and-copyright/ngss-trademarks-and-copyright'
const CITATION = 'NGSS Lead States. 2013. Next Generation Science Standards: For States, By States. Washington, DC: The National Academies Press.'
const ATTRIBUTION = `Text of the expectation: ${CITATION} Used under the NGSS Public License (${LICENSE_URL}).`

// ---------------------------------------------------------------- ids and quoting
function uuidv5(name, namespace) {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const hash = createHash('sha1').update(Buffer.concat([nsBytes, Buffer.from(name, 'utf8')])).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const h = hash.subarray(0, 16).toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}
const NS = uuidv5('https://openevo.net/openlpm/evomentor-us-preview-seed', '00000000-0000-0000-0000-000000000000')
const uid = (k) => uuidv5(k, NS)
const J = (s) => {
  s = s == null ? '' : String(s)
  if (s.includes('$J$')) throw new Error('literal contains $J$: ' + s.slice(0, 60))
  return `$J$${s}$J$`
}
const JSB = (o) => {
  const s = JSON.stringify(o)
  if (s.includes('$J$')) throw new Error('json contains $J$')
  return `$J$${s}$J$::jsonb`
}

// ---------------------------------------------------------------- checks
const fail = (m) => { throw new Error('data check failed: ' + m) }
const ccc = new Map(data.crosscuttingConcepts.map((c) => [c.id, c]))
const evo = new Map(data.evolutionConcepts.map((c) => [c.id, c]))
if (ccc.size !== 7) fail('expected 7 crosscutting concepts')
if (evo.size !== data.evolutionConcepts.length) fail('duplicate evolution concept id')
for (const c of data.evolutionConcepts) {
  if (c.level === 1 && c.parent !== null) fail('level 1 concept with a parent: ' + c.id)
  if (c.level === 2 && !(evo.get(c.parent)?.level === 1)) fail('level 2 concept without a level 1 parent: ' + c.id)
  if (!c.en || !c.de || !c.def) fail('concept without names or definition: ' + c.id)
}
const items = data.items
const byCode = new Map(items.map((i) => [i.code, i]))
if (byCode.size !== items.length) fail('duplicate item code')
if (items.length < 30 || items.length > 40) fail('item count outside 30 to 40: ' + items.length)
// The rule for the evolution level is written into the space (the root concept). This check keeps the data in line with it:
// level 3 exactly when the expectation text itself uses evolution, evolutionary, coevolution or natural selection.
const NAMES_EVOLUTION = /evolution|natural selection/i
for (const i of items) {
  if (!/^(\d|MS|HS)-[A-Z]+\d-\d$/.test(i.code)) fail('odd code ' + i.code)
  if (![1, 2, 3].includes(i.level)) fail('level of ' + i.code)
  if ((i.level === 3) !== NAMES_EVOLUTION.test(i.text)) fail(`level of ${i.code} disagrees with the rule about naming evolution`)
  if (!data.topics[i.topicKey]) fail('topic of ' + i.code)
  if (!i.evo?.length) fail('no evolution concept on ' + i.code)
  for (const e of i.evo) if (!evo.has(e)) fail(`${i.code}: unknown evolution concept ${e}`)
  for (const c of i.ccc) if (!ccc.has(c)) fail(`${i.code}: unknown crosscutting concept ${c}`)
  if (!i.practices?.length || !i.coreIdeas?.length) fail('foundation box of ' + i.code)
  if (i.why.length < 40) fail('reason too short on ' + i.code)
  if (new Set(i.evo).size !== i.evo.length || new Set(i.ccc).size !== i.ccc.length) fail('repeated concept on ' + i.code)
}
for (const t of data.threads) {
  if (!evo.has(t.explainedBy)) fail('thread concept ' + t.slug)
  for (const s of t.stations) if (!byCode.has(s.code)) fail(`thread ${t.slug}: unknown item ${s.code}`)
}

// ---------------------------------------------------------------- ids
const PROJECT_ID = uid(`project:${SLUG}`)
const LENS_ID = uid('concept:evolution-concepts')
const cccId = (id) => uid(`concept:ngss-ccc:${id}`)
const evoId = (id) => uid(`concept:evo:${id}`)
const itemId = (code) => uid(`item:${code}`)
const LEVEL_LABEL = data.meta.levels
const urlOf = (i) => `${SOURCE_URL}pe/${i.code.toLowerCase()}-${data.topics[i.topicKey].slug}`
const gradeLabel = (i) => (i.gradeBand === '6-8' ? 'Middle school (grades 6 to 8)' : i.gradeBand === '9-12' ? 'High school (grades 9 to 12)' : `Grade ${i.gradeBand}`)

// ---------------------------------------------------------------- concepts
const elements = []
const draftExt = (extra) => ({ draft_note: `${TAG}. ${extra}` })
for (const c of data.crosscuttingConcepts) {
  elements.push({
    id: cccId(c.id), parent: null, level: 0, label: c.name,
    definition: `${c.definition} Possible German counterpart (a hypothesis that needs an expert): ${c.germanMatch}. The name comes from NGSS. The wording is ours. ${TAG}.`,
    metadata: {
      source_id: cccId(c.id), vocabulary: 'EVOMENTOR-US-PREVIEW', origin: 'ngss-crosscutting-concept', kind: 'basic-concept',
      german_counterpart_hypothesis: c.germanMatch,
      review: { state: 'unreviewed', tag: TAG },
      proposed_extension: draftExt('The name is one of the seven NGSS crosscutting concepts. The plain wording and the German counterpart are our guesses.'),
    },
  })
}
const evoLensDefinition =
  'The concepts that evolution education researchers use to tag evolution content, as an English draft of the concept list in the German space EvoMentor Thuringia. ' +
  'The list has the same two levels as the German one, so the two spaces can be compared. ' +
  'How the evolution level of a goal is set: level 3 means the expectation text itself names evolution (the words evolution, evolutionary, coevolution or natural selection). ' +
  'Level 2 means it covers an evolution idea (variation, inheritance, differences in survival and reproduction, adaptation, common ancestry, fossils, deep time) without those words. ' +
  'Level 1 means background knowledge that evolution arguments build on. This rule is our draft and an expert should correct it. ' + TAG + '.'
elements.push({
  id: LENS_ID, parent: null, level: 0, label: 'Evolution concepts', definition: evoLensDefinition,
  metadata: {
    source_id: LENS_ID, vocabulary: 'EVOMENTOR-US-PREVIEW', origin: 'evolution-concept-list-draft', kind: 'evolution-lens',
    levels: LEVEL_LABEL,
    review: { state: 'unreviewed', tag: TAG },
    proposed_extension: draftExt('The English names are translated from the German list. Each concept shows its German original.'),
  },
})
for (const c of data.evolutionConcepts) {
  elements.push({
    id: evoId(c.id), parent: c.parent ? evoId(c.parent) : LENS_ID, level: c.level, label: c.en,
    definition: `${c.def} English name drafted from the German concept "${c.de}". ${TAG}.`,
    metadata: {
      source_id: c.id, vocabulary: 'EVOMENTOR-US-PREVIEW', origin: 'translated-from-evomentor-de', kind: 'evolution-concept',
      german_id: c.id, german_label: c.de, level: c.level,
      review: { state: 'unreviewed', tag: TAG },
      proposed_extension: draftExt(`English name drafted from the German concept "${c.de}" in the Thuringia space.`),
    },
  })
}
const elementsByLevel = [0, 1, 2].map((lv) => elements.filter((e) => (lv === 0 ? e.level === 0 : e.level === lv)))

// ---------------------------------------------------------------- goals
const objects = []
const tags = []
items.forEach((i, idx) => {
  const evoNames = i.evo.map((e) => evo.get(e).en)
  const bk = []
  for (const c of i.ccc) {
    const cc = ccc.get(c)
    bk.push({
      basiskonzept_id: cccId(c), conceptName: cc.name, relevanz_beurteilung: 3,
      begruendung: 'Named as a crosscutting concept in the NGSS foundation box of this expectation.',
      relevante_unterkonzepte_taxonomie: [{ value: cc.name, taxonomyElementId: cccId(c) }],
      basis: 'ngss-foundation-box', draftTag: TAG,
    })
  }
  bk.push({
    basiskonzept_id: LENS_ID, conceptName: 'Evolution concepts', relevanz_beurteilung: i.level,
    begruendung: i.why,
    relevante_evolutionskonzepte: evoNames,
    relevante_evolutionskonzepte_taxonomie: i.evo.map((e) => ({ value: evo.get(e).en, taxonomyElementId: evoId(e) })),
    basis: 'llm-judgment', draftTag: TAG,
  })
  const content = {
    source_id: `NGSS ${i.code}`,
    code: i.code,
    thema: data.topics[i.topicKey].title,
    unterthema: i.coreIdeas.join('; '),
    ngssBand: i.band,
    gradeLabel: gradeLabel(i),
    concepts: i.ccc.map((c) => ({ id: `ngss-ccc-${c}`, label: ccc.get(c).name, emphasis: 'primary' })),
    foundationBox: { practices: i.practices, coreIdeas: i.coreIdeas, crosscuttingConcepts: i.ccc.map((c) => ccc.get(c).name) },
    evolutionRelevance: {
      level: i.level, label: LEVEL_LABEL[String(i.level)], why: i.why, concepts: evoNames,
      germanConcepts: i.evo.map((e) => evo.get(e).de),
    },
    basiskonzeptbezug: bk,
    shortLabelNote: 'The short label after the code is ours. The expectation text is NGSS.',
    ...(i.engineeringMarker ? { engineeringMarker: 'NGSS marks this expectation with an asterisk because it connects to engineering design.' } : {}),
    textCheck: {
      reads: data.meta.readOnce.includes(i.code) ? 1 : 2,
      note: 'Text read from nextgenscience.org on ' + data.meta.fetchedOn + ' through a page-summarizing fetch tool. It has not been compared with the printed standards.',
    },
    attribution: ATTRIBUTION,
    draftTag: TAG,
    review: { state: 'unreviewed', note: 'Evolution level, concept tags and links were drafted by an LLM from the expectation text and its foundation box. No expert has reviewed them.' },
    _source: { repo: 'NGSS Lead States (2013), nextgenscience.org', path: urlOf(i) },
  }
  objects.push({
    id: itemId(i.code), title: `${i.code} · ${i.shortLabel}`, description: i.text, grade_band: i.gradeBand, content, seq: idx + 1,
  })
  for (const c of i.ccc) tags.push({ obj: itemId(i.code), el: cccId(c), role: 'primary' })
  for (const e of i.evo) tags.push({ obj: itemId(i.code), el: evoId(e), role: 'relates_to' })
})

// ---------------------------------------------------------------- reference checks (the database enforces these too, so a failure here would stop the migration)
{
  const ids = [PROJECT_ID, ...elements.map((e) => e.id), ...objects.map((o) => o.id)]
  const elementIds = new Set(elements.map((e) => e.id))
  const objectIds = new Set(objects.map((o) => o.id))
  if (new Set(ids).size !== ids.length) fail('two rows share an id')
  const seen = new Set()
  for (const lv of elementsByLevel) {
    for (const e of lv) {
      if (e.parent && !seen.has(e.parent)) fail(`concept ${e.label} points at a parent that is not inserted earlier`)
    }
    for (const e of lv) seen.add(e.id)
  }
  for (const t of tags) if (!elementIds.has(t.el) || !objectIds.has(t.obj)) fail('tag points at a missing row')
  const pairs = new Set(tags.map((t) => t.obj + t.el))
  if (pairs.size !== tags.length) fail('repeated tag pair')
  for (const o of objects) {
    for (const b of o.content.basiskonzeptbezug) {
      if (!elementIds.has(b.basiskonzept_id)) fail(`${o.title}: link to a missing concept`)
      for (const x of [...(b.relevante_unterkonzepte_taxonomie ?? []), ...(b.relevante_evolutionskonzepte_taxonomie ?? [])]) {
        if (!elementIds.has(x.taxonomyElementId)) fail(`${o.title}: tag value without a concept row`)
      }
    }
  }
  for (const t of data.threads) {
    if (new Set(t.stations.map((s) => s.code)).size !== t.stations.length) fail('item twice in thread ' + t.slug)
    if (!/^[a-z0-9-]+$/.test(t.slug)) fail('thread slug ' + t.slug)
  }
  for (const e of elements) if (e.id === e.parent) fail('concept is its own parent')
}

// ---------------------------------------------------------------- counts for the header
const nLevel = { 1: 0, 2: 0, 3: 0 }
for (const i of items) nLevel[i.level]++
const nByBand = {}
for (const i of items) nByBand[i.band] = (nByBand[i.band] ?? 0) + 1
const nLinks = objects.reduce((n, o) => n + o.content.basiskonzeptbezug.length, 0)

const DESCRIPTION =
  'Standards are cultural models of what a society expects students to learn and how that learning grows over the years. ' +
  `This preview holds the evolution thread of the US Next Generation Science Standards (${items.length} performance expectations from grade 1 to grade 12), each tagged for how much it has to do with evolution, so that evolution education researchers can look at it, compare it with the Thuringia space and correct our tags. ` +
  "We treat the seven NGSS crosscutting concepts as this space's basic concepts, on the hypothesis that they play the role of the six German basic concepts, and an expert needs to confirm that."
const STATUS_NOTE = 'Preview for evolution education researchers. Each goal, concept, link and path carries its own review tag. The standards text is from nextgenscience.org (see Sources in Settings).'

const NGSS_RIGHTS_NOTE =
  'NGSS Public License (' + LICENSE_URL + '): states, districts, schools, teachers and non-profit education entities may copy, reproduce, alter, adapt, edit, delete and rearrange any and all parts of the NGSS without permission. ' +
  'The licence page says that the National Academies Press holds the copyright of the published standards. ' +
  'Suggested citation: ' + CITATION + ' ' +
  'The trademark guidance asks that a product using the name Next Generation Science Standards shows a footnote at its first prominent use: the name is a registered trademark of WestEd, and neither WestEd nor the lead states and partners were involved in the production of the product or endorse it. ' +
  'The guidance also asks that the name is used in full. ' +
  'Open questions: the licence page does not define a non-profit education entity and does not mention research use. Written clarification from WestEd has not been requested yet. ' +
  'These terms were read through a page-summarizing fetch tool on ' + data.meta.fetchedOn + '. Read the licence page itself before the space is shared outside the lab. ' +
  'This space copies the text of the expectations and the names of the foundation box items, and nothing else from NGSS. Everything else in this space (tags, levels, English concept names, paths) is the lab\'s own draft.'
const CONCEPT_LIST_NOTE =
  'Own work of the lab. The German original is in the repository EvoMentor_DE (data/evolutionskonzepte.json), and the Thuringia space uses it. ' +
  'The English names and definitions in this space are drafts translated from it. ' + TAG + '. Shared under the ecosystem default licence (CC BY-NC-SA 4.0).'

// ---------------------------------------------------------------- SQL
const L = []
const w = (s = '') => L.push(s)

w(`-- 243: EvoMentor US (preview), a small English space for evolution education researchers (2026-11-13).`)
w(`--`)
w(`-- What it is: the evolution thread of the US Next Generation Science Standards, ${items.length} performance expectations from grade 1 to grade 12`)
w(`-- (${Object.entries(nByBand).map(([k, v]) => `${v} in ${k}`).join(', ')}): all LS4 expectations of grades 2 to 12, all heredity (LS3) expectations of grades 1 to 12, and a few from`)
w(`-- ecosystems, Earth history and growth that bear on evolution. It mirrors what the German space EvoMentor Thuringia does for the Thuringia`)
w(`-- curriculum, so researchers can look at a working example, compare the two and correct it.`)
w(`--`)
w(`-- Built from existing parts only, no new table and no new screen:`)
w(`--   goals       one lpm_data_objects row per expectation (type performance_indicator). The text is the NGSS wording as read from nextgenscience.org`)
w(`--               on ${data.meta.fetchedOn} through a page-summarizing fetch tool (not yet compared with the printed standards). content holds the foundation box (practice, core idea, crosscutting concept), the evolution`)
w(`--               level with its reason, and the concept links, in the shape the Thuringia goals use (basiskonzeptbezug, strength 1 to 3).`)
w(`--   concepts    lpm_schema_elements: the 7 NGSS crosscutting concepts as basic concepts (a hypothesis that they correspond to the six German`)
w(`--               ones), and a root "Evolution concepts" with ${data.evolutionConcepts.length} concepts under it. That is an English draft of the German list in`)
w(`--               EvoMentor_DE data/evolutionskonzepte.json, with the same ids, the same two levels and the German name kept in each concept.`)
w(`--   links       ${nLinks} concept links in content.basiskonzeptbezug (and the same links in lpm_object_tags). A link to a crosscutting concept comes`)
w(`--               from the NGSS foundation box and has strength 3. A link to the evolution concepts carries our own level.`)
w(`--   paths       ${data.threads.length} threads for the Strands tab: ${data.threads.map((t) => `${t.title.replace(/ from grade.*$/, '').toLowerCase()} (${t.stations.length} steps)`).join(', and ')}.`)
w(`--   rights      the NGSS source, its licence terms and the trademark footnote in project_source_declarations.`)
w(`--`)
w(`-- Evolution level: ${nLevel[3]} goals name evolution explicitly (3), ${nLevel[2]} cover the idea without the word (2), ${nLevel[1]} are background only (1). The rule is`)
w(`-- written into the definition of the root concept "Evolution concepts" and checked by the generator against the expectation text.`)
w(`--`)
w(`-- Review state: every goal, concept, link and path carries the agreed tag "${TAG}" (content.draftTag on goals and links,`)
w(`-- metadata.review on concepts, the evidence note on paths). No expert has reviewed any of it. The status 'accepted' on goals only makes`)
w(`-- Browse list them (see migration 235). It does not say a person reviewed them.`)
w(`--`)
w(`-- Space settings: private (visible to the owner and platform admins), maturity draft, English, no parent space. The owner is Dustin, found by`)
w(`-- e-mail as in migrations 128 and 233. If that user is missing, the space is still created and an admin can add the owner later.`)
w(`--`)
w(`-- Rights: the expectation text belongs to NGSS Lead States and is used under the NGSS Public License. content_license stays empty (the ecosystem`)
w(`-- default CC BY-NC-SA 4.0 for the lab's own tags and wording). The third-party terms sit in project_source_declarations, as RFC-0007 expects.`)
w(`--`)
w(`-- Idempotent: fixed uuid5 ids, ON CONFLICT DO NOTHING (or NOT EXISTS) on every insert. Running it twice changes nothing.`)
w(`-- Generated by scripts/generate_evomentor_us_preview_migration.mjs from scripts/data/ngss-evolution-thread-us-2026-11-13.json. Do not hand-edit.`)
w(`-- Rollback: DELETE FROM projects WHERE slug = '${SLUG}'; (everything below cascades).`)
w(`SET search_path = public, extensions;`)
w('')
w('DO $MIGRATION$')
w('DECLARE')
w(`  v_project UUID;`)
w('  v_branch UUID;')
w('  v_user UUID;')
w('BEGIN')
w(`  SELECT id INTO v_user FROM users WHERE email = 'dustin.eirdosh@eva.mpg.de';`)
w('')
w(`  INSERT INTO projects (id, slug, name, description, status, epistemic_status, epistemic_status_note, hosting_mode, is_private, maturity, parent_project_id, focus_type, region_tags, theme_tags, working_languages)`)
w(`  VALUES ('${PROJECT_ID}', '${SLUG}', ${J(NAME)}, ${J(DESCRIPTION)}, 'active', 'in-development',`)
w(`    ${J(STATUS_NOTE)},`)
w(`    'hosted', TRUE, 'draft', NULL, 'regional', ARRAY['US']::TEXT[], ARRAY['evolution','ngss','standards']::TEXT[], ARRAY['en']::TEXT[])`)
w(`  ON CONFLICT (slug) DO NOTHING;`)
w(`  SELECT id INTO v_project FROM projects WHERE slug = '${SLUG}';`)
w(`  IF v_project IS NULL THEN RAISE EXCEPTION '${SLUG} missing'; END IF;`)
w(`  IF v_user IS NOT NULL THEN`)
w(`    INSERT INTO project_members (project_id, user_id, role) VALUES (v_project, v_user, 'owner') ON CONFLICT (project_id, user_id) DO NOTHING;`)
w(`    UPDATE projects SET created_by = v_user WHERE id = v_project AND created_by IS NULL;`)
w(`  END IF;`)
w(`  SELECT id INTO v_branch FROM branches WHERE project_id = v_project AND is_trunk;`)
w(`  IF v_branch IS NULL THEN RAISE EXCEPTION 'trunk branch of ${SLUG} missing'; END IF;`)
w('')
w('  -- Sources and rights')
const srcRows = [
  ['Next Generation Science Standards, performance expectations (NGSS Lead States, 2013), nextgenscience.org', 'Web pages (nextgenscience.org), statement wording copied from the page', NGSS_RIGHTS_NOTE, 'full-text-stored', SOURCE_URL],
  ['Evolution concept list of EvoMentor Thuringia (German), with English names drafted for this space', `JSON list of ${data.evolutionConcepts.length} concepts, two levels`, CONCEPT_LIST_NOTE, 'full-text-stored', null],
]
for (const [name, fmt, note, tier, url] of srcRows) {
  w(`  INSERT INTO project_source_declarations (project_id, source_name, format, license_or_rights_note, access_tier, url)`)
  w(`  SELECT v_project, ${J(name)}, ${J(fmt)}, ${J(note)}, '${tier}', ${url ? J(url) : 'NULL'}`)
  w(`  WHERE NOT EXISTS (SELECT 1 FROM project_source_declarations WHERE project_id = v_project AND source_name = ${J(name)});`)
}
w('')
w('  -- Concepts: the root concepts first, then the two levels of evolution concepts (each statement only points at rows of an earlier one)')
const elementSql = (list) =>
  list.map((e) => `  ('${e.id}', v_project, v_branch, 'concept', ${J(e.label)}, ${J(e.definition)}, ${e.parent ? `'${e.parent}'` : 'NULL'}, ${JSB(e.metadata)}, 'proposed')`).join(',\n')
for (const list of elementsByLevel) {
  w(`  INSERT INTO lpm_schema_elements (id, project_id, branch_id, element_type, label, definition, parent_id, metadata, status) VALUES`)
  w(elementSql(list))
  w(`  ON CONFLICT (id) DO NOTHING;`)
  w('')
}
w('  -- Goals: one per expectation, on the trunk branch with status accepted so that Browse lists them')
w(`  INSERT INTO lpm_data_objects (id, project_id, branch_id, object_type, title, description, grade_band, subject_area, content, status, curriculum_sequence) VALUES`)
w(objects.map((o) => `  ('${o.id}', v_project, v_branch, 'performance_indicator', ${J(o.title)}, ${J(o.description)}, ${J(o.grade_band)}, 'Science', ${JSB(o.content)}, 'accepted', ${o.seq})`).join(',\n'))
w(`  ON CONFLICT (id) DO NOTHING;`)
w('')
w('  -- The same concept links in the table the Coherence screen reads')
w(`  INSERT INTO lpm_object_tags (project_id, data_object_id, schema_element_id, role) VALUES`)
w(tags.map((t) => `  (v_project, '${t.obj}', '${t.el}', ${J(t.role)})`).join(',\n'))
w(`  ON CONFLICT (data_object_id, schema_element_id) DO NOTHING;`)
w('')
w('  -- Paths for the Strands tab')
const EVIDENCE_NOTE = `${TAG}. Built from the core idea codes in the foundation boxes of the listed expectations. NGSS publishes its own progressions of core ideas. This draft has not been compared with them.`
for (const t of data.threads) {
  const tid = uid(`thread:${t.slug}`)
  w(`  INSERT INTO lpm_threads (id, project_id, branch_id, slug, title, thread_type, explained_by_element_id, connecting_idea, narrative, teaching_prompt, evidence_note, gaps, status)`)
  w(`  VALUES ('${tid}', v_project, v_branch, '${t.slug}', ${J(t.title)}, 'vertical', '${evoId(t.explainedBy)}', ${J(t.connectingIdea)}, ${J(t.narrative)}, ${J(t.teachingPrompt)}, ${J(EVIDENCE_NOTE)}, ${JSB(t.gaps)}, 'proposed')`)
  w(`  ON CONFLICT (project_id, slug) DO NOTHING;`)
  w(`  INSERT INTO lpm_thread_stations (id, thread_id, data_object_id, sequence, role_note, via_element_id, relation_to_next) VALUES`)
  w(t.stations.map((s, k) => `  ('${uid(`thread:${t.slug}:${k + 1}`)}', '${tid}', '${itemId(s.code)}', ${k + 1}, ${J(s.note)}, NULL, ${k < t.stations.length - 1 ? "'deepens'" : 'NULL'})`).join(',\n'))
  w(`  ON CONFLICT (thread_id, sequence) DO NOTHING;`)
  w('')
}
w('END $MIGRATION$;')

process.stdout.write(L.join('\n') + '\n')
process.stderr.write(
  `${items.length} goals (level 3: ${nLevel[3]}, level 2: ${nLevel[2]}, level 1: ${nLevel[1]}), ${elements.length} concepts (7 crosscutting, 1 root, ${data.evolutionConcepts.length} evolution), ` +
    `${nLinks} links, ${tags.length} tag rows, ${data.threads.length} threads\n`,
)
