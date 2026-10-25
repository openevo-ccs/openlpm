#!/usr/bin/env node
// Tests for the time layer library (src/lib/time). Bundles the TypeScript with esbuild, then runs node:test.
//   node scripts/test_time_model.mjs
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = mkdtempSync(path.join(tmpdir(), 'time-model-'))
const out = path.join(dir, 'time.mjs')
await build({ entryPoints: [path.join(root, 'src/lib/time/index.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
const T = await import(pathToFileURL(out).href)
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`)

test('ISO 8601 durations', () => {
  assert.equal(T.parseDuration('PT45M'), 45)
  assert.equal(T.parseDuration('PT1H30M'), 90)
  assert.equal(T.parseDuration('P1D'), 1440)
  assert.equal(T.parseDuration(60), 60)
  assert.throws(() => T.parseDuration('45 minutes'))
  assert.equal(T.formatDuration(90), 'PT1H30M')
  assert.equal(T.formatDuration(45), 'PT45M')
})

test('K-12 axis: irregular bands, tiers beside the bands', () => {
  const axis = T.expandAxis(T.k12TierAxis())
  assert.equal(axis.units.length, 13)
  const bandOf = (n) => axis.units[n - 1].coords[0]
  assert.deepEqual([1, 3, 4, 6, 7, 9, 10, 13].map(bandOf), [1, 1, 2, 2, 3, 3, 4, 4])
  // Grade 5 is year 6: in the 3-5 band and in the middle tier.
  const g5 = axis.units[5]
  assert.equal(g5.coords[0], 2)
  assert.ok(g5.tags.includes('middle'))
  assert.equal(g5.label.includes('Grade 5'), true)
  assert.deepEqual(axis.units[0].duration, { low: 900, high: 2700 })
  assert.deepEqual(axis.units[5].duration, { low: 2400, high: 4800 })
  assert.deepEqual(axis.units[12].duration, { low: 6000, high: 9000 })
})

test('selectors: constraints, every-k with offset, absolute indexes', () => {
  const axis = T.expandAxis(T.genericYearAxis(2, 10))
  assert.equal(axis.units.length, 20)
  const sel = (where, extra = {}) => T.selectUnits(axis, { where, ...extra }).map((h) => h.unit.abs)
  assert.deepEqual(sel({ year: { eq: 2 }, day: { range: [9, 10] } }), [19, 20])
  assert.deepEqual(sel({ year: { eq: 1 }, day: { every: 5 } }), [1, 6])
  assert.deepEqual(sel({ year: { eq: 1 }, day: { every: 5, offset: 2 } }), [3, 8])
  assert.deepEqual(sel({ day: { in: [1], absolute: false } }), [1, 11])
  assert.deepEqual(sel({ day: { range: [15, 16], absolute: true } }), [15, 16])
})

test('span: the last fifth of every year, with partial coverage of a single unit', () => {
  const axis = T.expandAxis(T.k12TierAxis())
  const hits = T.selectUnits(axis, { where: { band: { eq: 2 } }, span: { from: 0.8, to: 1 }, spanWithin: 'year' })
  assert.equal(hits.length, 3)
  hits.forEach((h) => close(h.coverage, 0.2))
  // Across the whole band, the last tenth of three years of equal length covers part of the last year only.
  const tail = T.selectUnits(axis, { where: { band: { eq: 1 } }, span: { from: 0.9, to: 1 } })
  assert.equal(tail.length, 1)
  assert.ok(tail[0].coverage > 0 && tail[0].coverage < 1)
})

test('amounts: duration, share and total', () => {
  const axis = T.expandAxis(T.k12TierAxis())
  const where = { band: { eq: 1 } }
  const dur = T.sumMinutes(T.placementMinutes(axis, { target_type: 'topic', target_id: 'a', selector: { where }, amount: { kind: 'duration', low: 'PT2H', high: 'PT3H' } }))
  assert.deepEqual(dur, { low: 360, high: 540 })
  const share = T.sumMinutes(T.placementMinutes(axis, { target_type: 'topic', target_id: 'a', selector: { where }, amount: { kind: 'share', low: 0.1, high: 0.2 } }))
  close(share.low, 0.1 * 900 * 3)
  close(share.high, 0.2 * 2700 * 3)
  const tot = T.sumMinutes(T.placementMinutes(axis, { target_type: 'topic', target_id: 'a', selector: { where }, amount: { kind: 'total', low: 'PT6H', high: 'PT9H' } }))
  assert.deepEqual(tot, { low: 360, high: 540 })
})

const stage = (id, band, strand, concepts, outcomes = 3) => ({ id, title: id, band, strand, concepts, outcomes, required: true })
const stages = [
  stage('s1', 'K-2', 'A', [{ id: 'c1', emphasis: 'primary' }, { id: 'c2', emphasis: 'reinforcing' }]),
  stage('s2', 'K-2', 'B', [{ id: 'c2', emphasis: 'primary' }]),
  stage('s3', '3-5', 'A', [{ id: 'c1', emphasis: 'primary' }, { id: 'c3', emphasis: 'primary' }]),
  stage('s4', '6-8', 'A', [{ id: 'c3', emphasis: 'reinforcing' }, { id: 'c4', emphasis: 'primary' }]),
  stage('s5', '9-12', 'B', [{ id: 'c1', emphasis: 'reinforcing' }, { id: 'c4', emphasis: 'primary' }]),
]
const concepts = ['c1', 'c2', 'c3', 'c4'].map((id) => ({ id, label: id.toUpperCase() }))

test('presets: three patterns give the same hours and different shapes', () => {
  const axis = T.expandAxis(T.k12TierAxis())
  const share = { low: 0.2, high: 0.2 }
  const totals = {}
  const counts = {}
  for (const preset of ['capstone', 'threaded', 'spiral']) {
    const ps = T.generateStarterPlacements(stages, { preset, share, returns_per_year: 2, thread_fraction: 0.25 })
    counts[preset] = ps.length
    const m = T.computePlanMeasures(axis, ps, stages, concepts)
    totals[preset] = m.totalEvolution
  }
  // Bands with stages: all four. Evolution time is 20 percent of biology time in each.
  const bio = axis.units.reduce((s, u) => s + (u.duration.low + u.duration.high) / 2, 0)
  for (const k of Object.keys(totals)) close((totals[k].low + totals[k].high) / 2, bio * 0.2, 1e-3)
  assert.ok(counts.spiral > counts.capstone)
  assert.equal(counts.threaded, counts.capstone)
})

test('measures: concept time conserves topic time; coherence counts', () => {
  const axis = T.expandAxis(T.k12TierAxis())
  const ps = T.generateStarterPlacements(stages, { preset: 'threaded', share: { low: 0.2, high: 0.2 } })
  const m = T.computePlanMeasures(axis, ps, stages, concepts, { reinforcing_share: 0.15 })
  const topicSum = m.topics.reduce((s, t) => s + t.minutes.low, 0)
  const conceptSum = m.concepts.reduce((s, c) => s + c.total.low, 0)
  close(topicSum, conceptSum, 1e-6)
  const c1 = m.concepts.find((c) => c.id === 'c1')
  assert.deepEqual(c1.bands, ['K-2', '3-5', '9-12'])
  assert.equal(c1.returns, 2)
  assert.equal(c1.firstMainBand, 'K-2')
  assert.equal(c1.longestGapBands, 2)
  assert.equal(c1.strands, 2)
  const b0 = m.bands[0]
  assert.equal(b0.newMainConcepts, 2)
  assert.equal(b0.stages, 2)
  assert.equal(b0.outcomes, 6)
})

const datedDef = (extra = {}) => ({
  kind: 'dated',
  levels: [],
  dated: {
    start: '2026-08-31',
    end: '2027-06-30',
    sessions: [{ weekday: 2, minutes: 45 }, { weekday: 4, minutes: 45 }],
    non_teaching: [{ from: '2026-10-12', to: '2026-10-23', label: 'Autumn break (placeholder)' }, { from: '2026-12-21', to: '2027-01-03', label: 'Winter break (placeholder)' }],
    ...extra,
  },
})

test('dated axis: sessions from a weekly timetable, closures marked', () => {
  const axis = T.expandAxis(datedDef())
  assert.equal(axis.units[0].date, '2026-09-01') // first Tuesday after Monday 31 Aug
  assert.equal(axis.units[1].date, '2026-09-03')
  assert.equal(axis.units[0].coords[0], 1)
  const closed = axis.units.filter((u) => !u.teaching)
  assert.ok(closed.length >= 8)
  assert.ok(closed.every((u) => u.tags.includes('non-teaching')))
  const week1 = axis.units.slice(0, 2).map((u) => u.coords[1])
  assert.deepEqual(week1, [1, 1])
})

test('projection: a generic-year plan onto a dated calendar, both rules', () => {
  const generic = T.expandAxis(T.genericYearAxis(1, 365))
  const target = T.expandAxis(datedDef())
  const placements = [
    // 4 hours in a block over generic days 40-80 (the autumn break falls inside the matching dates).
    { target_type: 'topic', target_id: 'x', selector: { where: { year: { eq: 1 }, day: { range: [40, 80] } } }, amount: { kind: 'total', low: 'PT3H', high: 'PT4H' } },
    // A large ask in a short window.
    { target_type: 'topic', target_id: 'y', selector: { where: { year: { eq: 1 }, day: { range: [100, 104] } } }, amount: { kind: 'total', low: 'PT20H' } },
    { target_type: 'topic', target_id: 'x', selector: { where: { year: { eq: 1 }, day: { range: [250, 280] } } }, amount: { kind: 'total', low: 'PT3H', high: 'PT4H' } },
  ]
  const off = T.projectPlan(generic, placements, target, 'date-offset')
  assert.equal(off.items.length, 3)
  assert.equal(off.items[0].windows[0].firstDate, '2026-10-09') // day 40 of the year that starts 2026-08-31
  assert.ok(off.items[0].closedDays > 0, 'autumn break overlaps the window')
  assert.equal(off.items[1].status, 'short')
  assert.equal(off.summary.short, 1)
  const prop = T.projectPlan(generic, placements, target, 'teaching-time')
  assert.ok(prop.items[0].sessions > 0 && prop.items[0].available.high > 0)
  assert.ok(prop.items[0].stretch > 1, 'a break inside the window stretches it in elapsed days')
  assert.ok(prop.items[0].windows[0].firstDate > '2026-09-01')
  // Spacing between the two placements of topic x is reported in generic days, elapsed days and teaching minutes.
  assert.equal(off.spacing.length, 1)
  assert.equal(off.spacing[0].target, 'topic:x')
  assert.equal(off.spacing[0].gapsGenericDays[0], 250 - 80)
  // A thread placement is continuous and never creates a gap.
  const withThread = T.projectPlan(generic, [...placements, { target_type: 'topic', target_id: 'x', role: 'threaded', selector: { where: { year: { eq: 1 } } }, amount: { kind: 'total', low: 'PT2H' } }], target, 'date-offset')
  assert.deepEqual(withThread.spacing[0].gapsGenericDays, off.spacing[0].gapsGenericDays)
  assert.ok(withThread.spacing[0].gapsGenericDays.every((g) => g >= 0))
  assert.ok(off.spacing[0].gapsTeachingMinutes[0] > 0)
})

test('explicit axis and unlimited length', () => {
  const axis = T.expandAxis({
    kind: 'explicit',
    levels: [{ key: 'week', per_parent: 1 }, { key: 'session', per_parent: 1 }],
    units: [
      { coords: [1, 1], duration: 'PT90M', label: 'Lecture', date: '2026-10-26' },
      { coords: [1, 2], duration: 'PT45M', label: 'Seminar', date: '2026-10-28' },
      { coords: [2, 1], duration: 'PT90M', teaching: false, label: 'Break' },
    ],
  })
  assert.equal(axis.units.length, 3)
  assert.equal(axis.units[2].absAt[0], 2)
  assert.equal(T.available(axis.units[2]).high, 0)
  const big = T.expandAxis({ kind: 'generated', levels: [{ key: 'year', per_parent: 13 }, { key: 'week', per_parent: 40 }, { key: 'session', per_parent: 3 }], default_duration: { low: 'PT45M' } })
  assert.equal(big.units.length, 13 * 40 * 3)
  assert.throws(() => T.expandAxis({ kind: 'generated', levels: [{ key: 'a', per_parent: 1000 }, { key: 'b', per_parent: 1000 }] }, { maxUnits: 5000 }))
})
