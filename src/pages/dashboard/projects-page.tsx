import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, FolderKanban, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { EpistemicStatusBadge } from '@/components/epistemic-status-badge'
import { MaturityBadge } from '@/components/maturity-badge'
import { WorkingLanguagesTag } from '@/components/working-languages-tag'
import type { Database } from '@/lib/supabase/database.types'

type Project = Database['public']['Tables']['projects']['Row']

// Everything real that happens inside a Project Space is a Project -- a
// fully proven regional curriculum and an early-stage idea someone's trying
// out are the same kind of thing here, just at a different point on the
// Draft -> Established status shown on each card. There is deliberately no
// separate "branch" or "fork" step anymore: starting something new here
// creates a real Project right away, nested in this Space, with its own
// team and no vocabulary forced onto it from its parent.
export default function ProjectsPage() {
  const { project, role, slug, supabase } = useOutletContext<ProjectOutletContext>()
  const [children, setChildren] = useState<Project[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  const reload = async () => {
    const { data } = await supabase.from('projects').select('*').eq('parent_project_id', project.id).order('created_at', { ascending: true })
    setChildren(data ?? [])
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  const canManage = role === 'owner' || role === 'maintainer'

  const createProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setBusy(true); setNotice(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const newSlug = String(formData.get('slug') ?? '').trim()
    const name = String(formData.get('name') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim() || null
    const focusType = String(formData.get('focus_type') ?? 'general') as Project['focus_type']

    if (!newSlug || !name) { setBusy(false); return }

    const { error } = await supabase.from('projects').insert({
      slug: newSlug,
      name,
      description,
      focus_type: focusType,
      maturity: 'draft',
      epistemic_status: project.epistemic_status,
      parent_project_id: project.id,
      created_by: user?.id ?? null,
    })

    if (error) setNotice({ kind: 'bad', text: error.message })
    else { setNotice({ kind: 'ok', text: `Started "${name}" as a new project in ${project.name}.` }); e.currentTarget.reset(); await reload() }
    setBusy(false)
  }

  return (
    <div>
      <h1>Projects in {project.name}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Every real effort inside this Project Space — a fully proven curriculum or something still
        early and being tried out — lives here as its own Project, with its own team and content.
      </p>

      {notice && (
        <div className={`notice notice-${notice.kind}`}>
          {notice.text}
          <button className="btn btn-mini" onClick={() => setNotice(null)} style={{ marginLeft: 'auto' }}><X size={10} /></button>
        </div>
      )}

      {children.length === 0 ? (
        <div className="card empty">
          <FolderKanban size={32} />
          <p>No projects here yet.</p>
        </div>
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 20 }}>
          {children.map((child) => (
            <Link key={child.id} to={`/dashboard/${child.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card" style={{ height: '100%' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3>{child.name}</h3>
                  <MaturityBadge status={child.maturity} />
                </div>
                {child.description && <p className="muted">{child.description}</p>}
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <EpistemicStatusBadge status={child.epistemic_status} />
                  <WorkingLanguagesTag languages={child.working_languages} />
                </div>
                <span className="row muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Open <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {canManage && (
        <div className="card">
          <h3>Start a new project</h3>
          <p className="muted">
            Shares nothing automatically — a new project starts empty and marked as a draft. You
            can mark it established from its own Overview page once it&apos;s ready.
          </p>
          <form onSubmit={createProject} className="grid grid-2">
            <div className="field">
              <label>Short address</label>
              <input name="slug" placeholder="e.g. evomentor-france" required />
            </div>
            <div className="field">
              <label>Name</label>
              <input name="name" placeholder="e.g. EvoMentor France" required />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <input name="description" placeholder="What is this for?" />
            </div>
            <div className="field">
              <label>What kind of project is this?</label>
              <select name="focus_type" defaultValue="general">
                <option value="general">General</option>
                <option value="regional">A specific region or jurisdiction</option>
                <option value="thematic">A specific theme or topic</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>Start it</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
