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

  // A draft/experiment can grow into something real and lasting enough to
  // deserve its own project -- e.g. a real regional or language effort, per
  // Dustin's own direction that these should be real sub-projects, not
  // branches (see migration 015). This creates that new project as a
  // sub-project of this one (auto-enrolling the acting user as owner, and
  // auto-creating its own trunk, per the handle_new_project trigger), marks
  // the source branch as 'promoted' pointing at it, and -- critically --
  // actually moves the branch's real content over. An earlier version of
  // this only created an empty new project and left the real content
  // stranded under the now-hidden old branch; found and fixed the same day
  // it was used for real (Thuringia's own move).
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
        description: `Grew out of "${branch.label}" in ${project.name}.`,
        epistemic_status: 'in-development',
        promoted_from_branch_id: branch.id,
        parent_project_id: project.id,
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !newProject) {
      setNotice({ kind: 'bad', text: error?.message ?? 'Could not create the new project.' })
      setBusy(false)
      return
    }

    const { data: newTrunk } = await supabase.from('branches').select('id').eq('project_id', newProject.id).eq('is_trunk', true).maybeSingle()
    if (!newTrunk) {
      setNotice({ kind: 'bad', text: 'New project was created, but it has no home for content yet -- nothing was moved. Contact support.' })
      setBusy(false)
      return
    }

    // Sequential, not parallel -- the object-tags move depends on
    // data_objects already having their new project_id (it matches by
    // the objects' own new home, so it has to run after, not racing it).
    const step1 = await Promise.all([
      supabase.from('lpm_schema_elements').update({ project_id: newProject.id, branch_id: newTrunk.id }).eq('project_id', project.id).eq('branch_id', branch.id),
      supabase.from('lpm_data_objects').update({ project_id: newProject.id, branch_id: newTrunk.id }).eq('project_id', project.id).eq('branch_id', branch.id),
      supabase.from('lpm_connections').update({ project_id: newProject.id, branch_id: newTrunk.id }).eq('project_id', project.id).eq('branch_id', branch.id),
      supabase.from('lpm_threads').update({ project_id: newProject.id, branch_id: newTrunk.id }).eq('project_id', project.id).eq('branch_id', branch.id),
      supabase.from('lpm_coherence_reviews').update({ project_id: newProject.id, branch_id: newTrunk.id }).eq('project_id', project.id).eq('branch_id', branch.id),
    ])
    const { data: movedObjects } = await supabase.from('lpm_data_objects').select('id').eq('project_id', newProject.id).eq('branch_id', newTrunk.id)
    const step2 = movedObjects?.length
      ? [await supabase.from('lpm_object_tags').update({ project_id: newProject.id }).eq('project_id', project.id).in('data_object_id', movedObjects.map((o) => o.id))]
      : []
    const moveError = [...step1, ...step2].find((r) => r.error)?.error

    await supabase.from('branches').update({ status: 'promoted', promoted_to_project_id: newProject.id }).eq('id', branch.id)

    if (moveError) {
      setNotice({ kind: 'bad', text: `Created "${newName}", but moving its content ran into a problem: ${moveError.message}` })
    } else {
      setNotice({ kind: 'ok', text: `"${branch.label}" is now its own project: "${newName}".` })
    }
    await reload()
    setBusy(false)
  }

  return (
    <div>
      <h1>Drafts and experiments</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        A quick way to try something new inside this project without touching the real content.
        If an idea grows into something real and lasting, turn it into its own project.
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
            <p className="muted"><b style={{ color: 'var(--text-primary)' }}>Why this exists: </b>{branch.fork_rationale}</p>
          )}
          {branch.status === 'promoted' && <p style={{ color: 'var(--good)' }}>This grew into its own project.</p>}

          <Link to={`/dashboard/${slug}/branches/${branch.slug}`} className="btn" style={{ marginTop: 4 }}>
            Open
            <ArrowRight size={14} />
          </Link>

          {canManage && !branch.is_trunk && branch.status === 'active' && (
            <form onSubmit={(e) => promoteBranch(branch, e)} className="row" style={{ paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Short address</label>
                <input name="new_project_slug" placeholder="e.g. evomentor-fr" style={{ width: 180 }} required />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Project name</label>
                <input name="new_project_name" placeholder="e.g. EvoMentor France" style={{ width: 220 }} required />
              </div>
              <button type="submit" className="btn" disabled={busy}>Turn into its own project</button>
            </form>
          )}
        </div>
      ))}

      {canManage && (
        <div className="card">
          <h3>Start something new</h3>
          <p className="muted">Shares this project&apos;s concepts to start; you can change that as it grows.</p>
          <form onSubmit={createBranch} className="grid grid-2">
            <div className="field">
              <label>Short address</label>
              <input name="slug" placeholder="e.g. spanish" required />
            </div>
            <div className="field">
              <label>Name</label>
              <input name="label" placeholder="e.g. Spanish translation" required />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <input name="description" placeholder="What is this for?" />
            </div>
            <div className="field">
              <label>Starting point</label>
              <select name="forked_from_branch_id">
                <option value="">(start from scratch)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Why this exists</label>
              <input name="fork_rationale" placeholder="What are you trying out?" />
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
