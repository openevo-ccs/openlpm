// Client for a state's OWN first-party CASE (IMS 1EdTech Competencies and
// Academic Standards Exchange) REST hosting -- e.g. Virginia's own
// va.satchelcommons.com, a state-run instance, as opposed to the generic
// third-party aggregator in commonStandardsProject.ts.
//
// Why this file exists, and why it does NOT reuse commonStandardsProject.ts's
// classifyLicense(): checked directly (2026-09-12) that api.commonstandards
// project.com claimed Virginia's 2018 Science SOL was "CC BY 4.0 US" --
// but Virginia's own first-party hosting of the SAME document states its
// real license as "Copyright (c) 2023 by the Virginia Department of
// Education" (plain copyright, several of VDOE's other subjects go further
// and say "in-app and alignment use only; no redistribution or
// republication"). A third party's own license claim about someone else's
// copyrighted work cannot be trusted over the rights holder's own statement
// -- so this path only ever trusts the license attached directly to the
// state's own CFDocument, fetched from the state's own host, never a
// re-publisher's separate metadata.
export interface CfLicense {
  title: string | null
  uri: string | null
}

export interface CfItem {
  identifier: string
  fullStatement: string
  humanCodingScheme?: string
  educationLevel?: string[]
  CFItemType?: string
}

export interface CfAssociation {
  associationType: string
  originNodeURI: { identifier: string }
  destinationNodeURI: { identifier: string }
}

export interface CfPackage {
  CFDocument: {
    identifier: string
    title: string
    subject?: string[]
    licenseURI?: CfLicense
    officialSourceURL?: string
    creator?: string
    publisher?: string
    adoptionStatus?: string
  }
  CFItems: CfItem[]
  CFAssociations?: CfAssociation[]
}

export interface CfDocumentSummary {
  identifier: string
  title: string
  subject?: string[]
  licenseURI?: CfLicense
}

function normalizeBase(hostOrUrl: string): string {
  let s = hostOrUrl.trim()
  if (!s) return ''
  if (!s.startsWith('http')) s = `https://${s}`
  // Strip any path the user pasted along with a bare host.
  const u = new URL(s)
  return `${u.protocol}//${u.host}`
}

/** Accepts a full .../CFPackages/<id> URL and fetches it directly. */
export async function fetchCfPackage(url: string): Promise<CfPackage> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`CASE API error (${res.status}) fetching ${url}`)
  return (await res.json()) as CfPackage
}

/** Given just a host (or any URL on that host), lists the CFDocuments -- the
 * available standards frameworks -- it publishes, each with its OWN real
 * license shown up front. */
export async function listCfDocuments(hostOrUrl: string): Promise<{ base: string; documents: CfDocumentSummary[] }> {
  const base = normalizeBase(hostOrUrl)
  const res = await fetch(`${base}/ims/case/v1p1/CFDocuments`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`CASE API error (${res.status}) listing documents at ${base}`)
  const body = await res.json()
  return { base, documents: (body.CFDocuments ?? []) as CfDocumentSummary[] }
}

export function cfPackageUrl(base: string, documentId: string): string {
  return `${base}/ims/case/v1p1/CFPackages/${documentId}`
}

/** Fail-closed, same discipline as EvoMentor's case_license_gate.py and
 * commonStandardsProject.ts's classifyLicense() -- but applied ONLY to the
 * license actually attached to this document by its own publisher. */
export function classifyCfLicense(license: CfLicense | null | undefined): 'ALLOW_FULL' | 'CITATION_ONLY' | 'BLOCKED' {
  if (!license || (!license.title && !license.uri)) return 'BLOCKED'
  const text = `${license.title ?? ''} ${license.uri ?? ''}`.toLowerCase()
  if (text.includes('no redistribution') || text.includes('no republication') || text.includes('all rights reserved')) {
    return 'BLOCKED'
  }
  if (text.includes('creativecommons.org/licenses/by') || text.includes('creativecommons.org/publicdomain') || text.includes('public domain')) {
    return 'ALLOW_FULL'
  }
  if (text.includes('copyright')) return 'BLOCKED'
  return 'CITATION_ONLY'
}

/** Leaf items: a CFItem no other item's isChildOf association points to as
 * a destination (i.e. nothing declares itself a child of it). */
export function leafCfItems(pkg: CfPackage): CfItem[] {
  const parents = new Set<string>()
  for (const a of pkg.CFAssociations ?? []) {
    if (a.associationType === 'isChildOf') parents.add(a.destinationNodeURI.identifier)
  }
  return pkg.CFItems.filter((i) => !parents.has(i.identifier))
}
