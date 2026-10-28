import { Navigate, useOutletContext } from 'react-router-dom'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ProjectOutletContext } from '../project-layout'
import { COUNTRY_REPOSITORIES, getCurriculumConnectionsViewConfig, type CurriculumConnectionsViewConfig } from '@/lib/student-view-templates'
import { loadComparisonSource, type ComparisonSource } from '@/lib/supabase/comparison'
import {
  RECORD_FAMILIES, buildGrid, buildIndex, computeMeasures, computeNetworkMeasures, listUnits, recordUnitIds,
  type CmpConcept, type CmpLink, type CmpObject, type CmpRecord, type CmpReview, type DimId, type Grid, type Lang, type Level,
  type Measures, type NetworkMeasures, type RecordFamily, type TextIndex, type Unit,
} from '@/lib/comparison'
import { makeT, type Translate } from './strings'
import './comparison.css'

// The one place the comparison views get their data and their scope. Loaded
// once per view session, so moving between pages is instant and every page
// reads the same snapshot. Scope choices (which countries, state or country
// level, which rows) persist in this browser per view.

export interface ComparisonState {
  config: CurriculumConnectionsViewConfig
  templateId: string
  lang: Lang
  t: Translate
  project: ProjectOutletContext['project']
  role: ProjectOutletContext['role']
  supabase: ProjectOutletContext['supabase']
  branchId: string
  canEdit: boolean
  canCritique: boolean
  loading: boolean
  error: string | null
  source: ComparisonSource | null
  refresh: () => void

  // scope
  level: Level
  setLevel: (l: Level) => void
  countries: string[]
  toggleCountry: (code: string) => void
  dim: DimId
  setDim: (d: DimId) => void
  includeProposed: boolean
  setIncludeProposed: (v: boolean) => void
  families: Set<RecordFamily>
  toggleFamily: (f: RecordFamily) => void
  resetFamilies: () => void

  // derived
  objects: CmpObject[]
  objectsById: Map<string, CmpObject>
  concepts: CmpConcept[]
  topConcepts: CmpConcept[]
  topConceptOf: Map<string, string>
  allRecords: CmpRecord[]
  recordsById: Map<string, CmpRecord>
  /** Records in the countries switched on. */
  scopeRecords: CmpRecord[]
  /** Links to records in scope, after the proposed-links and record-kind choices. */
  links: CmpLink[]
  reviewsByLink: Map<string, CmpReview[]>
  units: Unit[]
  /** Records in scope per place. */
  recordCountByUnit: Map<string, number>
  /** Units that hold at least one link. The measures only compare these. */
  activeUnitIds: string[]
  grid: Grid
  measures: Measures
  network: NetworkMeasures
  recordIndex: TextIndex
  /** Nudge for suggestions: kinds of record people have linked more often rank a little higher. 1 for every record until 10 confirmed links exist. */
  recordWeight: (recordId: string) => number
  proposedShare: number

  // cross-page choice: the two places "Side by side" compares
  pair: [string, string] | null
  setPair: (p: [string, string] | null) => void
}

const Ctx = createContext<ComparisonState | null>(null)

export function useComparison(): ComparisonState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useComparison must be used inside <ComparisonProvider>')
  return v
}

interface Saved { level?: Level; countries?: string[]; dim?: DimId; includeProposed?: boolean; families?: RecordFamily[] }

function loadSaved(templateId: string): Saved {
  try { return JSON.parse(window.localStorage.getItem(`openlpm-comparison:${templateId}`) ?? '{}') } catch { return {} }
}
function save(templateId: string, s: Saved) {
  try { window.localStorage.setItem(`openlpm-comparison:${templateId}`, JSON.stringify(s)) } catch { /* a convenience only */ }
}

export function ComparisonProvider({ context, children }: { context: ProjectOutletContext; children: ReactNode }) {
  const { templateId } = context
  const config = getCurriculumConnectionsViewConfig(templateId)
  if (!config || !templateId) return <p className="muted">Unknown view configuration.</p>
  // Keyed by view, so switching views starts from that view's own saved scope instead of carrying the last one over.
  return <Loaded key={templateId} context={context} config={config} templateId={templateId}>{children}</Loaded>
}

function Loaded({ context, config, templateId, children }: { context: ProjectOutletContext; config: CurriculumConnectionsViewConfig; templateId: string; children: ReactNode }) {
  const { project, role, supabase, defaultBranchId } = context
  const lang: Lang = config.language
  const t = useMemo(() => makeT(lang), [lang])
  const saved = useMemo(() => loadSaved(templateId), [templateId])

  const [level, setLevelState] = useState<Level>(saved.level === 'state' || saved.level === 'country' ? saved.level : config.scope === 'country' ? 'state' : 'country')
  const [countries, setCountries] = useState<string[]>(
    config.scope === 'country' ? config.countries : (saved.countries ?? config.countries).filter((c) => config.availableCountries.includes(c)).length
      ? (saved.countries ?? config.countries).filter((c) => config.availableCountries.includes(c)) : config.countries,
  )
  const [dim, setDimState] = useState<DimId>(saved.dim === 'item' || saved.dim === 'band' || saved.dim === 'strand' ? saved.dim : 'strand')
  const [includeProposed, setIncludeProposedState] = useState<boolean>(saved.includeProposed ?? true)
  const [families, setFamilies] = useState<Set<RecordFamily>>(new Set(saved.families?.length ? saved.families : RECORD_FAMILIES))
  const [pair, setPair] = useState<[string, string] | null>(null)

  const [source, setSource] = useState<ComparisonSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)
  const refresh = useCallback(() => setToken((x) => x + 1), [])

  useEffect(() => {
    save(templateId, { level, countries, dim, includeProposed, families: Array.from(families) })
  }, [templateId, level, countries, dim, includeProposed, families])

  useEffect(() => {
    let alive = true
    const repositories = config.availableCountries.flatMap((c) => config.regionSlugs.filter((s) => countryOfSlug(s) === c).map((slug) => ({ slug, country: c })))
    loadComparisonSource(supabase, project.id, defaultBranchId, repositories)
      .then((s) => { if (alive) { setSource(s); setError(null) } })
      .catch((e) => { if (alive) setError(String(e?.message ?? e)) })
    return () => { alive = false }
  }, [supabase, project.id, defaultBranchId, config, token])

  const canEdit = role !== 'viewer' && role !== 'reviewer'
  const canCritique = canEdit || role === 'reviewer'

  const toggleCountry = useCallback((code: string) => {
    setCountries((prev) => {
      if (prev.includes(code)) return prev.length > 1 ? prev.filter((c) => c !== code) : prev
      return config.availableCountries.filter((c) => c === code || prev.includes(c))
    })
  }, [config.availableCountries])
  const toggleFamily = useCallback((f: RecordFamily) => {
    setFamilies((prev) => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next.size === 0 ? new Set(RECORD_FAMILIES) : next
    })
  }, [])
  const resetFamilies = useCallback(() => setFamilies(new Set(RECORD_FAMILIES)), [])

  const objects = source?.objects ?? EMPTY_OBJECTS
  const objectsById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects])
  const concepts = source?.concepts ?? EMPTY_CONCEPTS
  const { topConcepts, topConceptOf } = useMemo(() => {
    const byId = new Map(concepts.map((c) => [c.id, c]))
    const top = new Map<string, string>()
    for (const c of concepts) {
      let cur = c
      const guard = new Set<string>()
      while (cur.parentId && byId.has(cur.parentId) && !guard.has(cur.id)) { guard.add(cur.id); cur = byId.get(cur.parentId)! }
      top.set(c.id, cur.id)
    }
    const used = new Set<string>()
    for (const o of objects) for (const cid of o.conceptIds) { const tp = top.get(cid); if (tp) used.add(tp) }
    return { topConcepts: concepts.filter((c) => used.has(c.id)).sort((a, b) => a.label.localeCompare(b.label)), topConceptOf: top }
  }, [concepts, objects])

  const allRecords = source?.records ?? EMPTY_RECORDS
  const recordsById = useMemo(() => new Map(allRecords.map((r) => [r.id, r])), [allRecords])
  const countrySet = useMemo(() => new Set(countries), [countries])
  const scopeRecords = useMemo(() => allRecords.filter((r) => r.jurisdictions.some((j) => countrySet.has(j.split('-')[0])) && families.has(r.family)), [allRecords, countrySet, families])
  const scopeRecordIds = useMemo(() => new Set(scopeRecords.map((r) => r.id)), [scopeRecords])

  const links = useMemo(() => (source?.links ?? EMPTY_LINKS).filter((l) => scopeRecordIds.has(l.recordId) && objectsById.has(l.objectId) && (includeProposed || !l.proposed)), [source, scopeRecordIds, objectsById, includeProposed])
  const proposedShare = useMemo(() => (links.length ? links.filter((l) => l.proposed).length / links.length : 0), [links])
  const reviewsByLink = useMemo(() => {
    const m = new Map<string, CmpReview[]>()
    for (const r of source?.reviews ?? []) { const a = m.get(r.linkId); if (a) a.push(r); else m.set(r.linkId, [r]) }
    return m
  }, [source])

  const units = useMemo(() => listUnits(scopeRecords, level, countries, lang), [scopeRecords, level, countries, lang])
  const recordCountByUnit = useMemo(() => {
    const m = new Map<string, number>(units.map((u) => [u.id, 0]))
    for (const r of scopeRecords) for (const id of recordUnitIds(r, level, countrySet)) m.set(id, (m.get(id) ?? 0) + 1)
    return m
  }, [units, scopeRecords, level, countrySet])
  const grid = useMemo(() => buildGrid(units, links, recordsById, level, countrySet), [units, links, recordsById, level, countrySet])
  const activeUnitIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const [k, arr] of grid.linksBy) { const uid = k.slice(k.indexOf('|') + 1); counts.set(uid, (counts.get(uid) ?? 0) + arr.length) }
    return units.filter((u) => (counts.get(u.id) ?? 0) > 0).map((u) => u.id)
  }, [grid, units])
  const measures = useMemo(() => computeMeasures(grid, objects, recordsById, dim, activeUnitIds), [grid, objects, recordsById, dim, activeUnitIds])
  const network = useMemo(() => computeNetworkMeasures(objects, links, scopeRecordIds), [objects, links, scopeRecordIds])
  const recordIndex = useMemo(() => buildIndex(allRecords.map((r) => ({ id: r.id, text: `${r.title} ${r.title} ${r.summary}` }))), [allRecords])

  const recordWeight = useMemo(() => {
    const confirmed = (source?.links ?? EMPTY_LINKS).filter((l) => !l.proposed)
    if (confirmed.length < 10) return () => 1
    const corpus = new Map<RecordFamily, number>()
    for (const r of allRecords) corpus.set(r.family, (corpus.get(r.family) ?? 0) + 1)
    const linked = new Map<RecordFamily, number>()
    let n = 0
    for (const l of confirmed) { const f = recordsById.get(l.recordId)?.family; if (f) { linked.set(f, (linked.get(f) ?? 0) + 1); n++ } }
    const lift = (f: RecordFamily) => Math.min(3, Math.max(0.25, (((linked.get(f) ?? 0) + 0.5) / (n + 3)) / ((corpus.get(f) ?? 1) / Math.max(1, allRecords.length))))
    return (id: string) => { const f = recordsById.get(id)?.family; return f ? lift(f) : 1 }
  }, [source, allRecords, recordsById])

  const state: ComparisonState = {
    config, templateId, lang, t, project, role, supabase, branchId: defaultBranchId, canEdit, canCritique,
    loading: !source && !error, error, source, refresh,
    level, setLevel: setLevelState, countries, toggleCountry, dim, setDim: setDimState, includeProposed, setIncludeProposed: setIncludeProposedState,
    families, toggleFamily, resetFamilies,
    objects, objectsById, concepts, topConcepts, topConceptOf, allRecords, recordsById, scopeRecords, links, reviewsByLink,
    units, recordCountByUnit, activeUnitIds, grid, measures, network, recordIndex, recordWeight, proposedShare, pair, setPair,
  }
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

const EMPTY_OBJECTS: CmpObject[] = []
const EMPTY_CONCEPTS: CmpConcept[] = []
const EMPTY_RECORDS: CmpRecord[] = []
const EMPTY_LINKS: CmpLink[] = []

function countryOfSlug(slug: string): string {
  for (const [c, slugs] of Object.entries(COUNTRY_REPOSITORIES)) if (slugs.includes(slug)) return c
  return ''
}

/**
 * Wraps a comparison page's route. Someone can land on one of these addresses
 * while a different view is active (an old link, or a view switched in another
 * tab). Instead of failing, send them to the project's home, which shows
 * whichever view they have.
 */
export function ComparisonOnly({ children }: { children: ReactNode }) {
  const context = useOutletContext<ProjectOutletContext>()
  if (!context.viewsReady) return <p className="muted">…</p>
  if (!getCurriculumConnectionsViewConfig(context.templateId)) return <Navigate to={`/dashboard/${context.slug}`} replace />
  return <>{children}</>
}
