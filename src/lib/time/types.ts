// Time layer for OpenLPM: types.
//
// Design source: lab_manager/docs/design-notes/
// bio-core-interdisciplinary-modelling-literature-human-examples-and-time-budget-2026-10-25.md
// (sections 5.5 to 5.11).
//
// Two general ideas carry everything:
//   * A time AXIS is a sequence of discrete units. It is defined by levels from coarse to fine, with no fixed
//     size, depth or length. Dates are optional.
//   * A PLACEMENT puts content (a concept, a topic, ...) onto units of an axis with an amount of time.
// LPM content never carries time. Axes, placements and plans do.

/** A pair of values. For minutes this is a range of possible values; for a fixed value low equals high. */
export interface Range {
  low: number
  high: number
}

/** ISO 8601 duration string such as "PT45M" or "PT1H30M" (days count as 24 hours), or a number of minutes. */
export type DurationValue = string | number

export interface DurationSpec {
  low: DurationValue
  high?: DurationValue
}

/** One constraint on a level. Indexes are 1-based inside the parent unit unless `absolute` is true. */
export type Constraint =
  | { eq: number; absolute?: boolean }
  | { range: [number, number]; absolute?: boolean }
  | { every: number; offset?: number; absolute?: boolean }
  | { in: number[]; absolute?: boolean }

export type Where = Record<string, Constraint>

export interface LevelDef {
  key: string
  label?: string
  /** How many units of this level sit inside each unit of the level above. A list gives one count per parent. */
  per_parent: number | number[]
  /** Optional display names for units of this level, in order of appearance. */
  names?: string[]
}

/** A named group of units with its own duration, for example a grade tier. Later segments win. */
export interface Segment {
  key: string
  label?: string
  where: Where
  duration: DurationSpec
  note?: string
}

export interface NonTeachingRule {
  where: Where
  label?: string
}

export interface DatedConfig {
  /** First day of the span, YYYY-MM-DD. */
  start: string
  /** Last day of the span, YYYY-MM-DD. */
  end: string
  /** The host subject's weekly timetable. weekday: 1 = Monday ... 7 = Sunday. */
  sessions: { weekday: number; minutes: number; label?: string }[]
  /** Date ranges with no teaching: holidays, exam weeks, closures. Inclusive. */
  non_teaching: { from: string; to: string; label?: string }[]
}

export interface ExplicitUnit {
  coords: number[]
  label?: string
  duration?: DurationSpec | DurationValue
  teaching?: boolean
  date?: string
  tags?: string[]
}

export type AxisKind = 'generated' | 'generic-year' | 'dated' | 'explicit'

export interface AxisDef {
  kind: AxisKind
  levels: LevelDef[]
  default_duration?: DurationSpec
  segments?: Segment[]
  non_teaching?: NonTeachingRule[]
  /** generic-year only: days in a year (365 by default). */
  year_length?: number
  dated?: DatedConfig
  units?: ExplicitUnit[]
}

export interface Unit {
  /** 1-based position along the whole axis. */
  abs: number
  /** 1-based index inside the parent, one entry per level. */
  coords: number[]
  /** 1-based index across the whole axis at each level. */
  absAt: number[]
  /** Available minutes when the unit is a teaching unit. */
  duration: Range
  teaching: boolean
  label: string
  date?: string
  tags: string[]
}

export interface Axis {
  def: AxisDef
  levels: string[]
  units: Unit[]
}

export interface Selector {
  where?: Where
  /** Fraction of the matched region, 0 to 1 along cumulative teaching time. */
  span?: { from: number; to: number }
  /** Apply the span separately inside each unit of this level (for example 'year'). */
  spanWithin?: string
}

export type Amount =
  | { kind: 'duration'; low: DurationValue; high?: DurationValue }
  | { kind: 'share'; low: number; high?: number }
  | { kind: 'total'; low: DurationValue; high?: DurationValue }

export type PlacementRole = 'dedicated' | 'threaded'

export interface Placement {
  id?: string
  target_type: string
  target_id: string
  role?: PlacementRole
  resource?: string
  selector: Selector
  amount: Amount
  note?: string
}

export interface Hit {
  unit: Unit
  /** Share of the unit the selector covers, 0 to 1. */
  coverage: number
}

export interface UnitMinutes {
  abs: number
  low: number
  high: number
  coverage: number
}
