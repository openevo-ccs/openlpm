// One-way Zotero import (decision 2 of lab_manager/docs/design-notes/
// openlpm-literature-collections-and-analytics-strategy-2026-10-23.md):
// OpenLPM reads a person's own Zotero library and never writes back to it.
// Uses Zotero's public Web API v3 directly from the browser -- no server
// needed, same shape as openalex.ts/semantic-scholar.ts/crossref.ts. The
// API key is used for exactly one fetch and never sent anywhere else or
// stored in this app's database -- entered fresh each time someone wants
// to pull their library in, same spirit as this page's existing
// "search, don't store a standing credential" engines.

export interface ZoteroCreator {
  creatorType: string
  firstName?: string
  lastName?: string
  name?: string
}

interface ZoteroItemData {
  itemType: string
  title?: string
  creators?: ZoteroCreator[]
  date?: string
  publicationTitle?: string
  bookTitle?: string
  proceedingsTitle?: string
  DOI?: string
  url?: string
}

interface ZoteroItem {
  key: string
  data: ZoteroItemData
}

export interface ZoteroResult {
  key: string
  doi: string | null
  title: string
  authors: string[]
  year: number | null
  venue: string | null
  type: string
  url: string | null
}

const SKIP_ITEM_TYPES = new Set(['attachment', 'note', 'annotation'])

const ITEM_TYPE_MAP: Record<string, string> = {
  journalArticle: 'article',
  magazineArticle: 'article',
  newspaperArticle: 'article',
  conferencePaper: 'article',
  preprint: 'article',
  book: 'book',
  bookSection: 'chapter',
  report: 'report',
  thesis: 'thesis',
}

function authorName(c: ZoteroCreator): string {
  if (c.name) return c.name
  return [c.lastName, c.firstName].filter(Boolean).join(', ')
}

function fromZoteroItem(item: ZoteroItem): ZoteroResult {
  const d = item.data
  const year = d.date ? parseInt(d.date.match(/\d{4}/)?.[0] ?? '', 10) : null
  return {
    key: item.key,
    doi: d.DOI ?? null,
    title: d.title ?? '(untitled)',
    authors: (d.creators ?? []).filter((c) => c.creatorType === 'author').map(authorName),
    year: Number.isNaN(year) ? null : year,
    venue: d.publicationTitle ?? d.bookTitle ?? d.proceedingsTitle ?? null,
    type: ITEM_TYPE_MAP[d.itemType] ?? 'article',
    url: d.url ?? null,
  }
}

/** Pages through a user's (or group's) Zotero library, top-level items only (no notes/attachments), up to a safety cap -- a researcher's library is realistically a few hundred to a couple thousand items, not worth building true infinite pagination for a one-off import. */
export async function fetchZoteroLibrary(
  libraryId: string,
  apiKey: string,
  libraryType: 'user' | 'group' = 'user',
  maxItems: number = 500
): Promise<{ results: ZoteroResult[]; error: string | null }> {
  const results: ZoteroResult[] = []
  const pageSize = 100
  let start = 0
  try {
    while (results.length < maxItems) {
      const url = `https://api.zotero.org/${libraryType}s/${encodeURIComponent(libraryId)}/items?v=3&key=${encodeURIComponent(apiKey)}&format=json&limit=${pageSize}&start=${start}`
      const response = await fetch(url)
      if (!response.ok) {
        if (response.status === 403) return { results: [], error: 'Zotero rejected this ID/API key combination (403) — double-check both, and that the key has library read access.' }
        if (response.status === 404) return { results: [], error: `No Zotero ${libraryType} library found for that ID (404).` }
        return { results: [], error: `Zotero returned an error (${response.status}).` }
      }
      const page: ZoteroItem[] = await response.json()
      for (const item of page) {
        if (!SKIP_ITEM_TYPES.has(item.data.itemType)) results.push(fromZoteroItem(item))
      }
      if (page.length < pageSize) break
      start += pageSize
    }
    return { results, error: null }
  } catch (e) {
    return { results: [], error: e instanceof Error ? e.message : 'Could not reach Zotero.' }
  }
}
