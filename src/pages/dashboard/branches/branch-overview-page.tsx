import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { GitBranch, Settings } from 'lucide-react'
import type { BranchOutletContext } from './branch-layout'

export default function BranchOverviewPage() {
  const { project, branch, slug, supabase } = useOutletContext<BranchOutletContext>()
  const [schemaCount, setSchemaCount] = useState<number | null>(null)

  useEffect(() => {
    setSchemaCount(null)
    supabase
      .from('lpm_schema_elements')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .eq('branch_id', branch.id)
      .then(({ count }) => setSchemaCount(count ?? 0))
  }, [supabase, project.id, branch.id])

  return (
    <div>
      {branch.fork_rationale && (
        <div className="card">
          <h3>Why this branch exists</h3>
          <p>{branch.fork_rationale}</p>
        </div>
      )}

      {branch.status === 'promoted' && (
        <div className="notice notice-ok">
          This branch was promoted to a full independent project — its own content now lives there.
        </div>
      )}

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">This branch&apos;s own schema elements</span>
          <GitBranch size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{schemaCount === null ? '—' : schemaCount}</div>
        <p className="muted" style={{ marginTop: 8 }}>
          Plus everything in {project.name}&apos;s shared schema — a branch diverges only in its
          own content, per RFC 0002.
        </p>
      </div>

      <div className="card">
        <Link to={`/dashboard/${slug}/branches`} className="row muted">
          <Settings size={14} />
          Fork, promote, or manage this branch from the Branches admin page
        </Link>
      </div>
    </div>
  )
}
