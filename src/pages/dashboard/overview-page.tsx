import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { BookOpen, FileText, MessageSquare, Clock, GitBranch, ArrowRight } from 'lucide-react'
import { Chip } from '@/components/chip'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { describeActivity, listRecentActivity, type ActivityEntry } from '@/lib/supabase/activity'

type CountTable = 'literature_references' | 'lpm_schema_elements' | 'lpm_data_objects' | 'discussion_topics'
type Branch = Database['public']['Tables']['branches']['Row']
type Project = Database['public']['Tables']['projects']['Row']

async function countFor(supabase: ProjectOutletContext['supabase'], table: CountTable, projectId: string) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('project_id', projectId)
  return count ?? 0
}

export default function OverviewPage() {
  const { project, slug, supabase } = useOutletContext<ProjectOutletContext>()
  const [counts, setCounts] = useState<[number, number, number, number] | null>(null)
  const [branches, setBranches] = useState<Branch[] | null>(null)
  const [subProjects, setSubProjects] = useState<Project[] | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null)

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
      .eq('is_trunk', false) // the trunk IS this project's own content, already reflected above -- not a separate "experiment" card
      .order('created_at', { ascending: true })
      .then(({ data }) => setBranches(data ?? []))
  }, [supabase, project.id])

  useEffect(() => {
    setActivity(null)
    listRecentActivity(supabase, project.id).then(setActivity)
  }, [supabase, project.id])

  useEffect(() => {
    setSubProjects(null)
    supabase
      .from('projects')
      .select('*')
      .eq('parent_project_id', project.id)
      .then(({ data }) => setSubProjects(data ?? []))
  }, [supabase, project.id])

  const stats = [
    { label: 'Papers and sources', count: counts?.[0] ?? 0, icon: BookOpen },
    { label: 'Concepts', count: counts?.[1] ?? 0, icon: FileText },
    { label: 'Curriculum topics', count: counts?.[2] ?? 0, icon: FileText },
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

      {subProjects && subProjects.length > 0 && (
        <>
          <h2 style={{ marginTop: 8 }}>Regional and topic projects</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Real, separate efforts that grew out of {project.name} — each with its own content and its own team.
          </p>
          <div className="grid grid-3" style={{ marginBottom: 20 }}>
            {subProjects.map((sp) => (
              <Link key={sp.id} to={`/dashboard/${sp.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card" style={{ height: '100%' }}>
                  <h3>{sp.name}</h3>
                  {sp.description && <p className="muted">{sp.description}</p>}
                  <span className="row muted" style={{ fontSize: 12 }}>
                    Open <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {branches && branches.length > 0 && (
        <>
          <h2 style={{ marginTop: 8 }}>Early drafts and experiments</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Smaller, in-progress ideas being tried out within {project.name} itself.
          </p>
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
                    <Chip status={branch.status} />
                  </div>
                  {branch.description && <p className="muted">{branch.description}</p>}
                  <span className="row muted" style={{ fontSize: 12 }}>
                    Enter <ArrowRight size={12} />
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
