import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Network, X } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'

type Portfolio = Database['public']['Tables']['portfolios']['Row']

export default function PortfoliosPage() {
  const { project, slug, supabase } = useOutletContext<ProjectOutletContext>()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [userId, setUserId] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  const reload = async () => {
    // RLS already returns exactly the right union: portfolios this user owns
    // (any visibility) plus others' shared/project-visible portfolios -- see
    // migration 004's portfolio policies.
    const { data } = await supabase.from('portfolios').select('*').eq('project_id', project.id).order('created_at', { ascending: true })
    setPortfolios(data ?? [])
  }

  useEffect(() => {
    reload()
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  const createPortfolio = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setBusy(true); setNotice(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) { setBusy(false); return }

    const name = String(formData.get('name') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim() || null
    const visibilityRaw = String(formData.get('visibility') ?? 'private')
    if (!name) { setBusy(false); return }

    const { error } = await supabase.from('portfolios').insert({
      project_id: project.id,
      owner_id: user.id,
      name,
      description,
      visibility: visibilityRaw === 'shared' || visibilityRaw === 'project' ? visibilityRaw : 'private',
    })

    if (error) setNotice({ kind: 'bad', text: error.message })
    else { setNotice({ kind: 'ok', text: `Created "${name}".` }); e.currentTarget.reset(); await reload() }
    setBusy(false)
  }

  return (
    <div>
      <h1>Portfolios</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Unlimited personal spaces per project — curate canonical items alongside your own
        notes, questions, and drafts. Nothing here is shared unless you say so.
      </p>

      {notice && (
        <div className={`notice notice-${notice.kind}`}>
          {notice.text}
          <button className="btn btn-mini" onClick={() => setNotice(null)} style={{ marginLeft: 'auto' }}><X size={10} /></button>
        </div>
      )}

      {portfolios.length === 0 ? (
        <div className="card empty">
          <Network size={32} />
          <p>No portfolios yet.</p>
        </div>
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 20 }}>
          {portfolios.map((p) => (
            <Link key={p.id} to={`/dashboard/${slug}/portfolios/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card" style={{ height: '100%' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 className="row"><Network size={14} style={{ color: 'var(--text-muted)' }} />{p.name}</h3>
                  {p.owner_id !== userId && <span className="chip">shared with you</span>}
                </div>
                <p className="muted">{p.description}</p>
                <span className="chip capitalize">{p.visibility}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="card">
        <h3>New portfolio</h3>
        <p className="muted">Private by default — you can share it later.</p>
        <form onSubmit={createPortfolio} className="grid grid-2">
          <div className="field">
            <label>Name</label>
            <input name="name" placeholder="e.g. 9th grade unit planning" required />
          </div>
          <div className="field">
            <label>Visibility</label>
            <select name="visibility">
              <option value="private">Private (just you)</option>
              <option value="shared">Shared (explicit grants)</option>
              <option value="project">Project (any member)</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Description</label>
            <input name="description" placeholder="What's this portfolio for?" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>Create portfolio</button>
          </div>
        </form>
      </div>
    </div>
  )
}
