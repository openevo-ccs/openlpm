import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, BookOpen, Clock, FileText, FolderKanban, MessageSquare } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { describeActivity, listRecentActivity, type ActivityEntry } from '@/lib/supabase/activity'
import { EpistemicStatusBadge } from '@/components/epistemic-status-badge'
import { MaturityBadge } from '@/components/maturity-badge'

type CountTable = 'literature_references' | 'lpm_schema_elements' | 'lpm_data_objects' | 'discussion_topics'
type Project = Database['public']['Tables']['projects']['Row']

async function countFor(supabase: ProjectOutletContext['supabase'], table: CountTable, projectId: string) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('project_id', projectId)
  return count ?? 0
}

export default function OverviewPage() {
  const { project, role, supabase } = useOutletContext<ProjectOutletContext>()
  const [counts, setCounts] = useState<[number, number, number, number] | null>(null)
  const [childProjects, setChildProjects] = useState<Project[] | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null)
  const [maturity, setMaturity] = useState(project.maturity)
  const [busy, setBusy] = useState(false)

  const canManage = role === 'owner' || role === 'maintainer'

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
    setActivity(null)
    listRecentActivity(supabase, project.id).then(setActivity)
  }, [supabase, project.id])

  // Everything real that grew out of this Project Space -- whether it's a
  // fully proven regional curriculum or something still early -- is a
  // Project nested here (parent_project_id), one list, one word. There is
  // no separate "drafts" list anymore.
  useEffect(() => {
    setChildProjects(null)
    supabase
      .from('projects')
      .select('*')
      .eq('parent_project_id', project.id)
      .then(({ data }) => setChildProjects(data ?? []))
  }, [supabase, project.id])

  useEffect(() => setMaturity(project.maturity), [project.maturity])

  const toggleMaturity = async () => {
    const next = maturity === 'draft' ? 'established' : 'draft'
    setBusy(true)
    const { error } = await supabase.from('projects').update({ maturity: next }).eq('id', project.id)
    setBusy(false)
    if (!error) setMaturity(next)
  }

  const stats = [
    { label: 'Papers and sources', count: counts?.[0] ?? 0, icon: BookOpen },
    { label: 'Concepts', count: counts?.[1] ?? 0, icon: FileText },
    { label: 'Curriculum topics', count: counts?.[2] ?? 0, icon: FileText },
    { label: 'Discussions', count: counts?.[3] ?? 0, icon: MessageSquare },
  ]

  return (
    <div>
      <h1>{project.name}</h1>
      <p className="muted" style={{ marginBottom: 8 }}>{project.description}</p>

      {canManage && (
        <div className="row" style={{ marginBottom: 20, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13 }}>Status:</span>
          <MaturityBadge status={maturity} />
          <button className="btn btn-mini" disabled={busy} onClick={toggleMaturity}>
            {maturity === 'draft' ? 'Mark as established' : 'Mark as draft'}
          </button>
        </div>
      )}

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

      {childProjects && childProjects.length > 0 && (
        <>
          <h2 style={{ marginTop: 8 }}>Projects in this Space</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Real efforts inside {project.name} — some fully proven, some still early drafts. See
            the Projects tab to start a new one.
          </p>
          <div className="grid grid-3" style={{ marginBottom: 20 }}>
            {childProjects.map((child) => (
              <Link key={child.id} to={`/dashboard/${child.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card" style={{ height: '100%' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 className="row"><FolderKanban size={14} style={{ color: 'var(--text-muted)' }} />{child.name}</h3>
                    <MaturityBadge status={child.maturity} />
                  </div>
                  {child.description && <p className="muted">{child.description}</p>}
                  <span className="row muted" style={{ fontSize: 12 }}>
                    Open <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 style={{ marginTop: 8 }}>Recent activity</h2>
      {activity === null ? (
        <p className="muted">Loading…</p>
      ) : activity.length === 0 ? (
        <div className="card empty">
          <Clock size={32} />
          <p>No recent activity</p>
          <p className="muted">Start by adding literature or proposing a connection</p>
        </div>
      ) : (
        <div className="card">
          {activity.map((entry) => (
            <div key={entry.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{describeActivity(entry)}</span>
              <span className="muted" style={{ fontSize: 12 }}>{new Date(entry.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
