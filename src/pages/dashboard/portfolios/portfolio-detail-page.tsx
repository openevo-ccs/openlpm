import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Sparkles, Trash2, UserPlus } from 'lucide-react'
import { addShare, getPortfolioGraph, listShares, removeShare, type PortfolioEdge, type PortfolioNode, type ShareGrant } from '@/lib/supabase/portfolios'
import { PortfolioExplorer } from '@/components/portfolio-explorer'
import { canShareInGroup, listGroupsWithMyMembership, type ProjectGroup } from '@/lib/supabase/groups'
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'

type Portfolio = Database['public']['Tables']['portfolios']['Row']

export default function PortfolioDetailPage() {
  const { project, role, slug, supabase } = useOutletContext<ProjectOutletContext>()
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
        <Link to={`/dashboard/${slug}/notebooks`} className="row muted" style={{ marginBottom: 12 }}>
          <ArrowLeft size={14} />
          All notebooks
        </Link>
        <div className="card empty">
          <p>Notebook not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div>
        <Link to={`/dashboard/${slug}/notebooks`} className="row muted">
          <ArrowLeft size={14} />
          All notebooks
        </Link>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <div>
            <h1>{portfolio.name}</h1>
            <p className="muted">{portfolio.description}</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Link to={`/dashboard/${slug}/notebooks/${portfolioId}/prompt`} className="btn btn-mini">
              <Sparkles size={12} />
              Generate teaching prompt
            </Link>
            <span className="chip capitalize">{portfolio.visibility}</span>
          </div>
        </div>
        {portfolio.owner_id === userId && (
          <VisibilityEditor
            portfolio={portfolio}
            project={project}
            role={role}
            supabase={supabase}
            onChanged={(next) => setPortfolio((p) => (p ? ({ ...p, ...next } as any) : p))}
          />
        )}
        {portfolio.visibility === 'shared' && portfolio.owner_id === userId && (
          <ShareManager portfolioId={portfolioId} supabase={supabase} />
        )}
      </div>
      <PortfolioExplorer portfolioId={portfolioId} projectId={project.id} initialNodes={graph.nodes} initialEdges={graph.edges} />
    </div>
  )
}

// Visibility (including the new 'group' tier, migration 076) was only ever
// settable at creation time (portfolios-page.tsx's "New notebook" form) --
// nothing let an owner change it on an EXISTING notebook, which would have
// left 'group' visibility with no real way to use it on anything already
// created. The group picker only lists groups the OWNER is themselves a
// member of -- sharing "my notebook" with a group I'm not part of isn't a
// real case here.
function VisibilityEditor({
  portfolio,
  project,
  role,
  supabase,
  onChanged,
}: {
  portfolio: Portfolio
  project: ProjectOutletContext['project']
  role: ProjectOutletContext['role']
  supabase: ProjectOutletContext['supabase']
  onChanged: (next: { visibility: string; group_id: string | null }) => void
}) {
  const current = portfolio as any as { visibility: string; group_id: string | null }
  const [visibility, setVisibility] = useState(current.visibility)
  const [groupId, setGroupId] = useState<string | null>(current.group_id ?? null)
  const [myGroups, setMyGroups] = useState<{ group: ProjectGroup; membership: { id: string } | null }[] | null>(null)
  const [busy, setBusy] = useState(false)
  // Real feedback 771f5fa2 (Dustin) / migration 117: hide the option
  // entirely for a role the project has restricted from group-sharing,
  // rather than letting them pick it and only then hit an RLS error.
  const canShare = canShareInGroup(role, project)

  useEffect(() => {
    listGroupsWithMyMembership(supabase, project.id).then(setMyGroups)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  const joinedGroups = (myGroups ?? []).filter((r) => r.membership).map((r) => r.group)

  const save = async (nextVisibility: string, nextGroupId: string | null) => {
    setBusy(true)
    const patch: Record<string, unknown> = { visibility: nextVisibility }
    patch.group_id = nextVisibility === 'group' ? nextGroupId : null
    const { error } = await (supabase as any).from('portfolios').update(patch).eq('id', portfolio.id)
    setBusy(false)
    if (!error) onChanged({ visibility: nextVisibility, group_id: patch.group_id as string | null })
  }

  const onVisibilityChange = (v: string) => {
    setVisibility(v)
    if (v === 'group') {
      const fallback = groupId ?? joinedGroups[0]?.id ?? null
      setGroupId(fallback)
      if (fallback) save(v, fallback)
    } else {
      save(v, null)
    }
  }

  return (
    <div className="row" style={{ gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Visibility</label>
        <select value={visibility} disabled={busy} onChange={(e) => onVisibilityChange(e.target.value)}>
          <option value="private">Private (just you)</option>
          <option value="shared">Shared (explicit grants)</option>
          <option value="project">Project (any member)</option>
          {(canShare || visibility === 'group') && <option value="group">Group</option>}
        </select>
      </div>
      {visibility === 'group' && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Which group</label>
          {joinedGroups.length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>You&apos;re not in a group yet in this project.</p>
          ) : (
            <select value={groupId ?? ''} disabled={busy} onChange={(e) => { setGroupId(e.target.value); save('group', e.target.value) }}>
              {joinedGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>
      )}
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
