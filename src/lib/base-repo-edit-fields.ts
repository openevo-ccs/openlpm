// Which fields of a Base Repo record can be edited in the Explorer card, and how each is edited (feedback 0afc62a5).
// A field is a dotted path into the record's own data ("learningApproaches", "description.en", "citation.title").
// The list is built from the record itself, so a new field in a repo shows up without new code. A few fields that matter
// are always offered, even when this record has none yet (a method with no learning approach still needs the tag box).
//
// Texts that exist once per language (a method's name and description, a competency's statement, a lesson's title) come as a pair of
// fields, one for English and one for German, whether the record has both yet or not (Dustin, 2026-11-13: "edit all of the metadata for
// any given entry in either language"). The form shows the pair for the language the page is set to. A text that is stored as one plain
// string or list so far counts as the English text, and the first German text turns it into a pair on save (see getPath and setPath).

import type { BaseRepoKey } from '@/lib/supabase/base-repo-explorer'
import { methodClassReading, normalizeTag, tagReading, tagTerms, type TagField } from '@/lib/method-text'

export type EditKind = 'text' | 'longtext' | 'tags' | 'lines' | 'select' | 'sources' | 'multi'

/** The two languages a text can be written in. */
export type EditLang = 'en' | 'de'
export const EDIT_LANGS: EditLang[] = ['en', 'de']
export const isEditLang = (s: string): s is EditLang => s === 'en' || s === 'de'
export const otherEditLang = (l: EditLang): EditLang => (l === 'de' ? 'en' : 'de')

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
  /** Choices for a multi-select: the stored value and the words shown for it. */
  choices?: { value: string; label: string }[]
  /** For a multi-select: always store a list, also when one choice is picked. Without it one choice is stored as a plain string. */
  asList?: boolean
  /** Short note under the field. */
  hint?: string
  /** For kind 'sources': the entries the record has now, so a line left alone keeps every key (for example a link to a LiteratureBase record). */
  original?: SourceEntry[]
  /** Set for a text kept once per language: the language of this box. The box for the other language has the same `pair`. */
  lang?: EditLang
  /** The path without its language, shared by the English and German box of one text. */
  pair?: string
  /** Where the form puts the field: 'text' (per language), 'tags' (a pick list whose words follow the language), 'shared' (the same in both languages, shown with the rest), or 'other' (the same in both languages, folded away). */
  group?: 'text' | 'tags' | 'shared' | 'other'
  /** For a pick list: the words shown for a stored value in a language. Without it the stored value is shown. */
  reading?: (value: string, lang: EditLang) => string
  /** For a pick list of tags whose names can be set in each language: which tag list it is. A new tag can be added to it. */
  tagField?: TagField
}

// Never edited here: ids, structure that other records point at, links to other records, review and provenance data.
const NEVER_EDIT = new Set(['id', 'slug', '$schema', 'provenance', 'review_status', 'review', 'schema_version', 'version', 'textStatus'])
const LINK_FIELDS = /^(related|decomposes|partOf|cycles|broader|narrower|primarySources|motivatedBy|literature_used|theoretical_framing|pedagogicalApproaches)/
const LANG_KEY = /^[a-z]{2}(-[A-Z]{2})?$/

export const LANGUAGE_NAMES: Record<string, string> = { en: 'English', de: 'German' }

export function humanize(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

/** A path as a person reads it, for the history of edits: "description.de" is "Description (German)". */
export function describePath(path: string): string {
  const parts = path.split('.')
  const last = parts[parts.length - 1]
  const words = (key: string) => { const h = humanize(key); return h.charAt(0) + h.slice(1).toLowerCase() }
  if (parts.length > 1 && isEditLang(last)) return `${parts.slice(0, -1).map(words).join(' · ')} (${LANGUAGE_NAMES[last]})`
  return parts.map(words).join(' · ')
}

export function getPath(data: unknown, path: string): unknown {
  const parts = path.split('.')
  let cur: any = data
  for (let i = 0; i < parts.length; i++) {
    // A text that is not kept per language yet counts as the English text.
    if (i === parts.length - 1 && i > 0 && isEditLang(parts[i]) && (typeof cur === 'string' || Array.isArray(cur))) return parts[i] === 'en' ? cur : undefined
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = cur[parts[i]]
  }
  return cur
}

/**
 * A copy of `data` with the value at `path` set, or removed when `value` is undefined. Nothing in `data` is changed.
 * Setting one language of a text that is still one plain string or list makes it a pair: the plain text becomes the English one.
 */
export function setPath<T extends Record<string, unknown>>(data: T, path: string, value: unknown): T {
  const parts = path.split('.')
  const root: any = { ...data }
  let cur = root
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]]
    const nextIsLanguage = i === parts.length - 2 && isEditLang(parts[parts.length - 1])
    const plain = (typeof next === 'string' && next !== '') || (Array.isArray(next) && next.length > 0)
    cur[parts[i]] = next && typeof next === 'object' && !Array.isArray(next) ? { ...next } : nextIsLanguage && plain ? { en: next } : {}
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
  /** Every method record, for choosing the more general method of one. */
  methods: { id: string; label: string }[]
}

// The texts that exist once per language in each repo. The three repos that already hold German text come first (Dustin, 2026-11-13).
// Order is the order of the form. A text that is not listed but is stored per language in a record is offered as a pair as well.
interface TranslatableText { key: string; label: string; empty: EditKind }
const TRANSLATABLE: Partial<Record<BaseRepoKey, TranslatableText[]>> = {
  methodsbase: [
    { key: 'label', label: 'Label', empty: 'text' },
    { key: 'discipline', label: 'Discipline', empty: 'text' },
    { key: 'whenToUse', label: 'When to use', empty: 'longtext' },
    { key: 'description', label: 'Description', empty: 'longtext' },
    { key: 'protocolSteps', label: 'Protocol steps', empty: 'lines' },
  ],
  competencybase: [
    { key: 'statement', label: 'Statement', empty: 'longtext' },
    { key: 'indicators', label: 'Indicators', empty: 'lines' },
  ],
  teachingbase: [
    { key: 'title', label: 'Title', empty: 'text' },
    { key: 'description', label: 'Description', empty: 'longtext' },
  ],
}
const BAND_ORDER = ['K-2', '3-5', '6-8', '9-12', '13-16']

/** Whether a repo's texts are kept per language, so its form has the English/German pairs. */
export function hasLanguagePairs(repoKey: BaseRepoKey): boolean {
  return TRANSLATABLE[repoKey] !== undefined
}

export function fieldsFor(repoKey: BaseRepoKey, data: Record<string, unknown>, vocab: FieldVocabulary): EditField[] {
  const out: EditField[] = []
  const seen = new Set<string>()
  const claimed = new Set<string>()
  const bilingual = hasLanguagePairs(repoKey)
  const add = (f: EditField) => { if (!seen.has(f.path)) { seen.add(f.path); out.push(bilingual && !f.group && !f.lang ? { ...f, group: 'other' } : f) } }

  const addValue = (path: string, label: string, value: unknown) => {
    if (typeof value === 'string') add({ path, label, kind: textKind(value) })
    else if (isLangObject(value)) {
      // Only a text or a list of texts per language gets a pair of boxes (the status of each language's text does not).
      if (EDIT_LANGS.some((l) => typeof value[l] === 'string' || isStringList(value[l]))) addLanguageFields(path, label, kindOfPair(value, 'text'))
    }
    else if (isStringList(value)) {
      if (isShortStringList(value)) add({ path, label, kind: 'tags' })
      else add({ path, label, kind: 'lines', hint: 'One entry per line.' })
    }
  }

  const kindOfPair = (value: Record<string, unknown>, fallback: EditKind): EditKind => {
    for (const lang of EDIT_LANGS) {
      const v = value[lang]
      if (typeof v === 'string' && v) return textKind(v)
      if (isStringList(v) && v.length > 0) return 'lines'
    }
    return fallback
  }

  // A text kept in two languages always offers both boxes, also when one language has no text yet, so a German name or description can
  // be added to a record that only has the English one (feedback c950e8f8, Susan Hanisch, 2026-11-13: "add the German label"). A text
  // that is still one plain string or list is the English one. `path` may be dotted ("developmentalProgression.6-8").
  const addLanguageFields = (path: string, label: string, emptyKind: EditKind) => {
    const value = getPath(data, path)
    const pair = isLangObject(value) ? (value as Record<string, unknown>) : {}
    const kind = isLangObject(value) ? kindOfPair(pair, emptyKind) : typeof value === 'string' && value ? textKind(value) : isStringList(value) && value.length > 0 ? 'lines' : emptyKind
    for (const lang of EDIT_LANGS) {
      add({
        path: `${path}.${lang}`, pair: path, lang, group: 'text', kind,
        label: `${label} (${LANGUAGE_NAMES[lang]})`,
        hint: kind === 'lines' ? 'One entry per line.' : undefined,
      })
    }
  }

  const addTexts = (list: TranslatableText[]) => {
    for (const t of list) {
      claimed.add(t.key)
      addLanguageFields(t.key, t.label, t.empty)
    }
  }

  // The words shown for a tag follow the language of the form. The tag itself is stored once.
  const termsOf = (path: string, field: 'learningApproaches' | 'lessonPhases', suggestions: string[]): EditField => {
    const stored = Array.isArray(getPath(data, path)) ? (getPath(data, path) as unknown[]).map(String).map(normalizeTag) : []
    const values = Array.from(new Set([...tagTerms(field), ...suggestions.map(normalizeTag), ...stored]))
    return {
      path, label: field === 'learningApproaches' ? 'Learning approaches' : 'Lesson phases', kind: 'multi', asList: true, group: 'tags', tagField: field,
      choices: values.map((v) => ({ value: v, label: tagReading(field, v, 'en') })),
      reading: (v, lang) => tagReading(field, v, lang),
    }
  }

  if (repoKey === 'methodsbase') {
    // The fields people review most, in the order the card shows them. The tag fields and the class are always offered.
    claimed.add('label'); addLanguageFields('label', 'Label', 'text')
    // Dustin, 2026-11-13: the method class is multi-select (a computer simulation is a teaching method and a research method).
    add({
      path: 'methodClass', label: 'Method-class', kind: 'multi', group: 'tags',
      choices: vocab.methodClasses.map((c) => ({ value: c, label: c })),
      reading: (v, lang) => methodClassReading(v, lang),
      hint: 'Pick both when the method is used both ways.',
    })
    add({
      path: 'broaderMethods', label: 'More general method', kind: 'multi', asList: true, group: 'tags',
      choices: vocab.methods.filter((m) => m.id !== String(data.id ?? '')).map((m) => ({ value: m.id, label: m.label })),
      hint: 'The method this one is a special case of, for example agent-based modeling under computer simulation. Usually one.',
    })
    add({ ...termsOf('learningApproaches', 'learningApproaches', vocab.learningApproaches), hint: 'The tag names follow the language of the form.' })
    add(termsOf('lessonPhases', 'lessonPhases', []))
    addTexts(TRANSLATABLE.methodsbase!.filter((t) => t.key !== 'label'))
    // Feedback 53ccb804 (Susan Hanisch, 2026-11-13): "need to be able to edit primary sources". One line per source.
    add({
      path: 'primarySources', label: 'Primary sources', kind: 'sources', group: 'shared',
      hint: 'One source per line: the citation, then " | " and a DOI or web address if there is one. A source linked to a LiteratureBase record keeps that link when you change its text.',
      original: Array.isArray(data.primarySources) ? (data.primarySources as SourceEntry[]) : [],
    })
    claimed.add('learningApproaches'); claimed.add('lessonPhases')
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
  } else if (repoKey === 'competencybase') {
    addTexts(TRANSLATABLE.competencybase!.filter((t) => t.key === 'statement'))
    const dp = (data as any).developmentalProgression
    if (dp && typeof dp === 'object' && !Array.isArray(dp)) {
      claimed.add('developmentalProgression')
      const bands = Object.keys(dp).sort((a, b) => (BAND_ORDER.indexOf(a) + 1 || 99) - (BAND_ORDER.indexOf(b) + 1 || 99))
      for (const band of bands) addLanguageFields(`developmentalProgression.${band}`, `Developmental progression, grades ${band}`, 'longtext')
    }
    addTexts(TRANSLATABLE.competencybase!.filter((t) => t.key !== 'statement'))
  } else if (repoKey === 'teachingbase') {
    addTexts(TRANSLATABLE.teachingbase!)
  }

  // Everything else the record carries as text, a language-keyed text or a list of strings. Links to other records and
  // anything nested deeper stay read-only here.
  for (const [key, value] of Object.entries(data)) {
    if (NEVER_EDIT.has(key) || key.startsWith('__') || LINK_FIELDS.test(key) || claimed.has(key)) continue
    addValue(key, humanize(key), value)
  }
  return out
}

/** The value a field currently shows in the form: text for the text kinds, a list for tags and lines. */
export function currentValue(field: EditField, data: Record<string, unknown>): EditValue {
  const v = getPath(data, field.path)
  if (field.kind === 'multi') {
    const list = Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : []
    return field.path === 'learningApproaches' ? list.map(normalizeTag) : list
  }
  if (field.kind === 'sources') return Array.isArray(v) ? (v as SourceEntry[]) : []
  if (field.kind === 'tags' || field.kind === 'lines') {
    if (Array.isArray(v)) return v.map(String)
    return typeof v === 'string' && v ? [v] : []
  }
  return v === undefined || v === null ? '' : String(v)
}

/** What the form's box holds, turned back into the stored value. Empty entries are dropped. */
export function parseInput(field: EditField, raw: string): EditValue {
  if (field.kind === 'multi') {
    const list = splitChoices(raw)
    return field.asList ? list : list.length <= 1 ? (list[0] ?? '') : list
  }
  if (field.kind === 'sources') return parseSources(raw, field.original ?? [])
  if (field.kind === 'tags') return raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (field.kind === 'lines') return raw.split('\n').map((s) => s.trim()).filter(Boolean)
  return raw.trim()
}

/** The ids or classes picked in a multi-select, from the comma-separated text the form keeps for it. */
export function splitChoices(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export function toInput(field: EditField, value: EditValue): string {
  if (field.kind === 'multi') return (Array.isArray(value) ? (value as unknown[]).map(String) : value ? [String(value)] : []).join(',')
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
