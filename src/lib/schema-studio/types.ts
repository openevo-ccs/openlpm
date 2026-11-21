// Shapes of the Schema Studio snapshot (built by scripts/lib/schema-studio-build.mjs, stored in schema_studio_snapshot, migration 253).

export interface LinkEvidence { token: string; evidence: string; legacy: boolean }

export interface FieldDef {
  name: string
  type: string
  required: boolean
  description: string
  enum?: string[]
  enumTruncated?: number
  pattern?: string
  list?: boolean
  sharedDef?: string
  links?: LinkEvidence[]
  deprecated?: boolean
  default?: unknown
  children?: FieldDef[]
}

export interface RecordTypeDef {
  kind: 'type'
  id: string
  file: string
  name: string
  title: string
  description: string
  idToken?: string
  idPattern?: string
  idDescription?: string
  required: string[]
  closed?: boolean
  fields: FieldDef[]
  defs?: { name: string; type: string; description: string; enum?: string[] }[]
  recordCount?: number
  schemaVersion?: string
}

export interface RepoDef {
  key: string
  name: string
  group: string
  tier: 'base' | 'extension'
  github: string
  visibility: string
  intro: string
  retiredOn: string | null
  git: { sha: string; date: string | null; branch: string | null; lastSchemaChange: { sha: string; date: string; subject: string } | null } | null
  recordFiles: number
  idCounts: Record<string, number>
  governance: boolean
  contributing: boolean
  vocabularies: { file: string; name: string; version?: string }[]
  types: RecordTypeDef[]
  sharedDefs: { name: string; type: string; description: string; enum?: string[]; file: string }[]
}

export interface OntologyClass { iri: string; label: string; status?: string; subClassOf?: string; definition: string }
export interface OntologyProperty { iri: string; label: string; domain?: string; range?: string; status?: string; definition: string }

export interface Snapshot {
  version: number
  generatedAt: string
  contentHash: string
  repos: RepoDef[]
  core: { key: string; name: string; github: string; git: RepoDef['git']; ontology: { version?: string; status?: string; classes: OntologyClass[]; properties: OntologyProperty[] } | null } | null
  tokenOwner: Record<string, string>
  retired: Record<string, string>
  warnings: string[]
}

export type Lens = 'structure' | 'meaning' | 'links' | 'data' | 'health' | 'shared' | 'naming'
export type StudioView = 'map' | 'explore' | 'connections' | 'values' | 'health' | 'changes' | 'board'
