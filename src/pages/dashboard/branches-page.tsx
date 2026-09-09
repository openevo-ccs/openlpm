import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, GitBranch as GitBranchIcon, X } from 'lucide-react'
import { Chip } from '@/components/chip'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'

type Branch = Database['public']['Tables']['branches']['Row']

export default function BranchesPage() {
  const { project, role, slug, supabase } = useOutletContext<ProjectOutletContext>()
  const [branches, setBranches] = useState<Branch[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  const reload = async () => {
    const { data } = await supabase.from('branches').select('*').eq('project_id', project.id).order('created_at', { ascending: true })
    setBranches(data ?? [])
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  const canManage = role === 'owner' || role === 'maintainer'

  const createBranch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setBusy(true); setNotice(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const slug = String(formData.get('slug') ?? '').trim()
    const label = String(formData.get('label') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim() || null
    const forkedFromBranchId = String(formData.get('forked_from_branch_id') ?? '') || null
    const forkRationale = String(formData.get('fork_rationale') ?? '').trim() || null

    if (!slug || !label) { setBusy(false); return }

    const { error } = await supabase.from('branches').insert({
      project_id: project.id,
      slug,
      label,
      description,
      forked_from_branch_id: forkedFromBranchId,
      fork_rationale: forkRationale,
      status: 'active',
      created_by: user?.id ?? null,
    })

    if (error) setNotice({ kind: 'bad', text: error.message })
    else { setNotice({ kind: 'ok', text: `Created "${label}".` }); e.currentTarget.reset(); await reload() }
    setBusy(false)
  }

  // Two-tier branching (RFC 0002 section 3): a content branch is promotable
  // to a fully independent project. This creates that new project
  // (auto-enrolling the acting user as its owner, per the handle_new_project
  // trigger) and marks the source branch as 'promoted', pointing at it.
  const promoteBranch = async (branch: Branch, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setBusy(true); setNotice(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || branch.is_trunk || branch.status !== 'active') { setBusy(false); return }

    const newSlug = String(formData.get('new_project_slug') ?? '').trim()
    const newName = String(formData.get('new_project_name') ?? '').trim()
    if (!newSlug || !newName) { setBusy(false); return }

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        slug: newSlug,
        name: newName,
        description: `Promoted from the "${branch.label}" branch.`,
        epistemic_status: 'in-development',
        promoted_from_branch_id: branch.id,
        created_by: user.id,
      })
      .select()
      .single()

    if (!error && newProject) {
      await supabase.from('branches').update({ status: 'promoted', promoted_to_project_id: newProject.id }).eq('id', branch.id)
      setNotice({ kind: 'ok', text: `Promoted to "${newName}".` })
      await reload()
    } else if (error) {
      setNotice({ kind: 'bad', text: error.message })
    }
    setBusy(false)
  }

  return (
    <div>
      <h1>Branches</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        A branch shares this project&apos;s schema and concept vocabulary, diverging only in
        content. If one outgrows that, promote it to a fully independent project.
      </p>

      {notice && (
        <div className={`notice notice-${notice.kind}`}>
          {notice.text}
          <button className="btn btn-mini" onClick={() => setNotice(null)} style={{ marginLeft: 'auto' }}><X size={10} /></button>
        </div>
      )}

      {branches.map((branch) => (
        <div key={branch.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className="row"><GitBranchIcon size={14} style={{ color: 'var(--text-muted)' }} />{branch.label}</h3>
              <p className="muted">{branch.description}</p>
            </div>
            <div className="row">
              {branch.is_trunk && <span className="chip">trunk</span>}
              <Chip status={branch.status} />
            </div>
          </div>

          {branch.fork_rationale && (
            <p className="muted"><b style={{ color: 'var(--text-primary)' }}>Fork rationale: </b>{branch.fork_rationale}</p>
          )}
          {branch.status === 'promoted' && <p style={{ color: 'var(--good)' }}>Promoted to a full independent project.</p>}

          <Link to={`/dashboard/${slug}/branches/${branch.slug}`} className="btn" style={{ marginTop: 4 }}>
            Enter branch
            <ArrowRight size={14} />
          </Link>

          {canManage && !branch.is_trunk && branch.status === 'active' && (
            <form onSubmit={(e) => promoteBranch(branch, e)} className="row" style={{ paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>New project slug</label>
                <input name="new_project_slug" placeholder="e.g. evomentor-fr" style={{ width: 180 }} required />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>New project name</label>
                <input name="new_project_name" placeholder="e.g. EvoMentor (French)" style={{ width: 220 }} required />
              </div>
              <button type="submit" className="btn" disabled={busy}>Promote to full project</button>
            </form>
          )}
        </div>
      ))}

      {canManage && (
        <div className="card">
          <h3>Fork a new branch</h3>
          <p className="muted">Shares this project&apos;s schema; diverges only in content.</p>
          <form onSubmit={createBranch} className="grid grid-2">
            <div className="field">
              <label>Slug</label>
              <input name="slug" placeholder="e.g. spanish" required />
            </div>
            <div className="field">
              <label>Label</label>
              <input name="label" placeholder="e.g. Spanish translation" required />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <input name="description" placeholder="What makes this branch different?" />
            </div>
            <div className="field">
              <label>Forked from</label>
              <select name="forked_from_branch_id">
                <option value="">(none — free-standing)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Fork rationale</label>
              <input name="fork_rationale" placeholder="Why does this need its own branch?" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>Create branch</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
