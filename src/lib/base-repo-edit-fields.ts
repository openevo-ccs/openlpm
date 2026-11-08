// Which fields of a Base Repo record can be edited in the Explorer card, and how each is edited (feedback 0afc62a5).
// A field is a dotted path into the record's own data ("learningApproaches", "description.en", "citation.title").
// The list is built from the record itself, so a new field in a repo shows up without new code. A few fields that matter
// are always offered, even when this record has none yet (a method with no learning approach still needs the tag box).

import type { BaseRepoKey } from '@/lib/supabase/base-repo-explorer'

export type EditKind = 'text' | 'longtext' | 'tags' | 'lines' | 'select'
export type EditValue = string | string[]

export interface EditField {
  path: string
  label: string
  kind: EditKind
  /** Choices for a select, or suggestions for tags. */
  options?: string[]
  /** Short note under the field. */
  hint?: string
}

// Never edited here: ids, structure that other records point at, links to other records, review and provenance data.
const NEVER_EDIT = new Set(['id', 'slug', '$schema', 'provenance', 'review_status', 'review', 'schema_version', 'version'])
const LINK_FIELDS = /^(related|decomposes|partOf|cycles|broader|narrower|primarySources|motivatedBy|literature_used|theoretical_framing|pedagogicalApproaches)/
const LANG_KEY = /^[a-z]{2}(-[A-Z]{2})?$/

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', de: 'German' }

export function humanize(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

export function getPath(data: unknown, path: string): unknown {
  let cur: any = data
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return cur
}

/** A copy of `data` with the value at `path` set, or removed when `value` is undefined. Nothing in `data` is changed. */
export function setPath<T extends Record<string, unknown>>(data: T, path: string, value: unknown): T {
  const parts = path.split('.')
  const root: any = { ...data }
  let cur = root
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]]
    cur[parts[i]] = next && typeof next === 'object' && !Array.isArray(next) ? { ...next } : {}
    cur = cur[parts[i]]
  }
  const last = parts[parts.length - 1]
  if (value === undefined) delete cur[last]
  else cur[last] = value
  return root
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

const isShortStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length <= 60)
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
const isLangObject = (v: unknown): v is Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const keys = Object.keys(v as object)
  return keys.length > 0 && keys.every((k) => LANG_KEY.test(k))
}

function textKind(value: string): EditKind {
  return value.length > 80 || value.includes('\n') ? 'longtext' : 'text'
}

export interface FieldVocabulary {
  /** Learning approach tags already used by any method, for suggestions. */
  learningApproaches: string[]
  /** Method classes already used. */
  methodClasses: string[]
}

export function fieldsFor(repoKey: BaseRepoKey, data: Record<string, unknown>, vocab: FieldVocabulary): EditField[] {
  const out: EditField[] = []
  const seen = new Set<string>()
  const add = (f: EditField) => { if (!seen.has(f.path)) { seen.add(f.path); out.push(f) } }

  const addValue = (path: string, label: string, value: unknown) => {
    if (typeof value === 'string') add({ path, label, kind: textKind(value) })
    else if (isLangObject(value)) {
      for (const lang of Object.keys(value)) addValue(`${path}.${lang}`, `${label} (${LANGUAGE_NAMES[lang] ?? lang.toUpperCase()})`, value[lang])
    } else if (isStringList(value)) {
      if (isShortStringList(value)) add({ path, label, kind: 'tags' })
      else add({ path, label, kind: 'lines', hint: 'One entry per line.' })
    }
  }

  if (repoKey === 'methodsbase') {
    // The fields people review most, in the order the card shows them. The tag fields and the class are always offered.
    addValue('label', 'Label', data.label)
    add({ path: 'methodClass', label: 'Method-class', kind: 'select', options: vocab.methodClasses })
    add({ path: 'learningApproaches', label: 'Learning approaches', kind: 'tags', options: vocab.learningApproaches, hint: 'Separate with commas. Suggestions are the tags other methods already use.' })
    addValue('discipline', 'Discipline', data.discipline)
    addValue('lessonPhases', 'Lesson phases', data.lessonPhases)
    addValue('whenToUse', 'When to use', data.whenToUse)
    addValue('description', 'Description', data.description)
    addValue('protocolSteps', 'Protocol steps', data.protocolSteps)
  } else if (repoKey === 'literaturebase') {
    add({ path: 'citation.title', label: 'Title', kind: 'text' })
    add({ path: 'citation.authors', label: 'Authors', kind: 'lines', hint: 'One author per line, as "Family, Given".' })
    const citationFields: [string, string][] = [
      ['year', 'Year'], ['venue', 'Journal or book'], ['publisher', 'Publisher'], ['volume', 'Volume'],
      ['issue', 'Issue'], ['pages', 'Pages'], ['doi', 'DOI'], ['open_access_url', 'Open-access link'],
    ]
    for (const [k, l] of citationFields) add({ path: `citation.${k}`, label: l, kind: 'text' })
    add({ path: 'domains', label: 'Keywords', kind: 'tags' })
    add({ path: 'plain_language_summary.text', label: 'Abstract', kind: 'longtext' })
  }

  // Everything else the record carries as text, a language-keyed text or a list of strings. Links to other records and
  // anything nested deeper stay read-only here.
  for (const [key, value] of Object.entries(data)) {
    if (NEVER_EDIT.has(key) || key.startsWith('__') || LINK_FIELDS.test(key)) continue
    addValue(key, humanize(key), value)
  }
  return out
}

/** The value a field currently shows in the form: text for the text kinds, a list for tags and lines. */
export function currentValue(field: EditField, data: Record<string, unknown>): EditValue {
  const v = getPath(data, field.path)
  if (field.kind === 'tags' || field.kind === 'lines') {
    if (Array.isArray(v)) return v.map(String)
    return typeof v === 'string' && v ? [v] : []
  }
  return v === undefined || v === null ? '' : String(v)
}

/** What the form's box holds, turned back into the stored value. Empty entries are dropped. */
export function parseInput(field: EditField, raw: string): EditValue {
  if (field.kind === 'tags') return raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (field.kind === 'lines') return raw.split('\n').map((s) => s.trim()).filter(Boolean)
  return raw.trim()
}

export function toInput(field: EditField, value: EditValue): string {
  if (Array.isArray(value)) return value.join(field.kind === 'tags' ? ', ' : '\n')
  return value
}
