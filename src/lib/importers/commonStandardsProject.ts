// Client for api.commonstandardsproject.com -- a live, no-auth, CORS-open
// (Access-Control-Allow-Origin: *, checked directly against the endpoint)
// directory of real academic standards for all 50 US states plus other
// issuing bodies, each republished under its own checked license. Fetched
// directly from the browser; nothing proxied, since this API allows it.
//
// License is checked per STANDARD SET, not per state -- confirmed live that
// this varies (e.g. Texas's current Biology TEKS republishing carries no
// license at all, while its own superseded vintage does, from a different
// republisher). classifyLicense() below fails closed on anything unclear,
// same discipline as EvoMentor's own case_license_gate.py.
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

/** Fail-closed license classification -- same philosophy as
 * ConceptBase's scripts/case_license_gate.py: an absent or unrecognized
 * license blocks full-text reuse rather than assuming it's fine. */
export function classifyLicense(license: CaseLicense | null | undefined): 'ALLOW_FULL' | 'CITATION_ONLY' | 'BLOCKED' {
  if (!license || !license.URL) return 'BLOCKED'
  const url = license.URL.toLowerCase()
  if (url.includes('creativecommons.org/licenses/by') || url.includes('creativecommons.org/publicdomain')) {
    return 'ALLOW_FULL'
  }
  return 'CITATION_ONLY'
}

/** Leaf standards only (no children in the source hierarchy) -- these map
 * most naturally to individual curriculum items, the way EvoMentor's own
 * importers treat leaf-level Lernziel/CFItem nodes. */
export function leafStandards(detail: StandardSetDetail): CaseStandard[] {
  const parentIds = new Set(Object.values(detail.standards).map((s) => s.parentId).filter((p): p is string => !!p))
  return Object.values(detail.standards).filter((s) => !parentIds.has(s.id))
}
