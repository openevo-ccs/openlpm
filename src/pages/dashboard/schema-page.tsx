import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Shapes, X } from 'lucide-react'
import { Chip } from '@/components/chip'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'

type SchemaElement = Database['public']['Tables']['lpm_schema_elements']['Row']
type ProjectBaseLink = Database['public']['Tables']['project_base_links']['Row']

const CONCEPTBASE_REPO = 'openevo-ccs/conceptbase'

interface ConceptBaseConcept {
  id: string
  type: string
  status: string
  version: string
  definedInVocabulary: string
  labels: Record<string, string>
  definitions?: Record<string, Record<string, string>>
  relations?: Record<string, string[]>
}

function mapStatus(cbStatus: string): 'proposed' | 'discussed' | 'accepted' | 'deprecated' {
  if (cbStatus === 'stable') return 'accepted'
  if (cbStatus === 'deprecated') return 'deprecated'
  return 'proposed'
}

export default function SchemaPage() {
  const { project, role, supabase } = useOutletContext<ProjectOutletContext>()
  const [elements, setElements] = useState<SchemaElement[]>([])
  const [baseLink, setBaseLink] = useState<ProjectBaseLink | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  const reload = async () => {
    // Every concept/competency/grade-band element that belongs to this
    // Project -- there's no more separate per-branch schema tab to split
    // this across (see the project-hierarchy/maturity migrations). Also
    // pulls in the parent Project Space's own elements when this project
    // has one (e.g. EvoMentor's shared Basiskonzepte taxonomy, moved up
    // 2026-09-12 specifically so every regional sub-project sees the same
    // one, not a separate copy each) -- a shared framework lives on the
    // Space, sub-projects read it, never fork their own copy.
    const projectIds = [project.id, project.parent_project_id].filter((id): id is string => !!id)
    const { data } = await supabase
      .from('lpm_schema_elements')
      .select('*')
      .in('project_id', projectIds)
      .order('created_at', { ascending: true })
    setElements(data ?? [])
  }

  useEffect(() => {
    reload()
    supabase
      .from('project_base_links')
      .select('*')
      .eq('project_id', project.id)
      .eq('base_repo', 'conceptbase')
      .maybeSingle()
      .then(({ data }) => setBaseLink(data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  const canManage = role === 'owner' || role === 'maintainer'

  // RFC 0002 section 5's import-from-any-base-repo model, first slice: pulls
  // real oe:Concept records from ConceptBase's public GitHub registry for one
  // vocabulary and lands them in this project's lpm_schema_elements.
  // Read-only against ConceptBase -- never writes back there (that direction
  // is the separate, not-yet-built "propose a PR" flow).
  const importConcepts = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const vocabulary = String(formData.get('vocabulary') ?? '').trim()
    if (!vocabulary) return
    setBusy(true); setNotice(null)

    try {
      const treeRes = await fetch(`https://api.github.com/repos/${CONCEPTBASE_REPO}/git/trees/main?recursive=1`, {
        headers: { Accept: 'application/vnd.github+json' },
      })
      if (!treeRes.ok) throw new Error(`GitHub API error (${treeRes.status})`)
      const tree: { tree: { path: string; type: string }[] } = await treeRes.json()

      const conceptPaths = tree.tree
        .filter((entry) => entry.type === 'blob' && entry.path.startsWith('registry/concept/') && entry.path.endsWith('.json'))
        .map((entry) => entry.path)

      const concepts = await Promise.all(
        conceptPaths.map(async (path) => {
          const res = await fetch(`https://raw.githubusercontent.com/${CONCEPTBASE_REPO}/main/${path}`)
          if (!res.ok) return null
          return (await res.json()) as ConceptBaseConcept
        })
      )

      const matching = concepts.filter((c): c is ConceptBaseConcept => c !== null && c.definedInVocabulary === vocabulary)

      for (const concept of matching) {
        const label = concept.labels?.en ?? concept.id
        const definitionsForLang = concept.definitions?.en ?? {}
        const definition = Object.values(definitionsForLang)[0] ?? null

        const { data: existing } = await supabase
          .from('lpm_schema_elements')
          .select('id')
          .eq('project_id', project.id)
          .eq('metadata->>conceptbase_id', concept.id)
          .maybeSingle()

        const row = {
          project_id: project.id,
          element_type: 'concept' as const,
          label,
          definition,
          status: mapStatus(concept.status),
          metadata: {
            conceptbase_id: concept.id,
            vocabulary: concept.definedInVocabulary,
            version: concept.version,
            relations: concept.relations ?? {},
            source: 'conceptbase',
          },
        }

        if (existing) await supabase.from('lpm_schema_elements').update(row).eq('id', existing.id)
        else await supabase.from('lpm_schema_elements').insert(row)
      }

      setNotice({ kind: 'ok', text: `Imported ${matching.length} concept(s) from "${vocabulary}".` })
      await reload()
    } catch (err) {
      setNotice({ kind: 'bad', text: err instanceof Error ? err.message : 'Import failed.' })
    }
    setBusy(false)
  }

  return (
    <div>
      <h1>Schema co-design</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Concepts, competencies, and grade bands used across this project — imported from
        ConceptBase or added directly.
      </p>

      {notice && (
        <div className={`notice notice-${notice.kind}`}>
          {notice.text}
          <button className="btn btn-mini" onClick={() => setNotice(null)} style={{ marginLeft: 'auto' }}><X size={10} /></button>
        </div>
      )}

      {elements.length === 0 ? (
        <div className="card empty">
          <Shapes size={32} />
          <p>No schema elements yet.</p>
        </div>
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 20 }}>
          {elements.map((el) => (
            <div key={el.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3>{el.label}</h3>
                <Chip status={el.status} />
              </div>
              <span className="muted capitalize">{el.element_type}</span>
              {el.definition && <p style={{ marginTop: 8 }}>{el.definition}</p>}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="card">
          <h3>Import from ConceptBase</h3>
          <p className="muted">
            {baseLink?.can_import
              ? 'Pulls real oe:Concept records for one vocabulary from the public ConceptBase registry. Read-only — never writes back.'
              : "This project isn't linked to ConceptBase for import yet (see project_base_links)."}
          </p>
          <form onSubmit={importConcepts} className="row">
            <div className="field" style={{ marginBottom: 0 }}>
              <input name="vocabulary" placeholder="e.g. BIO-CORE-v1.0.0" style={{ width: 220 }} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!baseLink?.can_import || busy}>
              Import concepts
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
