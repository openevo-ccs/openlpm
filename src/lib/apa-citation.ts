// APA 7th edition reference for one LiteratureBase record (feedback b8454f68, Susan Hanisch 2026-11-08: "a full citation in the latest APA
// format, with a click-option to copy it"). Built only from the record's own citation fields. Nothing is looked up or guessed.
//
// Two limits to know about:
// - Titles are printed as stored. APA wants sentence case for article and chapter titles, and a program cannot tell a proper noun from a
//   common word, so the record's own capitalization is kept.
// - LiteratureBase holds no editor names, so a book chapter reads "In Book title (pp. 1-10)" without the editors APA asks for.

export interface ApaPart { text: string; italic?: boolean }

type Cit = Record<string, unknown>

const str = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '')

// "Gentner, Dedre" -> "Gentner, D."; "Chang, Ming-Wei" -> "Chang, M.-W."; a one-part name (a group author) stays as it is.
function formatAuthor(raw: string): string {
  const name = raw.trim()
  const comma = name.indexOf(',')
  if (comma < 0) return name
  const family = name.slice(0, comma).trim()
  const given = name.slice(comma + 1).trim()
  if (!given) return family
  const initials = given
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((piece) => {
          const letter = piece.replace(/[^\p{L}]/gu, '').charAt(0)
          return letter ? `${letter.toUpperCase()}.` : ''
        })
        .filter(Boolean)
        .join('-'),
    )
    .filter(Boolean)
    .join(' ')
  return initials ? `${family}, ${initials}` : family
}

function formatAuthors(list: string[]): string {
  const names = list.map(formatAuthor).filter(Boolean)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length <= 20) return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`
  return `${names.slice(0, 19).join(', ')}, . . . ${names[names.length - 1]}`
}

const endsWithPunctuation = (s: string) => /[.?!]$/.test(s)

export function doiUrl(doi: unknown): string | null {
  const d = str(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '')
  return d ? `https://doi.org/${d}` : null
}

export function recordLink(citation: Cit): string | null {
  return doiUrl(citation.doi) ?? (str(citation.open_access_url) || null)
}

export function formatApa(type: string | undefined, citation: Cit): ApaPart[] {
  const authors = Array.isArray(citation.authors) ? (citation.authors as unknown[]).map(str).filter(Boolean) : []
  const year = str(citation.year)
  const title = str(citation.title)
  const venue = str(citation.venue)
  const publisher = str(citation.publisher)
  const volume = str(citation.volume)
  const issue = str(citation.issue)
  const pages = str(citation.pages).replace(/\s*[-–—]+\s*/g, '–')
  const link = recordLink(citation)

  const parts: ApaPart[] = []
  const add = (text: string, italic = false) => { if (text) parts.push({ text, italic }) }
  const endSentence = () => {
    const last = parts[parts.length - 1]
    if (last && !endsWithPunctuation(last.text)) add('.')
  }

  const who = formatAuthors(authors)
  if (who) { add(who); if (!endsWithPunctuation(who)) add('.'); add(' ') }
  add(`(${year || 'n.d.'}). `)

  const isArticle = type === 'journal-article'
  const isChapter = type === 'book-chapter'
  const isConference = type === 'conference-paper'

  if (isArticle || (!type && venue)) {
    add(title); endSentence(); add(' ')
    if (venue) {
      add(venue, true)
      if (volume) { add(', '); add(volume, true) }
      if (issue) add(`(${issue})`)
      if (pages) add(`, ${pages}`)
      add('.')
    }
  } else if (isChapter) {
    add(title); endSentence(); add(' ')
    if (venue) {
      add('In '); add(venue, true)
      if (pages) add(` (pp. ${pages})`)
      add('. ')
    }
    if (publisher) { add(publisher); add('.') }
  } else if (isConference) {
    add(title); endSentence(); add(' ')
    if (venue) { add('In '); add(venue, true); if (pages) add(` (pp. ${pages})`); add('. ') }
    if (publisher) { add(publisher); add('.') }
  } else if (type === 'preprint') {
    add(title, true); endSentence(); add(' ')
    if (venue) { add(venue); add('.') }
  } else if (type === 'book' || type === 'report') {
    add(title, true); endSentence(); add(' ')
    if (publisher) { add(publisher); add('.') }
  } else if (type === 'website') {
    add(title, true); endSentence(); add(' ')
    // APA leaves the site name out when it is the same as the author.
    const site = publisher || venue
    if (site && site !== (authors[0] ?? '')) { add(site); add('.') }
  } else {
    // thesis, other, or no type: title, then where it came from.
    add(title); endSentence(); add(' ')
    if (venue) { add(venue); add('.') }
    else if (publisher) { add(publisher); add('.') }
  }

  if (link) { add(' '); add(link) }
  // Trim a trailing space left by a record with no venue or publisher.
  const last = parts[parts.length - 1]
  if (last && !last.italic) last.text = last.text.replace(/\s+$/, '')
  return parts
}

export const apaToPlainText = (parts: ApaPart[]): string => parts.map((p) => p.text).join('')

export const apaToHtml = (parts: ApaPart[]): string =>
  parts
    .map((p) => {
      const safe = p.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return p.italic ? `<i>${safe}</i>` : safe
    })
    .join('')
