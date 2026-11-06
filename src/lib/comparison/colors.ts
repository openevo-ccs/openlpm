// One color language for the comparison views, so a hue always means the same
// thing wherever it appears.
//
//   place        --place-de / --place-us / --place-in / --place-other
//                one hue per country; states of a country are lighter shades of it
//   grade band   --band-1..4 (a sequence, light to dark) and --band-span for K-12
//   concept      --map-1..6, the shared concept palette (see the graph standards note)
//   strength     the hue of the thing being counted, mixed with the page background
//
// Record kinds are told apart by icon and label, never by hue, so the four
// color families above stay free of overlapping meanings. The tokens live in
// src/globals.css and are checked for color-blind readability by
// scripts/check_palette_colorblind.mjs.

import type { Unit } from './model'

export function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const PLACE_VARS: Record<string, string> = { DE: '--place-de', US: '--place-us', IN: '--place-in' }
const PLACE_FALLBACK: Record<string, string> = { DE: '#3c1c9c', US: '#8e2929', IN: '#ae8f32' }

/** CSS reference to a country's hue, for use inside style strings and color-mix(). */
export function placeVar(country: string): string {
  return `var(${PLACE_VARS[country] ?? '--place-other'})`
}

/** The resolved hex of a country's hue, for canvas and SVG attributes that cannot take var(). */
export function placeHex(country: string): string {
  return cssVar(PLACE_VARS[country] ?? '--place-other', PLACE_FALLBACK[country] ?? '#6f7d8c')
}

const BAND_VARS = ['--band-1', '--band-2', '--band-3', '--band-4']
const BAND_NAMES = ['K-2', '3-5', '6-8', '9-12']

export function bandVar(band: string | null): string {
  const i = BAND_NAMES.indexOf(band ?? '')
  return i >= 0 ? `var(${BAND_VARS[i]})` : 'var(--band-span)'
}

export function bandHex(band: string | null): string {
  const i = BAND_NAMES.indexOf(band ?? '')
  return i >= 0 ? cssVar(BAND_VARS[i], '#5fb8ae') : cssVar('--band-span', '#8b96a3')
}

export function conceptVar(index: number): string {
  return `var(--map-${(index % 6) + 1})`
}

export function conceptHex(index: number): string {
  return cssVar(`--map-${(index % 6) + 1}`, '#888888')
}

function parseHex(h: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(h.trim())
  if (!m) return null
  return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)]
}

/** Mixes a hex color toward white (t > 0) or black (t < 0). */
export function shade(hex: string, t: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const target = t >= 0 ? 255 : 0
  const k = Math.min(1, Math.abs(t))
  const out = rgb.map((c) => Math.round(c + (target - c) * k))
  return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('')
}

/** Hex of a unit's mark. States of one country share its hue with a gentle lightness step; national and country units use the pure hue. */
export function unitHex(unit: Unit, siblings: Unit[]): string {
  const base = placeHex(unit.country)
  if (unit.kind !== 'state') return base
  const states = siblings.filter((s) => s.country === unit.country && s.kind === 'state')
  const idx = Math.max(0, states.findIndex((s) => s.id === unit.id))
  const span = Math.min(0.5, 0.06 * Math.max(0, states.length - 1))
  return shade(base, states.length > 1 ? (span * idx) / (states.length - 1) : 0)
}

/** Fill for a heat cell: the hue at a share of full strength over the page background. `value` and `max` are counts. */
export function heatFill(value: number, max: number, hue: string): string {
  if (value <= 0 || max <= 0) return 'transparent'
  const pct = Math.round(14 + 70 * Math.sqrt(value / max))
  return `color-mix(in srgb, ${hue} ${pct}%, var(--surface-0))`
}

/** Black or white text, whichever reads better on a hex background. */
export function textOn(hex: string): string {
  const rgb = parseHex(hex)
  if (!rgb) return '#fff'
  const lin = rgb.map((c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
  return lum > 0.35 ? '#111' : '#fff'
}
