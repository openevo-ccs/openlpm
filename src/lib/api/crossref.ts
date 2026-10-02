export interface CrossRefWork {
  status: string
  message: {
    title: string[]
    author: Array<{
      given: string
      family: string
    }>
    published: {
      'date-parts': number[][]
    }
    'container-title'?: string[]
    'short-container-title'?: string[]
    type: string
    DOI: string
  }
}

export interface VerifiedDOI {
  verified: boolean
  title?: string
  authors?: string[]
  year?: number
  venue?: string
  type?: string
  doi?: string
}

export interface CrossRefSearchItem {
  DOI: string
  title?: string[]
  author?: Array<{ given?: string; family?: string }>
  published?: { 'date-parts': number[][] }
  'published-print'?: { 'date-parts': number[][] }
  'published-online'?: { 'date-parts': number[][] }
  'container-title'?: string[]
  type?: string
  'is-referenced-by-count'?: number
}

export interface CrossRefSearchResponse {
  status: string
  message: {
    'total-results': number
    items: CrossRefSearchItem[]
  }
}

export interface CrossRefSearchResult {
  doi: string | null
  title: string
  year: number | null
  authors: string[]
  venue: string | null
  citedByCount: number
  type: string
}

// Real feedback c327878b (Dustin Eirdosh, 2026-10-02): offer Crossref as a
// real keyword-search engine alongside OpenAlex/Semantic Scholar, not just
// the DOI-verification lookup verifyDOI below already did. Crossref's own
// /works?query= endpoint, same shape of normalized result as the other two
// engines' own search functions.
export async function searchCrossRef(query: string, limit: number = 10): Promise<{ count: number; results: CrossRefSearchResult[] }> {
  try {
    const response = await fetch(
      `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}`,
      { headers: { 'User-Agent': 'OpenLPM/1.0 (+https://github.com/openevo-ccs/openlpm)' } }
    )

    if (!response.ok) {
      return { count: 0, results: [] }
    }

    const data: CrossRefSearchResponse = await response.json()

    const results: CrossRefSearchResult[] = data.message.items.map((item) => {
      const dateParts = item.published?.['date-parts'] ?? item['published-print']?.['date-parts'] ?? item['published-online']?.['date-parts']
      return {
        doi: item.DOI ?? null,
        title: item.title?.[0] ?? '(untitled)',
        year: dateParts?.[0]?.[0] ?? null,
        authors: (item.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean),
        venue: item['container-title']?.[0] ?? null,
        citedByCount: item['is-referenced-by-count'] ?? 0,
        type: item.type ?? 'article',
      }
    })

    return { count: data.message['total-results'] ?? results.length, results }
  } catch (error) {
    console.error('Error searching Crossref:', error)
    return { count: 0, results: [] }
  }
}

export async function verifyDOI(doi: string): Promise<VerifiedDOI> {
  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      {
        headers: {
          'User-Agent': 'OpenLPM/1.0 (+https://github.com/openevo-ccs/openlpm)',
        },
      }
    )
    
    if (!response.ok) {
      return { verified: false }
    }
    
    const data: CrossRefWork = await response.json()
    
    if (data.status === 'ok') {
      const message = data.message
      return {
        verified: true,
        title: message.title[0],
        authors: message.author.map(a => `${a.given} ${a.family}`),
        year: message.published['date-parts'][0][0],
        venue: message['container-title']?.[0] || message['short-container-title']?.[0],
        type: message.type,
        doi: message.DOI,
      }
    }
    
    return { verified: false }
  } catch (error) {
    console.error('Error verifying DOI:', error)
    return { verified: false }
  }
}