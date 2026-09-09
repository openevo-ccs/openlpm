import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import { Chip } from '@/components/chip'
import type { BranchOutletContext } from './branch-layout'
import type { Database } from '@/lib/supabase/database.types'

type SchemaElement = Database['public']['Tables']['lpm_schema_elements']['Row']

export default function BranchSchemaPage() {
  const { project, branch, supabase } = useOutletContext<BranchOutletContext>()
  const [elements, setElements] = useState<SchemaElement[] | null>(null)

  useEffect(() => {
    setElements(null)
    supabase
      .from('lpm_schema_elements')
      .select('*')
      .eq('project_id', project.id)
      .or(`branch_id.eq.${branch.id},branch_id.is.null`)
      .order('created_at', { ascending: true })
      .then(({ data }) => setElements(data ?? []))
  }, [supabase, project.id, branch.id])

  return (
    <div>
      <p className="muted" style={{ marginBottom: 16 }}>
        {project.name}&apos;s shared vocabulary, plus anything {branch.label} has added or
        elaborated on its own.
      </p>

      {elements === null ? (
        <p className="muted">Loading…</p>
      ) : elements.length === 0 ? (
        <div className="card empty">
          <GitBranch size={32} />
          <p>No schema elements yet — shared or branch-specific.</p>
        </div>
      ) : (
        <div className="grid grid-3">
          {elements.map((el) => (
            <div key={el.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3>{el.label}</h3>
                <Chip status={el.status} />
              </div>
              <div className="row" style={{ marginBottom: 6 }}>
                <span className="muted capitalize">{el.element_type}</span>
                <span className="chip">{el.branch_id ? branch.label : 'shared'}</span>
              </div>
              {el.definition && <p>{el.definition}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
