// Client for api.commonstandardsproject.com -- a live, no-auth, CORS-open
// (Access-Control-Allow-Origin: *, checked directly against the endpoint)
// THIRD-PARTY directory of real academic standards for all 50 US states.
// Fetched directly from the browser; nothing proxied, since this API allows
// it. Good for DISCOVERY (what does a state call its standards, how are
// they organized) -- not trusted for licensing.
//
// Checked directly (2026-09-12): this API claimed Virginia's 2018 Science
// SOL was "CC BY 4.0 US", but Virginia's OWN first-party CASE hosting
// (va.satchelcommons.com, see caseDirect.ts) states its real license as
// plain copyright for the identical document. A re-publisher's own license
// claim about someone else's copyrighted government work isn't grounds to
// trust it over the rights holder's own statement, however official the
// claimed license URL looks -- classifyLicense() below therefore never
// authorizes full-text reproduction from this source, full stop. Use
// caseDirect.ts (a state's own hosting) when full text is actually needed;
// this module is for finding what exists, not importing its wording as-is.
const API_BASE = 'https://api.commonstandardsproject.com/api/v1'

export interface Jurisdiction {
  id: string
  title: string
  type: string
}

export interface StandardSetSummary {
  id: string
  title: string
  subject: string | null
  educationLevels: string[]
  document: { publicationStatus: string; title?: string; sourceURL?: string }
}

export interface CaseLicense {
  title: string | null
  URL: string | null
  rightsHolder: string | null
}

export interface CaseStandard {
  id: string
  statementNotation: string | null
  description: string
  parentId: string | null
}

export interface StandardSetDetail {
  id: string
  title: string
  subject: string
  jurisdiction: { id: string; title: string }
  license: CaseLicense
  document: { title?: string; sourceURL?: string; publicationStatus: string }
  standards: Record<string, CaseStandard>
}

export async function listJurisdictions(): Promise<Jurisdiction[]> {
  const res = await fetch(`${API_BASE}/jurisdictions`)
  if (!res.ok) throw new Error(`Common Standards Project API error (${res.status})`)
  const body = await res.json()
  return (body.data as Jurisdiction[]).filter((j) => j.type === 'state').sort((a, b) => a.title.localeCompare(b.title))
}

export async function getJurisdictionStandardSets(jurisdictionId: string): Promise<StandardSetSummary[]> {
  const res = await fetch(`${API_BASE}/jurisdictions/${jurisdictionId}`)
  if (!res.ok) throw new Error(`Common Standards Project API error (${res.status})`)
  const body = await res.json()
  return body.data.standardSets as StandardSetSummary[]
}

export async function getStandardSet(id: string): Promise<StandardSetDetail> {
  const res = await fetch(`${API_BASE}/standard_sets/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`Common Standards Project API error (${res.status})`)
  const body = await res.json()
  return body.data as StandardSetDetail
}

/** Deliberately caps at CITATION_ONLY, never ALLOW_FULL -- see this file's
 * header comment for why this source's own license claims aren't trusted
 * for full-text reproduction, proven wrong at least once already. */
export function classifyLicense(license: CaseLicense | null | undefined): 'CITATION_ONLY' | 'BLOCKED' {
  if (!license || !license.URL) return 'BLOCKED'
  return 'CITATION_ONLY'
}

/** Leaf standards only (no children in the source hierarchy) -- these map
 * most naturally to individual curriculum items, the way EvoMentor's own
 * importers treat leaf-level Lernziel/CFItem nodes. */
export function leafStandards(detail: StandardSetDetail): CaseStandard[] {
  const parentIds = new Set(Object.values(detail.standards).map((s) => s.parentId).filter((p): p is string => !!p))
  return Object.values(detail.standards).filter((s) => !parentIds.has(s.id))
}
