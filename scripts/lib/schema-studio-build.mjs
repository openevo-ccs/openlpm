// Builds the Schema Studio snapshot: one JSON document describing every base repository's schemas (record types, fields, links to other
// repositories, controlled values) plus the shared kernel's ontology classes. Read-only: it reads schema files from local checkouts of
// the repositories and never writes to them.
//
// Used by scripts/sync_schema_studio_snapshot.mjs (local runs and the scheduled GitHub Action) and by scripts/test_schema_studio.mjs.
// Pure Node, no network. js-yaml is already an OpenLPM dependency.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import yaml from 'js-yaml'

export const SNAPSHOT_VERSION = 1

// Repositories the Studio covers. `dirs` are the folders that hold schema files, relative to the repository root.
export const REPO_DEFS = [
  { key: 'concept', name: 'ConceptBase', dir: 'conceptbase', github: 'openevo-ccs/conceptbase', group: 'curriculum', tier: 'base', schemaDirs: ['schemas'], visibility: 'public' },
  { key: 'competency', name: 'CompetencyBase', dir: 'competencybase', github: 'openevo-ccs/competencybase', group: 'curriculum', tier: 'base', schemaDirs: ['schema'] },
  { key: 'teaching', name: 'TeachingBase', dir: 'teachingbase', github: 'openevo-ccs/teachingbase', group: 'practice', tier: 'base', schemaDirs: ['schema'] },
  { key: 'project', name: 'ProjectBase', dir: 'projectbase', github: 'openevo-ccs/projectbase', group: 'practice', tier: 'base', schemaDirs: ['schema'] },
  { key: 'theory', name: 'TheoryBase', dir: 'theorybase', github: 'openevo-ccs/theorybase', group: 'theory', tier: 'base', schemaDirs: ['schema'] },
  { key: 'question', name: 'QuestionBase', dir: 'questionbase', github: 'openevo-ccs/questionbase', group: 'theory', tier: 'base', schemaDirs: ['schema'] },
  { key: 'methods', name: 'MethodsBase', dir: 'methodsbase', github: 'openevo-ccs/methodsbase', group: 'theory', tier: 'base', schemaDirs: ['schema'] },
  { key: 'literature', name: 'LiteratureBase', dir: 'literaturebase', github: 'openevo-ccs/literaturebase', group: 'evidence', tier: 'base', schemaDirs: ['schema'] },
  { key: 'quote', name: 'QuoteBase', dir: 'quotebase', github: 'openevo-ccs/quotebase', group: 'evidence', tier: 'base', schemaDirs: ['schema'] },
  { key: 'species', name: 'SpeciesBase', dir: 'SpeciesBase', github: 'openevo-ccs/speciesbase', group: 'nature', tier: 'base', schemaDirs: ['schemas'] },
  { key: 'ccsgraph', name: 'ccs-graph', dir: 'ccs-graph', github: 'openevo-ccs/ccs-graph', group: 'graph', tier: 'extension', schemaDirs: ['schema'] },
  { key: 'deutschelp', name: 'deutsche_lp', dir: 'deutsche_lp', github: 'openevo-ccs/deutsche_lp', group: 'graph', tier: 'extension', schemaDirs: ['schema'] },
]
export const CORE_DEF = { key: 'core', name: 'openevo-core', dir: 'openevo-core', github: 'openevo-ccs/openevo-core' }

// Retired repositories stay in the link map as dashed targets so that fields pointing at them show up as a to-do.
// Record types whose id pattern is not a single OE-TYPE pattern (several tiers, or an older id style). name -> counting tokens.
export const TYPE_TOKENS = {
  concept: ['CONCEPT', 'SANDBOX'], lpm: ['LPM'], strand: ['STRAND'], learningObject: ['LO'], alignment: ['ALIGN'], frameworkRelation: ['FRAMEWORK'], competency: ['COMPETENCY'],
  'proposition-record': ['PROPOSITION', 'ASSUMPTION', 'COMPETINGPROPOSITION'],
  taxon: ['taxon'], taxonomic_concept: ['taxconcept'], lexical_form: ['name'], cultural_category: ['cultcat'], language: ['lang'], feature: ['feature'], feature_expression: ['featexpr'], context: ['context'], explanation: ['explanation'],
}

export const RETIRED_TOKENS = { PERSON: 'humanbase', GROUP: 'humanbase' }

// Which repository owns an identifier token such as OE-LITERATURE-<slug>.
export const TOKEN_OWNER = {
  CONCEPT: 'concept', LPM: 'concept', STRAND: 'concept', SUBSTRAND: 'concept', LO: 'concept', LEARNINGOBJECT: 'concept', ALIGN: 'concept', ONTOLOGY: 'concept', SANDBOX: 'concept', FRAMEWORK: 'concept',
  COMPETENCY: 'competency',
  RESOURCE: 'teaching',
  PROJECT: 'project',
  THEORY: 'theory', PROPOSITION: 'theory', HYPOTHESIS: 'theory', ASSUMPTION: 'theory', MECHANISM: 'theory', CROSSDOMAINCONSTRUCT: 'theory', DIVERGENCE: 'theory', MISCONCEPTION: 'theory',
  DESIGNPRINCIPLE: 'theory', CURRICULUMDECISION: 'theory', LEARNINGDEPENDENCY: 'theory', THEORYBUNDLE: 'theory', CONTEXT: 'theory', COMPETINGPROPOSITION: 'theory', RESEARCHEVIDENCE: 'theory', THEORETICALCONTEXT: 'theory',
  QUESTION: 'question', METHOD: 'methods', LITERATURE: 'literature', QUOTE: 'quote',
  TAXON: 'species', TAXCONCEPT: 'species', FEATURE: 'species', EXPLANATION: 'species', LANG: 'species', CULTCAT: 'species',
  PERSON: 'humanbase', GROUP: 'humanbase', ACTOR: 'humanbase',
}
// Older id styles that some schemas still use ("lit:", "question:"). They count as links too, flagged as legacy.
const LEGACY_PREFIX = { lit: 'LITERATURE', question: 'QUESTION', method: 'METHOD', theory: 'THEORY', project: 'PROJECT', resource: 'RESOURCE', person: 'PERSON', group: 'GROUP' }

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex')

function readDataFile(p) {
  const text = fs.readFileSync(p, 'utf8')
  return p.endsWith('.json') ? JSON.parse(text) : yaml.load(text)
}

// ---------------------------------------------------------------------------------------------------------------------------------
// $ref resolution (local "#/$defs/x" and sibling-file "common.defs.yaml#/$defs/x")
// ---------------------------------------------------------------------------------------------------------------------------------
function makeResolver(file, doc) {
  const dir = path.dirname(file)
  const cache = new Map([[file, doc]])
  const load = (p) => { if (!cache.has(p)) { try { cache.set(p, readDataFile(p)) } catch { cache.set(p, null) } } return cache.get(p) }
  const pointer = (root, ptr) => ptr.replace(/^#?\/?/, '').split('/').filter(Boolean).reduce((n, k) => (n == null ? n : n[decodeURIComponent(k.replace(/~1/g, '/').replace(/~0/g, '~'))]), root)
  function deref(node, rootFile = file, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 6) return node
    if (typeof node.$ref === 'string') {
      const [fpart, ptr] = node.$ref.split('#')
      const targetFile = fpart ? path.resolve(path.dirname(rootFile), fpart) : rootFile
      const root = load(targetFile)
      const target = root ? pointer(root, ptr || '') : null
      if (!target) return { ...node, $unresolved: node.$ref }
      const { $ref, ...rest } = node
      return deref({ ...target, ...rest, $refName: ptr ? ptr.split('/').pop() : path.basename(targetFile) }, targetFile, depth + 1)
    }
    return node
  }
  return { deref, load, dir }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Field extraction
// ---------------------------------------------------------------------------------------------------------------------------------
function typeLabel(node, R, file) {
  node = R.deref(node, file)
  if (!node) return 'any'
  if (node.enum) return 'choice'
  if (node.const !== undefined) return 'fixed value'
  if (node.oneOf || node.anyOf) {
    const opts = (node.oneOf || node.anyOf).map((o) => typeLabel(o, R, file))
    return [...new Set(opts)].join(' or ')
  }
  if (node.allOf) return node.allOf.map((o) => typeLabel(o, R, file)).find((t) => t !== 'any') || 'object'
  let t = node.type
  if (Array.isArray(t)) t = t.filter((x) => x !== 'null').join(' or ')
  if (t === 'array') {
    const it = node.items ? typeLabel(node.items, R, file) : 'any'
    return `list of ${it}${it.endsWith('s') ? '' : ''}`
  }
  if (t === 'object' || node.properties) return 'group of fields'
  if (t === 'string' && node.format) return node.format === 'date' ? 'date' : node.format === 'date-time' ? 'date and time' : node.format === 'uri' ? 'web address' : `text (${node.format})`
  if (t === 'string') return 'text'
  if (t === 'integer') return 'whole number'
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'yes / no'
  return t || 'any'
}

function collectStrings(node, R, file, out, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 5) return
  node = R.deref(node, file)
  for (const k of ['pattern', 'description', '$comment', 'title']) if (typeof node[k] === 'string') out.push({ from: k, text: node[k].replace(/\s+/g, ' ') })
  if (node.examples) for (const e of node.examples) if (typeof e === 'string') out.push({ from: 'examples', text: e })
  for (const k of ['items', 'additionalProperties', 'not']) if (node[k] && typeof node[k] === 'object') collectStrings(node[k], R, file, out, depth + 1)
  for (const k of ['oneOf', 'anyOf', 'allOf']) if (Array.isArray(node[k])) node[k].forEach((n) => collectStrings(n, R, file, out, depth + 1))
  if (node.properties) for (const v of Object.values(node.properties)) collectStrings(v, R, file, out, depth + 1)
}

function linksFrom(strings, ownTokens) {
  const found = new Map()
  for (const { from, text } of strings) {
    for (const m of text.matchAll(/OE-([A-Z][A-Z0-9]*)(?:-|\b)/g)) {
      const tok = m[1]
      if (!found.has(tok) || from === 'pattern') found.set(tok, { token: tok, evidence: from, legacy: false })
    }
    for (const m of text.matchAll(/sb:([A-Z][A-Za-z]+)/g)) { const tok = 'SB:' + m[1]; if (!found.has(tok)) found.set(tok, { token: tok, evidence: from, legacy: false }) }
    if (from === 'pattern' || from === 'description') {
      for (const m of text.matchAll(/(?:^|[\^|(\s"'])(lit|question|method|theory|project|resource|person|group):/g)) {
        const tok = LEGACY_PREFIX[m[1]]
        if (!found.has(tok)) found.set(tok, { token: tok, evidence: from, legacy: true })
      }
    }
  }
  return [...found.values()].filter((f) => f.token !== 'ACTOR' || true)
}

function enumValues(node, R, file, depth = 0) {
  node = R.deref(node, file)
  if (!node || depth > 4) return null
  if (node.enum) return node.enum
  if (node.items) return enumValues(node.items, R, file, depth + 1)
  for (const k of ['oneOf', 'anyOf', 'allOf']) if (Array.isArray(node[k])) for (const o of node[k]) { const e = enumValues(o, R, file, depth + 1); if (e) return e }
  return null
}

function describe(node, R, file) {
  const n = R.deref(node, file)
  let d = n?.description || n?.title || ''
  if (!d && n?.items) { const i = R.deref(n.items, file); d = i?.description || '' }
  return String(d).replace(/\s+/g, ' ').trim()
}

function fieldOf(name, prop, required, R, file, depth = 0) {
  const node = R.deref(prop, file)
  const strings = []
  collectStrings(prop, R, file, strings)
  const evidence = linksFrom(strings)
  const ev = enumValues(prop, R, file)
  const f = {
    name,
    type: typeLabel(prop, R, file),
    required: !!required,
    description: describe(prop, R, file),
    enum: ev && ev.length <= 60 ? ev.map(String) : undefined,
    enumTruncated: ev && ev.length > 60 ? ev.length : undefined,
    pattern: typeof node?.pattern === 'string' ? node.pattern : (node?.items && R.deref(node.items, file)?.pattern) || undefined,
    list: node?.type === 'array' || undefined,
    sharedDef: node?.$refName || undefined,
    links: evidence.length ? evidence : undefined,
    deprecated: /\b(deprecated|legacy|superseded)\b/i.test(describe(prop, R, file)) || undefined,
    default: node?.default,
  }
  // one level of nested fields (groups of fields, lists of groups)
  if (depth < 2) {
    let inner = node
    if (node?.type === 'array' && node.items) inner = R.deref(node.items, file)
    if (inner?.properties) {
      const req = new Set(inner.required || [])
      f.children = Object.entries(inner.properties).map(([k, v]) => fieldOf(k, v, req.has(k), R, file, depth + 1))
    }
  }
  for (const k of Object.keys(f)) if (f[k] === undefined) delete f[k]
  return f
}

function idInfo(properties, R, file) {
  const id = properties?.id ? R.deref(properties.id, file) : null
  const pattern = id?.pattern
  let token = null
  if (pattern) { const m = pattern.match(/OE-([A-Z][A-Z0-9]*)-/); if (m) token = m[1]; else { const m2 = pattern.match(/\^?\(?([a-z]+):/); if (m2) token = m2[1] } }
  return { pattern, token, description: id?.description ? String(id.description).replace(/\s+/g, ' ').trim() : undefined }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// One schema file -> one record type (or a "definitions only" file)
// ---------------------------------------------------------------------------------------------------------------------------------
export function parseSchemaFile(file, repoRoot) {
  const doc = readDataFile(file)
  if (!doc || typeof doc !== 'object') return null
  const R = makeResolver(file, doc)
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/')
  const base = path.basename(file).replace(/\.schema\.(json|ya?ml)$/, '').replace(/\.(json|ya?ml)$/, '')
  // Some YAML schemas wrap the object schema in allOf; merge the properties.
  let properties = doc.properties
  let required = doc.required || []
  if (!properties && Array.isArray(doc.allOf)) {
    properties = {}
    for (const part of doc.allOf) { const p = R.deref(part, file); Object.assign(properties, p.properties || {}); required = required.concat(p.required || []) }
  }
  const defs = doc.$defs || doc.definitions || {}
  const defsOut = Object.entries(defs).map(([name, d]) => ({ name, type: typeLabel(d, R, file), description: describe(d, R, file), enum: (enumValues(d, R, file) || undefined)?.slice?.(0, 40)?.map(String) }))
  if (!properties || Object.keys(properties).length === 0) {
    return { kind: 'defs', file: rel, name: base, defs: defsOut, title: doc.title }
  }
  const req = new Set(required)
  const fields = Object.entries(properties).filter(([k]) => k !== '$schema').map(([k, v]) => fieldOf(k, v, req.has(k), R, file))
  const idi = idInfo(properties, R, file)
  const title = doc.title && !/schema$/i.test(doc.title) ? doc.title : (doc.title || base)
  return {
    kind: 'type',
    file: rel,
    name: base,
    title: String(title).replace(/\s*schema\s*$/i, '').replace(/\s*record\s*$/i, '').trim() || base,
    description: String(doc.description || '').replace(/\s+/g, ' ').trim(),
    idToken: idi.token || undefined,
    idPattern: idi.pattern,
    idDescription: idi.description,
    required: [...req],
    closed: doc.additionalProperties === false || undefined,
    fields,
    defs: defsOut.length ? defsOut : undefined,
    schemaVersion: doc.version || doc.$id || undefined,
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Repository-level information
// ---------------------------------------------------------------------------------------------------------------------------------
function walkFiles(dir, exts, out = [], depth = 0) {
  if (!fs.existsSync(dir) || depth > 6) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, exts, out, depth + 1)
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p)
  }
  return out
}

function readmeIntro(repoRoot) {
  const p = ['README.md', 'readme.md'].map((f) => path.join(repoRoot, f)).find((f) => fs.existsSync(f))
  if (!p) return ''
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  const paras = []; let cur = []
  for (const l of lines) {
    if (/^\s*$/.test(l)) { if (cur.length) { paras.push(cur.join(' ')); cur = [] } continue }
    if (/^#|^\||^```|^\s*[-*]\s|^>\s*\*\*|^---/.test(l) && !cur.length) continue
    cur.push(l.trim().replace(/^>\s*/, ''))
  }
  if (cur.length) paras.push(cur.join(' '))
  const para = paras.find((x) => x.length > 60 && !/^(\[!|\!\[)/.test(x)) || paras[0] || ''
  return para.replace(/\*\*|\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`/g, '').slice(0, 520)
}

function retiredNote(repoRoot) {
  const p = path.join(repoRoot, 'README.md')
  if (!fs.existsSync(p)) return null
  const m = fs.readFileSync(p, 'utf8').match(/Retired\s+(\d{4}-\d{2}-\d{2})/i)
  return m ? m[1] : null
}

function gitInfo(repoRoot) {
  const git = (...a) => { try { return execFileSync('git', ['-C', repoRoot, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null } }
  const sha = git('rev-parse', 'HEAD')
  if (!sha) return null
  const lastSchemaChange = git('log', '-1', '--format=%H|%cI|%s', '--', 'schema', 'schemas')
  const [lsha, ldate, ...lsub] = (lastSchemaChange || '').split('|')
  return { sha: sha.slice(0, 10), date: git('log', '-1', '--format=%cI'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'), lastSchemaChange: lsha ? { sha: lsha.slice(0, 10), date: ldate, subject: lsub.join('|') } : null }
}

// Counts records per id token by scanning record folders for `id:` lines. Approximate on purpose: it needs to be cheap on 8,000 files.
function countRecords(repoRoot) {
  // Fast path: git grep over tracked record folders (one process instead of thousands of file reads).
  try {
    // id lines look like `id: OE-X-...`, `- id: "OE-X-..."` or `id: taxon:...`; the quote characters are matched with [^[:alnum:]] so no quoting is needed here.
    const GREP_RE = '^[[:space:]]*(-[[:space:]]+)?[^[:alnum:]]?id[^[:alnum:]]?[[:space:]]*:[[:space:]]*[^[:alnum:]]?(OE-[A-Z][A-Z0-9]*-|(taxon|taxconcept|name|cultcat|lang|feature|featexpr|context|explanation):)'
    const out = execFileSync('git', ['-C', repoRoot, 'grep', '-h', '-o', '-I', '-E', GREP_RE, '--', 'records', 'registry', 'taxa', 'features', 'explanations', 'languages', 'cultural-categories', 'contexts', 'data', 'nodes', 'alignments'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
    const counts = {}
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/(?:OE-([A-Z][A-Z0-9]*)-|(taxon|taxconcept|name|cultcat|lang|feature|featexpr|context|explanation):)$/)
      if (m) { const tok = m[1] || m[2]; counts[tok] = (counts[tok] || 0) + 1 }
    }
    return { counts, files: -1 }
  } catch { /* not a git checkout, or git grep found nothing: fall through to the slow path */ }
  const counts = {}
  const roots = ['records', 'registry', 'taxa', 'features', 'explanations', 'languages', 'cultural-categories', 'contexts', 'data', 'nodes', 'alignments', 'vocabularies'].map((d) => path.join(repoRoot, d))
  let files = 0
  for (const r of roots) {
    for (const f of walkFiles(r, ['.yaml', '.yml', '.json'])) {
      files++
      let text; try { text = fs.readFileSync(f, 'utf8') } catch { continue }
      if (text.length > 6_000_000) continue
      for (const m of text.matchAll(/^\s*(?:-\s+)?["']?id["']?\s*:\s*["']?(OE-([A-Z][A-Z0-9]*)-[^\s"',]+|(taxon|taxconcept|name|cultcat|lang|feature|featexpr|context|explanation):[^\s"',]+)/gm)) {
        const tok = m[2] || m[3]
        counts[tok] = (counts[tok] || 0) + 1
      }
    }
  }
  return { counts, files }
}

function resolveDir(root, dir) {
  if (fs.existsSync(path.join(root, dir))) return path.join(root, dir)
  const hit = fs.existsSync(root) ? fs.readdirSync(root).find((d) => d.toLowerCase() === dir.toLowerCase()) : null
  return hit ? path.join(root, hit) : null
}

function parseCoreOntology(coreRoot) {
  const p = path.join(coreRoot, 'ontologies', 'core_v1.yaml')
  if (!fs.existsSync(p)) return null
  const doc = yaml.load(fs.readFileSync(p, 'utf8'))
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
  const classes = Object.entries(doc.classes || {}).map(([iri, c]) => ({ iri, label: c.label || iri.replace('oe:', ''), status: c.status, subClassOf: c.subClassOf, definition: clean(c.definition) }))
  const properties = Object.entries(doc.properties || {}).map(([iri, c]) => ({ iri, label: c.label || iri.replace('oe:', ''), domain: c.domain, range: c.range, status: c.status, definition: clean(c.definition) }))
  return { version: doc.version, status: doc.status, classes, properties }
}

function vocabularies(repoRoot) {
  const dir = path.join(repoRoot, 'vocabularies')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => /\.ya?ml$|\.json$/.test(f)).map((f) => {
    const m = f.match(/^(.*?)(?:-v?(\d+\.\d+\.\d+))?\.(ya?ml|json)$/)
    return { file: `vocabularies/${f}`, name: m ? m[1] : f, version: m?.[2] }
  })
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Build the whole snapshot
// ---------------------------------------------------------------------------------------------------------------------------------
export function buildSnapshot(labRoot, { now = new Date() } = {}) {
  const repos = []
  const warnings = []
  for (const def of REPO_DEFS) {
    const root = resolveDir(labRoot, def.dir)
    if (!root) { warnings.push(`${def.name}: folder "${def.dir}" not found under ${labRoot}`); continue }
    const types = []; const defsFiles = []
    for (const sd of def.schemaDirs) {
      for (const f of walkFiles(path.join(root, sd), ['.schema.json', '.schema.yaml', '.schema.yml', 'common.defs.yaml'])) {
        try {
          const parsed = parseSchemaFile(f, root)
          if (!parsed) continue
          if (parsed.kind === 'type') types.push(parsed); else defsFiles.push(parsed)
        } catch (e) { warnings.push(`${def.name}: could not read ${path.relative(root, f)}: ${e.message}`) }
      }
    }
    types.sort((a, b) => a.name.localeCompare(b.name))
    const { counts, files } = countRecords(root)
    for (const t of types) {
      const toks = TYPE_TOKENS[t.name] || (t.idToken ? [t.idToken] : [])
      const n = toks.reduce((a, k) => a + (counts[k] || 0), 0)
      t.recordCount = toks.length && n > 0 ? n : undefined
      if (!t.idToken && toks.length) t.idToken = toks[0]
      t.id = `${def.key}/${t.name}`
    }
    repos.push({
      key: def.key, name: def.name, group: def.group, tier: def.tier, github: def.github, visibility: def.visibility || 'private',
      intro: readmeIntro(root), retiredOn: retiredNote(root), git: gitInfo(root), recordFiles: files, idCounts: counts,
      governance: fs.existsSync(path.join(root, 'GOVERNANCE.md')), contributing: fs.existsSync(path.join(root, 'CONTRIBUTING.md')),
      vocabularies: vocabularies(root), types, sharedDefs: defsFiles.flatMap((d) => d.defs.map((x) => ({ ...x, file: d.file }))),
    })
  }
  const coreRoot = resolveDir(labRoot, CORE_DEF.dir)
  const core = coreRoot ? { ...CORE_DEF, git: gitInfo(coreRoot), ontology: parseCoreOntology(coreRoot) } : null
  if (!core) warnings.push('openevo-core folder not found')
  const body = { version: SNAPSHOT_VERSION, repos, core, tokenOwner: TOKEN_OWNER, retired: RETIRED_TOKENS }
  const hash = sha1(JSON.stringify(body))
  return { ...body, generatedAt: now.toISOString(), contentHash: hash, warnings }
}
