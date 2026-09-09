import { useEffect, useState } from 'react'
import { Link, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, GitBranch, ShieldAlert } from 'lucide-react'
import { getBranchBySlug, type BranchRow } from '@/lib/supabase/branches'
import { Chip } from '@/components/chip'
import { ProjectNav } from '@/components/project-nav'
import type { ProjectOutletContext } from '../project-layout'

export interface BranchOutletContext extends ProjectOutletContext {
  branch: BranchRow
}

export default function BranchLayout() {
  const projectContext = useOutletContext<ProjectOutletContext>()
  const { project, role, slug, supabase } = projectContext
  const { branchSlug } = useParams<{ branchSlug: string }>()
  const [branch, setBranch] = useState<BranchRow | null | undefined>(undefined)
  const [parentLabel, setParentLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!branchSlug) return
    setBranch(undefined)
    getBranchBySlug(supabase, project.id, branchSlug).then(setBranch)
  }, [supabase, project.id, branchSlug])

  useEffect(() => {
    setParentLabel(null)
    if (!branch?.forked_from_branch_id) return
    supabase
      .from('branches')
      .select('label')
      .eq('id', branch.forked_from_branch_id)
      .maybeSingle()
      .then(({ data }) => setParentLabel(data?.label ?? null))
  }, [supabase, branch?.forked_from_branch_id])

  const backLink = (
    <Link to={`/dashboard/${slug}/branches`} className="row muted" style={{ marginBottom: 12 }}>
      <ArrowLeft size={14} />
      All branches
    </Link>
  )

  if (branch === undefined) {
    return <p className="muted">Loading…</p>
  }

  if (branch === null) {
    return (
      <div>
        {backLink}
        <div className="card empty">
          <ShieldAlert size={32} />
          <p>No branch named &ldquo;{branchSlug}&rdquo; in {project.name}.</p>
        </div>
      </div>
    )
  }

  const nav = [
    { href: `/dashboard/${slug}/branches/${branch.slug}`, content: <><FileText size={14} />Overview</> },
    { href: `/dashboard/${slug}/branches/${branch.slug}/schema`, content: <><GitBranch size={14} />Schema</> },
  ]

  const context: BranchOutletContext = { ...projectContext, branch }

  return (
    <div>
      {backLink}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <h1 className="row" style={{ marginBottom: 0 }}>
          <GitBranch size={18} style={{ color: 'var(--text-muted)' }} />
          {branch.label}
        </h1>
        <div className="row">
          {branch.is_trunk && <span className="chip">trunk</span>}
          <Chip status={branch.status} />
        </div>
      </div>
      <p className="muted" style={{ marginBottom: 4 }}>
        {project.name}
        {parentLabel && <> — forked from <b style={{ color: 'var(--text-primary)' }}>{parentLabel}</b></>}
      </p>
      {branch.description && <p style={{ marginBottom: 16 }}>{branch.description}</p>}

      <div className="tabs">
        <ProjectNav items={nav} />
      </div>

      <Outlet context={context} />
    </div>
  )
}
