// Shared shape every import path (CASE, FWU/MEM-Schule Lehrplan-Ontologie,
// future custom-schema uploads) converges on before landing in
// lpm_data_objects.content -- mirrors EvoMentor's own
// schema/canonical-curriculum-item.schema.json so content imported here
// stays interoperable with the wider ecosystem, not just this one app.
export type SourceFormat = 'case' | 'fwu-lehrplan-ontologie'

export type LicenseVerdict = 'ALLOW_FULL' | 'CITATION_ONLY' | 'BLOCKED'

export interface CanonicalCurriculumItem {
  sourceFormat: SourceFormat
  sourceRef: Record<string, unknown>
  jurisdiction: string
  language: string
  subject?: string
  gradeBand?: string
  fullStatement: string
  concepts: never[]
  provenance: {
    ingestedFrom: SourceFormat
    ingestedAt: string
    importedVia: 'openlpm-import-ui'
    conceptTagged: false
  }
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
