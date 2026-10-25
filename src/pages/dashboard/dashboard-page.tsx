import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, BookOpen, Clock, FileText, FolderKanban, MessageSquare, Plus } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { describeActivity, listRecentActivity, type ActivityEntry } from '@/lib/supabase/activity'
import { EpistemicStatusBadge } from '@/components/epistemic-status-badge'
import { MaturityBadge } from '@/components/maturity-badge'
import { WorkingLanguagesTag } from '@/components/working-languages-tag'

// 2026-09-13 restructure: renamed from "Overview," folding in the former
// standalone Projects and Members tabs (per Dustin's explicit instruction)
// plus a new "needs attention" digest built from tables that already exist.
// An editable multi-language intro/overview text block is planned (RFC-0005's
// content_translations pattern) but not built in this pass -- it needs its
// own small schema addition beyond what this restructure already has queued.
//
// Real feedback 67375983 (2026-10-01): "the Dashboard should be more of a
// true dashboard." Color, Members (and everything nested under it --
// invites, self-join rules, student view), and the danger zone moved out
// to settings-page.tsx behind its own sidebar entry -- this page keeps only
// status/stats/navigation: the maturity badge, the stat tiles, this
// project's own sub-projects, and recent activity.

// Introduction text (migration 173). Paragraphs are separated by blank lines.
// A first paragraph that starts with "Status:" is shown as a notice so the
// space's standing (synthetic, unreviewed, and so on) is the first thing read.
// The column does not exist until migration 173 is applied; a project without
// text renders nothing.
function capitalizeFirst(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

function ProjectIntroduction({ text }: { text: string | null }) {
  if (!text || !text.trim()) return null
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <div style={{ marginBottom: 20, maxWidth: 760 }}>
      {paragraphs.map((para, i) =>
        i === 0 && para.startsWith('Status:') ? (
          <div key={i} className="notice" style={{ alignItems: 'flex-start' }}>
            <span>
              <strong>Status:</strong> {capitalizeFirst(para.slice('Status:'.length).trim())}
            </span>
          </div>
        ) : (
          <p key={i} style={{ marginTop: 0, lineHeight: 1.55 }}>{para}</p>
        ),
      )}
    </div>
  )
}

type CountTable = 'literature_references' | 'lpm_schema_elements' | 'lpm_data_objects' | 'discussion_topics'
type Project = Database['public']['Tables']['projects']['Row']

async function countFor(supabase: ProjectOutletContext['supabase'], table: CountTable, projectId: string) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('project_id', projectId)
  return count ?? 0
}

// Real feedback, 2026-10-21: a Curriculum Repository project (Florida,
// Germany, etc.) "doesn't seem to have data" -- the four generic LPM-project
// tiles below (literature_references/lpm_schema_elements/lpm_data_objects/
// discussion_topics) are all genuinely, correctly empty for this project
// kind, since its real content lives entirely in curriculum_repository_records
// instead. Showing four zeroes next to a repo that actually holds 49 real
// records is the wrong four numbers being shown, a display problem rather
// than a real absence of data. Four facts about its own real content
// instead: how many records, how many
// distinct kinds of record, how many jurisdictions it covers, and how many of
// its records are an actual sub-space of this nation (vs. living flat on the
// nation itself) -- the same regional/thematic split project-switcher-page.tsx
// now surfaces in the parent's own card.
async function curriculumRepositoryStats(supabase: ProjectOutletContext['supabase'], projectId: string) {
  const { data, count } = await supabase
    .from('curriculum_repository_records')
    .select('record_type, jurisdiction', { count: 'exact' })
    .eq('project_id', projectId)
  const rows = data ?? []
  const recordTypes = new Set(rows.map((r) => r.record_type)).size
  const jurisdictions = new Set(rows.map((r) => r.jurisdiction).filter((j): j is string => !!j)).size
  const { count: subSpaceCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('parent_project_id', projectId)
  return { total: count ?? 0, recordTypes, jurisdictions, subSpaceCount: subSpaceCount ?? 0 }
}

export default function DashboardPage() {
  const { project, role, supabase } = useOutletContext<ProjectOutletContext>()
  const isCurriculumRepository = (project as any).project_kind === 'curriculum-repository'
  const [counts, setCounts] = useState<[number, number, number, number] | null>(null)
  const [repoStats, setRepoStats] = useState<Awaited<ReturnType<typeof curriculumRepositoryStats>> | null>(null)
  const [pendingReviews, setPendingReviews] = useState<number | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null)
  const [maturity, setMaturity] = useState(project.maturity)
  const [busy, setBusy] = useState(false)

  const canManage = role === 'owner' || role === 'maintainer'

  useEffect(() => {
    if (isCurriculumRepository) {
      setRepoStats(null)
      curriculumRepositoryStats(supabase, project.id).then(setRepoStats)
      return
    }
    setCounts(null)
    Promise.all([
      countFor(supabase, 'literature_references', project.id),
      countFor(supabase, 'lpm_schema_elements', project.id),
      countFor(supabase, 'lpm_data_objects', project.id),
      countFor(supabase, 'discussion_topics', project.id),
    ]).then((c) => setCounts(c as [number, number, number, number]))
  }, [supabase, project.id, isCurriculumRepository])

  useEffect(() => {
    setPendingReviews(null)
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('peer_review_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('reviewer_id', data.user.id)
        .eq('status', 'pending')
        .then(({ count }) => setPendingReviews(count ?? 0))
    })
  }, [supabase, project.id])

  useEffect(() => {
    setActivity(null)
    listRecentActivity(supabase, project.id).then(setActivity)
  }, [supabase, project.id])

  useEffect(() => setMaturity(project.maturity), [project.maturity])

  const toggleMaturity = async () => {
    const next = maturity === 'draft' ? 'established' : 'draft'
    setBusy(true)
    const { error } = await supabase.from('projects').update({ maturity: next }).eq('id', project.id)
    setBusy(false)
    if (!error) setMaturity(next)
  }

  const stats = isCurriculumRepository
    ? [
        { label: 'Curriculum Repository records', count: repoStats?.total ?? 0, icon: FileText },
        { label: 'Kinds of record', count: repoStats?.recordTypes ?? 0, icon: FolderKanban },
        { label: 'Jurisdictions covered', count: repoStats?.jurisdictions ?? 0, icon: BookOpen },
        { label: 'Sub-spaces inside', count: repoStats?.subSpaceCount ?? 0, icon: MessageSquare },
      ]
    : [
        { label: 'Papers and sources', count: counts?.[0] ?? 0, icon: BookOpen },
        { label: 'Concepts', count: counts?.[1] ?? 0, icon: FileText },
        { label: 'Learning goals', count: counts?.[2] ?? 0, icon: FileText },
        { label: 'Discussion topics', count: counts?.[3] ?? 0, icon: MessageSquare },
      ]

  return (
    <div>
      <h1>{project.name}</h1>

      <ProjectIntroduction text={(project as { introduction?: string | null }).introduction ?? null} />

      {canManage && (
        <div className="row" style={{ marginBottom: 20, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13 }}>Status:</span>
          <MaturityBadge status={maturity} />
          <button className="btn btn-mini" disabled={busy} onClick={toggleMaturity}>
            {maturity === 'draft' ? 'Mark as established' : 'Mark as draft'}
          </button>
        </div>
      )}

      {pendingReviews !== null && pendingReviews > 0 && (
        <div className="notice notice-ok" style={{ marginBottom: 16 }}>
          <Clock size={14} />
          <span>
            You have {pendingReviews} pending review{pendingReviews === 1 ? '' : 's'} —{' '}
            <Link to="review">go to Review</Link>
          </span>
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        {stats.map(({ label, count, icon: Icon }) => (
          <div key={label} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">{label}</span>
              <Icon size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{(isCurriculumRepository ? repoStats === null : counts === null) ? '—' : count}</div>
          </div>
        ))}
      </div>

      <ProjectsSection project={project} canManage={canManage} supabase={supabase} />

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

// ============================================================================
// Projects section -- formerly the standalone Projects tab. The simple
// slug/name/description/focus_type create form here is superseded by the
// full "Start new project" wizard (geography, language, subject, grade-band
// framework, source/rights) once that's built -- kept as-is for now so
// creating a project isn't blocked while that larger piece is in progress.
// ============================================================================

function ProjectsSection({
  project,
  canManage,
  supabase,
}: {
  project: Database['public']['Tables']['projects']['Row']
  canManage: boolean
  supabase: ProjectOutletContext['supabase']
}) {
  const [children, setChildren] = useState<Project[]>([])

  useEffect(() => {
    supabase.from('projects').select('*').eq('parent_project_id', project.id).order('created_at', { ascending: true })
      .then(({ data }) => setChildren(data ?? []))
  }, [supabase, project.id])

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
        <div>
          <h2 className="row"><FolderKanban size={16} style={{ color: 'var(--text-muted)' }} />Projects in this Space</h2>
          {/* Real feedback f316c6a2 (Susan): "/style-check all text on this
              page, specifically get rid of any mention of 'echt'" -- this
              opened with "Real efforts," a reflexive self-vouching "real"
              Dustin's own writing-style rule already bans. State the fact,
              skip the qualifier. */}
          <p className="muted" style={{ marginBottom: 12 }}>
            Efforts inside {project.name} — some fully proven, some still early drafts.
          </p>
        </div>
        {canManage && (
          <Link to="new-project" className="btn btn-primary">
            <Plus size={14} />Start new project
          </Link>
        )}
      </div>

      {children.length === 0 ? (
        <div className="card empty" style={{ marginBottom: 20 }}>
          <FolderKanban size={32} />
          <p>No projects here yet.</p>
        </div>
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 20 }}>
          {children.map((child) => (
            <Link key={child.id} to={`/dashboard/${child.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card" style={{ height: '100%' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3>{child.name}</h3>
                  <MaturityBadge status={child.maturity} />
                </div>
                {child.description && <p className="muted">{child.description}</p>}
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <EpistemicStatusBadge status={child.epistemic_status} />
                  <WorkingLanguagesTag languages={child.working_languages} />
                </div>
                <span className="row muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Open <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
