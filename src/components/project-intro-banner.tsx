import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { listMembers, type MemberWithUser } from '@/lib/supabase/members'

type Project = Database['public']['Tables']['projects']['Row']

// Real feedback, 2026-10-21: "rich yet concise introductory paragraphs at
// the very top of every dashboard page... up-to-date overview of the
// project status, aims, users with admin or editorial or curatorial
// roles." Starting simple and automatic (Dustin's own choice over a
// richer, hand-authored version): built entirely from data this project
// already has -- its own description and its real current membership --
// never a separately-authored or AI-generated text block that could go
// stale. Status itself (maturity/epistemic-status chips) already renders
// right above this in project-layout.tsx's sidebar, so this banner's own
// job is the two things nothing else on the page currently shows: the
// project's stated aim, spelled out in full rather than truncated, and who
// actually holds which role -- not shown anywhere outside Settings today.
// Rendered once, here, rather than once per page, so every page gets it
// automatically and no individual page has to remember to add it.
export function ProjectIntroBanner({ project, supabase }: { project: Project; supabase: SupabaseClient<Database> }) {
  const [members, setMembers] = useState<MemberWithUser[] | null>(null)

  useEffect(() => {
    setMembers(null)
    listMembers(supabase, project.id).then(setMembers)
  }, [supabase, project.id])

  if (!project.description && members === null) return null

  const owners = (members ?? []).filter((m) => m.role === 'owner' || m.role === 'maintainer')
  const editors = (members ?? []).filter((m) => m.role === 'editor')
  const otherCount = (members ?? []).length - owners.length - editors.length

  const roleLine = members === null
    ? 'Loading who maintains this project…'
    : owners.length === 0
      ? 'No owner or maintainer currently assigned.'
      : [
          `Maintained by ${owners.map((m) => m.user.name || m.user.email).join(', ')}`,
          editors.length > 0 ? `${editors.length} editor${editors.length === 1 ? '' : 's'}` : null,
          otherCount > 0 ? `${otherCount} other member${otherCount === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(editors.length > 0 || otherCount > 0 ? '; ' : '') + '.'

  return (
    <div className="card">
      {project.description && <p style={{ margin: 0, marginBottom: 6 }}>{project.description}</p>}
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>{roleLine}</p>
    </div>
  )
}
