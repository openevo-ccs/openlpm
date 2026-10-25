#!/usr/bin/env node
// Generates the migration that adds the Sachsen timetable (real lesson hours) to all four synthetic spaces.
//
//   node scripts/generate_sachsen_timetable_migration.mjs > supabase/migrations/183_sachsen_timetable_axes_and_plans.sql
//
// Source of the hours: VwV Stundentafeln of 20 June 2018, version valid 2026-08-01 to 2027-07-31 (Anlage 1a Grundschule,
// Anlage 4a Gymnasium Sekundarstufe I), read directly from the official PDFs on 2026-10-25. See
// deutsche_lp/land/sachsen/lp/data/sachsen-stundentafel-2026-27.json.
//
// Per space this writes four subject axes in the jurisdiction set DE-SN (Sachunterricht for grades 1 to 4, Biologie, the
// social group and computing for grades 5 to 10) and five plans on the space's home subject: capstone, threaded, spiral,
// sequenced and its reverse. Grades 1 to 4 are taught inside Sachunterricht for every space, because the Grundschule has no
// separate biology, social studies or computing lessons. Each subject gives the same share of its own hours (home-share).
// The available time of a unit is a range: the low end counts 25 weeks (what the Lehrpläne plan with), the high end 39 weeks
// (a day count of the 2026/27 calendar that was not independently checked). Kursstufe (grades 11 and 12) is not modelled.
// Content of Bio-Core and Interdisciplinary is read from the live database with the service_role key from .supabase-secrets
// (never printed). Social-Core and Computational-Core come from scripts/data/core-spaces-content.json. Ids are uuid5-derived.

import { build } from 'esbuild'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { v5 as uuid5 } from 'uuid'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'sn-time-'))
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

const C = JSON.parse(readFileSync(path.join(root, 'scripts/data/core-spaces-content.json'), 'utf8'))
const NS = uuid5('https://openevo-ccs.github.io/openlpm/sachsen-timetable-2026-10-25', uuid5.URL)
const uid = (...p) => uuid5(p.join('/'), NS)
const CORE_NS = uuid5('https://openevo-ccs.github.io/openlpm/core-spaces-2026-10-25', uuid5.URL)
const coreUid = (...p) => uuid5(p.join('/'), CORE_NS)
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const jq = (o) => q(JSON.stringify(o)) + '::jsonb'
const sqlOrNull = (v) => (v === null || v === undefined ? 'NULL' : q(v))
const SHARE = { low: 0.1, high: 0.3 }
const BANDS = T.BAND_NAMES
const JURISDICTION = 'DE-SN'
const LOW_WEEKS = 25
const HIGH_WEEKS = 39
const MIN = 45

const SOURCE = 'VwV Stundentafeln vom 20.6.2018 (MBl. SMK S. 347), Fassung gueltig 2026-08-01 bis 2027-07-31, https://www.revosax.sachsen.de/vorschrift/17744.7. Weekly hours read directly from the official PDF on 2026-10-25.'

// Weekly lesson hours by grade. Year index of a grade g is g + 1, because kindergarten is year 1.
const WEEKLY = {
  sachunterricht: { 1: 3, 2: 3, 3: 3, 4: 3 },
  biology: { 5: 2, 6: 2, 7: 1, 8: 1, 9: 2, 10: 2 },
  'social-studies': { 5: 5, 6: 6, 7: 7, 8: 6, 9: 7, 10: 8 },
  'computer-science': { 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1 },
}
const SUBJECTS = [
  { key: 'sachunterricht', label: 'Sachunterricht', name: 'Sachunterricht: Sachsen Grundschule 2026/27', statement: 'Sachunterricht has 3 weekly lesson hours in each of grades 1 to 4 (Grundschule, Anlage 1a). It is one integrated subject. Biologie, Chemie, Physik, Informatik, Geschichte, Geographie and Gemeinschaftskunde have no lessons of their own in grades 1 to 4.', src: 'VwV Stundentafeln, Anlage 1a (https://revosax.sachsen.de/attachments/38081), read directly from the PDF 2026-10-25.' },
  { key: 'biology', label: 'Biologie', name: 'Biologie: Sachsen Gymnasium 2026/27', statement: 'Biologie at the Gymnasium has 2, 2, 1, 1, 2 and 2 weekly lesson hours in grades 5 to 10 (Anlage 4a). Grades 11 and 12 are not modelled.', src: 'VwV Stundentafeln, Anlage 4a (https://revosax.sachsen.de/attachments/35174), read directly from the PDF 2026-10-25.' },
  { key: 'social-studies', label: 'Social studies', name: 'Social studies group: Sachsen Gymnasium 2026/27', statement: 'The social group adds Gemeinschaftskunde/Rechtserziehung/Wirtschaft, Geschichte, Geographie and Ethik: 5, 6, 7, 6, 7 and 8 weekly lesson hours in grades 5 to 10 (Anlage 4a). Students take Ethik or Religion, and the model counts that slot as Ethik. Grades 11 and 12 are not modelled.', src: 'VwV Stundentafeln, Anlage 4a (https://revosax.sachsen.de/attachments/35174), read directly from the PDF 2026-10-25. The grouping of four subjects into one host is a modelling choice.' },
  { key: 'computer-science', label: 'Computer science', name: 'Computing: Sachsen Gymnasium 2026/27', statement: 'Technik/Computer (grades 5 and 6) and Informatik (grades 7 to 10) have 1 weekly lesson hour each year in grades 5 to 10 (Anlage 4a). Grades 11 and 12 are not modelled.', src: 'VwV Stundentafeln, Anlage 4a (https://revosax.sachsen.de/attachments/35174), read directly from the PDF 2026-10-25. Counting Technik/Computer and Informatik as one host is a modelling choice.' },
]
const WEEKS_WHY = 'The low end of the available time counts 25 weeks, which the Lehrpläne plan with. The high end counts 39 weeks, from a day count of the 2026/27 calendar that was not independently checked. A lesson hour is 45 minutes. The gap between the two ends is the time the Lehrplan leaves unassigned.'

function sachsenAxis(subject) {
  const base = T.k12TierAxis()
  const weekly = WEEKLY[subject.key]
  const segments = []
  for (let year = 1; year <= 13; year++) {
    const grade = year - 1
    const w = weekly[grade] ?? 0
    const lowMin = w * LOW_WEEKS * MIN
    const highMin = w * HIGH_WEEKS * MIN
    segments.push({ key: year === 1 ? 'kindergarten' : `grade-${grade}`, label: year === 1 ? 'Kindergarten' : `Grade ${grade}`, where: { year: { eq: year, absolute: true } }, duration: { low: `PT${lowMin}M`, high: `PT${highMin}M` }, ...(w > 0 ? { note: `${w} weekly lesson hours.` } : {}) })
  }
  return { ...base, segments }
}

const lines = []
const w = (s = '') => lines.push(s)
w(`-- The Sachsen timetable (real weekly lesson hours) for the four synthetic spaces.
-- Generated by scripts/generate_sachsen_timetable_migration.mjs; do not hand-edit.
--
-- Hours come from the VwV Stundentafeln of 2018, version valid 2026-08-01 to 2027-07-31, read directly from the official PDFs
-- (Anlage 1a Grundschule, Anlage 4a Gymnasium Sekundarstufe I). Each space gets four subject axes in the set DE-SN and five plans
-- on its home subject. Grades 1 to 4 are taught inside Sachunterricht for every space. Each subject gives the same share of its
-- own hours. Available time is a range: 25 weeks (what the Lehrpläne plan with) to 39 weeks (a day count of the calendar).
-- Kursstufe is not modelled. The placeholder axes of migrations 176 to 181 stay and form the other set.
-- Everything is AI-drafted, status 'proposed'. The weekly hours are sourced. The share each space takes is a placeholder.

SET search_path = public, extensions;
`)

// ---- spaces ----
const DOMAIN_TO_SUBJECT = { Biology: 'biology', Science: 'biology', 'Social Studies': 'social-studies', 'Computer Science': 'computer-science' }
const SPACES = []

// Bio-Core and Interdisciplinary come from the live database.
for (const [slug, key, home] of [['bio-core-lpm-synth', 'bio', 'biology'], ['interdisciplinary-lpm-synth', 'int', 'biology']]) {
  const proj = (await rest(`projects?select=id&slug=eq.${slug}`))[0]
  const pid = proj.id
  const objs = await rest(`lpm_data_objects?select=id,object_type,title,grade_band,content,status&project_id=eq.${pid}&limit=1000`)
  const type = new Map(objs.map((o) => [o.id, o.object_type]))
  const strandDomains = new Map(objs.filter((o) => o.object_type === 'strand' && o.status === 'accepted').map((o) => [o.content?._source?.path, o.content?.associatedDomains ?? []]))
  const stages = objs.filter((o) => o.object_type === 'substrand' && o.status === 'accepted' && o.content?.track !== 'human-examples').map((r) => ({
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
  const domainSplit = (s) => {
    const subs = [...new Set((strandDomains.get(s.strand) ?? []).map((d) => DOMAIN_TO_SUBJECT[d]).filter(Boolean))]
    if (key === 'bio' || subs.length === 0) return { [home]: 1 }
    return Object.fromEntries(subs.map((x) => [x, 1 / subs.length]))
  }
  SPACES.push({ slug, key, home, pid, stages, sources, domainSplit })
}

// Social-Core and Computational-Core come from the content file.
for (const sp of C.spaces) {
  const pid = coreUid('project', sp.slug)
  const stageId = (code, band) => coreUid('stage', sp.key, code, band)
  const stages = []
  for (const s of sp.strands) for (const st of s.stages) stages.push({ id: stageId(s.code, st.band), title: st.title, band: st.band, strand: `strands/strand-${s.code.toLowerCase()}-${s.slug}.yaml`, concepts: st.concepts.map(([slug, emphasis]) => ({ id: `OE-CONCEPT-${sp.key}-core-${slug}`, emphasis })), outcomes: st.pis.length, required: true })
  stages.sort((a, b) => a.id.localeCompare(b.id))
  const sources = { stageStrand: {}, strandEdges: [], stageEdges: [], threads: [] }
  for (const s of sp.strands) {
    for (const st of s.stages) sources.stageStrand[stageId(s.code, st.band)] = coreUid('strand', sp.key, s.code)
    for (const [rel, targets] of Object.entries(s.relations)) for (const t of targets) sources.strandEdges.push({ from: coreUid('strand', sp.key, s.code), to: coreUid('strand', sp.key, t), relation: rel })
    sources.threads.push({ id: coreUid('thread', sp.key, s.code), slug: s.slug, title: s.title, stageIds: s.stages.map((st) => stageId(s.code, st.band)) })
  }
  for (const e of sp.stageEdges) { const [fc, fb] = e.from.split(':'); const [tc, tb] = e.to.split(':'); sources.stageEdges.push({ from: stageId(fc, fb), to: stageId(tc, tb), relation: 'prerequisiteOf' }) }
  SPACES.push({ slug: sp.slug, key: sp.key, home: sp.homeSubject, pid, stages, sources, domainSplit: () => ({ [sp.homeSubject]: 1 }) })
}

const fx = []
for (const sp of SPACES) {
  const edges = T.deriveOrderEdges(sp.sources, sp.stages, BANDS)
  w(`-- ${sp.slug}: ${sp.stages.length} stages, ${edges.length} ordering claims, home subject ${sp.home}`)
  const axisIds = {}
  const infos = []
  for (const s of SUBJECTS) {
    const id = uid('axis', sp.pid, s.key)
    axisIds[s.key] = id
    const def = sachsenAxis(s)
    const desc = `${s.label} lesson hours of the Sachsen school year 2026/27, one unit per year from kindergarten (year 1) to grade 12 (year 13). Years outside the school type of this subject have no hours. Available time is a range from 25 weeks to 39 weeks.`
    w('INSERT INTO lpm_time_axes (id, project_id, name, description, kind, definition, jurisdiction, source, status, subject)')
    w(`VALUES (${q(id)}, ${q(sp.pid)}, ${q(s.name)}, ${q(desc)}, 'generated', ${jq(def)}, ${q(JURISDICTION)}, ${q(SOURCE)}, 'proposed', ${q(s.key)}) ON CONFLICT (id) DO NOTHING;`)
    const aid = uid('assumption', sp.pid, `hours-${s.key}`)
    w('INSERT INTO lpm_time_assumptions (id, project_id, plan_id, axis_id, projection_id, statement, assumption_type, confidence, source, rationale, value)')
    w(`VALUES (${q(aid)}, ${q(sp.pid)}, NULL, ${q(id)}, NULL, ${q(s.statement)}, 'literature', 'high', ${q(s.src)}, ${q(WEEKS_WHY)}, NULL) ON CONFLICT (id) DO NOTHING;`)
    infos.push({ axisId: id, subject: s.key, label: s.label, axis: T.expandAxis(def) })
  }
  const homeAxis = axisIds[sp.home]
  const ctx = { reference: sp.home, hosts: [infos.find((i) => i.subject === sp.home), ...infos.filter((i) => i.subject !== sp.home)] }

  // Split per stage: grades 1 to 4 sit in Sachunterricht. The 3-5 band holds grades 3 and 4 (Sachunterricht) and grade 5.
  const split = {}
  for (const st of sp.stages) {
    const dom = sp.domainSplit(st)
    if (st.band === 'K-2') split[st.id] = { sachunterricht: 1 }
    else if (st.band === '3-5') split[st.id] = { sachunterricht: 2 / 3, ...Object.fromEntries(Object.entries(dom).map(([k, v]) => [k, v / 3])) }
    else split[st.id] = dom
  }

  const PLANS = [
    { key: 'capstone', preset: 'capstone', name: 'Sachsen hours: one unit at the end of each year', extra: {} },
    { key: 'threaded', preset: 'threaded', name: 'Sachsen hours: a slice of every session', extra: {} },
    { key: 'spiral', preset: 'spiral', name: 'Sachsen hours: short blocks that return each year, plus a small thread', extra: { returns_per_year: 2, thread_fraction: 0.25 } },
    { key: 'sequenced', preset: 'sequenced', name: 'Sachsen hours: stages in sequence, in dependency order', extra: { sequence_order: 'dependency' } },
    { key: 'sequenced-reverse', preset: 'sequenced', name: 'Sachsen hours, control: the same sequence in reverse dependency order', extra: { sequence_order: 'reverse' } },
  ]
  const SUMMARY = 'The same pattern as the matching starter plan, laid on the real Sachsen timetable. Grades 1 to 4 are taught inside Sachunterricht and grades 5 to 10 in the subjects of the Gymnasium. Each subject gives the same share of its own hours. The share is a placeholder, the hours are sourced, and the plan makes no recommendation.'
  const planIds = {}
  for (const pl of PLANS) {
    const planId = uid('plan', sp.pid, pl.key)
    planIds[pl.key] = planId
    const params = { preset: pl.preset, share: SHARE, reinforcing_share: 0.15, ...pl.extra, hosts: { basis: 'home-share', split } }
    w('INSERT INTO lpm_time_plans (id, project_id, axis_id, name, summary, kind, parameters, status)')
    w(`VALUES (${q(planId)}, ${q(sp.pid)}, ${q(homeAxis)}, ${q(pl.name)}, ${q(pl.key === 'sequenced-reverse' ? 'A negative control for the order check on the Sachsen timetable. It reverses the sequence on purpose. It is not a design.' : SUMMARY)}, 'planned', ${jq(params)}, 'proposed') ON CONFLICT (id) DO NOTHING;`)
    const placed = T.generateStarterPlacements(sp.stages, params, BANDS, edges, ctx)
    placed.forEach((p, i) => {
      const id = uid('placement', planId, String(i))
      w('INSERT INTO lpm_time_placements (id, plan_id, target_type, target_id, role, resource, selector, amount, note, sort_order, axis_id)')
      w(`VALUES (${q(id)}, ${q(planId)}, ${q(p.target_type)}, ${q(p.target_id)}, ${q(p.role)}, ${q(p.resource)}, ${jq(p.selector)}, ${jq(p.amount)}, ${sqlOrNull(p.note)}, ${i}, ${sqlOrNull(p.axis_id)}) ON CONFLICT (id) DO NOTHING;`)
    })
  }
  const rows = [
    ['capstone', 'Every subject a space draws on gives the same share of its own hours (a share between 10 and 30 percent).', 'placeholder', 'low', 'No source.', 'The share is unknown. The same range is used for all four spaces. With real hours the absolute time a space takes differs by subject, because the subjects have different hours.', { low: 0.1, high: 0.3 }],
    ['capstone', 'Grades 1 to 4 are taught inside Sachunterricht for every space, including the three disciplinary spaces.', 'literature', 'high', 'VwV Stundentafeln, Anlage 1a (read directly 2026-10-25).', 'The Grundschule has no lessons of biology, social studies or computing of its own. Sachunterricht is one integrated subject.', null],
    ['capstone', 'In the grade band 3-5, two thirds of a stage sits in Sachunterricht (grades 3 and 4) and one third in the subject of grade 5.', 'derived', 'medium', 'Counted from the grade bands of the axis.', 'The band holds three school years. A stage cannot be placed in one year, so the split follows the years.', null],
    ['capstone', 'Grades 11 and 12 (Kursstufe) are not modelled in this version.', 'derived', 'high', 'VwV Stundentafeln has no table for the Kursstufe. Rules are in SOGYA, transcribed by an agent and not re-read.', 'Courses are chosen individually and the Grundkurs and Leistungskurs hours differ. The stages of the 9-12 band are placed in grades 9 and 10 only, so they carry less time than their band would suggest.', null],
    ['spiral', 'The spiral plan has two blocks per year and keeps a quarter of the space\'s time as a thread.', 'placeholder', 'low', 'No source.', 'That proportion is a hypothesis to test.', { returns_per_year: 2, thread_fraction: 0.25 }],
    ['sequenced', "Inside a band, each stage takes its own stretch of the band's teaching time, in dependency order.", 'derived', 'low', 'Design note 2026-10-25, section 5.11.', "The links come from this space's own prerequisite claims. This is a rule of the model and makes no claim about how any school should sequence.", null],
    ['sequenced-reverse', 'This plan reverses the dependency order on purpose. It is a negative control for the order check and carries no design intent.', 'derived', 'high', 'Design note 2026-10-25, section 5.11.', 'A check that never reports a violation tells us little.', null],
  ]
  rows.forEach(([planKey, statement, type_, conf, src, why, value], i) => {
    const aid = uid('assumption', sp.pid, `plan-${i}`)
    w('INSERT INTO lpm_time_assumptions (id, project_id, plan_id, axis_id, projection_id, statement, assumption_type, confidence, source, rationale, value)')
    w(`VALUES (${q(aid)}, ${q(sp.pid)}, ${q(planIds[planKey])}, NULL, NULL, ${q(statement)}, ${q(type_)}, ${q(conf)}, ${q(src)}, ${q(why)}, ${value ? jq(value) : 'NULL'}) ON CONFLICT (id) DO NOTHING;`)
  })
  w()
  fx.push({ slug: sp.slug, stages: sp.stages.length, edges: edges.length })
}
process.stdout.write(lines.join('\n') + '\n')
for (const x of fx) process.stderr.write(`${x.slug}: ${x.stages} stages, ${x.edges} ordering claims\n`)
