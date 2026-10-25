#!/usr/bin/env node
// Generates the migration that gives bio-core-lpm-synth and interdisciplinary-lpm-synth higher organizing concepts.
//
//   node scripts/generate_organizing_concepts_migration.mjs > supabase/migrations/<n>_organizing_concepts_bio_core_interdisciplinary.sql
//   node scripts/generate_organizing_concepts_migration.mjs --report <path.md>   (also writes the tables used in the design note)
//
// Design source: lab_manager/docs/design-notes/organizing-concepts-for-bio-core-and-interdisciplinary-2026-10-25.md
//
// What it writes, all AI-drafted and unreviewed:
//   1. New organizing concepts as lpm_schema_elements rows (status proposed), five per space.
//   2. For Interdisciplinary, seven discipline facets of Selection and Inheritance as child rows (status proposed).
//   3. parent_id on each existing concept, pointing at its primary organizing concept. This is the one change to
//      existing rows. It is a pointer only. Labels, definitions, statuses and links are untouched, and the rollback
//      at the end of the file is one UPDATE.
//   4. Secondary memberships as lpm_concept_relations rows ('also_organized_by', source llm_suggested, status suggested).
//   5. An additive content.organizingConcepts array on each stage. content.concepts is not changed.
// Live concepts and stages are read with the service_role key from .supabase-secrets (never printed). Ids are
// uuid5-derived, so running again against unchanged content gives identical SQL.

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { v5 as uuid5 } from 'uuid'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const env = readFileSync(path.join(root, '.env.local'), 'utf8')
const URL_ = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '')
const KEY = readFileSync(path.join(root, '.supabase-secrets', 'service-role-key.txt'), 'utf8').trim()
async function rest(p) {
  const r = await fetch(`${URL_}/rest/v1/${p}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  if (!r.ok) throw new Error(`${p}: ${r.status}`)
  return r.json()
}

const NS = uuid5('https://openevo-ccs.github.io/openlpm/organizing-concepts-2026-10-25', uuid5.URL)
const uid = (...parts) => uuid5(parts.join('/'), NS)
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const jq = (o) => q(JSON.stringify(o)) + '::jsonb'

const NOTE = 'AI-drafted on 2026-10-25 from the stage links in content.concepts, by the rule in the design note. No subject-matter expert has reviewed it.'
const TIE = 0.8 // a second organizing concept within 80 percent of the top one is also primary
const SECONDARY = 0.4 // an organizing concept with at least 40 percent of the top weight is secondary

// ---------------------------------------------------------------------------------------------------------------
// Design data
// ---------------------------------------------------------------------------------------------------------------
const SPACES = {
  bio: {
    slug: 'bio-core-lpm-synth',
    pid: '28997544-0d87-4b05-9ee2-7c474513c108',
    vocab: 'BIO-CORE-v1.0.0',
    idPrefix: 'OE-CONCEPT-bio-core-oc-',
    ocs: [
      { key: 'heritable-variation', label: 'Heritable Variation',
        definition: 'Individuals in a population differ in their traits, and some of those differences pass from parents to offspring. New variants arise by mutation.',
        principles: ['Every population contains variation.', 'Only differences that are inherited can change a population over generations.', 'Mutation adds new variants, and no process aims at which variants appear.'],
        excludes: ['Any account in which organisms make the variants they need.'],
        counterpart: 'Shared in part with the Interdisciplinary organizing concept The Evolutionary Pattern, which joins variation and inheritance to selection and transmission across domains.' },
      { key: 'differential-reproduction', label: 'Differential Reproduction',
        definition: 'Variants leave different numbers of offspring because of how they interact with their surroundings. Over generations this changes which variants are common.',
        principles: ['Some variants leave more offspring than others in a given setting.', 'The same variant can do better in one setting and worse in another.', 'Natural settings, mating success and human breeding all act as conditions on variants. The variants do not choose the condition.'],
        excludes: ['Organisms trying, wanting or needing to change.'],
        counterpart: 'Divergent. Interdisciplinary holds the biological form as one facet of Selection, next to cultural, educational and computational forms.' },
      { key: 'change-in-populations', label: 'Change in Populations',
        definition: 'The mix of variants in a population shifts from one generation to the next. Selection shifts it in a direction. Chance shifts it with no direction.',
        principles: ['The unit that changes in evolution is the population.', 'Selection gives change a direction and drift gives it none.', 'Chance effects are stronger in small populations.'],
        excludes: ['Change inside one individual during its lifetime.'],
        counterpart: 'Absent as a separate organizing concept in Interdisciplinary, where population-level change sits inside The Evolutionary Pattern.' },
      { key: 'common-descent', label: 'Common Descent and Deep Time',
        definition: 'All living things share ancestors. The history of life is a branching tree over very long time, and many branches end in extinction.',
        principles: ['Relatedness is a matter of how recently two groups share an ancestor.', 'Lineages split, and some end.', 'The time involved is far longer than human history.'],
        excludes: ['Ladders of progress and any main line toward one group.'],
        counterpart: 'Absent in Interdisciplinary, which has no phylogeny or extinction concept.' },
      { key: 'species-divergence', label: 'Species and Divergence',
        definition: 'Populations that stay apart can change in different ways until they become separate species.',
        principles: ['A species is a group of populations that can interbreed and that stay apart from other such groups.', 'Separation, variation and selection together produce divergence.', 'Large differences in appearance do not by themselves make separate species.'],
        excludes: ['Species as fixed types.'],
        counterpart: 'Absent in Interdisciplinary.' },
    ],
    // concept label -> primary organizing concept and secondary ones
    map: {
      'Inheritance': ['heritable-variation', []], 'Gene': ['heritable-variation', []], 'Allele': ['heritable-variation', ['change-in-populations']],
      'Mutation': ['heritable-variation', ['change-in-populations']],
      'Natural Selection': ['differential-reproduction', ['change-in-populations', 'species-divergence']],
      'Fitness': ['differential-reproduction', ['change-in-populations']],
      'Selection Pressure': ['differential-reproduction', ['change-in-populations', 'species-divergence']],
      'Adaptation': ['differential-reproduction', []], 'Sexual Selection': ['differential-reproduction', []],
      'Domestication': ['differential-reproduction', ['species-divergence']],
      'Population': ['change-in-populations', ['heritable-variation']], 'Drift': ['change-in-populations', []],
      'Common Ancestor': ['common-descent', ['species-divergence']], 'Phylogeny': ['common-descent', ['species-divergence']],
      'Extinction': ['common-descent', []],
      'Speciation': ['species-divergence', []], 'Species': ['species-divergence', ['common-descent']],
    },
    facets: [],
  },
  int: {
    slug: 'interdisciplinary-lpm-synth',
    pid: '371fce26-d1f3-439b-95df-0a0e38b8a824',
    vocab: 'OE-INTERDISCIPLINARY-v1.0.0',
    idPrefix: 'OE-CONCEPT-oe-interdisciplinary-oc-',
    ocs: [
      { key: 'evolutionary-pattern', label: 'The Evolutionary Pattern',
        definition: 'Variants appear, some persist or spread more than others, and traits or practices pass on. The same pattern appears in living things, culture, learning and technology. Each domain gives the key words its own meaning, so students learn the pattern and its differences.',
        principles: ['Variation, selection and transmission together make a general pattern.', 'Selection, inheritance and transmission carry a domain-specific meaning in biology, culture, education and computing.', 'Using the pattern on a new case means checking which parts carry over.'],
        excludes: ['Treating the pattern as proof that the domains work in the same way.'],
        counterpart: 'Shared in part with Bio-Core. Bio-Core splits the pattern into Heritable Variation, Differential Reproduction and Change in Populations and keeps each in biology only.' },
      { key: 'agency-niche', label: 'Agency and Niche Construction',
        definition: 'Individuals and groups act, and their actions change the conditions that selection works on. The space teaches when thinking in terms of goals and choices explains something and when it misleads.',
        principles: ['Agency is a matter of degree and differs between organisms, people and systems.', 'What an actor does can change the selective setting for itself and for others.', 'Development shapes what an actor can do.'],
        excludes: ['Agency used everywhere, and agency left out everywhere.'],
        counterpart: 'Absent in Bio-Core by design, whose vocabulary has no organism agency.' },
      { key: 'learning-discovery', label: 'Learning, Minds and Discovery',
        definition: 'How individuals build, test and pass on understanding, with support from others, and how minds search for better ideas by starting from similar cases.',
        principles: ['Learning builds on what a learner already believes.', 'Support from others is temporary and is withdrawn as competence grows.', 'Comparing a new case with a familiar one is a way to search for ideas, and the comparison needs checking.'],
        excludes: ['Learning described as filling an empty mind.'],
        counterpart: 'Absent in Bio-Core.' },
      { key: 'culture-social', label: 'Culture and Social Structure',
        definition: 'Groups share and carry knowledge and practices. Norms and institutions regulate behavior, and groups meet shared problems through cooperation and conflict.',
        principles: ['Culture persists beyond any one member of a group.', 'Norms and institutions stabilize group behavior.', 'Cooperation and conflict both shape which practices spread.'],
        excludes: ['Culture as a fixed list of traits of a group of people.'],
        counterpart: 'Absent in Bio-Core.' },
      { key: 'information-technology', label: 'Information, Technology and Collective Systems',
        definition: 'Information is encoded, communicated and represented. Tools and distributed systems extend what individuals can do, alone and together.',
        principles: ['Information can be carried by genes, speech, symbols and code.', 'Representations stand for things and can be shared.', 'Tools and collective systems change what a group can know and do.'],
        excludes: ['Technology as a neutral object or as a separate force acting on people.'],
        counterpart: 'Absent in Bio-Core.' },
    ],
    map: {
      'Evolutionary Process': ['evolutionary-pattern', []], 'Variation': ['evolutionary-pattern', []],
      'Selection': ['evolutionary-pattern', ['learning-discovery', 'culture-social', 'information-technology']],
      'Inheritance': ['evolutionary-pattern', ['culture-social', 'information-technology']],
      'Transmission': ['evolutionary-pattern', ['culture-social', 'information-technology']],
      'Innovation': ['evolutionary-pattern', ['culture-social', 'information-technology']],
      'Agency': ['agency-niche', ['learning-discovery', 'culture-social']],
      'Niche Construction': ['agency-niche', ['evolutionary-pattern', 'culture-social']],
      'Development': ['agency-niche', ['learning-discovery']],
      'Domestication': ['agency-niche', ['evolutionary-pattern', 'culture-social']],
      'Learning': ['learning-discovery', ['agency-niche']], 'Teaching': ['learning-discovery', ['culture-social']],
      'Scaffolding': ['learning-discovery', []], 'Metacognition': ['learning-discovery', []],
      'Analogical Reasoning': ['learning-discovery', []], 'Intuitive Theories': ['learning-discovery', ['agency-niche']],
      'Theory of Mind': ['learning-discovery', ['agency-niche']],
      'Culture': ['culture-social', ['evolutionary-pattern', 'information-technology']], 'Norms': ['culture-social', []],
      'Institutions': ['culture-social', ['information-technology']], 'Cooperation': ['culture-social', ['agency-niche']],
      'Conflict': ['culture-social', ['agency-niche']],
      'Information': ['information-technology', ['evolutionary-pattern', 'learning-discovery']],
      'Knowledge': ['information-technology', ['learning-discovery']], 'Representation': ['information-technology', ['learning-discovery']],
      'Communication': ['information-technology', ['culture-social']], 'Technology': ['information-technology', ['culture-social']],
      'Collective Intelligence': ['information-technology', ['culture-social']], 'Distributed Cognition': ['information-technology', ['learning-discovery']],
    },
    // Discipline facets: the existing definitions of Selection and Inheritance already name them.
    facets: [
      { parent: 'Selection', key: 'selection-biology', label: 'Selection (biology)', definition: 'Differential reproductive success among heritable variants.', secondary: [] },
      { parent: 'Selection', key: 'selection-culture', label: 'Selection (culture)', definition: 'Differential persistence or spread of cultural variants based on their fit to a social or environmental context.', secondary: ['culture-social'] },
      { parent: 'Selection', key: 'selection-education', label: 'Selection (education)', definition: 'Choosing among available instructional pathways or resources.', secondary: ['learning-discovery'] },
      { parent: 'Selection', key: 'selection-ai', label: 'Selection (AI and computation)', definition: 'A search or optimization process that favors candidates scoring higher against an objective function.', secondary: ['information-technology'] },
      { parent: 'Inheritance', key: 'inheritance-biology', label: 'Inheritance (biology)', definition: 'Transmission of genetic information from parent to offspring.', secondary: [] },
      { parent: 'Inheritance', key: 'inheritance-culture', label: 'Inheritance (culture)', definition: 'Transmission of beliefs, practices or knowledge from one generation or individual to another through social learning.', secondary: ['culture-social'] },
      { parent: 'Inheritance', key: 'inheritance-technology', label: 'Inheritance (technology)', definition: 'Persistence of design features or code structure across successive versions of an artifact or system.', secondary: ['information-technology'] },
    ],
  },
}

// ---------------------------------------------------------------------------------------------------------------
// Read the live content and compute
// ---------------------------------------------------------------------------------------------------------------
const BAND_ORDER = ['K-2', '3-5', '6-8', '9-12']
const sql = []
const w = (s = '') => sql.push(s)
const md = []
const m = (s = '') => md.push(s)

function summarize(values) {
  const n = values.length
  if (!n) return { mean: 0, median: 0, max: 0, share3: 0, once: 0, entropy: 0, gini: 0, top3: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const total = values.reduce((a, b) => a + b, 0)
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  let entropy = 0
  for (const v of values) if (v > 0) { const p = v / total; entropy -= p * Math.log2(p) }
  let cum = 0
  sorted.forEach((v, i) => { cum += (i + 1) * v })
  const gini = total > 0 ? Math.max(0, (2 * cum) / (n * total) - (n + 1) / n) : 0
  const top3 = [...sorted].reverse().slice(0, 3).reduce((a, b) => a + b, 0)
  return { mean: total / n, median, max: sorted[n - 1], share3: values.filter((v) => v >= 3).length / n, once: values.filter((v) => v === 1).length, entropy, gini, top3: total > 0 ? top3 / total : 0 }
}
const f1 = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1))
const f2 = (x) => x.toFixed(2)

const results = {}
for (const [spaceKey, sp] of Object.entries(SPACES)) {
  const els = await rest(`lpm_schema_elements?select=id,label,metadata,status,parent_id&project_id=eq.${sp.pid}&element_type=eq.concept&limit=200`)
  const stages = await rest(`lpm_data_objects?select=id,title,grade_band,status,content&project_id=eq.${sp.pid}&object_type=eq.substrand&limit=200`)
  // The ring and tree both need every concept present, so never run on top of an earlier hierarchy.
  const existing = els.filter((e) => !(e.metadata && (e.metadata.level === 'organizing' || e.metadata.level === 'discipline-facet')))
  const byLabel = new Map(existing.map((e) => [e.label, e]))
  const cbToLabel = new Map(existing.map((e) => [e.metadata?.conceptbase_id, e.label]))
  const ocKeys = sp.ocs.map((o) => o.key)

  // Checks: no orphan concept, no mapping to a missing concept, every organizing concept governs enough.
  const missing = existing.filter((e) => !sp.map[e.label]).map((e) => e.label)
  const extra = Object.keys(sp.map).filter((l) => !byLabel.has(l))
  if (missing.length || extra.length) throw new Error(`${spaceKey}: concepts without a mapping: ${missing.join(', ') || 'none'}; mapping without a concept: ${extra.join(', ') || 'none'}`)
  for (const [label, [p, s]] of Object.entries(sp.map)) for (const k of [p, ...s]) if (!ocKeys.includes(k)) throw new Error(`${spaceKey}: unknown organizing concept ${k} for ${label}`)

  const ocId = (k) => uid('oc', sp.pid, k)
  const ocCb = (k) => sp.idPrefix + k
  const ocLabel = (k) => sp.ocs.find((o) => o.key === k).label

  // Stage links by rule.
  const stageLinks = stages.map((s) => {
    const weights = Object.fromEntries(ocKeys.map((k) => [k, 0]))
    for (const c of s.content?.concepts ?? []) {
      const label = cbToLabel.get(c.id)
      const mapped = label ? sp.map[label] : null
      if (!mapped) continue
      const wgt = c.emphasis === 'primary' ? 2 : 1
      weights[mapped[0]] += wgt
      for (const k of mapped[1]) weights[k] += wgt * 0.5
    }
    const top = Math.max(...Object.values(weights))
    const links = []
    if (top > 0) {
      for (const k of ocKeys) {
        if (weights[k] >= TIE * top) links.push({ k, emphasis: 'primary', weight: weights[k] })
        else if (weights[k] >= SECONDARY * top) links.push({ k, emphasis: 'reinforcing', weight: weights[k] })
      }
      links.sort((a, b) => b.weight - a.weight)
    }
    return { stage: s, links }
  })

  // Governed concepts and reach (accepted stages only, the same basis as the structural profile).
  const accepted = stageLinks.filter((x) => x.stage.status === 'accepted')
  const governed = Object.fromEntries(ocKeys.map((k) => [k, { primary: [], secondary: [] }]))
  for (const [label, [p, s]] of Object.entries(sp.map)) { governed[p].primary.push(label); for (const k of s) governed[k].secondary.push(label) }
  const ocReach = ocKeys.map((k) => {
    const withOc = accepted.filter((x) => x.links.some((l) => l.k === k))
    const withPrimary = accepted.filter((x) => x.links.some((l) => l.k === k && l.emphasis === 'primary'))
    return {
      key: k, label: ocLabel(k),
      stages: withOc.length, primaryStages: withPrimary.length,
      strands: new Set(withOc.map((x) => x.stage.content?._source?.path)).size,
      bands: new Set(withOc.map((x) => x.stage.grade_band)).size,
      primaryConcepts: governed[k].primary.length, secondaryConcepts: governed[k].secondary.length,
      firstAny: withOc.length ? BAND_ORDER[Math.min(...withOc.map((x) => BAND_ORDER.indexOf(x.stage.grade_band)))] : 'none',
      firstMain: withPrimary.length ? BAND_ORDER[Math.min(...withPrimary.map((x) => BAND_ORDER.indexOf(x.stage.grade_band)))] : 'none',
    }
  })
  const fine = existing.map((e) => {
    const withC = accepted.filter((x) => (x.stage.content?.concepts ?? []).some((c) => cbToLabel.get(c.id) === e.label))
    return { label: e.label, stages: withC.length, strands: new Set(withC.map((x) => x.stage.content?._source?.path)).size, bands: new Set(withC.map((x) => x.stage.grade_band)).size }
  }).filter((r) => r.stages > 0)
  const flags = []
  for (const r of ocReach) {
    if (r.primaryConcepts + r.secondaryConcepts < 3) flags.push(`${r.label} governs fewer than three concepts`)
    if (r.stages < 3) flags.push(`${r.label} reaches fewer than three accepted stages`)
    if (r.primaryConcepts < 3) flags.push(`${r.label} has ${r.primaryConcepts} primary concepts and relies on secondary links to govern three`)
  }
  results[spaceKey] = { sp, els: existing, stageLinks, ocReach, fine, governed, flags, byLabel }

  // -------------------------------------------------------------------------------------------------------------
  // SQL
  // -------------------------------------------------------------------------------------------------------------
  w(`-- ${sp.slug}`)
  for (const o of sp.ocs) {
    const meta = { definition: o.definition, vocabulary: sp.vocab, conceptbase_id: ocCb(o.key), level: 'organizing', proposed_not_in_conceptbase: true, proposed_on: '2026-10-25', excludes: o.excludes, counterpart_in_partner_space: o.counterpart, grounding: NOTE }
    w('INSERT INTO lpm_schema_elements (id, project_id, element_type, label, definition, parent_id, metadata, status, core_principles)')
    w(`VALUES (${q(ocId(o.key))}, ${q(sp.pid)}, 'concept', ${q(o.label)}, ${q(o.definition)}, NULL, ${jq(meta)}, 'proposed', ${jq(o.principles)}) ON CONFLICT (id) DO NOTHING;`)
  }
  for (const f of sp.facets) {
    const parent = byLabel.get(f.parent)
    const meta = { definition: f.definition, vocabulary: sp.vocab, conceptbase_id: `OE-CONCEPT-oe-interdisciplinary-${f.key}`, level: 'discipline-facet', facet_of: f.parent, proposed_not_in_conceptbase: true, proposed_on: '2026-10-25', grounding: `Taken from the discipline-specific definitions already inside the ${f.parent} concept. ${NOTE}` }
    w('INSERT INTO lpm_schema_elements (id, project_id, element_type, label, definition, parent_id, metadata, status)')
    w(`VALUES (${q(uid('facet', sp.pid, f.key))}, ${q(sp.pid)}, 'concept', ${q(f.label)}, ${q(f.definition)}, ${q(parent.id)}, ${jq(meta)}, 'proposed') ON CONFLICT (id) DO NOTHING;`)
  }
  w('')
  w(`-- Primary organizing concept for each existing concept: a pointer only (parent_id was NULL).`)
  for (const e of existing) {
    const [p] = sp.map[e.label]
    w(`UPDATE lpm_schema_elements SET parent_id = ${q(ocId(p))} WHERE id = ${q(e.id)} AND parent_id IS NULL;`)
  }
  w('')
  w(`-- Secondary memberships, as suggested relations nobody has reviewed.`)
  const rel = (fromId, k) => {
    w('INSERT INTO lpm_concept_relations (id, project_id, from_element_id, to_element_id, relation_type, source, status)')
    w(`VALUES (${q(uid('rel', fromId, k))}, ${q(sp.pid)}, ${q(fromId)}, ${q(ocId(k))}, 'also_organized_by', 'llm_suggested', 'suggested') ON CONFLICT (from_element_id, to_element_id, relation_type) DO NOTHING;`)
  }
  for (const e of existing) for (const k of sp.map[e.label][1]) rel(e.id, k)
  for (const f of sp.facets) for (const k of f.secondary) rel(uid('facet', sp.pid, f.key), k)
  w('')
  w(`-- Stage links: an additive content.organizingConcepts array. content.concepts is not changed.`)
  for (const { stage, links } of stageLinks) {
    if (links.length === 0) continue
    const arr = links.map((l) => ({ id: ocCb(l.k), emphasis: l.emphasis }))
    w(`UPDATE lpm_data_objects SET content = content || jsonb_build_object('organizingConcepts', ${jq(arr)}, 'organizingConceptsNote', ${q(NOTE)}) WHERE id = ${q(stage.id)} AND NOT (content ? 'organizingConcepts');`)
  }
  w('')
}

// ---------------------------------------------------------------------------------------------------------------
// Rollback, as comments
// ---------------------------------------------------------------------------------------------------------------
w('-- ROLLBACK (run by hand if the hierarchy should be removed):')
for (const [, r] of Object.entries(results)) {
  const ids = r.els.map((e) => q(e.id)).join(', ')
  w(`--   UPDATE lpm_schema_elements SET parent_id = NULL WHERE id IN (${ids});`)
  w(`--   DELETE FROM lpm_schema_elements WHERE project_id = ${q(r.sp.pid)} AND metadata ->> 'level' IN ('organizing', 'discipline-facet');`)
  w(`--   UPDATE lpm_data_objects SET content = content - 'organizingConcepts' - 'organizingConceptsNote' WHERE project_id = ${q(r.sp.pid)};`)
}
w('--   (Deleting the organizing and facet rows also removes their also_organized_by relations, which cascade.)')

// ---------------------------------------------------------------------------------------------------------------
// Report for the design note
// ---------------------------------------------------------------------------------------------------------------
const reportIdx = process.argv.indexOf('--report')
if (reportIdx > -1) {
  for (const [key, r] of Object.entries(results)) {
    const title = key === 'bio' ? 'Bio-Core' : 'Interdisciplinary'
    m(`## ${title}`)
    m()
    m('### Organizing concepts')
    m()
    m('| Organizing concept | Definition | Main points | Leaves out | Place relative to the partner space |')
    m('|---|---|---|---|---|')
    for (const o of r.sp.ocs) m(`| ${o.label} | ${o.definition} | ${o.principles.join(' ')} | ${o.excludes.join(' ')} | ${o.counterpart} |`)
    m()
    m('### Concept mapping')
    m()
    m('| Concept | Status | Primary organizing concept | Secondary |')
    m('|---|---|---|---|')
    for (const e of [...r.els].sort((a, b) => r.sp.map[a.label][0].localeCompare(r.sp.map[b.label][0]) || a.label.localeCompare(b.label))) {
      const [p, s] = r.sp.map[e.label]
      m(`| ${e.label} | ${e.status} | ${r.sp.ocs.find((o) => o.key === p).label} | ${s.map((k) => r.sp.ocs.find((o) => o.key === k).label).join('; ') || 'none'} |`)
    }
    if (r.sp.facets.length) {
      m()
      m('Discipline facets (second level, proposed):')
      m()
      m('| Facet | Child of | Also organized by |')
      m('|---|---|---|')
      for (const f of r.sp.facets) m(`| ${f.label} | ${f.parent} | ${f.secondary.map((k) => r.sp.ocs.find((o) => o.key === k).label).join('; ') || 'none'} |`)
    }
    m()
    m('### Stage mapping (accepted stages)')
    m()
    m('| Id | Band | Stage | Primary | Secondary |')
    m('|---|---|---|---|---|')
    const stagesAcc = r.stageLinks.filter((x) => x.stage.status === 'accepted').sort((a, b) => (a.stage.content?._source?.path ?? '').localeCompare(b.stage.content?._source?.path ?? '') || BAND_ORDER.indexOf(a.stage.grade_band) - BAND_ORDER.indexOf(b.stage.grade_band))
    for (const { stage, links } of stagesAcc) {
      const lab = (k) => r.sp.ocs.find((o) => o.key === k).label
      m(`| ${stage.id.slice(0, 8)} | ${stage.grade_band} | ${stage.title} | ${links.filter((l) => l.emphasis === 'primary').map((l) => lab(l.k)).join('; ')} | ${links.filter((l) => l.emphasis !== 'primary').map((l) => lab(l.k)).join('; ') || 'none'} |`)
    }
    const drafts = r.stageLinks.filter((x) => x.stage.status !== 'accepted')
    m()
    m(`The ${drafts.length} draft human-example stages receive the same links by the same rule (not listed here).`)
    m()
    m('### Reach')
    m()
    m('| Organizing concept | Primary concepts | Secondary concepts | Accepted stages | of which as main idea | Strands | Bands | First appears | First as main idea |')
    m('|---|---|---|---|---|---|---|---|---|')
    for (const o of r.ocReach) m(`| ${o.label} | ${o.primaryConcepts} | ${o.secondaryConcepts} | ${o.stages} | ${o.primaryStages} | ${o.strands} | ${o.bands} | ${o.firstAny} | ${o.firstMain} |`)
    const sFine = summarize(r.fine.map((x) => x.stages))
    const sOc = summarize(r.ocReach.map((x) => x.stages))
    const sFineStr = summarize(r.fine.map((x) => x.strands))
    const sOcStr = summarize(r.ocReach.map((x) => x.strands))
    m()
    m('| Reach measure (accepted stages) | Fine-grained concepts | Organizing concepts |')
    m('|---|---|---|')
    m(`| Items | ${r.fine.length} | ${r.ocReach.length} |`)
    m(`| Stages per item: mean, median, max | ${f1(sFine.mean)}, ${f1(sFine.median)}, ${sFine.max} | ${f1(sOc.mean)}, ${f1(sOc.median)}, ${sOc.max} |`)
    m(`| Strands per item: mean, max | ${f1(sFineStr.mean)}, ${sFineStr.max} | ${f1(sOcStr.mean)}, ${sOcStr.max} |`)
    m(`| Share in three or more stages | ${Math.round(sFine.share3 * 100)}% | ${Math.round(sOc.share3 * 100)}% |`)
    m(`| In one stage only | ${sFine.once} | ${sOc.once} |`)
    m(`| Entropy (bits) | ${f2(sFine.entropy)} | ${f2(sOc.entropy)} |`)
    m(`| Gini | ${f2(sFine.gini)} | ${f2(sOc.gini)} |`)
    m(`| Share held by top three | ${Math.round(sFine.top3 * 100)}% | ${Math.round(sOc.top3 * 100)}% |`)
    m()
    m('### Checks')
    m()
    m(`Concepts in the space: ${r.els.length}. Concepts without a primary organizing concept: 0. Organizing concepts: ${r.sp.ocs.length}. Every organizing concept governs at least three concepts and reaches at least three accepted stages: ${r.flags.filter((f) => /fewer than three/.test(f)).length === 0 ? 'yes' : 'no'}.`)
    if (r.flags.length) { m(); for (const fl of r.flags) m(`- ${fl}.`) }
    m()
  }
  writeFileSync(process.argv[reportIdx + 1], md.join('\n'))
  process.stderr.write(`Wrote report to ${process.argv[reportIdx + 1]}\n`)
}

const header = `-- Higher organizing concepts for bio-core-lpm-synth and interdisciplinary-lpm-synth.
-- Generated by scripts/generate_organizing_concepts_migration.mjs; do not hand-edit.
--
-- Design: lab_manager/docs/design-notes/organizing-concepts-for-bio-core-and-interdisciplinary-2026-10-25.md
--
-- Everything below is AI-drafted and has not been reviewed by a subject-matter expert. The organizing concepts and
-- discipline facets load as status 'proposed'. Secondary memberships load as suggested relations. The one change to
-- existing rows is parent_id on each existing concept (a pointer to its primary organizing concept). Labels,
-- definitions, statuses and content.concepts are untouched. After this migration each space has a hierarchy, so the
-- Concepts map switches from the ring to the tree layout. A rollback is at the end of the file.
-- Idempotent: fixed uuid5 ids, ON CONFLICT, and updates that only touch rows still unset.

SET search_path = public, extensions;

`
process.stdout.write(header + sql.join('\n') + '\n')
