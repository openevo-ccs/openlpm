import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, UserPlus } from 'lucide-react'
import { addShare, getPortfolioGraph, listShares, removeShare, type PortfolioEdge, type PortfolioNode, type ShareGrant } from '@/lib/supabase/portfolios'
import { PortfolioExplorer } from '@/components/portfolio-explorer'
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'

type Portfolio = Database['public']['Tables']['portfolios']['Row']

export default function PortfolioDetailPage() {
  const { project, slug, supabase } = useOutletContext<ProjectOutletContext>()
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const [portfolio, setPortfolio] = useState<Portfolio | null | undefined>(undefined)
  const [graph, setGraph] = useState<{ nodes: PortfolioNode[]; edges: PortfolioEdge[] } | null>(null)
  const [userId, setUserId] = useState<string | undefined>()

  useEffect(() => {
    if (!portfolioId) return
    setPortfolio(undefined)
    setGraph(null)
    supabase.from('portfolios').select('*').eq('id', portfolioId).maybeSingle().then(({ data }) => setPortfolio(data))
    getPortfolioGraph(supabase, portfolioId).then(setGraph)
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id))
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
        {portfolio.visibility === 'shared' && portfolio.owner_id === userId && (
          <ShareManager portfolioId={portfolioId} supabase={supabase} />
        )}
      </div>
      <PortfolioExplorer portfolioId={portfolioId} projectId={project.id} initialNodes={graph.nodes} initialEdges={graph.edges} />
    </div>
  )
}

// The "Shared (explicit grants)" visibility option had no way to actually
// grant anyone access before this -- portfolio_shares existed in the schema
// with correct RLS since migration 004 but zero UI anywhere ever wrote to
// it, so choosing that option silently behaved exactly like "private."
function ShareManager({ portfolioId, supabase }: { portfolioId: string; supabase: ProjectOutletContext['supabase'] }) {
  const [shares, setShares] = useState<ShareGrant[] | null>(null)
  const [email, setEmail] = useState('')
  const [canReview, setCanReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = () => listShares(supabase, portfolioId).then(setShares)

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, portfolioId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    const { error: err } = await addShare(supabase, portfolioId, email.trim(), canReview)
    setBusy(false)
    if (err) setError(err.message)
    else { setEmail(''); reload() }
  }

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <h3 className="row"><UserPlus size={14} />Shared with</h3>
      {shares === null ? (
        <p className="muted">Loading…</p>
      ) : shares.length === 0 ? (
        <p className="muted">Nobody yet.</p>
      ) : (
        shares.map((s) => (
          <div key={s.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
            <span>{s.user.name} <span className="muted">{s.user.email}</span></span>
            <span className="row">
              {s.can_review && <span className="chip">can review</span>}
              <button className="btn btn-mini" onClick={() => removeShare(supabase, s.id).then(reload)}><Trash2 size={11} /></button>
            </span>
          </div>
        ))
      )}
      <form onSubmit={submit} className="row" style={{ marginTop: 8 }}>
        <input type="email" placeholder="their@email.org" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1 }} />
        <label className="row" style={{ fontSize: 12 }}>
          <input type="checkbox" checked={canReview} onChange={(e) => setCanReview(e.target.checked)} />
          Can review
        </label>
        <button className="btn btn-mini" type="submit" disabled={busy}>Add</button>
      </form>
      {error && <div className="notice notice-bad">{error}</div>}
    </div>
  )
}
