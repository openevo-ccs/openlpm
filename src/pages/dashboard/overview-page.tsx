import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { BookOpen, FileText, MessageSquare, Clock, GitBranch, ArrowRight } from 'lucide-react'
import { Chip } from '@/components/chip'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'

type CountTable = 'literature_references' | 'lpm_schema_elements' | 'lpm_data_objects' | 'discussion_topics'
type Branch = Database['public']['Tables']['branches']['Row']

async function countFor(supabase: ProjectOutletContext['supabase'], table: CountTable, projectId: string) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('project_id', projectId)
  return count ?? 0
}

export default function OverviewPage() {
  const { project, slug, supabase } = useOutletContext<ProjectOutletContext>()
  const [counts, setCounts] = useState<[number, number, number, number] | null>(null)
  const [branches, setBranches] = useState<Branch[] | null>(null)

  useEffect(() => {
    setCounts(null)
    Promise.all([
      countFor(supabase, 'literature_references', project.id),
      countFor(supabase, 'lpm_schema_elements', project.id),
      countFor(supabase, 'lpm_data_objects', project.id),
      countFor(supabase, 'discussion_topics', project.id),
    ]).then((c) => setCounts(c as [number, number, number, number]))
  }, [supabase, project.id])

  useEffect(() => {
    setBranches(null)
    supabase
      .from('branches')
      .select('*')
      .eq('project_id', project.id)
      .eq('status', 'active')
      .order('is_trunk', { ascending: false })
      .order('created_at', { ascending: true })
      .then(({ data }) => setBranches(data ?? []))
  }, [supabase, project.id])

  const stats = [
    { label: 'Literature references', count: counts?.[0] ?? 0, icon: BookOpen },
    { label: 'Schema elements', count: counts?.[1] ?? 0, icon: FileText },
    { label: 'LPM objects', count: counts?.[2] ?? 0, icon: FileText },
    { label: 'Discussions', count: counts?.[3] ?? 0, icon: MessageSquare },
  ]

  return (
    <div>
      <h1>{project.name}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>{project.description}</p>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        {stats.map(({ label, count, icon: Icon }) => (
          <div key={label} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">{label}</span>
              <Icon size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{counts === null ? '—' : count}</div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 8 }}>Branches</h2>
      <p className="muted" style={{ marginBottom: 12 }}>
        {project.name}&apos;s trunk, plus every language/jurisdiction/depth variant that has
        diverged from it.
      </p>

      {branches === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 20 }}>
          {branches.map((branch) => (
            <Link
              key={branch.id}
              to={`/dashboard/${slug}/branches/${branch.slug}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="card" style={{ height: '100%' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 className="row"><GitBranch size={14} style={{ color: 'var(--text-muted)' }} />{branch.label}</h3>
                  {branch.is_trunk ? <span className="chip">trunk</span> : <Chip status={branch.status} />}
                </div>
                {branch.description && <p className="muted">{branch.description}</p>}
                <span className="row muted" style={{ fontSize: 12 }}>
                  Enter <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="card empty">
        <Clock size={32} />
        <p>No recent activity</p>
        <p className="muted">Start by adding literature or creating schema elements</p>
      </div>
    </div>
  )
}
