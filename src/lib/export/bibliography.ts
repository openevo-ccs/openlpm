// Exports a project's own saved literature in standard bibliographic
// formats, decision 2 of lab_manager/docs/design-notes/
// openlpm-literature-collections-and-analytics-strategy-2026-10-23.md:
// "Zotero: one-way import only, plus a range of bibliographic data format
// exports." BibTeX, RIS, and CSL-JSON between them cover Zotero, Mendeley,
// EndNote, and most Word/Google Docs citation plugins -- picked as a
// technical call, not something that needed a separate decision from
// Dustin. Pure string generation, no network/DB access, so this also
// works for a branch's papers (literaturebase_snapshot rows) and not just
// a project's own literature_references.

export interface ExportableReference {
  key: string
  title: string
  authors: string[]
  year: number | null
  venue: string | null
  doi: string | null
  type: string
}

const TYPE_TO_BIBTEX: Record<string, string> = {
  article: 'article',
  'journal-article': 'article',
  book: 'book',
  chapter: 'incollection',
  report: 'techreport',
  thesis: 'phdthesis',
}

const TYPE_TO_RIS: Record<string, string> = {
  article: 'JOUR',
  'journal-article': 'JOUR',
  book: 'BOOK',
  chapter: 'CHAP',
  report: 'RPRT',
  thesis: 'THES',
}

function bibtexKey(r: ExportableReference): string {
  const lastName = (r.authors[0] ?? 'unknown').split(',')[0].split(' ').pop()?.toLowerCase().replace(/[^a-z]/g, '') || 'unknown'
  return `${lastName}${r.year ?? 'nd'}${r.key.slice(0, 4)}`
}

function escapeBibtex(s: string): string {
  return s.replace(/[{}]/g, '')
}

export function toBibTeX(refs: ExportableReference[]): string {
  return refs
    .map((r) => {
      const kind = TYPE_TO_BIBTEX[r.type] ?? 'misc'
      const fields: string[] = [
        `  title = {${escapeBibtex(r.title)}}`,
        r.authors.length > 0 ? `  author = {${escapeBibtex(r.authors.join(' and '))}}` : null,
        r.year ? `  year = {${r.year}}` : null,
        r.venue ? `  journal = {${escapeBibtex(r.venue)}}` : null,
        r.doi ? `  doi = {${r.doi}}` : null,
      ].filter((f): f is string => f !== null)
      return `@${kind}{${bibtexKey(r)},\n${fields.join(',\n')}\n}`
    })
    .join('\n\n')
}

export function toRIS(refs: ExportableReference[]): string {
  return refs
    .map((r) => {
      const lines: string[] = [`TY  - ${TYPE_TO_RIS[r.type] ?? 'GEN'}`]
      for (const a of r.authors) lines.push(`AU  - ${a}`)
      lines.push(`TI  - ${r.title}`)
      if (r.year) lines.push(`PY  - ${r.year}`)
      if (r.venue) lines.push(`JO  - ${r.venue}`)
      if (r.doi) lines.push(`DO  - ${r.doi}`)
      lines.push('ER  - ')
      return lines.join('\n')
    })
    .join('\n\n')
}

export function toCSLJSON(refs: ExportableReference[]): string {
  const CSL_TYPE: Record<string, string> = { article: 'article-journal', 'journal-article': 'article-journal', book: 'book', chapter: 'chapter', report: 'report', thesis: 'thesis' }
  const items = refs.map((r) => ({
    id: bibtexKey(r),
    type: CSL_TYPE[r.type] ?? 'article-journal',
    title: r.title,
    author: r.authors.map((a) => {
      const parts = a.split(',').map((p) => p.trim())
      return parts.length > 1 ? { family: parts[0], given: parts[1] } : { literal: a }
    }),
    issued: r.year ? { 'date-parts': [[r.year]] } : undefined,
    'container-title': r.venue ?? undefined,
    DOI: r.doi ?? undefined,
  }))
  return JSON.stringify(items, null, 2)
}

export function downloadText(filename: string, mimeType: string, text: string): void {
  const blob = new Blob([text], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
