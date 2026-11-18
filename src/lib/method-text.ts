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

/** Whether a value is a text kept per language, such as {"en": "...", "de": "..."}. */
export function isLangText(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && asLangObject(value) !== null
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

// The two method classes, read in German (Susan Hanisch, 2026-11-13, feedback b28a398a: "change the German version of the methods
// classes to Unterrichtsmethoden and Forschungsmethoden"). The stored values stay English.
const METHOD_CLASS_DE: Record<string, string> = {
  'pedagogical-practice': 'Unterrichtsmethoden',
  'research-method': 'Forschungsmethoden',
}

/** A method class as a reader of that language should see it. English readers get the stored value. */
export function methodClassReading(value: string, lang: string): string {
  return lang === 'de' ? METHOD_CLASS_DE[value] ?? value : value
}

/** The method classes of a record: a single string, a list of them (a method used both ways), or nothing. */
export function methodClassesOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  return typeof value === 'string' && value ? [value] : []
}

/** All method classes of a record in one language, joined for a table cell. */
export function methodClassesReading(value: unknown, lang: string): string {
  return methodClassesOf(value).map((c) => methodClassReading(c, lang)).join(', ')
}

export type TagField = 'lessonPhases' | 'learningApproaches' | 'disciplineTags'

export const TAG_READINGS: Record<TagField, Record<string, string>> = {
  lessonPhases: {
    Einstieg: 'Introduction',
    Erarbeitung: 'Knowledge acquisition',
    'Festigung/Anwendung': 'Practice and application',
    'Reflexion/Feedback': 'Reflection and feedback',
    'Ergebnisermittlung/Bewertung': 'Evaluation',
    'Transfer/Vernetzung': 'Transfer, connecting knowledge',
  },
  learningApproaches: {
    erfahrungsbasiert: 'Experience-based',
    handlungsorientiert: 'Action-oriented',
    problembasiert: 'Problem-based',
    projektbasiert: 'Project-based',
    forschend: 'Inquiry-based',
    'konzeptbasiert/vernetzend': 'Conceptual/networked',
    kooperativ: 'Cooperative/social',
    selbstreguliert: 'Self-regulated',
    kreativ: 'Creative',
    bewegt: 'Movement-based',
    digital: 'Digital',
    außerschulisch: 'Out-of-school',
    'kritisch/reflexiv': 'Critical/reflective',
  },
  // Disciplines (Susan Hanisch, feedback 3bef962e, 2026-11-18). Unlike the two lists above the stored term is the English name.
  disciplineTags: {
    'Educational research': 'Educational research',
    'Curriculum studies': 'Curriculum studies',
    'Science education': 'Science education',
    'Biology education': 'Biology education',
    'Evolutionary biology': 'Evolutionary biology',
    'Cultural evolution': 'Cultural evolution',
    'Behavioral economics': 'Behavioral economics',
    'Cognitive science and psychology': 'Cognitive science and psychology',
    'Systems science and modeling': 'Systems science and modeling',
    'Computational text analysis': 'Computational text analysis',
    'Linguistics': 'Linguistics',
    'Information science': 'Information science',
    'Science and technology studies': 'Science and technology studies',
    'Science': 'Science',
    'Mathematics': 'Mathematics',
    'Engineering': 'Engineering',
    'Art': 'Art',
    'Language': 'Language',
    'History': 'History',
    'Geography': 'Geography',
    'Social studies': 'Social studies',
    'Ethics': 'Ethics',
    'Health': 'Health',
    'Sports': 'Sports',
    'Social-emotional learning': 'Social-emotional learning',
    'Biology': 'Biology',
    'Evolution': 'Evolution',
  },
}

// Tags whose German name differs from the stored term (the `de` key of an entry in methodsbase/vocabularies/method-tags.yaml).
// The stored term stays as it is, so records, filters and links keep working.
export const TAG_GERMAN_NAMES: Record<TagField, Record<string, string>> = {
  lessonPhases: {},
  learningApproaches: { kooperativ: 'kooperativ/sozial' },
  disciplineTags: {
    'Educational research': 'Bildungsforschung',
    'Curriculum studies': 'Curriculumforschung',
    'Science education': 'Naturwissenschaftsdidaktik',
    'Biology education': 'Biologiedidaktik',
    'Evolutionary biology': 'Evolutionsbiologie',
    'Cultural evolution': 'Kulturelle Evolution',
    'Behavioral economics': 'Verhaltensökonomik',
    'Cognitive science and psychology': 'Kognitionswissenschaft und Psychologie',
    'Systems science and modeling': 'Systemwissenschaft und Modellierung',
    'Computational text analysis': 'Computergestützte Textanalyse',
    'Linguistics': 'Sprachwissenschaft',
    'Information science': 'Informationswissenschaft',
    'Science and technology studies': 'Wissenschafts- und Technikforschung',
    'Science': 'Naturwissenschaften',
    'Mathematics': 'Mathematik',
    'Engineering': 'Technik',
    'Art': 'Kunst',
    'Language': 'Sprache',
    'History': 'Geschichte',
    'Geography': 'Geografie',
    'Social studies': 'Gesellschaftslehre',
    'Ethics': 'Ethik',
    'Health': 'Gesundheit',
    'Sports': 'Sport',
    'Social-emotional learning': 'Sozial-emotionales Lernen',
    'Biology': 'Biologie',
    'Evolution': 'Evolution',
  },
}

// The general method a learning approach stands for (the `method` key of an entry in methodsbase/vocabularies/method-tags.yaml), for example the
// tag "bewegt" and the method "Movement-Based Learning". Susan Hanisch, 2026-11-15 (feedback 5844bcd2): "Do entries that have the learning
// approach tag 'bewegt' also need to be grouped under a higher-level method?" Dustin chose to work the link out from the tag, so it is entered once.
export const TAG_GENERAL_METHODS: Record<string, string> = {
  erfahrungsbasiert: 'OE-METHOD-experiential-action-oriented-learning',
  handlungsorientiert: 'OE-METHOD-experiential-action-oriented-learning',
  problembasiert: 'OE-METHOD-problem-based-learning',
  projektbasiert: 'OE-METHOD-project-based-learning',
  forschend: 'OE-METHOD-inquiry-based-learning',
  'konzeptbasiert/vernetzend': 'OE-METHOD-concept-based-teaching',
  kooperativ: 'OE-METHOD-cooperative-learning',
  selbstreguliert: 'OE-METHOD-self-regulated-learning',
  kreativ: 'OE-METHOD-creative-design-tasks',
  bewegt: 'OE-METHOD-movement-based-learning',
  digital: 'OE-METHOD-digital-media-integration',
  außerschulisch: 'OE-METHOD-out-of-school-learning',
}

/**
 * The more general methods a method has through its learning approach tags: one per tag that names a general method, left out when it is the
 * method itself or is already named in the record's own broaderMethods. Each comes with the tag it comes from.
 */
export function broaderMethodsFromTags(data: Record<string, unknown> | null | undefined, ownId: string): { id: string; term: string }[] {
  const tags = Array.isArray(data?.learningApproaches) ? (data!.learningApproaches as unknown[]).map((t) => normalizeTag(String(t))) : []
  const explicit = new Set(Array.isArray(data?.broaderMethods) ? (data!.broaderMethods as unknown[]).map(String) : [])
  const seen = new Set<string>()
  const out: { id: string; term: string }[] = []
  for (const term of tags) {
    const id = TAG_GENERAL_METHODS[term]
    if (!id || id === ownId || explicit.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push({ id, term })
  }
  return out
}

// Names given to tags inside OpenLPM (Dustin, 2026-11-13: tags can be named and edited in either language). A tag is stored once, under
// its term. The terms of the source taxonomy are German and keep their German name and the English reading above. A tag added in the
// app has the name it was typed with in one language, and the other name is missing until someone adds it. The overlay holds the
// names set in the app, per field and term. The Explorer fills it from the saved edits (see base-repo-edits.ts).
export type TagNames = { en?: string; de?: string }
export type TagNameOverlay = Record<TagField, Record<string, TagNames>>
const EMPTY_OVERLAY = (): TagNameOverlay => ({ lessonPhases: {}, learningApproaches: {}, disciplineTags: {} })
let tagOverlay: TagNameOverlay = EMPTY_OVERLAY()
let tagOverlayVersion = 0

/** Sets the names given in the app. Anything that shows a tag afterwards uses them. */
export function setTagNameOverlay(overlay: TagNameOverlay | null): void {
  tagOverlay = overlay ?? EMPTY_OVERLAY()
  tagOverlayVersion++
}

/** Changes whenever the names set in the app change, so a screen can rebuild what it worked out from them. */
export function tagNameVersion(): number {
  return tagOverlayVersion
}

/** Every tag of a field: the taxonomy's terms, then the ones added in the app. */
export function tagTerms(field: TagField): string[] {
  return Array.from(new Set([...Object.keys(TAG_READINGS[field]), ...Object.keys(tagOverlay[field])]))
}

/** The name of a tag in one language, or null when it has none in that language yet. */
export function tagNameIn(field: TagField, term: string, lang: string, extra?: Record<string, TagNames>): string | null {
  term = normalizeTag(term)
  const set = extra?.[term] ?? tagOverlay[field][term]
  const given = lang === 'de' ? set?.de : set?.en
  if (given) return given
  if (lang === 'de') return term in TAG_READINGS[field] ? TAG_GERMAN_NAMES[field][term] ?? term : null
  return TAG_READINGS[field][term] ?? null
}

/**
 * A tag the way a reader should see it. A German reader gets the German name. An English reader gets the English
 * name with the German term in brackets, for example "Introduction (Einstieg)". A tag without a name in the reader's
 * language is shown by the name it has.
 */
export function tagLabel(field: TagField, term: string, uiLang: string): string {
  term = normalizeTag(term)
  if (uiLang === 'de') return tagNameIn(field, term, 'de') ?? tagNameIn(field, term, 'en') ?? term
  const reading = tagNameIn(field, term, 'en')
  const german = tagNameIn(field, term, 'de')
  return reading ? (german && german !== reading ? `${reading} (${german})` : reading) : german ?? term
}

/**
 * A tag in one language only. The Base Repo Explorer uses this so its English view shows no German words (Dustin, 2026-11-11).
 * A tag without a name in that language is shown by the name it has in the other.
 */
export function tagReading(field: TagField, term: string, lang: string): string {
  term = normalizeTag(term)
  return tagNameIn(field, term, lang) ?? tagNameIn(field, term, lang === 'de' ? 'en' : 'de') ?? term
}

/** Removes a "(German name)" gloss that an English text carries inside it, e.g. "The ABC Method (ABC-Methode) uses...". */
export function withoutGermanGloss(text: string, germanName: string | undefined): string {
  if (!germanName) return text
  const escaped = germanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`\\s*\\(${escaped}\\)`, 'g'), '')
}
