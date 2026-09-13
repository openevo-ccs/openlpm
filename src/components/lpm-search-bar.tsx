import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import type { ProjectOutletContext } from '@/pages/dashboard/project-layout'

// Replaces the old standalone "Explore" sidebar tab, per Dustin's explicit
// instruction: an LPM-level (i.e. scoped to the currently open project, not
// global across every project) search bar instead of its own nav item.
// Searches the three real, already-live content tables a learner/curriculum
// designer would actually look something up in; Theories and Strands aren't
// included yet since their own tables aren't live.
interface Hit {
  kind: 'Learning goal' | 'Concept' | 'Literature'
  id: string
  label: string
  sub?: string | null
  href: string
}

export function LpmSearchBar({ project, slug, supabase }: Pick<ProjectOutletContext, 'project' | 'slug' | 'supabase'>) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setHits(null); return }
    const timer = setTimeout(async () => {
      const like = `%${q}%`
      const [goals, concepts, literature] = await Promise.all([
        supabase.from('lpm_data_objects').select('id, title, grade_band').eq('project_id', project.id).ilike('title', like).limit(5),
        supabase.from('lpm_schema_elements').select('id, label, element_type').eq('project_id', project.id).ilike('label', like).limit(5),
        supabase.from('literature_references').select('id, title, year').eq('project_id', project.id).ilike('title', like).limit(5),
      ])
      setHits([
        ...(goals.data ?? []).map((g): Hit => ({ kind: 'Learning goal', id: g.id, label: g.title, sub: g.grade_band ? `Grade ${g.grade_band}` : null, href: `/dashboard/${slug}/learning-goals/${g.id}` })),
        ...(concepts.data ?? []).map((c): Hit => ({ kind: 'Concept', id: c.id, label: c.label, sub: c.element_type, href: `/dashboard/${slug}/concepts` })),
        ...(literature.data ?? []).map((l): Hit => ({ kind: 'Literature', id: l.id, label: l.title, sub: l.year ? String(l.year) : null, href: `/dashboard/${slug}/literature` })),
      ])
    }, 250)
    return () => clearTimeout(timer)
  }, [query, project.id, slug, supabase])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={boxRef} style={{ position: 'relative', width: 260 }}>
      <div className="row" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px' }}>
        <Search size={13} style={{ color: 'var(--text-muted)' }} />
        <input
          type="search"
          placeholder={`Search ${project.name}…`}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          style={{ border: 'none', flex: 1, padding: '2px 4px' }}
        />
        {query && (
          <button type="button" className="btn-linklike" onClick={() => { setQuery(''); setHits(null) }}>
            <X size={12} />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, maxHeight: 320, overflowY: 'auto' }}>
          {hits === null ? (
            <p className="muted" style={{ fontSize: 12 }}>Searching…</p>
          ) : hits.length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>No matches in this project.</p>
          ) : (
            hits.map((h) => (
              <Link
                key={`${h.kind}-${h.id}`}
                to={h.href}
                onClick={() => setOpen(false)}
                style={{ display: 'block', padding: '6px 4px', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--border)' }}
              >
                <span className="chip" style={{ fontSize: 10, marginRight: 6 }}>{h.kind}</span>
                <strong style={{ fontSize: 13 }}>{h.label}</strong>
                {h.sub && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{h.sub}</span>}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
