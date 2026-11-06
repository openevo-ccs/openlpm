import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, ListTree } from 'lucide-react'
import type { ProjectOutletContext } from '@/pages/dashboard/project-layout'
import { DRAFT_LABEL } from '@/lib/supabase/curriculum-repository'

// Where an expert goes to review (Dustin, 2026-11-02): the repository dashboard says how much of the structure still awaits review and
// links straight to the review view, filtered to what is open. Shown only to people who can review (owner or maintainer).

type Supabase = ProjectOutletContext['supabase']

export function StructureReviewCard({ supabase, projectId, slug, canReview }: { supabase: Supabase; projectId: string; slug: string; canReview: boolean }) {
  const [counts, setCounts] = useState<{ open: number; reviewed: number } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const base = () => supabase.from('curriculum_repository_structure_nodes').select('id', { count: 'exact', head: true }).eq('project_id', projectId).not('level', 'in', '(edition,grade_band)')
      const [all, done] = await Promise.all([base(), base().eq('review_status', 'expert-reviewed')])
      if (!alive) return
      const total = all.count ?? 0
      setCounts({ open: total - (done.count ?? 0), reviewed: done.count ?? 0 })
    })().catch(() => alive && setCounts(null))
    return () => { alive = false }
  }, [supabase, projectId])

  if (!counts || counts.open + counts.reviewed === 0) return null
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <ListTree size={16} style={{ color: 'var(--text-muted)' }} />
        <strong>Review the curriculum structure</strong>
        <span className="chip" style={{ fontSize: 11, borderColor: 'var(--warn, #b7791f)' }}>{counts.open} awaiting review</span>
        <span className="chip" style={{ fontSize: 11 }}><BadgeCheck size={11} style={{ verticalAlign: 'text-bottom' }} /> {counts.reviewed} reviewed</span>
      </div>
      <p className="muted" style={{ margin: '6px 0', fontSize: 12.5 }}>
        Topics, subtopics and units of the curriculum documents in this repository, in German and English. Each one is marked "{DRAFT_LABEL.en}" until a person has checked it.
        {canReview ? ' Open the list, read each entry against the document, then mark it reviewed or correct the text on the spot.' : ' You can read them here; owners and maintainers can mark them reviewed.'}
      </p>
      <Link className="btn btn-mini btn-primary" to={`/dashboard/${slug}/curriculum-structure?status=open`}>{canReview ? 'Start review' : 'Open the structure'}</Link>
    </div>
  )
}
