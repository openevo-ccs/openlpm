import { addDays, addYears, daysBetween, formatDate, parseDate, weekdayOf } from './dates'
import { durationRange } from './duration'
import type { Axis, AxisDef, Constraint, LevelDef, Range, Unit, Where } from './types'

export const MAX_UNITS = 300000

export function matchConstraint(value: number, c: Constraint): boolean {
  if ('eq' in c) return value === c.eq
  if ('range' in c) return value >= c.range[0] && value <= c.range[1]
  if ('every' in c) {
    const k = Math.max(1, Math.floor(c.every))
    const off = c.offset ?? 0
    return (((value - 1 - off) % k) + k) % k === 0
  }
  return c.in.includes(value)
}

export function matchWhere(unit: Pick<Unit, 'coords' | 'absAt'>, levels: string[], where: Where | undefined): boolean {
  if (!where) return true
  for (const [key, c] of Object.entries(where)) {
    const i = levels.indexOf(key)
    if (i < 0) return false
    const v = c.absolute ? unit.absAt[i] : unit.coords[i]
    if (!matchConstraint(v, c)) return false
  }
  return true
}

/** The finest-level duration for a unit, or zero when the axis gives none. */
export function available(unit: Unit): Range {
  return unit.teaching ? unit.duration : { low: 0, high: 0 }
}

function childCount(level: LevelDef, parentFlatIndex: number): number {
  const pp = level.per_parent
  if (Array.isArray(pp)) return pp[parentFlatIndex] ?? pp[pp.length - 1] ?? 0
  return pp
}

function levelLabel(level: LevelDef, coord: number, absIndex: number): string {
  return level.names?.[absIndex - 1] ?? `${level.label ?? level.key} ${coord}`
}

function applyRules(def: AxisDef, units: Unit[], levels: string[]): void {
  const base = durationRange(def.default_duration)
  for (const u of units) {
    if (def.kind !== 'dated' && def.kind !== 'explicit') u.duration = { ...base }
    for (const seg of def.segments ?? []) {
      if (matchWhere(u, levels, seg.where)) {
        u.duration = durationRange(seg.duration)
        if (!u.tags.includes(seg.key)) u.tags.push(seg.key)
      }
    }
    for (const rule of def.non_teaching ?? []) {
      if (matchWhere(u, levels, rule.where)) u.teaching = false
    }
  }
}

function expandLevels(def: AxisDef, maxUnits: number): Unit[] {
  const levels = def.levels
  if (levels.length === 0) return []
  const top = Array.isArray(levels[0].per_parent) ? levels[0].per_parent[0] : levels[0].per_parent
  type Node = { coords: number[]; absAt: number[] }
  let nodes: Node[] = []
  for (let i = 1; i <= top; i++) nodes.push({ coords: [i], absAt: [i] })
  const counters = levels.map((_, i) => (i === 0 ? top : 0))
  for (let li = 1; li < levels.length; li++) {
    const next: Node[] = []
    nodes.forEach((parent, flat) => {
      const n = childCount(levels[li], flat)
      for (let c = 1; c <= n; c++) {
        counters[li] += 1
        next.push({ coords: [...parent.coords, c], absAt: [...parent.absAt, counters[li]] })
        if (next.length > maxUnits) throw new Error(`Axis has more than ${maxUnits} units`)
      }
    })
    nodes = next
  }
  return nodes.map((n, idx) => {
    const last = levels.length - 1
    const label = levels
      .slice(Math.max(0, last - 1))
      .map((lv, k) => levelLabel(lv, n.coords[Math.max(0, last - 1) + k], n.absAt[Math.max(0, last - 1) + k]))
      .join(' · ')
    return { abs: idx + 1, coords: n.coords, absAt: n.absAt, duration: { low: 0, high: 0 }, teaching: true, label, tags: [] }
  })
}

function expandDated(def: AxisDef): { units: Unit[]; levels: LevelDef[] } {
  const cfg = def.dated
  if (!cfg) throw new Error('A dated axis needs a dated configuration')
  const levels: LevelDef[] = [
    { key: 'year', label: 'School year', per_parent: 1 },
    { key: 'week', label: 'Week', per_parent: 1 },
    { key: 'session', label: 'Session', per_parent: 1 },
  ]
  const units: Unit[] = []
  const total = daysBetween(cfg.start, cfg.end)
  let abs = 0
  let lastWeekGlobal = 0
  let sessionInWeek = 0
  const startMs = parseDate(cfg.start)
  const startDow = weekdayOf(cfg.start)
  for (let d = 0; d <= total; d++) {
    const date = addDays(cfg.start, d)
    const dow = weekdayOf(date)
    const todays = cfg.sessions.filter((s) => s.weekday === dow)
    if (todays.length === 0) continue
    let yearIdx = 1
    while (parseDate(addYears(cfg.start, yearIdx)) <= parseDate(date)) yearIdx++
    const yearStart = addYears(cfg.start, yearIdx - 1)
    const weekGlobal = Math.floor((d + (startDow - 1)) / 7) + 1
    const weekInYear = Math.floor((daysBetween(yearStart, date) + (weekdayOf(yearStart) - 1)) / 7) + 1
    if (weekGlobal !== lastWeekGlobal) {
      sessionInWeek = 0
      lastWeekGlobal = weekGlobal
    }
    const closed = cfg.non_teaching.find((r) => parseDate(r.from) <= parseDate(date) && parseDate(date) <= parseDate(r.to))
    for (const s of todays) {
      abs += 1
      sessionInWeek += 1
      units.push({
        abs,
        coords: [yearIdx, weekInYear, sessionInWeek],
        absAt: [yearIdx, weekGlobal, abs],
        duration: { low: s.minutes, high: s.minutes },
        teaching: !closed,
        label: `${date}${s.label ? ' ' + s.label : ''}${closed?.label ? ' (' + closed.label + ')' : ''}`,
        date,
        tags: closed ? ['non-teaching'] : [],
      })
    }
  }
  void startMs
  return { units, levels }
}

function expandExplicit(def: AxisDef): Unit[] {
  const seen: Map<string, number>[] = def.levels.map(() => new Map())
  return (def.units ?? []).map((e, idx) => {
    const absAt = e.coords.map((_, i) => {
      const key = e.coords.slice(0, i + 1).join('.')
      if (!seen[i].has(key)) seen[i].set(key, seen[i].size + 1)
      return seen[i].get(key) as number
    })
    return {
      abs: idx + 1,
      coords: e.coords,
      absAt,
      duration: durationRange(e.duration ?? def.default_duration),
      teaching: e.teaching !== false,
      label: e.label ?? `Unit ${idx + 1}`,
      date: e.date,
      tags: e.tags ? [...e.tags] : [],
    }
  })
}

export function expandAxis(def: AxisDef, opts: { maxUnits?: number } = {}): Axis {
  const maxUnits = opts.maxUnits ?? MAX_UNITS
  let units: Unit[]
  let levelDefs = def.levels
  if (def.kind === 'dated') {
    const r = expandDated(def)
    units = r.units
    levelDefs = r.levels
  } else if (def.kind === 'explicit') {
    units = expandExplicit(def)
  } else {
    units = expandLevels(def, maxUnits)
  }
  if (units.length > maxUnits) throw new Error(`Axis has more than ${maxUnits} units`)
  const levels = levelDefs.map((l) => l.key)
  applyRules(def, units, levels)
  return { def: { ...def, levels: levelDefs }, levels, units }
}

/** A generic year axis: `years` years of `yearLength` days each, with no durations or weekdays. */
export function genericYearAxis(years: number, yearLength = 365): AxisDef {
  return {
    kind: 'generic-year',
    year_length: yearLength,
    levels: [
      { key: 'year', label: 'Year', per_parent: years },
      { key: 'day', label: 'Day', per_parent: yearLength },
    ],
  }
}

export function levelIndex(axis: Axis, key: string): number {
  return axis.levels.indexOf(key)
}

/** Names the finest level so callers can word measures by grain. */
export function finestLevel(axis: Axis): string {
  return axis.levels[axis.levels.length - 1] ?? ''
}

export { formatDate }
