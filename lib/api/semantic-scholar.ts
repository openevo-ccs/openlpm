export interface SemanticScholarPaper {
  paperId: string
  title: string
  year: number | null
  authors: Array<{
    name: string
  }>
  venue: string | null
  abstract: string | null
  citationCount: number
  externalIds?: {
    DOI?: string
  }
}

export interface SemanticScholarResponse {
  total: number
  data: SemanticScholarPaper[]
}

export interface SearchResult {
  doi: string | null
  title: string
  year: number | null
  authors: string[]
  venue: string | null
  abstract: string | null
  citedByCount: number
  semanticScholarId: string
}

export async function searchSemanticScholar(
  query: string,
  limit: number = 10
): Promise<{ count: number; results: SearchResult[] }> {
  try {
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
        query
      )}&limit=${limit}&fields=title,year,authors,venue,abstract,citationCount,externalIds`
    )
    
    if (!response.ok) {
      return { count: 0, results: [] }
    }
    
    const data: SemanticScholarResponse = await response.json()
    
    const results: SearchResult[] = data.data.map(paper => ({
      doi: paper.externalIds?.DOI || null,
      title: paper.title,
      year: paper.year,
      authors: paper.authors.map(a => a.name),
      venue: paper.venue,
      abstract: paper.abstract,
      citedByCount: paper.citationCount,
      semanticScholarId: paper.paperId,
    }))
    
    return {
      count: data.total,
      results,
    }
  } catch (error) {
    console.error('Error searching Semantic Scholar:', error)
    return { count: 0, results: [] }
  }
}