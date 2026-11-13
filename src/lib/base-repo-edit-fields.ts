// Which fields of a Base Repo record can be edited in the Explorer card, and how each is edited (feedback 0afc62a5).
// A field is a dotted path into the record's own data ("learningApproaches", "description.en", "citation.title").
// The list is built from the record itself, so a new field in a repo shows up without new code. A few fields that matter
// are always offered, even when this record has none yet (a method with no learning approach still needs the tag box).

import type { BaseRepoKey } from '@/lib/supabase/base-repo-explorer'
import { normalizeTag } from '@/lib/method-text'

export type EditKind = 'text' | 'longtext' | 'tags' | 'lines' | 'select' | 'sources'

/** One entry of a MethodsBase record's primarySources. Only `citation` is always there. */
export interface SourceEntry {
  citation?: string
  doi?: string
  url?: string
  literatureRef?: string
  [key: string]: unknown
}
export type EditValue = string | string[] | SourceEntry[]

export interface EditField {
  path: string
  label: string
  kind: EditKind
  /** Choices for a select, or suggestions for tags. */
  options?: string[]
  /** Short note under the field. */
  hint?: string
  /** For kind 'sources': the entries the record has now, so a line left alone keeps every key it had (for example a link to a LiteratureBase record). */
  original?: SourceEntry[]
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

  // A text kept in two languages always offers both boxes, also when one language has no text yet, so a German name or description can
  // be added to a record that only has the English one (feedback c950e8f8, Susan Hanisch, 2026-11-13: "add the German label").
  const addLanguageFields = (key: string, label: string, emptyKind: EditKind) => {
    const value = data[key]
    if (value !== undefined && value !== null && !isLangObject(value)) { addValue(key, label, value); return }
    const texts = isLangObject(value) ? value : {}
    for (const lang of Array.from(new Set(['en', 'de', ...Object.keys(texts)]))) {
      const path = `${key}.${lang}`
      const name = `${label} (${LANGUAGE_NAMES[lang] ?? lang.toUpperCase()})`
      const v = texts[lang]
      if (typeof v === 'string') add({ path, label: name, kind: textKind(v) })
      else if (isStringList(v)) add(isShortStringList(v) ? { path, label: name, kind: 'tags' } : { path, label: name, kind: 'lines', hint: 'One entry per line.' })
      else add({ path, label: name, kind: emptyKind, hint: emptyKind === 'lines' ? 'One entry per line.' : undefined })
    }
  }

  if (repoKey === 'methodsbase') {
    // The fields people review most, in the order the card shows them. The tag fields and the class are always offered.
    addLanguageFields('label', 'Label', 'text')
    add({ path: 'methodClass', label: 'Method-class', kind: 'select', options: vocab.methodClasses })
    add({ path: 'learningApproaches', label: 'Learning approaches', kind: 'tags', options: vocab.learningApproaches, hint: 'Separate with commas. Suggestions are the tags other methods already use.' })
    addValue('discipline', 'Discipline', data.discipline)
    addValue('lessonPhases', 'Lesson phases', data.lessonPhases)
    addLanguageFields('whenToUse', 'When to use', 'longtext')
    addLanguageFields('description', 'Description', 'longtext')
    addLanguageFields('protocolSteps', 'Protocol steps', 'lines')
    // Feedback 53ccb804 (Susan Hanisch, 2026-11-13): "need to be able to edit primary sources". One line per source.
    add({
      path: 'primarySources', label: 'Primary sources', kind: 'sources',
      hint: 'One source per line: the citation, then " | " and a DOI or web address if there is one. A source linked to a LiteratureBase record keeps that link when you change its text.',
      original: Array.isArray(data.primarySources) ? (data.primarySources as SourceEntry[]) : [],
    })
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
  if (field.kind === 'sources') return Array.isArray(v) ? (v as SourceEntry[]) : []
  if (field.kind === 'tags' || field.kind === 'lines') {
    // The tag lists of a method show the corrected spelling of an old misspelled tag.
    const clean = field.path === 'learningApproaches' ? normalizeTag : (t: string) => t
    if (Array.isArray(v)) return v.map(String).map(clean)
    return typeof v === 'string' && v ? [clean(v)] : []
  }
  return v === undefined || v === null ? '' : String(v)
}

/** What the form's box holds, turned back into the stored value. Empty entries are dropped. */
export function parseInput(field: EditField, raw: string): EditValue {
  if (field.kind === 'sources') return parseSources(raw, field.original ?? [])
  if (field.kind === 'tags') return raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (field.kind === 'lines') return raw.split('\n').map((s) => s.trim()).filter(Boolean)
  return raw.trim()
}

export function toInput(field: EditField, value: EditValue): string {
  if (field.kind === 'sources') return (Array.isArray(value) ? (value as SourceEntry[]) : []).map(sourceLine).join(NEWLINE)
  if (Array.isArray(value)) return value.join(field.kind === 'tags' ? ', ' : '\n')
  return value
}

// ---- Primary sources: one line per source, "citation | link" ----

const NEWLINE = String.fromCharCode(10)

const DOI_PATTERN = /^10\.\d{4,9}\//

/** The line a source shows as in the form. A DOI is written as its web address. */
export function sourceLine(s: SourceEntry): string {
  const text = String(s.citation ?? s.literatureRef ?? '').replace(/\s+/g, ' ').trim()
  const link = s.url ? String(s.url).trim() : s.doi ? `https://doi.org/${String(s.doi).trim()}` : ''
  return link ? `${text} | ${link}` : text
}

function splitSourceLine(line: string): { citation: string; link: string } {
  const at = line.lastIndexOf(' | ')
  if (at >= 0) {
    const link = line.slice(at + 3).trim()
    if (/^https?:\/\//i.test(link) || DOI_PATTERN.test(link) || /^doi:/i.test(link)) return { citation: line.slice(0, at).trim(), link }
  }
  return { citation: line.trim(), link: '' }
}

function applyLink(entry: SourceEntry, link: string): SourceEntry {
  const next: SourceEntry = { ...entry }
  delete next.doi
  delete next.url
  const doi = /^https?:\/\/(dx\.)?doi\.org\//i.test(link) ? link.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : /^doi:/i.test(link) ? link.replace(/^doi:\s*/i, '') : DOI_PATTERN.test(link) ? link : ''
  if (doi) next.doi = doi
  else if (link) next.url = link
  return next
}

/**
 * The form's lines turned back into sources. A line left alone returns the entry it came from, with every key. A line
 * that was changed keeps its LiteratureBase link when the number of lines is the same and the entry at that place had one.
 * A new line is a new entry.
 */
export function parseSources(raw: string, original: SourceEntry[]): SourceEntry[] {
  const lines = raw.split(NEWLINE).map((l) => l.trim()).filter(Boolean)
  const used = new Set<number>()
  const matched: (SourceEntry | null)[] = lines.map((line) => {
    const at = original.findIndex((o, i) => !used.has(i) && sourceLine(o) === line)
    if (at < 0) return null
    used.add(at)
    return original[at]
  })
  return lines.map((line, i) => {
    if (matched[i]) return matched[i] as SourceEntry
    const { citation, link } = splitSourceLine(line)
    const sameCount = lines.length === original.length
    const base: SourceEntry = sameCount && !used.has(i) && original[i] ? { ...original[i] } : {}
    return applyLink({ ...base, citation }, link)
  })
}
