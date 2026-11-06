#!/usr/bin/env node
// Generates the migration that adds host-subject hour budgets to the time layer:
//   1. two columns: lpm_time_axes.subject (which school subject an axis describes) and lpm_time_placements.axis_id
//      (which axis a placement lands on, empty meaning the plan's own axis)
//   2. a revision of the biology hours seeded by migration 176, after Dustin judged the upper tier too high
//   3. a social studies axis and a computer science axis in both synthetic spaces, with placeholder hours
//   4. four plans for the Interdisciplinary space that take the same total hours as the one-subject starter plans
//      from biology, social studies and computer science
// The order edges come from the space's own sequencing claims, read from the live database with the service_role key
// from .supabase-secrets (never printed). Ids are uuid5-derived, so re-running gives identical SQL.
//
//   node scripts/generate_host_budgets_migration.mjs > supabase/migrations/179_host_subject_hour_budgets.sql
//   node scripts/generate_host_budgets_migration.mjs --fixtures out.json > /dev/null   (also writes test fixtures)

import { build } from 'esbuild'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { v5 as uuid5 } from 'uuid'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'host-seed-'))
const out = path.join(dir, 'time.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/time/index.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const T = await import(pathToFileURL(out).href)
rmSync(dir, { recursive: true, force: true })

const env = readFileSync(path.join(root, '.env.local'), 'utf8')
const URL_ = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/^"|"$/g, '')
const KEY = readFileSync(path.join(root, '.supabase-secrets', 'service-role-key.txt'), 'utf8').trim()
async function rest(p) {
  const r = await fetch(`${URL_}/rest/v1/${p}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  if (!r.ok) throw new Error(`${p}: ${r.status}`)
  return r.json()
}

// Same namespace as migration 176, so the ids of the biology axes and assumptions match the rows that migration created.
const NS = uuid5('https://openevo-ccs.github.io/openlpm/time-layer-2026-10-25', uuid5.URL)
const uid = (...parts) => uuid5(parts.join('/'), NS)
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const jq = (o) => q(JSON.stringify(o)) + '::jsonb'
const sqlOrNull = (v) => (v === null || v === undefined ? 'NULL' : q(v))

const PROJECTS = {
  'bio-core-lpm-synth': '28997544-0d87-4b05-9ee2-7c474513c108',
  'interdisciplinary-lpm-synth': '371fce26-d1f3-439b-95df-0a0e38b8a824',
}
const SHARE = { low: 0.1, high: 0.3 }

// The figures migration 176 seeded for biology, and the revision.
const OLD = [
  { key: 'lower', text: 'Biology gets 15-45 hours a year in the lower grades (K-4).' },
  { key: 'middle', text: 'Biology gets 40-80 hours a year in the middle grades (5-8). Adjust to local conditions.' },
  { key: 'upper', text: 'Biology gets 100-150 hours a year in the upper grades (9-12).' },
]
const NEW_BIO = [
  { text: 'Biology gets 8-21 hours a year in the lower grades (K-4).', type: 'derived', src: 'Scaled from Dustin Eirdosh, 2026-10-25.', why: 'His first range was 15-45 hours. He then judged the upper tier too high and suggested lowering the lower tiers in proportion. This figure applies the same ratio (about 0.5 at the low end and 0.47 at the high end). No published source yet.', value: { low: 'PT8H', high: 'PT21H' } },
  { text: 'Biology gets 20-38 hours a year in the middle grades (5-8). Adjust to local conditions.', type: 'derived', src: 'Scaled from the default Dustin Eirdosh gave, 2026-10-25.', why: 'The earlier default was 40-80 hours. It was lowered by the same ratio as the upper tier. Local conditions differ.', value: { low: 'PT20H', high: 'PT38H' } },
  { text: 'Biology gets 50-70 hours a year in the upper grades (9-12).', type: 'estimate', src: 'Dustin Eirdosh, 2026-10-25 (revised the same day).', why: 'His first figure of 100-150 hours was likely too high for secondary school. 50-70 is the more likely range. No published source yet.', value: { low: 'PT50H', high: 'PT70H' } },
]

// Hours of the two other subjects. Placeholders with no source, chosen to claim as little as possible.
const SUBJECTS = [
  {
    key: 'social-studies', label: 'Social studies',
    tiers: T.DEFAULT_TIER_HOURS,
    notes: { lower: 'Placeholder, no source: the same hours as biology.', middle: 'Placeholder, no source: the same hours as biology.', upper: 'Placeholder, no source: the same hours as biology.' },
    statement: 'Social studies gets the same hours a year as biology: 8-21 in the lower grades, 20-38 in the middle grades and 50-70 in the upper grades.',
    why: 'No figure for this subject exists yet. Matching biology adds no outside claim. Replace it with the local timetable.',
  },
  {
    key: 'computer-science', label: 'Computer science',
    tiers: { lower: { low: 0, high: 0 }, middle: { low: 10, high: 19 }, upper: { low: 25, high: 35 } },
    notes: { lower: 'Placeholder, no source: no separate computer science hours in K-4.', middle: 'Placeholder, no source: half of the biology hours.', upper: 'Placeholder, no source: half of the biology hours.' },
    statement: 'Computer science gets no hours in the lower grades (K-4), 10-19 hours a year in the middle grades and 25-35 in the upper grades.',
    why: 'No figure for this subject exists yet. Half of the biology hours in grades 5-12 and none before is a deliberately low placeholder. Replace it with the local timetable.',
  },
]

// Each strand of the source LPM lists the school domains it belongs to (the field associatedDomains). A stage takes
// its time in equal parts from those domains. Science is counted as biology, since biology is the reference subject
// and there is no separate science timetable here. The mapping is a rule of this model and is open to debate.
const DOMAIN_TO_SUBJECT = { 'Biology': 'biology', 'Science': 'biology', 'Social Studies': 'social-studies', 'Computer Science': 'computer-science' }

const lines = []
const w = (s = '') => lines.push(s)
const fx = { axisUpdates: [], axes: [], plans: [], placements: [], assumptions: [] }

w(`-- Host-subject hour budgets for the time layer.
-- Generated by scripts/generate_host_budgets_migration.mjs; do not hand-edit.
--
-- An LPM never owns teaching time. Its content is taught inside subjects that already have a timetable. Each
-- subject is an axis with the same bands and years as the plan's own axis, and a placement now says which axis it
-- lands on. That lets the Interdisciplinary space draw hours from biology, social studies and computer science
-- separately, and lets the Time page show what each subject gives up.
--
--   lpm_time_axes.subject       the school subject an axis describes (open vocabulary), empty for a calendar
--   lpm_time_placements.axis_id the axis a placement lands on; empty means the plan's own axis
--
-- The same migration lowers the biology hours seeded by migration 176. Dustin judged 100-150 hours a year in the
-- upper grades too high (2026-10-25, later the same day) and suggested 50-70, with the lower tiers reduced in
-- proportion. Rows that were edited since are left alone.
-- Everything seeded here is AI-drafted, status 'proposed', and every hour figure is a placeholder with no source.

SET search_path = public, extensions;

ALTER TABLE lpm_time_axes ADD COLUMN IF NOT EXISTS subject TEXT;
COMMENT ON COLUMN lpm_time_axes.subject IS 'Open vocabulary. The school subject whose timetable this axis describes (biology, social-studies, computer-science, ...). Empty for a calendar that belongs to no one subject.';
ALTER TABLE lpm_time_placements ADD COLUMN IF NOT EXISTS axis_id UUID REFERENCES lpm_time_axes(id) ON DELETE CASCADE;
COMMENT ON COLUMN lpm_time_placements.axis_id IS 'The axis this placement lands on. Empty means the axis of the plan. The axis must belong to the same project and share the plan axis levels.';
CREATE INDEX IF NOT EXISTS idx_lpm_time_placements_axis ON lpm_time_placements(axis_id);
`)

const axisDefs = {}
for (const [slug, pid] of Object.entries(PROJECTS)) {
  w(`-- ${slug}: biology hours revised, two more subjects`)
  const axisBio = uid('axis', pid, 'k12-tiers')
  const newDef = T.k12TierAxis()
  const AXIS_SOURCE = 'Hours per year, biology: Dustin Eirdosh, 2026-10-25, revised the same day (upper grades 50-70; lower and middle scaled by the same ratio). All placeholders.'
  w(`UPDATE lpm_time_axes SET definition = ${jq(newDef)}, source = ${q(AXIS_SOURCE)}, updated_at = NOW()`)
  w(`WHERE id = ${q(axisBio)} AND definition #>> '{segments,2,duration,low}' = 'PT100H';`)
  w(`UPDATE lpm_time_axes SET subject = 'biology' WHERE id = ${q(axisBio)} AND subject IS NULL;`)
  fx.axisUpdates.push({ id: axisBio, definition: newDef, source: AXIS_SOURCE, subject: 'biology' })
  OLD.forEach((o, i) => {
    const n = NEW_BIO[i]
    const aid = uid('assumption', pid, String(i))
    w(`UPDATE lpm_time_assumptions SET statement = ${q(n.text)}, assumption_type = ${q(n.type)}, source = ${q(n.src)}, rationale = ${q(n.why)}, value = ${jq(n.value)}, updated_at = NOW()`)
    w(`WHERE id = ${q(aid)} AND statement = ${q(o.text)};`)
    fx.assumptions.push({ id: aid, __update: true, statement: n.text, assumption_type: n.type, source: n.src, rationale: n.why, value: n.value })
  })

  axisDefs[pid] = { biology: { id: axisBio, def: newDef } }
  for (const s of SUBJECTS) {
    const id = uid('axis', pid, `host-${s.key}`)
    const def = T.k12TierAxis(s.tiers, s.notes)
    const name = `${s.label}: K-12 hours by grade band and year`
    const desc = `The timetable of ${s.label.toLowerCase()} with the same grade bands, years and tiers as the biology axis. Hours are placeholders and editable. A plan puts part of this space's content on this axis to draw its time from ${s.label.toLowerCase()}.`
    const src = 'Placeholder. No source. AI-drafted, unreviewed.'
    fx.axes.push({ id, project_id: pid, name, description: desc, kind: 'generated', definition: def, jurisdiction: null, source: src, status: 'proposed', subject: s.key })
    w('INSERT INTO lpm_time_axes (id, project_id, name, description, kind, definition, source, status, subject)')
    w(`VALUES (${q(id)}, ${q(pid)}, ${q(name)}, ${q(desc)}, 'generated', ${jq(def)}, ${q(src)}, 'proposed', ${q(s.key)}) ON CONFLICT (id) DO NOTHING;`)
    const aid = uid('assumption', pid, `host-hours-${s.key}`)
    fx.assumptions.push({ id: aid, project_id: pid, plan_id: null, axis_id: id, projection_id: null, statement: s.statement, assumption_type: 'placeholder', confidence: 'low', source: 'No source.', rationale: s.why, value: null, status: 'open' })
    w('INSERT INTO lpm_time_assumptions (id, project_id, plan_id, axis_id, projection_id, statement, assumption_type, confidence, source, rationale, value)')
    w(`VALUES (${q(aid)}, ${q(pid)}, NULL, ${q(id)}, NULL, ${q(s.statement)}, 'placeholder', 'low', 'No source.', ${q(s.why)}, NULL) ON CONFLICT (id) DO NOTHING;`)
    axisDefs[pid][s.key] = { id, def }
  }
  w()
}

// ---- the Interdisciplinary plans that draw on three subjects ----
const slug = 'interdisciplinary-lpm-synth'
const pid = PROJECTS[slug]
const objs = await rest(`lpm_data_objects?select=id,object_type,title,grade_band,content,status&project_id=eq.${pid}&limit=1000`)
const type = new Map(objs.map((o) => [o.id, o.object_type]))
const stages = objs.filter((o) => o.object_type === 'substrand' && o.status === 'accepted').map((r) => ({
  id: r.id, title: r.title, band: r.grade_band, strand: r.content?._source?.path ?? 'strand',
  concepts: (r.content?.concepts ?? []).map((c) => ({ id: c.id, emphasis: c.emphasis })),
  outcomes: (r.content?.performanceIndicators ?? []).length, required: r.content?.required !== false,
})).sort((a, b) => a.id.localeCompare(b.id))
const conns = await rest(`lpm_connections?select=relation_type,from_object_id,to_object_id,status&project_id=eq.${pid}&limit=1000`)
const sources = { stageStrand: {}, strandEdges: [], stageEdges: [], threads: [] }
for (const c of conns) {
  if (c.status !== 'accepted') continue
  const a = type.get(c.from_object_id)
  const b = type.get(c.to_object_id)
  if (c.relation_type === 'isChildOf' && a === 'substrand' && b === 'strand') sources.stageStrand[c.from_object_id] = c.to_object_id
  else if (c.relation_type === 'prerequisiteOf' || c.relation_type === 'foundationalTo') {
    if (a === 'strand' && b === 'strand') sources.strandEdges.push({ from: c.from_object_id, to: c.to_object_id, relation: c.relation_type })
    else if (a === 'substrand' && b === 'substrand') sources.stageEdges.push({ from: c.from_object_id, to: c.to_object_id, relation: c.relation_type })
  }
}
const threads = await rest(`lpm_threads?select=id,slug,title,status&project_id=eq.${pid}&status=eq.accepted&limit=100`)
for (const t of threads) {
  const st = await rest(`lpm_thread_stations?select=data_object_id,sequence&thread_id=eq.${t.id}&order=sequence`)
  sources.threads.push({ id: t.id, slug: t.slug, title: t.title, stageIds: st.map((s) => s.data_object_id) })
}
const bands = T.BAND_NAMES
const edges = T.deriveOrderEdges(sources, stages, bands)

const strandDomains = new Map()
for (const o of objs) if (o.object_type === 'strand' && o.status === 'accepted') strandDomains.set(o.content?._source?.path, o.content?.associatedDomains ?? [])
const split = {}
const splitDesc = new Set()
for (const s of stages) {
  const subjects = [...new Set((strandDomains.get(s.strand) ?? []).map((d) => {
    if (!DOMAIN_TO_SUBJECT[d]) throw new Error(`Unknown domain ${d} on ${s.strand}`)
    return DOMAIN_TO_SUBJECT[d]
  }))]
  if (subjects.length === 0) throw new Error(`No associatedDomains for ${s.title} (${s.strand})`)
  split[s.id] = Object.fromEntries(subjects.map((k) => [k, 1 / subjects.length]))
  splitDesc.add(`${s.strand}: ${subjects.join(' + ')}`)
}
process.stderr.write([...splitDesc].sort().join(' | ') + ' [stage split by strand]\n')

const ctx = {
  reference: 'biology',
  hosts: [
    { axisId: axisDefs[pid].biology.id, subject: 'biology', label: 'Biology', axis: T.expandAxis(axisDefs[pid].biology.def) },
    ...SUBJECTS.map((s) => ({ axisId: axisDefs[pid][s.key].id, subject: s.key, label: s.label, axis: T.expandAxis(axisDefs[pid][s.key].def) })),
  ],
}

const PLANS = [
  { key: 'capstone', name: 'Three subjects, same hours: one unit at the end of each year', extra: {} },
  { key: 'threaded', name: 'Three subjects, same hours: a slice of every session', extra: {} },
  { key: 'spiral', name: 'Three subjects, same hours: short blocks that return, plus a thread', extra: { returns_per_year: 2, thread_fraction: 0.25 } },
  { key: 'sequenced', name: 'Three subjects, same hours: stages in sequence, in dependency order', extra: { sequence_order: 'dependency' } },
]
const SUMMARY = 'The same pattern and the same total evolution hours as the matching one-subject starter plan. The hours come from biology, social studies and computer science in the split shown on this page. The split is an AI-drafted placeholder, unreviewed, and the plan makes no recommendation.'
const SPLIT_STATEMENT = 'Each stage takes its time in equal parts from the school subjects its strand is associated with in the source LPM, listed on this page. Science is counted as biology. A share of a subject that has no hours in a grade band moves to the other subjects of that stage.'
const SPLIT_WHY = 'The split is the largest judgement in this plan. It rests on the strand field associatedDomains of the source LPM, and the equal parts are an AI-drafted rule with no source. Stages within a strand may lean one way or the other. Argue it stage by stage and change it on this page.'
const BASIS_STATEMENT = 'The space takes the same total evolution hours as the one-subject plan with the same pattern. The split decides which subject gives them.'
const BASIS_WHY = 'This keeps the comparison with a space that lives in biology alone fair on total hours. The alternative is that every subject gives the same share of its own hours, which the page offers as a setting.'

const planIds = []
for (const pl of PLANS) {
  const planId = uid('plan', pid, `hosts-${pl.key}`)
  planIds.push(planId)
  const params = { preset: pl.key, share: SHARE, reinforcing_share: 0.15, ...pl.extra, hosts: { basis: 'matched-hours', split } }
  fx.plans.push({ id: planId, project_id: pid, axis_id: axisDefs[pid].biology.id, name: pl.name, summary: SUMMARY, kind: 'planned', parameters: params, forked_from: null, valid_from: null, valid_to: null, status: 'proposed', created_at: '2026-10-25T00:03:00Z' })
  w('INSERT INTO lpm_time_plans (id, project_id, axis_id, name, summary, kind, parameters, status)')
  w(`VALUES (${q(planId)}, ${q(pid)}, ${q(axisDefs[pid].biology.id)}, ${q(pl.name)}, ${q(SUMMARY)}, 'planned', ${jq(params)}, 'proposed') ON CONFLICT (id) DO NOTHING;`)
  T.generateStarterPlacements(stages, params, bands, edges, ctx).forEach((p, i) => {
    const id = uid('placement', planId, String(i))
    fx.placements.push({ id, plan_id: planId, ...p, sort_order: i })
    w('INSERT INTO lpm_time_placements (id, plan_id, target_type, target_id, role, resource, selector, amount, note, sort_order, axis_id)')
    w(`VALUES (${q(id)}, ${q(planId)}, ${q(p.target_type)}, ${q(p.target_id)}, ${q(p.role)}, ${q(p.resource)}, ${jq(p.selector)}, ${jq(p.amount)}, ${sqlOrNull(p.note)}, ${i}, ${sqlOrNull(p.axis_id)}) ON CONFLICT (id) DO NOTHING;`)
  })
  const rows = [
    ['split', SPLIT_STATEMENT, 'derived', 'low', 'Strand field associatedDomains of the source LPM (oe-interdisciplinary-k12). Equal weights are an AI-drafted rule.', SPLIT_WHY, null],
    ['basis', BASIS_STATEMENT, 'derived', 'medium', 'Design note 2026-10-25, section 5.12.', BASIS_WHY, null],
  ]
  for (const [k, statement, atype, conf, src, why, value] of rows) {
    const aid = uid('assumption', pid, `hosts-${pl.key}-${k}`)
    fx.assumptions.push({ id: aid, project_id: pid, plan_id: planId, axis_id: null, projection_id: null, statement, assumption_type: atype, confidence: conf, source: src, rationale: why, value, status: 'open' })
    w('INSERT INTO lpm_time_assumptions (id, project_id, plan_id, axis_id, projection_id, statement, assumption_type, confidence, source, rationale, value)')
    w(`VALUES (${q(aid)}, ${q(pid)}, ${q(planId)}, NULL, NULL, ${q(statement)}, ${q(atype)}, ${q(conf)}, ${q(src)}, ${q(why)}, NULL) ON CONFLICT (id) DO NOTHING;`)
  }
}
w()

const fxIdx = process.argv.indexOf('--fixtures')
if (fxIdx > -1) {
  writeFileSync(process.argv[fxIdx + 1], JSON.stringify(fx))
  process.stderr.write(`Wrote fixtures to ${process.argv[fxIdx + 1]}\n`)
}
process.stdout.write(lines.join('\n') + '\n')
