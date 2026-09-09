export interface OpenAlexWork {
  id: string
  doi: string | null
  title: string
  publication_year: number
  authorships: Array<{
    author: {
      display_name: string
    }
  }>
  primary_location?: {
    source?: {
      display_name: string
    }
  }
  cited_by_count: number
  type: string
}

export interface OpenAlexResponse {
  results: OpenAlexWork[]
  meta: {
    count: number
  }
}

export interface SearchResult {
  doi: string | null
  title: string
  year: number
  authors: string[]
  venue: string | null
  citedByCount: number
  openAlexId: string
  type: string
}

export async function searchOpenAlex(
  query: string,
  limit: number = 10
): Promise<{ count: number; results: SearchResult[] }> {
  try {
    const response = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(
        query
      )}&per_page=${limit}`
    )
    
    if (!response.ok) {
      return { count: 0, results: [] }
    }
    
    const data: OpenAlexResponse = await response.json()
    
    const results: SearchResult[] = data.results.map(work => ({
      doi: work.doi,
      title: work.title,
      year: work.publication_year,
      authors: work.authorships.map(a => a.author.display_name),
      venue: work.primary_location?.source?.display_name || null,
      citedByCount: work.cited_by_count,
      openAlexId: work.id,
      type: work.type,
    }))
    
    return {
      count: data.meta.count,
      results,
    }
  } catch (error) {
    console.error('Error searching OpenAlex:', error)
    return { count: 0, results: [] }
  }
}