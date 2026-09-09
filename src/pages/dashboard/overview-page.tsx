import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BookOpen, FileText, MessageSquare, Clock } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'

type CountTable = 'literature_references' | 'lpm_schema_elements' | 'lpm_data_objects' | 'discussion_topics'

async function countFor(supabase: ProjectOutletContext['supabase'], table: CountTable, projectId: string) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('project_id', projectId)
  return count ?? 0
}

export default function OverviewPage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const [counts, setCounts] = useState<[number, number, number, number] | null>(null)

  useEffect(() => {
    setCounts(null)
    Promise.all([
      countFor(supabase, 'literature_references', project.id),
      countFor(supabase, 'lpm_schema_elements', project.id),
      countFor(supabase, 'lpm_data_objects', project.id),
      countFor(supabase, 'discussion_topics', project.id),
    ]).then((c) => setCounts(c as [number, number, number, number]))
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

      <div className="card empty">
        <Clock size={32} />
        <p>No recent activity</p>
        <p className="muted">Start by adding literature or creating schema elements</p>
      </div>
    </div>
  )
}
