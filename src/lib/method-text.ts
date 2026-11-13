// Helpers for text that exists in more than one language, used wherever a MethodsBase record is shown.
//
// MethodsBase stores label, description, whenToUse and protocolSteps as one entry per language, for example
// {"en": "ABC Method", "de": "ABC-Methode"}. Screens ask for a preferred language and get back the text together with the
// language it is actually in, so a reader can see when a German project is showing English text and the other way round.
//
// The lesson-phase and learning-approach tags are stored in German (the wording of the source taxonomy). TAG_READINGS holds
// the English reading of each one. It mirrors methodsbase/vocabularies/method-tags.yaml, which is the source of truth.

const LANG_KEY = /^[a-z]{2}(-[A-Z]{2})?$/

export const LANGUAGE_NAMES: Record<string, string> = { en: 'English', de: 'German' }
export const LANGUAGE_NAMES_DE: Record<string, string> = { en: 'Englisch', de: 'Deutsch' }

export interface LangText {
  text: string
  /** Language code, or '' for a plain string that carries no language tag. */
  lang: string
}

/** The language a project works in: its first working language, English when none is set. */
export function projectUiLanguage(workingLanguages: string[] | null | undefined): string {
  return workingLanguages && workingLanguages.length > 0 ? workingLanguages[0] : 'en'
}

export function languageName(code: string, uiLang: string): string {
  const names = uiLang === 'de' ? LANGUAGE_NAMES_DE : LANGUAGE_NAMES
  return names[code] ?? code
}

function asLangObject(value: unknown): Record<string, unknown> | null {
  let v = value
  if (typeof v === 'string' && v.trimStart().startsWith('{')) {
    try {
      v = JSON.parse(v)
    } catch {
      return null
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const obj = v as Record<string, unknown>
  const keys = Object.keys(obj)
  return keys.length > 0 && keys.every((k) => LANG_KEY.test(k)) ? obj : null
}

function order(obj: Record<string, unknown>, preferred: string): string[] {
  const keys = Object.keys(obj)
  return [preferred, 'en', 'de', ...keys].filter((k, i, all) => k in obj && all.indexOf(k) === i)
}

/** The text in the preferred language, else English, else German, else whatever exists. */
export function pickLocalized(value: unknown, preferred: string): LangText | null {
  const obj = asLangObject(value)
  if (obj) {
    for (const k of order(obj, preferred)) {
      const v = obj[k]
      if (typeof v === 'string' && v.trim()) return { text: v.trim(), lang: k }
    }
    return null
  }
  return typeof value === 'string' && value.trim() ? { text: value.trim(), lang: '' } : null
}

/** Same as pickLocalized for a list of strings, such as protocolSteps. */
export function pickLocalizedList(value: unknown, preferred: string): { items: string[]; lang: string } | null {
  const obj = asLangObject(value)
  if (obj) {
    for (const k of order(obj, preferred)) {
      const v = obj[k]
      if (Array.isArray(v) && v.length > 0) return { items: v.map(String), lang: k }
    }
    return null
  }
  return Array.isArray(value) && value.length > 0 ? { items: value.map(String), lang: '' } : null
}

/** The other languages a field exists in besides `shown`. */
export function otherLanguages(value: unknown, shown: string): LangText[] {
  const obj = asLangObject(value)
  if (!obj) return []
  const out: LangText[] = []
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (k !== shown && typeof v === 'string' && v.trim()) out.push({ text: v.trim(), lang: k })
  }
  return out
}

/** Language codes a field has text in. */
export function languagesOf(value: unknown): string[] {
  const obj = asLangObject(value)
  if (!obj) return []
  return Object.keys(obj).filter((k) => {
    const v = obj[k]
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== ''
  })
}

/**
 * Whether the texts in a language were written by Claude and still wait for an expert. Reads the record's textStatus
 * ({de: {state: 'claude-draft-unreviewed'}}). A language without an entry counts as original text.
 */
export function textState(data: Record<string, unknown> | null | undefined, lang: string): 'original' | 'claude-draft-unreviewed' | 'reviewed' {
  const status = (data as any)?.textStatus?.[lang]?.state
  return status === 'claude-draft-unreviewed' || status === 'reviewed' ? status : 'original'
}

// Spellings that were stored by mistake and are corrected in MethodsBase. Records and saved edits made before the
// correction reached the database still carry them, so a tag is read through this list first (feedback 5824a32e,
// Susan Hanisch, 2026-11-12: "typo in the learning approach in the German version").
const MISSPELLED_TAGS: Record<string, string> = {
  'konzeptbasiert/vernetztend': 'konzeptbasiert/vernetzend',
}

/** The correct spelling of a stored tag. Any other tag comes back unchanged. */
export function normalizeTag(term: string): string {
  return MISSPELLED_TAGS[term] ?? term
}

export type TagField = 'lessonPhases' | 'learningApproaches'

export const TAG_READINGS: Record<TagField, Record<string, string>> = {
  lessonPhases: {
    Einstieg: 'Introduction',
    Erarbeitung: 'Working through new material',
    'Festigung/Anwendung': 'Practice and application',
    'Reflexion/Feedback': 'Reflection and feedback',
    'Ergebnisermittlung/Bewertung': 'Collecting and judging results',
  },
  learningApproaches: {
    erfahrungsbasiert: 'Experience-based',
    handlungsorientiert: 'Action-oriented',
    problembasiert: 'Problem-based',
    projektbasiert: 'Project-based',
    forschend: 'Inquiry-based',
    'konzeptbasiert/vernetzend': 'Concept-based and connecting',
    kooperativ: 'Cooperative',
    selbstreguliert: 'Self-regulated',
    kreativ: 'Creative',
    bewegt: 'Movement-based',
    digital: 'Digital',
    außerschulisch: 'Out-of-school',
  },
}

/**
 * A tag the way a reader should see it. A German reader gets the stored German term. An English reader gets the English
 * reading with the German term in brackets, for example "Introduction (Einstieg)". A tag without an English reading is
 * shown as stored.
 */
export function tagLabel(field: TagField, term: string, uiLang: string): string {
  term = normalizeTag(term)
  if (uiLang === 'de') return term
  const reading = TAG_READINGS[field][term]
  return reading ? `${reading} (${term})` : term
}

/**
 * A tag in one language only. English gives the English reading, German gives the stored German term. The Base Repo
 * Explorer uses this so its English view shows no German words (Dustin, 2026-11-11). A tag without an English reading is
 * shown as stored.
 */
export function tagReading(field: TagField, term: string, lang: string): string {
  term = normalizeTag(term)
  if (lang === 'de') return term
  return TAG_READINGS[field][term] ?? term
}

/** Removes a "(German name)" gloss that an English text carries inside it, e.g. "The ABC Method (ABC-Methode) uses...". */
export function withoutGermanGloss(text: string, germanName: string | undefined): string {
  if (!germanName) return text
  const escaped = germanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`\\s*\\(${escaped}\\)`, 'g'), '')
}
