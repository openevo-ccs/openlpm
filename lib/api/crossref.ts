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