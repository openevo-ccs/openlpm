import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FolderKanban, Library, Plus, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import { ADMIN_EMAIL } from '@/lib/admin'
import { getUserProjects, type ProjectRow, type ProjectMemberRole, type ProjectWithRole } from '@/lib/supabase/projects'
import { listAllProjects } from '@/lib/supabase/admin-users'

// Admin-only: a project the admin can see exists (migration 049's directory
// reach) but isn't personally a member of -- role is null rather than one
// of the real ProjectMemberRole values, distinct from ProjectWithRole's own
// (always-a-real-member) shape used everywhere else in the app.
interface SwitcherEntry {
  project: ProjectRow
  role: ProjectMemberRole | null
}
import { EpistemicStatusBadge, CURATION, type Curation } from '@/components/epistemic-status-badge'
import { WorkingLanguagesTag } from '@/components/working-languages-tag'
import { projectColorHex } from '@/lib/project-colors'

// Real feedback 2371cbf7 (2026-10-01): "set a standard character display
// cut off to ensure project descriptions are displayed at the same
// length" -- a card with a long description used to dwarf its row-mates
// (confirmed against Dustin's own screenshot: eva-lpm's long migration
// note made its card 4x the height of EvoMentor's, right next to it).
// Full text stays in the title tooltip rather than being lost.
const DESCRIPTION_MAX = 140
function truncateDescription(text: string | null): string {
  if (!text) return ''
  if (text.length <= DESCRIPTION_MAX) return text
  return `${text.slice(0, DESCRIPTION_MAX).trimEnd()}…`
}

const CURATION_LABEL: Record<Curation, string> = {
  'human-curated': 'Human-Curated',
  'synthetic-theoretical': 'Synthetic-Theoretical',
}

const CURATION_GLOSS: Record<Curation, string> = {
  'human-curated': 'Made or reviewed by real teachers and researchers, whether or not it has been tried in a classroom yet.',
  'synthetic-theoretical': 'A designed thought experiment -- not yet tried with real students.',
}

export default function ProjectSwitcherPage() {
  const supabase = useMemo(() => createClient(), [])
  const navigate = useNavigate()
  const { session } = useSession()
  const isAdmin = session?.user.email === ADMIN_EMAIL
  const [memberships, setMemberships] = useState<ProjectWithRole[] | null>(null)
  const [allProjects, setAllProjects] = useState<ProjectWithRole['project'][] | null>(null)
  // Both on by default -- this only narrows the view, never hides a project
  // space a user hasn't deliberately chosen to filter out.
  const [visibleCurations, setVisibleCurations] = useState<Set<Curation>>(
    new Set(['human-curated', 'synthetic-theoretical'])
  )

  useEffect(() => {
    getUserProjects(supabase).then(setMemberships)
  }, [supabase])

  // Real need, stated directly (2026-10-01): "I need to always be able to
  // see all projects on the platform" -- the admin account's own landing
  // page used to show only its own memberships, same as anyone else, which
  // meant "see everything" only ever lived on a separate admin sub-page.
  // `role` is null for a project the admin can see but isn't actually a
  // member of -- opening one of those still hits ProjectLayout's own "you
  // aren't a member" wall (content RLS is a separate, bigger boundary this
  // doesn't touch); this fixes visibility of what exists, not content access.
  useEffect(() => {
    if (!isAdmin) { setAllProjects(null); return }
    listAllProjects(supabase).then(setAllProjects)
  }, [supabase, isAdmin])

  const entries = useMemo<SwitcherEntry[]>(() => {
    if (!isAdmin) return memberships ?? []
    if (!allProjects) return []
    const roleByProjectId = new Map((memberships ?? []).map((m) => [m.project.id, m.role]))
    return allProjects.map((project) => ({ project, role: roleByProjectId.get(project.id) ?? null }))
  }, [isAdmin, memberships, allProjects])

  // A real student who's only ever joined one group (the common case --
  // this is exactly the Jena pilot's own shape) shouldn't have to pick from
  // a switcher with one tile in it every time they sign in -- send them
  // straight to it. Someone in more than one project space still lands here
  // to choose, same as before. "All project spaces" stays one click away
  // from inside that project, so this is a default, not a dead end. Never
  // applies to the admin account -- it should always land on the full
  // platform-wide view, even on a day it happens to have just one real
  // membership of its own.
  useEffect(() => {
    if (!isAdmin && memberships?.length === 1) {
      navigate(`/dashboard/${memberships[0].project.slug}`, { replace: true })
    }
  }, [isAdmin, memberships, navigate])

  const stillLoading = memberships === null || (isAdmin && allProjects === null)
  const redirecting = !isAdmin && memberships?.length === 1
  if (stillLoading || redirecting) {
    return <p className="muted">Loading…</p>
  }

  // Group by parent so a real regional or topic-focused effort (e.g.
  // "EvoMentor Thuringia") shows nested under its home Project Space instead
  // of sitting as its own separate tile -- keeps this list from growing one
  // entry per region/language/theme as those get added. Every top-level
  // entry here is a Project Space; everything nested under one is a Project
  // (see [[openlpm-project-hierarchy-architecture]] -- this is the entry
  // point that list is meant to serve).
  const byId = new Map(entries.map((m) => [m.project.id, m]))
  const isRepository = (p: ProjectRow) => (p as any).project_kind === 'curriculum-repository'
  const topLevel = entries.filter((m) => !m.project.parent_project_id || !byId.has(m.project.parent_project_id))
  // Curriculum Repositories are a different part of the ontology, not a
  // filtered subset of "project spaces" -- real feedback 8e9545c6 ("needs
  // its own distinct section"). Shown in full, every time any exist, never
  // narrowed by the human-curated/synthetic-theoretical filter below (that
  // filter is about how a research project's content was made, which
  // doesn't apply to a curated source archive the same way).
  const repoTopLevel = topLevel.filter((m) => isRepository(m.project))
  const standardTopLevel = topLevel.filter((m) => !isRepository(m.project))
  // Real feedback a4be05a6 (2026-10-01): differentiate human-curated from
  // synthetic-theoretical project spaces at the frame level, same split as
  // the Admin page's own Projects card now uses.
  const curatedTopLevel = standardTopLevel.filter((m) => CURATION[m.project.epistemic_status] === 'human-curated' && visibleCurations.has('human-curated'))
  const syntheticTopLevel = standardTopLevel.filter((m) => CURATION[m.project.epistemic_status] === 'synthetic-theoretical' && visibleCurations.has('synthetic-theoretical'))
  const childrenOf = (id: string) => entries.filter((m) => m.project.parent_project_id === id)

  const toggleCuration = (c: Curation) => {
    setVisibleCurations((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Your project spaces</h1>
          <p className="muted" style={{ marginBottom: 12 }}>
            Open a project space below to work inside it. Each one keeps its own curriculum,
            literature, and members separate from the others.
          </p>
        </div>
        <Link to="/dashboard/new-project" className="btn btn-primary">
          <Plus size={14} />Start new project
        </Link>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 20 }}>
        {(['human-curated', 'synthetic-theoretical'] as const).map((c) => (
          <label key={c} className="row" style={{ gap: 6, fontSize: 13, cursor: 'pointer' }} title={CURATION_GLOSS[c]}>
            <input type="checkbox" checked={visibleCurations.has(c)} onChange={() => toggleCuration(c)} />
            {CURATION_LABEL[c]}
          </label>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="card empty">
          <FolderKanban size={32} />
          <p>You aren&apos;t a member of any project space yet.</p>
          <p className="muted">Ask an owner to add you, or create a new one.</p>
        </div>
      ) : (
        <>
          {repoTopLevel.length > 0 && (
            <div className="frame">
              <h2 className="row" style={{ fontSize: 16, gap: 6 }}><Library size={16} style={{ color: 'var(--text-muted)' }} />Curriculum Repositories</h2>
              <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
                Reference curriculum documents for a country or region, kept separate from the
                research project spaces below.
              </p>
              <div className="grid grid-3">
                {repoTopLevel.map(({ project, role }) => (
                  <ProjectCard key={project.id} project={project} role={role} childrenOf={childrenOf} />
                ))}
              </div>
            </div>
          )}

          {curatedTopLevel.length === 0 && syntheticTopLevel.length === 0 ? (
            <div className="card empty">
              <p className="muted">No project spaces match the selected filter.</p>
            </div>
          ) : (
            <>
              {curatedTopLevel.length > 0 && (
                <div className="frame frame-curated">
                  <h2 style={{ fontSize: 16, marginBottom: 2 }}>Human-Curated</h2>
                  <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
                    Made by real teachers and researchers.
                  </p>
                  <div className="grid grid-3">
                    {curatedTopLevel.map(({ project, role }) => (
                      <ProjectCard key={project.id} project={project} role={role} childrenOf={childrenOf} />
                    ))}
                  </div>
                </div>
              )}

              {syntheticTopLevel.length > 0 && (
                <div className="frame frame-synthetic">
                  <h2 style={{ fontSize: 16, marginBottom: 2 }}>Synthetic-Theoretical</h2>
                  <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
                    Designed by AI as thought experiments — not reviewed by a subject-matter
                    expert and not tried with real students. Kept visually separate from the
                    human-curated work above so the two are never confused.
                  </p>
                  <div className="grid grid-3">
                    {syntheticTopLevel.map(({ project, role }) => (
                      <ProjectCard key={project.id} project={project} role={role} childrenOf={childrenOf} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function ProjectCard({
  project,
  role,
  childrenOf,
}: {
  project: ProjectRow
  role: ProjectMemberRole | null
  childrenOf: (id: string) => SwitcherEntry[]
}) {
  const children = childrenOf(project.id)
  const colorHex = projectColorHex((project as any).color)
  // Real feedback b4b23580 (2026-10-01): an always-expanded children list
  // made a card with many sub-projects (EvoMentor's 6) tower over a
  // one-child neighbor. Capped and collapsible instead, same shape as the
  // Admin page's own project tree.
  const CAP = 3
  const [expanded, setExpanded] = useState(false)
  const visibleChildren = expanded ? children : children.slice(0, CAP)
  const hiddenCount = children.length - visibleChildren.length
  return (
    <div
      className="card"
      style={{
        height: '100%',
        // Real feedback 7f8bc960 (2026-10-02): "a dash of color across the
        // core UI," grounded in openevo.net's own site -- its real card
        // style reserves a splash of the brand teal for things worth
        // noticing. Pairs the existing left-edge accent (project color,
        // feedback 2371cbf7) with a matching top edge, so a card with a
        // color actually set reads as a colored frame, not a single stray line.
        borderLeft: colorHex ? `4px solid ${colorHex}` : undefined,
        borderTop: colorHex ? `3px solid ${colorHex}` : undefined,
      }}
    >
      <Link to={`/dashboard/${project.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3>{project.name}</h3>
          <div className="row" style={{ gap: 4 }}>
            {/* Real feedback 7f8bc960: colored visibility badges, same
                teal-for-public/tan-for-private pairing openevo.net's own
                repo-grid pills use (app/css/styles.css .pill-public/
                .pill-private) -- reusing this app's existing progress/draft
                chip tints rather than inventing a third color pair. */}
            {project.is_private ? (
              <span className="chip chip-draft" title="Only members can see this project exists">Private</span>
            ) : (
              <span className="chip chip-progress" title="Anyone can see this project exists">Public</span>
            )}
            {role ? (
              <span className={`chip capitalize${role === 'owner' ? ' chip-progress' : ''}`}>{role}</span>
            ) : (
              <span className="chip" title="You can see this because you're the admin -- you aren't a member" style={{ gap: 3 }}>
                <ShieldCheck size={10} />Admin view
              </span>
            )}
          </div>
        </div>
        <p className="muted" title={project.description ?? undefined}>{truncateDescription(project.description)}</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <EpistemicStatusBadge status={project.epistemic_status} />
          <WorkingLanguagesTag languages={project.working_languages} />
        </div>
      </Link>
      {children.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
          <span className="muted" style={{ fontSize: 12 }}>{(project as any).project_kind === 'curriculum-repository' ? 'Repositories inside:' : 'Projects inside:'}</span>
          {visibleChildren.map((c) => (
            <Link key={c.project.id} to={`/dashboard/${c.project.slug}`} className="row" style={{ textDecoration: 'none', color: 'inherit', marginTop: 4, fontSize: 13 }}>
              {c.project.name}
            </Link>
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              className="btn-linklike"
              style={{ marginTop: 4, fontSize: 12 }}
              onClick={(e) => { e.preventDefault(); setExpanded(true) }}
            >
              +{hiddenCount} more
            </button>
          )}
          {expanded && children.length > CAP && (
            <button
              type="button"
              className="btn-linklike"
              style={{ marginTop: 4, fontSize: 12 }}
              onClick={(e) => { e.preventDefault(); setExpanded(false) }}
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  )
}
