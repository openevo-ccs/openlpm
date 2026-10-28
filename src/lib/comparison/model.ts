// The comparison model: what the country and cross-national views know about a
// progression, its links to real-world records, and the places those records
// belong to. Everything here is plain data in and plain data out, so the pages
// stay thin and the numbers can be tested without a browser.

import {
  adjustedResiduals, bootstrapEvenness, clusterOrder, describe, evenness, gini, jaccard, jensenShannon, mutualInformation,
  permutationJsd, permutationMutualInformation, total, type MutualInfo, type PermutationResult, type Summary,
} from './stats'
import { betweenness, components, density, projectOnto, type Graph } from './graph-measures'

export type Lang = 'en' | 'de'
export type Level = 'state' | 'country'

// ---- Input shapes ----------------------------------------------------------

export interface CmpObject {
  id: string
  title: string
  description: string
  type: string
  gradeBand: string | null
  parentId: string | null
  conceptIds: string[]
  threadIds: string[]
  order: number
}

export interface CmpConcept { id: string; label: string; parentId: string | null }
export interface CmpThread { id: string; title: string; objectIds: string[] }

export interface CmpRecord {
  id: string
  title: string
  type: string
  family: RecordFamily
  jurisdictions: string[]
  /** ISO date or year as stored, null when the record carries none. */
  date: string | null
  dateEnd: string | null
  summary: string
  /** Set for records that are one unit of an official Lehrplan. */
  unit?: CurriculumUnit
  /** Address of the page the record was read from, when it carries one. */
  sourceUrl?: string
}

export interface CurriculumUnit {
  subject: string
  schoolType: string | null
  gradeFrom: number
  gradeTo: number
  hours: number | null
  courseLevel: string | null
  tags: string[]
  titleDe: string | null
}

export interface CmpLink {
  id: string
  objectId: string
  recordId: string
  relationType: string
  rationale: string | null
  createdAt: string
  createdBy: string | null
  /** True for links drafted by an AI session that nobody has confirmed yet. */
  proposed: boolean
}

export interface CmpReview {
  id: string
  linkId: string
  verdict: string
  comment: string | null
  reviewedBy: string | null
  createdAt: string
}

export interface Unit {
  id: string
  label: string
  country: string
  kind: 'state' | 'national' | 'country'
}

// ---- Places ------------------------------------------------------------------

export interface CountryInfo { code: string; en: string; de: string }

export const COUNTRIES: Record<string, CountryInfo> = {
  DE: { code: 'DE', en: 'Germany', de: 'Deutschland' },
  US: { code: 'US', en: 'United States', de: 'USA' },
  IN: { code: 'IN', en: 'India', de: 'Indien' },
}

const STATE_NAMES: Record<string, [string, string]> = {
  'DE-BW': ['Baden-Württemberg', 'Baden-Württemberg'], 'DE-BY': ['Bavaria', 'Bayern'], 'DE-BE': ['Berlin', 'Berlin'], 'DE-BB': ['Brandenburg', 'Brandenburg'],
  'DE-HB': ['Bremen', 'Bremen'], 'DE-HH': ['Hamburg', 'Hamburg'], 'DE-HE': ['Hesse', 'Hessen'], 'DE-MV': ['Mecklenburg-Vorpommern', 'Mecklenburg-Vorpommern'],
  'DE-NI': ['Lower Saxony', 'Niedersachsen'], 'DE-NW': ['North Rhine-Westphalia', 'Nordrhein-Westfalen'], 'DE-RP': ['Rhineland-Palatinate', 'Rheinland-Pfalz'],
  'DE-SL': ['Saarland', 'Saarland'], 'DE-SN': ['Saxony', 'Sachsen'], 'DE-ST': ['Saxony-Anhalt', 'Sachsen-Anhalt'], 'DE-SH': ['Schleswig-Holstein', 'Schleswig-Holstein'],
  'DE-TH': ['Thuringia', 'Thüringen'],
  'US-NY': ['New York', 'New York'], 'US-CA': ['California', 'Kalifornien'], 'US-FL': ['Florida', 'Florida'], 'US-PA': ['Pennsylvania', 'Pennsylvanien'], 'US-TN': ['Tennessee', 'Tennessee'],
  'IN-KL': ['Kerala', 'Kerala'], 'IN-KA': ['Karnataka', 'Karnataka'], 'IN-MH': ['Maharashtra', 'Maharashtra'],
}

export function countryOf(jurisdiction: string): string {
  return jurisdiction.split('-')[0].trim().toUpperCase()
}

export function countryName(code: string, lang: Lang): string {
  return COUNTRIES[code]?.[lang] ?? code
}

export function jurisdictionName(code: string, lang: Lang): string {
  const state = STATE_NAMES[code]
  if (state) return state[lang === 'de' ? 1 : 0]
  if (!code.includes('-')) return lang === 'de' ? `${countryName(code, lang)} (bundesweit)` : `${countryName(code, lang)} (national)`
  return code
}

export function splitJurisdictions(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw.split(/[,;]/).map((s) => s.trim().toUpperCase()).filter(Boolean)
}

// ---- Record families ---------------------------------------------------------

export type RecordFamily = 'mandate' | 'unit' | 'event' | 'actor' | 'principle' | 'finding' | 'controversy' | 'other'

export const RECORD_FAMILIES: RecordFamily[] = ['mandate', 'unit', 'event', 'actor', 'principle', 'finding', 'controversy', 'other']

/**
 * The family of a record. A mandate whose type is 'curriculum-unit' is one unit of an official Lehrplan
 * (subject, grades, hours, topic tags) and counts as its own family, since it speaks to what is taught when.
 */
export function familyOf(recordType: string, mandateType?: string | null): RecordFamily {
  if (recordType === 'institutional-mandate-record' && mandateType === 'curriculum-unit') return 'unit'
  switch (recordType) {
    case 'institutional-mandate-record':
    case 'curriculum-crosswalk-record': return 'mandate'
    case 'policy-timeline-event': return 'event'
    case 'institutional-actor-record': return 'actor'
    case 'policy-principle-record':
    case 'policy-brief-manifest': return 'principle'
    case 'coherence-finding-record':
    case 'latent-connection-record':
    case 'synthetic-curriculum-redesign-record': return 'finding'
    case 'policy-controversy-record': return 'controversy'
    default: return 'other'
  }
}

// ---- Units ------------------------------------------------------------------

/** The unit ids a record counts toward. A record that names several states counts in each; at country level it counts once per country. */
export function recordUnitIds(rec: CmpRecord, level: Level, countries: ReadonlySet<string>): string[] {
  const ids = new Set<string>()
  for (const j of rec.jurisdictions) {
    const c = countryOf(j)
    if (!countries.has(c)) continue
    ids.add(level === 'country' ? c : j)
  }
  return Array.from(ids)
}

export function unitFromId(id: string, lang: Lang): Unit {
  const country = countryOf(id)
  return { id, label: jurisdictionName(id, lang), country, kind: id.includes('-') ? 'state' : 'national' }
}

/** Every unit that holds at least one record, in country order (as configured), states alphabetically, the national unit last. */
export function listUnits(records: CmpRecord[], level: Level, countryOrder: string[], lang: Lang): Unit[] {
  const countries = new Set(countryOrder)
  const seen = new Map<string, Unit>()
  for (const r of records) {
    for (const id of recordUnitIds(r, level, countries)) {
      if (seen.has(id)) continue
      const u: Unit = level === 'country'
        ? { id, label: countryName(id, lang), country: id, kind: 'country' }
        : unitFromId(id, lang)
      seen.set(id, u)
    }
  }
  const rank = (u: Unit) => countryOrder.indexOf(u.country)
  return Array.from(seen.values()).sort((a, b) => rank(a) - rank(b) || (a.kind === 'national' ? 1 : 0) - (b.kind === 'national' ? 1 : 0) || a.label.localeCompare(b.label, lang))
}

// ---- Dimensions (the rows of a comparison) -------------------------------------

export type DimId = 'strand' | 'item' | 'band'

export interface DimKey { id: string; label: string; objectIds: string[] }

const BAND_ORDER = ['K-2', '3-5', '6-8', '9-12', 'K-12']

export function bandRank(band: string | null): number {
  const i = BAND_ORDER.indexOf(band ?? '')
  return i >= 0 ? i : BAND_ORDER.length
}

export function topStrandOf(obj: CmpObject, byId: Map<string, CmpObject>): CmpObject {
  let cur = obj
  const guard = new Set<string>()
  while (cur.parentId && byId.has(cur.parentId) && !guard.has(cur.id)) { guard.add(cur.id); cur = byId.get(cur.parentId)! }
  return cur
}

/** The keys of one dimension. Each object belongs to exactly one key, so the counts add up. */
export function dimensionKeys(objects: CmpObject[], dim: DimId): DimKey[] {
  const byId = new Map(objects.map((o) => [o.id, o]))
  const ordered = [...objects].sort((a, b) => a.order - b.order)
  if (dim === 'item') return ordered.map((o) => ({ id: o.id, label: o.title, objectIds: [o.id] }))
  if (dim === 'band') {
    const keys = new Map<string, DimKey>()
    for (const o of ordered) {
      const b = o.gradeBand ?? 'n/a'
      if (!keys.has(b)) keys.set(b, { id: b, label: b, objectIds: [] })
      keys.get(b)!.objectIds.push(o.id)
    }
    return Array.from(keys.values()).sort((a, b) => bandRank(a.id) - bandRank(b.id))
  }
  const keys = new Map<string, DimKey>()
  for (const o of ordered) {
    const top = topStrandOf(o, byId)
    if (!keys.has(top.id)) keys.set(top.id, { id: top.id, label: top.title, objectIds: [] })
    keys.get(top.id)!.objectIds.push(o.id)
  }
  return Array.from(keys.values())
}

// ---- The grid: objects x units ------------------------------------------------

export interface Grid {
  units: Unit[]
  /** Links per (object, unit), keyed by cellKey(). A link whose record sits in several units appears in each. */
  linksBy: Map<string, CmpLink[]>
}

export const cellKey = (objectId: string, unitId: string) => `${objectId}|${unitId}`

export function buildGrid(units: Unit[], links: CmpLink[], recordsById: Map<string, CmpRecord>, level: Level, countries: ReadonlySet<string>): Grid {
  const linksBy = new Map<string, CmpLink[]>()
  for (const l of links) {
    const rec = recordsById.get(l.recordId)
    if (!rec) continue
    for (const uid of recordUnitIds(rec, level, countries)) {
      const k = cellKey(l.objectId, uid)
      const arr = linksBy.get(k)
      if (arr) arr.push(l)
      else linksBy.set(k, [l])
    }
  }
  return { units, linksBy }
}

/** Link counts per dimension key (rows) and unit (columns). */
export function countMatrix(grid: Grid, keys: DimKey[], unitIds: string[]): number[][] {
  return keys.map((k) => unitIds.map((u) => {
    let n = 0
    for (const oid of k.objectIds) n += grid.linksBy.get(cellKey(oid, u))?.length ?? 0
    return n
  }))
}

/** Distinct records behind a dimension key and unit, for the detail panel. */
export function cellLinks(grid: Grid, key: DimKey, unitId: string): CmpLink[] {
  const out: CmpLink[] = []
  for (const oid of key.objectIds) out.push(...(grid.linksBy.get(cellKey(oid, unitId)) ?? []))
  return out
}

// ---- Measures ----------------------------------------------------------------

export interface UnitStat {
  unitId: string
  /** Link incidences in this unit. */
  n: number
  distinctRecords: number
  rowsCovered: number
  rowsTotal: number
  perRow: Summary
  evenness: { value: number; lo: number; hi: number } | null
  gini: number
  familyMix: Record<RecordFamily, number>
  withRationale: number
  proposed: number
  firstYear: number | null
  lastYear: number | null
}

export interface PairStat {
  a: string
  b: string
  /** Jensen-Shannon divergence in bits, null when either unit has no links. */
  jsd: number | null
  /** Divergence expected by chance for samples this size. */
  chance: number | null
  /** Chance of seeing a divergence this large if both units drew from one profile. */
  p: number | null
  rowsJaccard: number
  sharedRecords: number
  n1: number
  n2: number
}

export type Reliability = 'none' | 'small' | 'fair'

export interface Measures {
  dim: DimId
  keys: DimKey[]
  unitIds: string[]
  counts: number[][]
  units: UnitStat[]
  pairs: PairStat[]
  distance: number[][]
  order: number[]
  merges: { a: number; b: number; height: number; size: number }[]
  mi: MutualInfo
  miTest: PermutationResult
  residuals: number[][]
  nLinks: number
  reliability: Reliability
}

export function yearOf(date: string | null): number | null {
  if (!date) return null
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(date)
  if (!m) return null
  const y = Number(m[1])
  const mo = m[2] ? Number(m[2]) - 1 : 0
  const d = m[3] ? Number(m[3]) : 1
  return y + (mo + (d - 1) / 31) / 12
}

export function computeMeasures(
  grid: Grid, objects: CmpObject[], recordsById: Map<string, CmpRecord>, dim: DimId, unitIds: string[],
): Measures {
  const keys = dimensionKeys(objects, dim)
  const counts = countMatrix(grid, keys, unitIds)
  const nLinks = total(counts.map((r) => total(r)))
  const units: UnitStat[] = unitIds.map((uid, j) => {
    const col = counts.map((r) => r[j])
    const records = new Set<string>()
    const family = Object.fromEntries(RECORD_FAMILIES.map((f) => [f, 0])) as Record<RecordFamily, number>
    let withRationale = 0
    let proposed = 0
    let minY: number | null = null
    let maxY: number | null = null
    const seenLinks = new Set<string>()
    for (const k of keys) for (const oid of k.objectIds) {
      for (const l of grid.linksBy.get(cellKey(oid, uid)) ?? []) {
        if (seenLinks.has(l.id)) continue
        seenLinks.add(l.id)
        records.add(l.recordId)
        const rec = recordsById.get(l.recordId)
        if (rec) {
          family[rec.family]++
          const y = yearOf(rec.date)
          if (y !== null) { minY = minY === null ? y : Math.min(minY, y); maxY = maxY === null ? y : Math.max(maxY, y) }
        }
        if (l.rationale && l.rationale.trim().length >= 40) withRationale++
        if (l.proposed) proposed++
      }
    }
    return {
      unitId: uid,
      n: total(col),
      distinctRecords: records.size,
      rowsCovered: col.filter((c) => c > 0).length,
      rowsTotal: keys.length,
      perRow: describe(col),
      evenness: bootstrapEvenness(col, keys.length),
      gini: gini(col),
      familyMix: family,
      withRationale,
      proposed,
      firstYear: minY,
      lastYear: maxY,
    }
  })

  const cols = unitIds.map((_, j) => counts.map((r) => r[j]))
  const nUnits = unitIds.length
  const pairs: PairStat[] = []
  const distance = Array.from({ length: nUnits }, () => new Array<number>(nUnits).fill(0))
  const unitRecords = unitIds.map((uid) => {
    const s = new Set<string>()
    for (const o of objects) for (const l of grid.linksBy.get(cellKey(o.id, uid)) ?? []) s.add(l.recordId)
    return s
  })
  for (let i = 0; i < nUnits; i++) for (let j = i + 1; j < nUnits; j++) {
    const jsd = jensenShannon(cols[i], cols[j])
    const perm = jsd === null ? null : permutationJsd(cols[i], cols[j], 300)
    const rowsA = new Set(keys.filter((_, r) => counts[r][i] > 0).map((k) => k.id))
    const rowsB = new Set(keys.filter((_, r) => counts[r][j] > 0).map((k) => k.id))
    let shared = 0
    for (const rid of unitRecords[i]) if (unitRecords[j].has(rid)) shared++
    pairs.push({
      a: unitIds[i], b: unitIds[j], jsd, chance: perm?.nullMean ?? null, p: perm?.p ?? null,
      rowsJaccard: jaccard(rowsA, rowsB), sharedRecords: shared, n1: total(cols[i]), n2: total(cols[j]),
    })
    const dist = jsd === null ? 1 : Math.sqrt(jsd)
    distance[i][j] = distance[j][i] = dist
  }
  const { order, merges } = clusterOrder(distance)

  // Rows x units contingency table for "does the unit tell you which row?".
  const mi = mutualInformation(counts)
  const miTest = permutationMutualInformation(counts, 300)
  const residuals = adjustedResiduals(counts)
  const minUnitN = Math.min(...units.map((u) => u.n).filter((n) => n > 0), Infinity)
  const reliability: Reliability = nLinks === 0 ? 'none' : nLinks < 25 || minUnitN < 6 ? 'small' : 'fair'
  return { dim, keys, unitIds, counts, units, pairs, distance, order, merges, mi, miTest, residuals, nLinks, reliability }
}

// ---- Network measures ----------------------------------------------------------

export interface BridgeRecord {
  recordId: string
  /** Distinct top-level strands the record is linked to. */
  strands: number
  /** Distinct grade bands. */
  bands: number
  /** Distinct objects. */
  objects: number
  betweenness: number
}

export interface NetworkMeasures {
  /** The progression's items, joined when they share a real-world record. */
  itemGraph: Graph
  componentsCount: number
  isolated: string[]
  density: number
  bridges: BridgeRecord[]
  /** Items ranked by betweenness in the item-record network. */
  keyItems: { id: string; betweenness: number }[]
}

export function computeNetworkMeasures(objects: CmpObject[], links: CmpLink[], recordIdsInScope: Set<string>): NetworkMeasures {
  const byId = new Map(objects.map((o) => [o.id, o]))
  const scoped = links.filter((l) => recordIdsInScope.has(l.recordId) && byId.has(l.objectId))
  const recordObjects = new Map<string, string[]>()
  for (const l of scoped) {
    const arr = recordObjects.get(l.recordId)
    if (arr) arr.push(l.objectId)
    else recordObjects.set(l.recordId, [l.objectId])
  }
  const itemGraph = projectOnto(objects.map((o) => o.id), recordObjects)
  const comps = components(itemGraph)
  const isolated = comps.filter((c) => c.length === 1).map((c) => c[0])

  // Bipartite network of items and records, for betweenness of both kinds of node.
  const nodes = [...objects.map((o) => `o:${o.id}`), ...Array.from(recordObjects.keys()).map((r) => `r:${r}`)]
  const bip: Graph = { nodes, edges: scoped.map((l) => ({ a: `o:${l.objectId}`, b: `r:${l.recordId}` })) }
  const bt = betweenness(bip)
  const bridges: BridgeRecord[] = Array.from(recordObjects.entries()).map(([rid, oids]) => {
    const uniq = Array.from(new Set(oids))
    const strands = new Set(uniq.map((o) => topStrandOf(byId.get(o)!, byId).id))
    const bands = new Set(uniq.map((o) => byId.get(o)!.gradeBand ?? 'n/a'))
    return { recordId: rid, strands: strands.size, bands: bands.size, objects: uniq.length, betweenness: bt.get(`r:${rid}`) ?? 0 }
  }).filter((b) => b.objects > 1).sort((a, b) => b.strands - a.strands || b.betweenness - a.betweenness || b.objects - a.objects)
  const keyItems = objects.map((o) => ({ id: o.id, betweenness: bt.get(`o:${o.id}`) ?? 0 })).sort((a, b) => b.betweenness - a.betweenness)
  return { itemGraph, componentsCount: comps.length, isolated, density: density(itemGraph), bridges, keyItems }
}

// ---- Evidence flags for links ----------------------------------------------------

export type LinkIssue = 'no-rationale' | 'short-rationale' | 'boilerplate' | 'proposed' | 'questioned' | 'record-without-date'

export function linkIssues(l: CmpLink, reviews: CmpReview[]): LinkIssue[] {
  const out: LinkIssue[] = []
  const r = (l.rationale ?? '').trim()
  if (!r) out.push('no-rationale')
  else if (/one-time backfill/i.test(r)) out.push('boilerplate')
  else if (r.length < 60) out.push('short-rationale')
  if (l.proposed) out.push('proposed')
  if (reviews.some((v) => v.linkId === l.id && (v.verdict === 'questions' || v.verdict === 'wrong_place' || v.verdict === 'too_broad'))) out.push('questioned')
  return out
}
