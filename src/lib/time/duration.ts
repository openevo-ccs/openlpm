import type { DurationSpec, DurationValue, Range } from './types'

const ISO = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/

/** Minutes for an ISO 8601 duration ("PT1H30M", "P1D" = 24 hours) or a plain number of minutes. */
export function parseDuration(value: DurationValue): number {
  if (typeof value === 'number') return value
  const m = ISO.exec(value.trim())
  if (!m || value.trim() === 'P' || value.trim() === 'PT') throw new Error(`Not an ISO 8601 duration: ${value}`)
  const [, d, h, min, s] = m
  return (d ? parseFloat(d) * 1440 : 0) + (h ? parseFloat(h) * 60 : 0) + (min ? parseFloat(min) : 0) + (s ? parseFloat(s) / 60 : 0)
}

export function durationRange(spec: DurationSpec | DurationValue | undefined): Range {
  if (spec === undefined || spec === null) return { low: 0, high: 0 }
  if (typeof spec === 'string' || typeof spec === 'number') {
    const v = parseDuration(spec)
    return { low: v, high: v }
  }
  const low = parseDuration(spec.low)
  return { low, high: spec.high === undefined ? low : parseDuration(spec.high) }
}

/** ISO 8601 form of a number of minutes, for example 90 becomes "PT1H30M". */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes * 60) / 60
  const h = Math.floor(total / 60)
  const m = Math.round((total - h * 60) * 100) / 100
  if (h === 0 && m === 0) return 'PT0M'
  return 'PT' + (h ? `${h}H` : '') + (m ? `${m}M` : '')
}

export function hours(minutes: number): number {
  return minutes / 60
}

export function mid(r: Range): number {
  return (r.low + r.high) / 2
}
