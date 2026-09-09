import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getPortfolioGraph, type PortfolioEdge, type PortfolioNode } from '@/lib/supabase/portfolios'
import { PortfolioExplorer } from '@/components/portfolio-explorer'
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'

type Portfolio = Database['public']['Tables']['portfolios']['Row']

export default function PortfolioDetailPage() {
  const { slug, supabase } = useOutletContext<ProjectOutletContext>()
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const [portfolio, setPortfolio] = useState<Portfolio | null | undefined>(undefined)
  const [graph, setGraph] = useState<{ nodes: PortfolioNode[]; edges: PortfolioEdge[] } | null>(null)

  useEffect(() => {
    if (!portfolioId) return
    setPortfolio(undefined)
    setGraph(null)
    supabase.from('portfolios').select('*').eq('id', portfolioId).maybeSingle().then(({ data }) => setPortfolio(data))
    getPortfolioGraph(supabase, portfolioId).then(setGraph)
  }, [supabase, portfolioId])

  if (portfolio === undefined || graph === null) {
    return <p className="muted">Loading…</p>
  }

  if (!portfolio || !portfolioId) {
    return (
      <div>
        <Link to={`/dashboard/${slug}/portfolios`} className="row muted" style={{ marginBottom: 12 }}>
          <ArrowLeft size={14} />
          All portfolios
        </Link>
        <div className="card empty">
          <p>Portfolio not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div>
        <Link to={`/dashboard/${slug}/portfolios`} className="row muted">
          <ArrowLeft size={14} />
          All portfolios
        </Link>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <div>
            <h1>{portfolio.name}</h1>
            <p className="muted">{portfolio.description}</p>
          </div>
          <span className="chip capitalize">{portfolio.visibility}</span>
        </div>
      </div>
      <PortfolioExplorer portfolioId={portfolioId} initialNodes={graph.nodes} initialEdges={graph.edges} />
    </div>
  )
}
