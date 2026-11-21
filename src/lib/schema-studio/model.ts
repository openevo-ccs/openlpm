// Turns a Schema Studio snapshot into the things the screens need: record types as nodes, links between them, a flat list of
// every field, the controlled-value lists, and automatic findings about the structure. Everything here is computed from the
// snapshot, so a new schema field or record type shows up with no code change.

import type { FieldDef, RecordTypeDef, RepoDef, Snapshot } from './types'

export interface GroupStyle { key: string; label: string; order: number; dark: string; mid: string; light: string; tint: string }

// Same colour roles as the Base Repositories diagram (teal, blue, indigo, lime, amber), plus slate for the layers around the base repositories.
export const GROUPS: Record<string, GroupStyle> = {
  curriculum: { key: 'curriculum', label: 'Curriculum core', order: 0, dark: '#00514c', mid: '#00867d', light: '#7fd1c7', tint: '#e3f4f1' },
  practice: { key: 'practice', label: 'Practice', order: 1, dark: '#0a4f86', mid: '#0170b9', light: '#7db8ea', tint: '#e4f0fb' },
  theory: { key: 'theory', label: 'Theory and inquiry', order: 2, dark: '#0b0b5e', mid: '#3535b8', light: '#a3a3ec', tint: '#e8e8f9' },
  evidence: { key: 'evidence', label: 'Evidence', order: 3, dark: '#44690a', mid: '#79a81f', light: '#c3dd7a', tint: '#f0f6df' },
  nature: { key: 'nature', label: 'Nature', order: 4, dark: '#9a5a0a', mid: '#d98d1f', light: '#f3cd85', tint: '#fcf1de' },
  graph: { key: 'graph', label: 'Graph and project layers', order: 5, dark: '#475569', mid: '#64748b', light: '#a8b4c4', tint: '#eef1f5' },
  retired: { key: 'retired', label: 'Retired', order: 6, dark: '#4b5563', mid: '#7b8494', light: '#c3c9d3', tint: '#eef0f3' },
}

export interface Target { repo: string; type?: string; field?: string }

export interface Edge {
  from: Target & { type: string; field: string }
  /** Where the link points. repo is a snapshot key, or 'humanbase' for the retired repository, or null when the id token is unknown. */
  to: { repo: string | null; type?: string; token: string }
  kind: 'intra' | 'cross' | 'retired' | 'unknown'
  required: boolean
  legacy: boolean
  list: boolean
}

export interface FlatField {
  id: string
  repo: string
  typeId: string
  typeName: string
  path: string
  depth: number
  field: FieldDef
  links: Edge[]
  style: 'camel' | 'snake' | 'plain'
  /** Lower-case, letters and digits only: relatedLiterature and related_literature share one key. */
  key: string
  search: string
}

export interface TypeNode {
  id: string
  repo: RepoDef
  def: RecordTypeDef
  title: string
  out: Edge[]
  in: Edge[]
  fieldCount: number
  documented: number
  linkFieldCount: number
  hasProvenance: boolean
}

export interface Finding {
  id: string
  severity: 'attention' | 'consider' | 'info'
  category: string
  title: string
  plain: string
  why: string
  action: string
  targets: Target[]
  repos: string[]
}

export interface VocabList { values: string[]; uses: { repo: string; type: string; field: string }[] }
export interface VocabGroup { fieldKey: string; fieldName: string; lists: VocabList[] }

export interface Model {
  snap: Snapshot
  repos: RepoDef[]
  repoByKey: Map<string, RepoDef>
  types: TypeNode[]
  typeById: Map<string, TypeNode>
  fields: FlatField[]
  fieldById: Map<string, FlatField>
  edges: Edge[]
  /** repo -> repo -> edges (cross-repository only) */
  matrix: Map<string, Map<string, Edge[]>>
  sharedNames: { key: string; names: string[]; fields: FlatField[] }[]
  vocab: VocabGroup[]
  findings: Finding[]
  findingsByType: Map<string, Finding[]>
  stats: { repos: number; types: number; fields: number; links: number; crossLinks: number; records: number }
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const styleOf = (name: string): FlatField['style'] => (name.includes('_') ? 'snake' : /[a-z][A-Z]/.test(name) ? 'camel' : 'plain')

// Titles in the schema files are written for developers ("TheoryBase Canonical Resource"). Drop the repository prefix and filler words.
export function shortTitle(def: RecordTypeDef, repo: RepoDef): string {
  let t = def.title || def.name
  t = t.replace(new RegExp(`^${repo.name}\\s+`, 'i'), '').replace(/^Canonical\s+/i, '').replace(/\bCanonical\b/gi, '').replace(/\s+/g, ' ').trim()
  if (!t || t === def.name) t = def.name.replace(/[-_]record$/, '').replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
  t = t.split(' ').map((w) => (ACRONYMS[w.toLowerCase()] ?? w)).join(' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const ACRONYMS: Record<string, string> = { lpm: 'LPM', lo: 'LO', id: 'ID' }

const TOKEN_EXTRA: Record<string, string> = { ASSUMPTION: 'proposition-record', COMPETINGPROPOSITION: 'proposition-record', PROPOSITION: 'proposition-record' }

export function buildModel(snap: Snapshot): Model {
  const repos = snap.repos
  const repoByKey = new Map(repos.map((r) => [r.key, r]))
  const types: TypeNode[] = []
  const typeById = new Map<string, TypeNode>()
  for (const r of repos) {
    for (const def of r.types) {
      const flat = def.fields
      const node: TypeNode = {
        id: def.id, repo: r, def, title: shortTitle(def, r), out: [], in: [], fieldCount: flat.length,
        documented: flat.filter((f) => f.description).length, linkFieldCount: flat.filter((f) => f.links?.length).length,
        hasProvenance: flat.some((f) => /provenance/i.test(f.name)),
      }
      types.push(node); typeById.set(node.id, node)
    }
  }

  const tokenToType = new Map<string, string>()
  for (const t of types) if (t.def.idToken) tokenToType.set(`${t.repo.key}:${t.def.idToken.toUpperCase()}`, t.id)
  const resolve = (token: string, fromRepo: string): { repo: string | null; type?: string } => {
    if (token.startsWith('SB:')) {
      const want = normalise(token.slice(3))
      const hit = types.find((t) => t.repo.key === 'species' && normalise(t.def.name) === want)
      return hit ? { repo: 'species', type: hit.id } : { repo: 'species' }
    }
    const up = token.toUpperCase()
    const owner = snap.tokenOwner[token] ?? snap.tokenOwner[up] ?? null
    if (!owner) return { repo: null }
    if (owner === 'humanbase') return { repo: 'humanbase' }
    const extra = TOKEN_EXTRA[up]
    if (extra) { const id = `${owner}/${extra}`; if (typeById.has(id)) return { repo: owner, type: id } }
    const t = tokenToType.get(`${owner}:${up}`)
    return t ? { repo: owner, type: t } : { repo: owner }
  }

  const flatFields: FlatField[] = []
  const edges: Edge[] = []
  const pushFields = (node: TypeNode, list: FieldDef[], prefix: string, depth: number) => {
    for (const f of list) {
      const path = prefix ? `${prefix}.${f.name}` : f.name
      const fe: Edge[] = []
      for (const l of f.links ?? []) {
        if (depth === 0 && f.name === 'id') continue
        if (path === 'id') continue
        const to = resolve(l.token, node.repo.key)
        const kind: Edge['kind'] = to.repo === null ? 'unknown' : to.repo === 'humanbase' ? 'retired' : to.repo === node.repo.key ? 'intra' : 'cross'
        // A pattern that only repeats the record's own id style is not a link to another record.
        if (kind === 'intra' && to.type === node.id && /^(id|slug)$/.test(f.name)) continue
        const e: Edge = { from: { repo: node.repo.key, type: node.id, field: path }, to: { repo: to.repo, type: to.type, token: l.token }, kind, required: f.required, legacy: l.legacy, list: !!f.list }
        fe.push(e); edges.push(e)
      }
      const ff: FlatField = {
        id: `${node.id}#${path}`, repo: node.repo.key, typeId: node.id, typeName: node.title, path, depth, field: f, links: fe, style: styleOf(f.name), key: normalise(f.name),
        search: [node.repo.name, node.title, node.def.name, path, f.type, f.description, (f.enum ?? []).join(' ')].join(' ').toLowerCase(),
      }
      flatFields.push(ff)
      if (f.children?.length) pushFields(node, f.children, path, depth + 1)
    }
  }
  for (const t of types) pushFields(t, t.def.fields, '', 0)
  for (const e of edges) {
    typeById.get(e.from.type)?.out.push(e)
    if (e.to.type) typeById.get(e.to.type)?.in.push(e)
  }
  const fieldById = new Map(flatFields.map((f) => [f.id, f]))

  const matrix = new Map<string, Map<string, Edge[]>>()
  for (const e of edges) {
    if (e.kind === 'intra' || e.kind === 'unknown' || !e.to.repo) continue
    const row = matrix.get(e.from.repo) ?? new Map<string, Edge[]>()
    row.set(e.to.repo, [...(row.get(e.to.repo) ?? []), e]); matrix.set(e.from.repo, row)
  }

  // Fields that carry the same name (ignoring camelCase and snake_case) in more than one record type.
  const byKey = new Map<string, FlatField[]>()
  for (const f of flatFields) if (f.depth === 0) byKey.set(f.key, [...(byKey.get(f.key) ?? []), f])
  const sharedNames = [...byKey.entries()].filter(([, v]) => v.length >= 2).map(([key, v]) => ({ key, names: [...new Set(v.map((x) => x.path))], fields: v })).sort((a, b) => b.fields.length - a.fields.length)

  // Controlled value lists, grouped by field name.
  const vmap = new Map<string, Map<string, VocabList>>()
  const vnames = new Map<string, string>()
  for (const f of flatFields) {
    if (!f.field.enum?.length) continue
    const k = f.key; vnames.set(k, vnames.get(k) ?? f.field.name)
    const sig = [...f.field.enum].sort().join('|')
    const lists = vmap.get(k) ?? new Map<string, VocabList>()
    const cur = lists.get(sig) ?? { values: f.field.enum, uses: [] }
    cur.uses.push({ repo: f.repo, type: f.typeId, field: f.path }); lists.set(sig, cur); vmap.set(k, lists)
  }
  const vocab: VocabGroup[] = [...vmap.entries()].map(([k, l]) => ({ fieldKey: k, fieldName: vnames.get(k) ?? k, lists: [...l.values()].sort((a, b) => b.uses.length - a.uses.length) }))
    .sort((a, b) => b.lists.reduce((s, x) => s + x.uses.length, 0) - a.lists.reduce((s, x) => s + x.uses.length, 0))

  const model: Model = {
    snap, repos, repoByKey, types, typeById, fields: flatFields, fieldById, edges, matrix, sharedNames, vocab, findings: [], findingsByType: new Map(),
    stats: {
      repos: repos.length, types: types.length, fields: flatFields.filter((f) => f.depth === 0).length, links: edges.length,
      crossLinks: edges.filter((e) => e.kind === 'cross' || e.kind === 'retired').length, records: repos.reduce((a, r) => a + r.types.reduce((b, t) => b + (t.recordCount ?? 0), 0), 0),
    },
  }
  model.findings = computeFindings(model)
  for (const f of model.findings) for (const t of f.targets) if (t.type) model.findingsByType.set(t.type, [...(model.findingsByType.get(t.type) ?? []), f])
  return model
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Findings: things worth a second look, found by rules over the whole structure.
// ---------------------------------------------------------------------------------------------------------------------------------
function computeFindings(m: Model): Finding[] {
  const out: Finding[] = []
  const nameOf = (k: string) => m.repoByKey.get(k)?.name ?? (k === 'humanbase' ? 'HumanBase (retired)' : k)
  const base = m.repos.filter((r) => r.tier === 'base')

  // 1. Naming style
  const style: Record<string, { camel: number; snake: number }> = {}
  for (const f of m.fields) if (f.depth === 0) { const s = (style[f.repo] ??= { camel: 0, snake: 0 }); if (f.style === 'camel') s.camel++; else if (f.style === 'snake') s.snake++ }
  const dominant = (s: { camel: number; snake: number }) => (s.camel > s.snake ? 'camelCase' : s.snake > s.camel ? 'snake_case' : 'mixed')
  const used = Object.entries(style).filter(([, s]) => s.camel + s.snake >= 3)
  const styles = new Set(used.map(([, s]) => dominant(s)))
  if (styles.size > 1) {
    out.push({
      id: 'naming-across', severity: 'consider', category: 'Naming',
      title: 'Field names follow different spelling styles in different repositories',
      plain: `Some repositories write field names like relatedLiterature (camelCase) and others like related_literature (snake_case). ${used.map(([k, s]) => `${nameOf(k)}: ${dominant(s)}`).join('; ')}.`,
      why: 'People and tools that work across repositories have to remember which style each one uses. Searches for one spelling miss the other.',
      action: 'Agree one style for new fields, and decide whether to rename older ones.', targets: used.map(([k]) => ({ repo: k })), repos: used.map(([k]) => k),
    })
  }
  for (const [k, s] of used) {
    if (Math.min(s.camel, s.snake) >= 3) out.push({
      id: `naming-mix:${k}`, severity: 'consider', category: 'Naming', title: `${nameOf(k)} mixes two spelling styles`,
      plain: `${s.camel} fields use camelCase and ${s.snake} use snake_case in the same repository.`, why: 'Mixed spelling inside one repository is the hardest kind to remember.',
      action: 'Pick one style for new fields and list the older ones that would need renaming.', targets: [{ repo: k }], repos: [k],
    })
  }

  // 2. Different field names pointing at the same repository
  const pointers = new Map<string, Map<string, FlatField[]>>()
  for (const e of m.edges) {
    if (e.kind !== 'cross' || !e.to.repo) continue
    const f = m.fieldById.get(`${e.from.type}#${e.from.field}`); if (!f) continue
    const mp = pointers.get(e.to.repo) ?? new Map<string, FlatField[]>(); const arr = mp.get(f.key) ?? []; arr.push(f); mp.set(f.key, arr); pointers.set(e.to.repo, mp)
  }
  for (const [target, names] of pointers) {
    if (names.size >= 4) {
      const fields = [...names.values()].flat()
      out.push({
        id: `pointer-names:${target}`, severity: 'consider', category: 'Links',
        title: `${names.size} different field names point at ${nameOf(target)}`,
        plain: `Records in other repositories point at ${nameOf(target)} using these field names: ${[...names.values()].map((v) => v[0].field.name).join(', ')}.`,
        why: 'When the same kind of link has many names, it is harder to find every record that uses a given item, and each name can mean something slightly different.',
        action: 'Check whether these are really different relationships. If not, choose one shared name.', targets: fields.map((f) => ({ repo: f.repo, type: f.typeId, field: f.path })), repos: [...new Set(fields.map((f) => f.repo)), target],
      })
    }
  }

  // 3. Same field name, different allowed values
  for (const g of m.vocab) {
    if (g.lists.length >= 2 && /status|type|class|kind|level|tier/i.test(g.fieldName)) {
      const uses = g.lists.reduce((a, l) => a + l.uses.length, 0)
      if (uses >= 3) out.push({
        id: `values:${g.fieldKey}`, severity: 'consider', category: 'Allowed values',
        title: `"${g.fieldName}" allows ${g.lists.length} different sets of values`,
        plain: `The field "${g.fieldName}" appears ${uses} times with ${g.lists.length} different lists of allowed values.`,
        why: 'A reader who learns what "' + g.fieldName + '" means in one place may guess wrongly in another.',
        action: 'Decide which differences are intended. Where they are not, align the lists.', targets: g.lists.flatMap((l) => l.uses.map((u) => ({ repo: u.repo, type: u.type, field: u.field }))), repos: [...new Set(g.lists.flatMap((l) => l.uses.map((u) => u.repo)))],
      })
    }
  }

  // 4. Links to the retired repository, legacy id styles, unknown targets
  for (const e of m.edges) {
    const f = m.fieldById.get(`${e.from.type}#${e.from.field}`); if (!f) continue
    const tgt = { repo: e.from.repo, type: e.from.type, field: e.from.field }
    if (e.kind === 'retired') out.push({
      id: `retired:${f.id}`, severity: 'attention', category: 'Links', title: `${f.typeName}: "${e.from.field}" points at the retired HumanBase`,
      plain: 'This field expects ids of people or groups from HumanBase, which is no longer developed.', why: 'Records written today have nowhere current to point.',
      action: 'Decide where people and groups live now, then change or retire this field.', targets: [tgt], repos: [e.from.repo],
    })
    if (e.kind === 'unknown') out.push({
      id: `unknown:${f.id}:${e.to.token}`, severity: 'consider', category: 'Links', title: `${f.typeName}: "${e.from.field}" mentions an id style no repository owns (${e.to.token})`,
      plain: `The field refers to ids that start with OE-${e.to.token}-, and no repository in the map claims that prefix.`, why: 'A link with no owner cannot be followed.',
      action: 'Check the spelling, or register the prefix with the shared kernel.', targets: [tgt], repos: [e.from.repo],
    })
  }
  const legacyByRepo = new Map<string, Edge[]>()
  for (const e of m.edges) if (e.legacy) legacyByRepo.set(e.from.repo, [...(legacyByRepo.get(e.from.repo) ?? []), e])
  for (const [k, es] of legacyByRepo) out.push({
    id: `legacy-ids:${k}`, severity: 'consider', category: 'Identifiers', title: `${nameOf(k)} still accepts older id styles in ${es.length} field${es.length > 1 ? 's' : ''}`,
    plain: 'Some links accept short forms such as "lit:" or "question:" next to the permanent OE- ids.', why: 'Two id styles for one thing make links harder to check and to follow.',
    action: 'Migrate the older ids and remove the old pattern from the schema.', targets: es.map((e) => ({ repo: k, type: e.from.type, field: e.from.field })), repos: [k],
  })

  // 5. Per record type
  for (const t of m.types) {
    const tgt: Target = { repo: t.repo.key, type: t.id }
    if (t.fieldCount >= 5 && t.documented / t.fieldCount < 0.5) out.push({
      id: `undocumented:${t.id}`, severity: 'info', category: 'Explanations', title: `${t.title}: ${t.fieldCount - t.documented} of ${t.fieldCount} fields have no description`,
      plain: 'The schema file does not explain what these fields hold.', why: 'Newcomers and tools can only guess from the name.', action: 'Add a short plain-language description to each field.', targets: [tgt], repos: [t.repo.key],
    })
    if (t.repo.tier === 'base' && !t.hasProvenance && t.fieldCount >= 5) out.push({
      id: `no-provenance:${t.id}`, severity: 'consider', category: 'Shared fields', title: `${t.title} has no provenance block`,
      plain: 'Most record types record who wrote a record, when, and how far it has been reviewed. This one does not.', why: 'Without it a reader cannot tell a checked record from a draft.', action: 'Add the shared provenance block, or note why it is left out.', targets: [tgt], repos: [t.repo.key],
    })
    if (t.repo.tier === 'base' && !t.def.idPattern && !t.def.idToken) out.push({
      id: `no-id-pattern:${t.id}`, severity: 'consider', category: 'Identifiers', title: `${t.title} does not say what its ids look like`,
      plain: 'The schema has no pattern for the id field.', why: 'Other repositories cannot check that a link to this type is well formed.', action: 'Add an id pattern (OE-TYPE-slug).', targets: [tgt], repos: [t.repo.key],
    })
    const cross = t.out.filter((e) => e.kind === 'cross').length + t.in.filter((e) => e.from.repo !== t.repo.key).length
    if (t.repo.tier === 'base' && cross === 0 && t.out.length + t.in.length === 0) out.push({
      id: `island:${t.id}`, severity: 'info', category: 'Links', title: `${t.title} has no links to or from any other record type`,
      plain: 'Nothing in the schemas points at this type, and it points at nothing.', why: 'It may be a stand-alone list, or links may be missing.', action: 'Check whether it should connect to something.', targets: [tgt], repos: [t.repo.key],
    })
    for (const f of t.def.fields) if (f.deprecated) out.push({
      id: `deprecated:${t.id}:${f.name}`, severity: 'info', category: 'Clean-up', title: `${t.title}: "${f.name}" is marked as older`,
      plain: 'The description calls this field deprecated, legacy or superseded.', why: 'Fields that stay forever keep being used.', action: 'Set a date to remove it, or remove the warning.', targets: [{ ...tgt, field: f.name }], repos: [t.repo.key],
    })
  }
  for (const r of base) if (!r.governance) out.push({
    id: `no-governance:${r.key}`, severity: 'consider', category: 'Governance', title: `${r.name} has no GOVERNANCE file`,
    plain: 'The repository does not say how its schema may change.', why: 'Changes need a known route (a proposal, a review).', action: 'Add a short GOVERNANCE.md.', targets: [{ repo: r.key }], repos: [r.key],
  })
  const order = { attention: 0, consider: 1, info: 2 } as const
  return out.sort((a, b) => order[a.severity] - order[b.severity] || a.category.localeCompare(b.category) || a.title.localeCompare(b.title))
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Search: a small query language. Plain words match anywhere. Operators narrow it:
//   repo:theory   type:proposition   field:related   links:literature   has:link  has:enum  has:children  is:required  is:list  undocumented
// ---------------------------------------------------------------------------------------------------------------------------------
export interface ParsedQuery { words: string[]; ops: { op: string; value: string }[]; empty: boolean }

export function parseQuery(q: string): ParsedQuery {
  const words: string[] = []; const ops: { op: string; value: string }[] = []
  for (const tok of q.trim().split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^(repo|type|field|links|has|is):(.+)$/i)
    if (m) ops.push({ op: m[1].toLowerCase(), value: m[2].toLowerCase() })
    else if (/^undocumented$/i.test(tok)) ops.push({ op: 'is', value: 'undocumented' })
    else words.push(tok.toLowerCase())
  }
  return { words, ops, empty: !words.length && !ops.length }
}

export function fieldMatches(f: FlatField, q: ParsedQuery, m: Model): boolean {
  if (q.empty) return true
  const repo = m.repoByKey.get(f.repo)
  for (const { op, value } of q.ops) {
    if (op === 'repo' && !(f.repo.includes(value) || repo?.name.toLowerCase().includes(value))) return false
    if (op === 'type' && !(f.typeName.toLowerCase().includes(value) || f.typeId.toLowerCase().includes(value))) return false
    if (op === 'field' && !f.path.toLowerCase().includes(value)) return false
    if (op === 'links' && !f.links.some((e) => (e.to.repo ?? '').includes(value) || (nameLower(m, e.to.repo)).includes(value) || e.to.token.toLowerCase().includes(value))) return false
    if (op === 'has') {
      if (value === 'link' && !f.links.length) return false
      if (value === 'enum' && !f.field.enum?.length) return false
      if (value === 'children' && !f.field.children?.length) return false
      if (value === 'description' && !f.field.description) return false
    }
    if (op === 'is') {
      if (value === 'required' && !f.field.required) return false
      if (value === 'list' && !f.field.list) return false
      if (value === 'undocumented' && f.field.description) return false
      if (value === 'deprecated' && !f.field.deprecated) return false
    }
  }
  return q.words.every((w) => f.search.includes(w))
}
const nameLower = (m: Model, k: string | null) => (k ? (m.repoByKey.get(k)?.name ?? k).toLowerCase() : '')

export function typeMatches(t: TypeNode, q: ParsedQuery, m: Model): boolean {
  if (q.empty) return true
  const fieldHit = m.fields.some((f) => f.typeId === t.id && fieldMatches(f, q, m))
  return fieldHit
}

export const slugRepoName = (m: Model, key: string) => m.repoByKey.get(key)?.name ?? (key === 'humanbase' ? 'HumanBase (retired)' : key)

/** What changed between two snapshots: added and removed record types and fields, per repository. */
export interface SnapshotDiff { repo: string; addedTypes: string[]; removedTypes: string[]; fields: { type: string; added: string[]; removed: string[]; changed: string[] }[] }
export function diffSnapshots(a: Snapshot, b: Snapshot): SnapshotDiff[] {
  const out: SnapshotDiff[] = []
  for (const rb of b.repos) {
    const ra = a.repos.find((r) => r.key === rb.key)
    const d: SnapshotDiff = { repo: rb.key, addedTypes: [], removedTypes: [], fields: [] }
    if (!ra) { d.addedTypes = rb.types.map((t) => t.name); out.push(d); continue }
    const ta = new Map(ra.types.map((t) => [t.name, t])); const tb = new Map(rb.types.map((t) => [t.name, t]))
    d.addedTypes = [...tb.keys()].filter((k) => !ta.has(k)); d.removedTypes = [...ta.keys()].filter((k) => !tb.has(k))
    for (const [name, t2] of tb) {
      const t1 = ta.get(name); if (!t1) continue
      const f1 = new Map(t1.fields.map((f) => [f.name, f])); const f2 = new Map(t2.fields.map((f) => [f.name, f]))
      const added = [...f2.keys()].filter((k) => !f1.has(k)); const removed = [...f1.keys()].filter((k) => !f2.has(k))
      const changed = [...f2.keys()].filter((k) => f1.has(k) && (f1.get(k)!.type !== f2.get(k)!.type || f1.get(k)!.required !== f2.get(k)!.required || (f1.get(k)!.enum ?? []).join('|') !== (f2.get(k)!.enum ?? []).join('|')))
      if (added.length || removed.length || changed.length) d.fields.push({ type: name, added, removed, changed })
    }
    if (d.addedTypes.length || d.removedTypes.length || d.fields.length) out.push(d)
  }
  return out
}
