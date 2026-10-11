import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { AlertTriangle, Check, Copy, ExternalLink, Globe, Layers, Library, Link2, Mail, Plus, Trash2, UserPlus, Users, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { countSubProjects, deleteProject, type ProjectRow } from '@/lib/supabase/projects'
import { CUSTOM_VIEW_AUDIENCES, CUSTOM_VIEW_LANGUAGES } from '@/lib/custom-views'
import { createCustomView, listCustomViews } from '@/lib/supabase/custom-views'
import {
  listProjectRepositoryLinks,
  listRepositoryLinkSummaryForProject,
  type ProjectRepositoryLinkSummary,
  type ProjectRepositoryLinkRow,
} from '@/lib/supabase/curriculum-repository'
import {
  addJoinRule,
  cancelMemberRequest,
  createMemberRequest,
  inviteMembers,
  listJoinRules,
  listMembers,
  listPendingInvites,
  listPendingRequestsSent,
  removeJoinRule,
  removeMember,
  revokeInvite,
  searchUsersToInvite,
  updateMemberRole,
  type InviteResult,
  type InviteRow,
  type JoinRule,
  type JoinRuleType,
  type MemberRequestRow,
  type MemberWithUser,
  type ProjectMemberRole,
  type UserSearchResult,
} from '@/lib/supabase/members'
import { getStudentViewTemplate, STUDENT_VIEW_TEMPLATES } from '@/lib/student-view-templates'
import { ALWAYS_VISIBLE_PAGE_KEY, DASHBOARD_PAGES, defaultPageKeys } from '@/lib/dashboard-view-pages'
import {
  addDashboardViewAssignment,
  createDashboardView,
  deleteDashboardView,
  listDashboardViewAssignments,
  listDashboardViews,
  removeDashboardViewAssignment,
  setDashboardViewForced,
  setDefaultDashboardView,
  type DashboardView,
  type DashboardViewAssignment,
  type DashboardViewKind,
  type ViewAssignmentTargetType,
} from '@/lib/supabase/dashboard-views'
import { PROJECT_COLORS } from '@/lib/project-colors'
import { groupsSettings, listGroups, setGroupCreatorRoles, setGroupSharingRoles, setGroupsEnabled, type ProjectGroup } from '@/lib/supabase/groups'
import {
  acceptFederation,
  federationCounterparty,
  federationPreviewMembers,
  federationSourceName,
  findProjectForFederation,
  listIncomingFederations,
  listOutgoingFederations,
  proposeFederation,
  revokeFederation,
  type Federation,
  type FederationPreviewMember,
  type ResolvedProject,
} from '@/lib/supabase/federations'

const ROLES: ProjectMemberRole[] = ['owner', 'maintainer', 'editor', 'reviewer', 'contributor', 'viewer']

// Real feedback 67375983 (2026-10-01): "we don't have a project-level
// Settings page or infrastructure but we probably do, and probably things
// like color, members, self-join settings, student view, and danger zone
// should be more part of project settings, while the Dashboard should be
// more of a true dashboard." Everything below (project color, the whole
// Members section, self-join rules, student view, danger zone) used to
// live directly on dashboard-page.tsx -- moved here unchanged internally,
// same gating (canManage / owner-only) as before, just relocated behind
// its own sidebar entry instead of mixed into the stats/activity page.
export default function SettingsPage() {
  const { project, role, supabase } = useOutletContext<ProjectOutletContext>()
  const canManage = role === 'owner' || role === 'maintainer'
  // project_kind (migration 072) isn't in the generated types yet.
  const isRepository = (project as any).project_kind === 'curriculum-repository'
  const isCustomView = (project as any).project_kind === 'curriculum-repository-custom-view'

  return (
    <div>
      <h1>Settings</h1>
      <p className="muted" style={{ marginBottom: 20 }}>Manage {project.name} — color, members, who can join, and more.</p>

      {canManage && <ProjectColorSection project={project} supabase={supabase} />}
      <MembersSection project={project} role={role} supabase={supabase} isRepository={isRepository} isCustomView={isCustomView} />
      {canManage && isRepository && <CustomViewsSection project={project} supabase={supabase} />}
      {!isRepository && !isCustomView && <CurriculumSourcesSection project={project} supabase={supabase} />}
      {canManage && <GroupsSettingsSection project={project} supabase={supabase} />}
      {canManage && <FederationSection project={project} supabase={supabase} />}
      {role === 'owner' && <DangerZoneSection project={project} supabase={supabase} />}
    </div>
  )
}

// ============================================================================
// Curriculum Repository Custom Views (migration 095) -- decided 2026-10-03,
// see lab_manager's openlpm-curriculum-context-modeling-2026-10-03.md. Only
// shown on a Curriculum Repository's own Settings page (never on an
// ordinary project, and never on a custom view's OWN Settings page -- a
// view doesn't get views of itself, since isRepository above is only ever
// true for the real repository). Each row listed here is an ordinary
// project with its own separate membership, created via createCustomView --
// never inherited or synced from this repository's own Members section
// above.
// ============================================================================

function CustomViewsSection({
  project,
  supabase,
}: {
  project: Database['public']['Tables']['projects']['Row']
  supabase: ProjectOutletContext['supabase']
}) {
  const [views, setViews] = useState<ProjectRow[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const reload = () => listCustomViews(supabase, project.id).then(setViews)

  useEffect(() => {
    setViews(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="row"><Layers size={16} style={{ color: 'var(--text-muted)' }} />Custom Views</h3>
      <p className="muted">
        An audience- or language-specific view of {project.name}&apos;s content — its own URL, its
        own members, never listed alongside ordinary project spaces in the switcher. Useful for
        opening this repository up to a much wider group (e.g. all teachers) or sharing a
        translated version, without giving that group access to everything here.
      </p>

      {views === null ? (
        <p className="muted">Loading…</p>
      ) : views.length === 0 ? (
        <p className="muted">No custom views yet.</p>
      ) : (
        <div style={{ marginBottom: 10 }}>
          {views.map((v) => (
            <div key={v.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>
                <strong>{v.name}</strong>
                {(v as any).view_audience && <span className="chip" style={{ marginLeft: 6 }}>{(v as any).view_audience}</span>}
                {(v as any).view_language && <span className="chip" style={{ marginLeft: 4 }}>{(v as any).view_language}</span>}
              </span>
              <Link to={`/dashboard/${v.slug}`} className="btn btn-mini">
                <ExternalLink size={11} />Open
              </Link>
            </div>
          ))}
        </div>
      )}

      {!showCreate ? (
        <button className="btn btn-mini" onClick={() => setShowCreate(true)}><Plus size={12} />New custom view</button>
      ) : (
        <NewCustomViewForm
          project={project}
          supabase={supabase}
          onDone={() => { setShowCreate(false); reload() }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

function NewCustomViewForm({
  project,
  supabase,
  onDone,
  onCancel,
}: {
  project: Database['public']['Tables']['projects']['Row']
  supabase: ProjectOutletContext['supabase']
  onDone: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [audience, setAudience] = useState('')
  const [language, setLanguage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setBusy(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await createCustomView(supabase, {
      parentProjectId: project.id,
      slug: slug.trim(),
      name: name.trim(),
      audience: audience.trim() || null,
      language: language.trim() || null,
      epistemicStatus: project.epistemic_status,
      createdBy: user?.id ?? null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setName(''); setSlug(''); setAudience(''); setLanguage('')
    onDone()
  }

  return (
    <div className="card" style={{ marginTop: 8, background: 'var(--bg-subtle, #f5f5f5)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>New custom view</strong>
        <button type="button" className="btn-linklike" onClick={onCancel}><X size={12} /></button>
      </div>
      <form onSubmit={submit} className="row" style={{ flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Germany Repository — Teachers" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Short address</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. germany-repository-teachers" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Audience (optional)</label>
          <input list="custom-view-audiences" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. teachers" />
          <datalist id="custom-view-audiences">
            {CUSTOM_VIEW_AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </datalist>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Language (optional)</label>
          <input list="custom-view-languages" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. fr" />
          <datalist id="custom-view-languages">
            {CUSTOM_VIEW_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </datalist>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || !name.trim() || !slug.trim()} style={{ alignSelf: 'flex-end' }}>
          {busy ? 'Creating…' : 'Create'}
        </button>
      </form>
      {error && <div className="notice notice-bad" style={{ marginTop: 8 }}>{error}</div>}
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Starts with no members but you — add people from this new view&apos;s own Settings page once it&apos;s created.
      </p>
    </div>
  )
}

// ============================================================================
// Curriculum sources (migration 105, 2026-10-04) -- the content side of
// migration 066's "browse + connect" feature. Shows which Curriculum
// Repository document(s) this project's own content was built from, and
// flags it directly when the Repository already has a newer edition --
// built after a real incident where EvoMentor Thuringia and the Germany
// Curriculum Repository drifted out of sync with nothing to flag it. See
// lab_manager's germany-curriculum-repository-vs-evomentor-thuringia-
// relation-2026-10-04.md for the full story. Read-only here deliberately --
// creating a new connection already has a home on the Repository's own
// record-detail page (the existing "Connect" button); this just makes the
// result of that visible from the content side too, which previously had
// no way to see it at all.
// ============================================================================

function CurriculumSourcesSection({
  project,
  supabase,
}: {
  project: Database['public']['Tables']['projects']['Row']
  supabase: ProjectOutletContext['supabase']
}) {
  const [projectLinks, setProjectLinks] = useState<(ProjectRepositoryLinkRow & { repository: { id: string; name: string; slug: string } })[] | null>(null)
  const [recordLinks, setRecordLinks] = useState<ProjectRepositoryLinkSummary[] | null>(null)

  useEffect(() => {
    setProjectLinks(null)
    setRecordLinks(null)
    listProjectRepositoryLinks(supabase, project.id).then(setProjectLinks)
    listRepositoryLinkSummaryForProject(supabase, project.id).then(setRecordLinks)
  }, [supabase, project.id])

  const loading = projectLinks === null || recordLinks === null
  const nothingYet = !loading && projectLinks!.length === 0 && recordLinks!.length === 0

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="row"><Library size={16} style={{ color: 'var(--text-muted)' }} />Curriculum Repository sources</h3>
      <p className="muted">
        Which official curriculum document(s) {project.name}&apos;s content is grounded in, and whether the
        Repository already has a newer edition than what it was built from.
      </p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : nothingYet ? (
        <p className="muted">
          No Curriculum Repository connections yet. These are made from a repository record&apos;s own page
          (the &quot;Connect&quot; button there), not from here.
        </p>
      ) : (
        <>
          {projectLinks!.length > 0 && (
            <div style={{ marginBottom: recordLinks!.length > 0 ? 14 : 0 }}>
              <p className="muted" style={{ marginBottom: 4, fontSize: 12.5 }}>Grounded in, project-wide:</p>
              {projectLinks!.map((l) => (
                <div key={l.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>
                    <strong>{l.repository.name}</strong>
                    {l.jurisdiction && <span className="chip" style={{ marginLeft: 6 }}>{l.jurisdiction}</span>}
                  </span>
                  <Link to={`/dashboard/${l.repository.slug}`} className="btn btn-mini">
                    <ExternalLink size={11} />Open
                  </Link>
                </div>
              ))}
            </div>
          )}

          {recordLinks!.length > 0 && (
            <div>
              <p className="muted" style={{ marginBottom: 4, fontSize: 12.5 }}>Specific content connected to a Repository record:</p>
              {recordLinks!.map(({ record, linkedContentCount, supersession }) => (
                <div key={record.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span>
                      <strong>{record.title}</strong>
                      <span className="muted" style={{ marginLeft: 6 }}>
                        {linkedContentCount} linked item{linkedContentCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  </div>
                  {supersession.successor && (
                    <p className="notice notice-bad" style={{ marginTop: 6, marginBottom: 0, fontSize: 12.5 }}>
                      <AlertTriangle size={11} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
                      The Repository shows a newer edition — <strong>{supersession.successor.title}</strong> — worth
                      checking whether this content still matches.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// Members section -- formerly the standalone Members tab, unchanged
// internally.
// ============================================================================

function MembersSection({
  project,
  role,
  supabase,
  isRepository,
  isCustomView,
}: {
  project: Database['public']['Tables']['projects']['Row']
  role: ProjectOutletContext['role']
  supabase: ProjectOutletContext['supabase']
  isRepository: boolean
  isCustomView: boolean
}) {
  const [members, setMembers] = useState<MemberWithUser[] | null>(null)
  const [invites, setInvites] = useState<InviteRow[] | null>(null)
  const [requests, setRequests] = useState<(MemberRequestRow & { user: UserSearchResult })[] | null>(null)
  const [federationLabels, setFederationLabels] = useState<Record<string, string>>({})
  const canManage = role === 'owner' || role === 'maintainer'

  const reload = () => {
    listMembers(supabase, project.id).then((rows) => {
      setMembers(rows)
      // Resolve "via federation with <source project>" labels for any
      // federation-sourced rows, one lookup per distinct federation (not
      // per member) since several members can share the same source.
      const ids = Array.from(new Set(rows.map((m) => m.source_federation_id).filter((id): id is string => !!id)))
      ids.forEach((id) => {
        if (federationLabels[id]) return
        federationSourceName(supabase, id).then((name) => {
          if (name) setFederationLabels((prev) => ({ ...prev, [id]: name }))
        })
      })
    })
    if (canManage) {
      listPendingInvites(supabase, project.id).then(setInvites)
      listPendingRequestsSent(supabase, project.id).then(setRequests)
    }
  }

  useEffect(() => {
    setMembers(null)
    setInvites(null)
    setRequests(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  return (
    <>
      <h2 className="row" style={{ marginTop: 8 }}><Users size={16} style={{ color: 'var(--text-muted)' }} />Members</h2>
      <p className="muted" style={{ marginBottom: 12 }}>Who can see and work on {project.name}.</p>

      {canManage && <RequestToJoinForm projectId={project.id} supabase={supabase} onRequested={reload} />}
      {canManage && <InviteForm projectId={project.id} supabase={supabase} onInvited={reload} />}
      {canManage && <JoinRulesSection project={project} supabase={supabase} />}
      {canManage && !isRepository && !isCustomView && <DashboardViewsSection project={project} supabase={supabase} />}

      {requests !== null && requests.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Pending requests</h3>
          <p className="muted">Waiting for them to accept or decline -- nothing happens until they respond.</p>
          {requests.map((r) => (
            <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>
                <strong>{r.user.name}</strong>
                <span className="muted" style={{ marginLeft: 6 }}>{r.user.email}</span>
              </span>
              <span className="row">
                <span className="chip">{r.role}</span>
                <button className="btn btn-mini" onClick={() => cancelMemberRequest(supabase, r.id).then(reload)}><Trash2 size={11} />Cancel</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {invites !== null && invites.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Pending invites</h3>
          <p className="muted">Not signed up yet — they&apos;ll be added automatically the moment they do.</p>
          {invites.map((inv) => (
            <div key={inv.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="row"><Mail size={13} />{inv.email}</span>
              <span className="row">
                <span className="chip">{inv.role}</span>
                <button className="btn btn-mini" onClick={() => revokeInvite(supabase, inv.id).then(reload)}><Trash2 size={11} />Revoke</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Current members</h3>
        {members === null ? (
          <p className="muted">Loading…</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>
                <strong>{m.user.name}</strong>
                <span className="muted" style={{ marginLeft: 6 }}>{m.user.email}</span>
                {m.source_federation_id && (
                  <span className="chip" style={{ marginLeft: 6 }} title="Added automatically because their project federates with this one">
                    <Link2 size={10} />via federation{federationLabels[m.source_federation_id] ? ` with ${federationLabels[m.source_federation_id]}` : ''}
                  </span>
                )}
              </span>
              {canManage ? (
                <span className="row">
                  <select value={m.role} onChange={(e) => updateMemberRole(supabase, m.id, e.target.value as ProjectMemberRole).then(reload)}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button className="btn btn-mini btn-danger" aria-label="Remove member" title="Remove member" onClick={() => removeMember(supabase, m.id).then(reload)}><Trash2 size={11} /></button>
                </span>
              ) : (
                <span className="chip">{m.role}</span>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}

// Owner-only (not maintainer -- more destructive than anything else a
// maintainer can already do, migration 052's own comment). The admin page's
// Projects section is the cross-project counterpart for an admin acting on
// a project they don't themselves own.
function DangerZoneSection({
  project,
  supabase,
}: {
  project: Database['public']['Tables']['projects']['Row']
  supabase: ProjectOutletContext['supabase']
}) {
  const navigate = useNavigate()
  const [subCount, setSubCount] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typedSlug, setTypedSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    countSubProjects(supabase, project.id).then(setSubCount)
  }, [supabase, project.id])

  const confirmDelete = async () => {
    if (typedSlug.trim() !== project.slug) return
    setBusy(true)
    setError(null)
    const { error: err } = await deleteProject(supabase, project.id)
    setBusy(false)
    if (err) setError(err.message)
    else navigate('/dashboard')
  }

  return (
    <div className="card" style={{ marginTop: 20, borderColor: 'var(--critical)' }}>
      <h3 className="row" style={{ color: 'var(--critical)' }}><AlertTriangle size={16} />Danger zone</h3>

      {subCount === null ? (
        <p className="muted">Loading…</p>
      ) : subCount > 0 ? (
        <p className="muted">
          This project can&apos;t be deleted while it still has {subCount} sub-project{subCount === 1 ? '' : 's'} inside it —
          delete or move {subCount === 1 ? 'it' : 'those'} first.
        </p>
      ) : !confirming ? (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <p className="muted" style={{ margin: 0 }}>
            Permanently delete {project.name} and everything in it. This cannot be undone.
          </p>
          <button className="btn btn-mini btn-danger" onClick={() => setConfirming(true)}>
            <Trash2 size={11} />Delete this project
          </button>
        </div>
      ) : (
        <div>
          <p>
            This permanently deletes <strong>{project.name}</strong> — its Learning Goals, Concepts,
            Theories, Strands, Literature, discussions, and membership. There is no undo.
          </p>
          <p style={{ marginBottom: 4 }}>Type <strong>{project.slug}</strong> to confirm:</p>
          <div className="row">
            <input
              type="text"
              value={typedSlug}
              onChange={(e) => setTypedSlug(e.target.value)}
              placeholder={project.slug}
              style={{ maxWidth: 240 }}
            />
            <button
              className="btn btn-mini btn-danger"
              disabled={busy || typedSlug.trim() !== project.slug}
              onClick={confirmDelete}
            >
              {busy ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button className="btn btn-mini" onClick={() => { setConfirming(false); setTypedSlug(''); setError(null) }} disabled={busy}>
              Cancel
            </button>
          </div>
          {error && <p style={{ marginTop: 6, color: 'var(--critical)' }}>{error}</p>}
        </div>
      )}
    </div>
  )
}

// Real feedback 092405e2 (2026-10-04): "easier to add members who have
// accounts on OpenLPM, type to search by name, then that sends their
// account a request and they can accept to join or not" -- a separate path
// from InviteForm below, which adds anyone who already has an account
// immediately with no consent step (fine for a known class roster, not fine
// for approaching one specific person). A debounced name/email search
// against every real account, excluding anyone already a member or already
// asked (searchUsersToInvite handles both exclusions).
function RequestToJoinForm({ projectId, supabase, onRequested }: { projectId: string; supabase: ProjectOutletContext['supabase']; onRequested: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [role, setRole] = useState<ProjectMemberRole>('viewer')
  const [busy, setBusy] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      searchUsersToInvite(supabase, projectId, query).then(setResults)
    }, 250)
    return () => clearTimeout(timer)
  }, [query, supabase, projectId])

  const send = async (user: UserSearchResult) => {
    setBusy(user.id)
    setSendError(null)
    const { error } = await createMemberRequest(supabase, projectId, user.id, role)
    setBusy(null)
    if (error) {
      setSendError("Couldn't send that request right now -- try again in a moment.")
    } else {
      setSent(user.name)
      setResults((prev) => prev.filter((u) => u.id !== user.id))
      setQuery('')
      onRequested()
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="row"><UserPlus size={16} />Request someone to join</h3>
      <p className="muted">
        Find someone who already has an OpenLPM account by name or email. They get a request and
        choose whether to accept -- nothing happens until they do.
      </p>
      <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div className="field" style={{ flex: '1 1 220px', marginBottom: 0 }}>
          <label>Name or email</label>
          <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setSent(null) }} placeholder="Type at least 2 characters…" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as ProjectMemberRole)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      {results.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {results.map((u) => (
            <div key={u.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>
                <strong>{u.name}</strong>
                <span className="muted" style={{ marginLeft: 6 }}>{u.email}</span>
              </span>
              <button className="btn btn-mini" disabled={busy === u.id} onClick={() => send(u)}>
                {busy === u.id ? 'Sending…' : 'Send request'}
              </button>
            </div>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && results.length === 0 && (
        <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>No matching account (or they&apos;re already a member or already asked).</p>
      )}
      {sent && <div className="notice notice-ok" style={{ marginTop: 10 }}>Request sent to {sent}.</div>}
      {sendError && <div className="notice notice-bad" style={{ marginTop: 10 }}>{sendError}</div>}
    </div>
  )
}

function InviteForm({ projectId, supabase, onInvited }: { projectId: string; supabase: ProjectOutletContext['supabase']; onInvited: () => void }) {
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<ProjectMemberRole>('viewer')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<InviteResult[] | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const list = emails.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
    if (list.length === 0) return
    setBusy(true)
    setResults(null)
    const outcomes = await inviteMembers(supabase, projectId, list, role)
    setResults(outcomes)
    setEmails('')
    setBusy(false)
    onInvited()
  }

  const outcomeLabel: Record<InviteResult['outcome'], string> = {
    added: 'Added — already had an account',
    invited: 'Invited — will join when they sign up',
    already_member: 'Already a member',
    error: 'Failed',
  }

  return (
    <div className="card">
      <h3 className="row"><UserPlus size={16} />Add people</h3>
      <p className="muted">Paste a whole class roster at once — one email per line, or comma-separated. Works whether or not they&apos;ve signed up yet.</p>
      <form onSubmit={submit}>
        <div className="field">
          <textarea
            placeholder={'student1@example.org\nstudent2@example.org'}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            style={{ minHeight: 100 }}
          />
        </div>
        <div className="row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as ProjectMemberRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !emails.trim()} style={{ alignSelf: 'flex-end' }}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
      {results && (
        <div style={{ marginTop: 10 }}>
          {results.map((r) => (
            <div key={r.email} className={`notice ${r.outcome === 'error' ? 'notice-bad' : r.outcome === 'already_member' ? '' : 'notice-ok'}`}>
              {r.email} — {outcomeLabel[r.outcome]}{r.detail && r.outcome === 'error' ? `: ${r.detail}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Self-join rules (migration 035) -- lets people join THEMSELVES if their
// email matches, instead of an owner naming each one ahead of time above.
// Built for a real, immediate case: a whole incoming class (Uni Jena's
// Biologiedidaktik pilot) can't realistically be rostered by exact email
// before the semester starts. A domain rule ("uni-jena.de") covers the
// whole class at once; an email rule still covers a specific one-off
// person, same as before. The shareable link only appears once at least
// one rule exists -- there's nothing useful to share before then.
// ============================================================================

function JoinRulesSection({
  project,
  supabase,
}: {
  project: Database['public']['Tables']['projects']['Row']
  supabase: ProjectOutletContext['supabase']
}) {
  const [rules, setRules] = useState<JoinRule[] | null>(null)
  const [ruleType, setRuleType] = useState<JoinRuleType>('domain')
  const [value, setValue] = useState('')
  const [role, setRole] = useState<ProjectMemberRole>('contributor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reload = () => listJoinRules(supabase, project.id).then(setRules)

  useEffect(() => {
    setRules(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  const joinLink = `${window.location.origin}${import.meta.env.BASE_URL}#/join/${project.slug}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await addJoinRule(supabase, project.id, ruleType, value, role)
    setBusy(false)
    if (error) setError(error.message)
    else {
      setValue('')
      reload()
    }
  }

  const remove = async (rule: JoinRule) => {
    await removeJoinRule(supabase, rule)
    reload()
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can fail quietly (permissions, insecure context) --
      // the link is still shown and selectable by hand either way.
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="row"><Globe size={16} />Let people join themselves</h3>
      <p className="muted">
        Add a whole email domain (e.g. everyone with a real <code>uni-jena.de</code> address) or a specific
        person&apos;s email. Anyone who matches can join with one click from their own profile — no need to
        know every student&apos;s email ahead of time.
      </p>

      <form onSubmit={submit} className="row">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Type</label>
          <select value={ruleType} onChange={(e) => setRuleType(e.target.value as JoinRuleType)}>
            <option value="domain">Email domain</option>
            <option value="email">Specific email</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
          <label>{ruleType === 'domain' ? 'Domain' : 'Email'}</label>
          <input
            type="text"
            placeholder={ruleType === 'domain' ? 'uni-jena.de' : 'someone@example.org'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Joins as</label>
          <select value={role} onChange={(e) => setRole(e.target.value as ProjectMemberRole)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || !value.trim()} style={{ alignSelf: 'flex-end' }}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
      {error && <div className="notice notice-bad" style={{ marginTop: 8 }}>{error}</div>}

      {rules === null ? (
        <p className="muted">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="muted" style={{ marginTop: 8 }}>No self-join rules yet — this group can only be joined by direct invite above.</p>
      ) : (
        <>
          <div style={{ marginTop: 10 }}>
            {rules.map((r) => (
              <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="row">
                  {r.rule_type === 'domain' ? <Globe size={13} /> : <Mail size={13} />}
                  {r.rule_type === 'domain' ? `Anyone @${r.value}` : r.value}
                </span>
                <span className="row">
                  <span className={`chip capitalize${r.role === 'owner' ? ' chip-progress' : ''}`}>{r.role}</span>
                  <button className="btn btn-mini" onClick={() => remove(r)}><Trash2 size={11} />Remove</button>
                </span>
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 12, padding: '8px 10px', background: 'var(--bg-subtle, #f5f5f5)', borderRadius: 6 }}>
            <span className="muted" style={{ fontSize: 12, flex: 1, wordBreak: 'break-all' }}>{joinLink}</span>
            <button className="btn btn-mini" type="button" onClick={copyLink}>
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Share this one link — anyone who matches a rule above joins with one click.
          </p>
        </>
      )}
    </div>
  )
}

// ============================================================================
// Project color (migration 064) -- a small fixed palette rather than a
// free picker, shown as a subtle left-border accent on this project's own card
// in the project switcher. Real feedback 2371cbf7 (2026-10-01).
// ============================================================================

function ProjectColorSection({
  project,
  supabase,
}: {
  project: Database['public']['Tables']['projects']['Row']
  supabase: ProjectOutletContext['supabase']
}) {
  // color (migration 064) isn't in the generated types yet.
  const [value, setValue] = useState<string | null>((project as any).color ?? null)
  const [busy, setBusy] = useState(false)

  const save = async (next: string | null) => {
    setValue(next)
    setBusy(true)
    const { error } = await (supabase as any)
      .from('projects')
      .update({ color: next })
      .eq('id', project.id)
    setBusy(false)
    if (error) setValue((project as any).color ?? null)
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Project color</h3>
      <p className="muted">
        A subtle accent border on this project&apos;s card in the project switcher — purely visual,
        doesn&apos;t need to be unique to this project.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-linklike"
          disabled={busy}
          onClick={() => save(null)}
          title="No color"
          style={{
            width: 26, height: 26, borderRadius: '50%', padding: 0,
            border: value === null ? '2px solid var(--series-a)' : '1px dashed var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)',
          }}
        >
          ×
        </button>
        {PROJECT_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            className="btn-linklike"
            disabled={busy}
            onClick={() => save(c.key)}
            title={c.label}
            aria-pressed={value === c.key}
            style={{
              width: 26, height: 26, borderRadius: '50%', padding: 0,
              background: c.hex,
              border: value === c.key ? '2px solid var(--text-primary)' : '2px solid transparent',
              boxShadow: value === c.key ? '0 0 0 2px var(--surface-1)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Dashboard views (migration 109) -- replaces the single, all-or-nothing
// "Preview as student" toggle (migration 045) this section used to be.
// Real feedback 63321a17: an owner builds any number of named views --
// each either a checklist of the normal sidebar pages, or one of the
// hand-built special templates below (today just the Jena pilot) -- and
// assigns each one to a specific person, a Group (if Groups is on), a
// project role, or how someone joined. One view can be the project's
// default (whoever matches nothing more specific falls back to it); any
// view can be forced (no switcher for whoever it applies to) or left
// optional (switchable -- the same spirit the old preview toggle had, now
// available to more than just an owner/maintainer previewing). Hidden for
// Curriculum Repository projects (gated at the call site) -- their nav
// isn't built from the shared page registry this reads, so a view created
// here would have no visible effect there.
// ============================================================================

function DashboardViewsSection({
  project,
  supabase,
}: {
  project: Database['public']['Tables']['projects']['Row']
  supabase: ProjectOutletContext['supabase']
}) {
  const [views, setViews] = useState<DashboardView[] | null>(null)
  const [assignments, setAssignments] = useState<DashboardViewAssignment[]>([])
  const [members, setMembers] = useState<MemberWithUser[]>([])
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const groupsEnabled = groupsSettings(project).enabled

  const reload = async () => {
    const vs = await listDashboardViews(supabase, project.id)
    setViews(vs)
    setAssignments(vs.length > 0 ? await listDashboardViewAssignments(supabase, vs.map((v) => v.id)) : [])
  }

  useEffect(() => {
    reload()
    listMembers(supabase, project.id).then(setMembers)
    if (groupsEnabled) listGroups(supabase, project.id).then(setGroups)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id, groupsEnabled])

  const makeDefault = async (viewId: string) => {
    await setDefaultDashboardView(supabase, project.id, viewId)
    reload()
  }
  const clearDefault = async () => {
    await setDefaultDashboardView(supabase, project.id, null)
    reload()
  }
  const toggleForced = async (view: DashboardView) => {
    await setDashboardViewForced(supabase, view.id, !view.is_forced)
    reload()
  }
  const remove = async (viewId: string) => {
    if (!window.confirm('Delete this view? Anyone assigned to it falls back to the project default, or the full view.')) return
    await deleteDashboardView(supabase, viewId)
    reload()
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Dashboard views</h3>
      <p className="muted">
        Build named views for different people, then decide who sees which one. Nobody sees anything
        here until you assign it to them — a brand-new view is invisible to everyone until it has at
        least one assignment, or is made the project default.
      </p>

      {views === null ? (
        <p className="muted">Loading…</p>
      ) : views.length === 0 ? (
        <p className="muted" style={{ marginBottom: 12 }}>No views yet — everyone sees the full researcher view.</p>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {views.map((v) => (
            <DashboardViewRow
              key={v.id}
              view={v}
              assignments={assignments.filter((a) => a.view_id === v.id)}
              members={members}
              groups={groups}
              groupsEnabled={groupsEnabled}
              supabase={supabase}
              onMakeDefault={() => makeDefault(v.id)}
              onClearDefault={clearDefault}
              onToggleForced={() => toggleForced(v)}
              onDelete={() => remove(v.id)}
              onChanged={reload}
            />
          ))}
        </div>
      )}

      <NewDashboardViewForm project={project} supabase={supabase} onCreated={reload} />
    </div>
  )
}

function DashboardViewRow({
  view,
  assignments,
  members,
  groups,
  groupsEnabled,
  supabase,
  onMakeDefault,
  onClearDefault,
  onToggleForced,
  onDelete,
  onChanged,
}: {
  view: DashboardView
  assignments: DashboardViewAssignment[]
  members: MemberWithUser[]
  groups: ProjectGroup[]
  groupsEnabled: boolean
  supabase: ProjectOutletContext['supabase']
  onMakeDefault: () => void
  onClearDefault: () => void
  onToggleForced: () => void
  onDelete: () => void
  onChanged: () => void
}) {
  const [targetType, setTargetType] = useState<ViewAssignmentTargetType>('user')
  const [targetValue, setTargetValue] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setTargetValue('')
  }, [targetType])

  const describeAssignment = (a: DashboardViewAssignment) => {
    if (a.target_type === 'user') return members.find((m) => m.user.id === a.target_value)?.user.name ?? 'Unknown person'
    if (a.target_type === 'group') return groups.find((g) => g.id === a.target_value)?.name ?? 'Unknown group'
    if (a.target_type === 'role') return `Role: ${a.target_value}`
    return a.target_value === 'self_join_rule' ? 'Signed themselves up' : 'Added or invited directly'
  }

  const targetOptions: { value: string; label: string }[] =
    targetType === 'user'
      ? members.map((m) => ({ value: m.user.id, label: m.user.name }))
      : targetType === 'group'
      ? groups.map((g) => ({ value: g.id, label: g.name }))
      : targetType === 'role'
      ? ROLES.map((r) => ({ value: r, label: r }))
      : [
          { value: 'self_join_rule', label: 'Signed themselves up' },
          { value: 'direct', label: 'Added or invited directly' },
        ]

  const addAssignment = async () => {
    if (!targetValue) return
    setBusy(true)
    await addDashboardViewAssignment(supabase, view.id, targetType, targetValue)
    setBusy(false)
    setTargetValue('')
    onChanged()
  }

  const removeAssignment = async (assignmentId: string) => {
    await removeDashboardViewAssignment(supabase, assignmentId)
    onChanged()
  }

  return (
    <div className="card" style={{ marginBottom: 10, background: 'var(--bg-subtle, #f5f5f5)' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span className="row" style={{ flexWrap: 'wrap' }}>
          <strong>{view.name}</strong>
          <span className="chip">{view.kind === 'template' ? 'Template' : 'Standard pages'}</span>
          {view.is_default && <span className="chip chip-progress">Default</span>}
          <span className={`chip${view.is_forced ? ' chip-progress' : ''}`}>{view.is_forced ? 'Forced' : 'Optional'}</span>
        </span>
        <span className="row">
          {view.is_default ? (
            <button className="btn btn-mini" onClick={onClearDefault}>Unset default</button>
          ) : (
            <button className="btn btn-mini" onClick={onMakeDefault}>Make default</button>
          )}
          <button className="btn btn-mini" onClick={onToggleForced}>{view.is_forced ? 'Make optional' : 'Make forced'}</button>
          <button className="btn btn-mini btn-danger" onClick={onDelete}><Trash2 size={11} />Delete</button>
        </span>
      </div>

      {view.kind === 'standard' ? (
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Pages: {view.page_keys.length === 0
            ? 'Dashboard only'
            : view.page_keys.map((k) => DASHBOARD_PAGES.find((p) => p.key === k)?.label ?? k).join(', ')}
        </p>
      ) : (
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {getStudentViewTemplate(view.template_id)?.description ?? view.template_id}
        </p>
      )}

      <div style={{ marginTop: 8 }}>
        {assignments.length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>Not assigned to anyone yet.</p>
        ) : (
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {assignments.map((a) => (
              <span key={a.id} className="chip row" style={{ gap: 4 }}>
                {describeAssignment(a)}
                <button type="button" className="btn-linklike" onClick={() => removeAssignment(a.id)} title="Remove" style={{ padding: 0 }}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="row" style={{ marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
          <select value={targetType} onChange={(e) => setTargetType(e.target.value as ViewAssignmentTargetType)}>
            <option value="user">Specific person</option>
            {groupsEnabled && <option value="group">Group</option>}
            <option value="role">Project role</option>
            <option value="join_method">How they joined</option>
          </select>
          <select value={targetValue} onChange={(e) => setTargetValue(e.target.value)}>
            <option value="">Choose…</option>
            {targetOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className="btn btn-mini" disabled={busy || !targetValue} onClick={addAssignment}>
            <Plus size={11} />Assign
          </button>
        </div>
      </div>
    </div>
  )
}

function NewDashboardViewForm({
  project,
  supabase,
  onCreated,
}: {
  project: Database['public']['Tables']['projects']['Row']
  supabase: ProjectOutletContext['supabase']
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<DashboardViewKind>('standard')
  const [pageKeys, setPageKeys] = useState<string[]>(defaultPageKeys())
  const [templateId, setTemplateId] = useState(STUDENT_VIEW_TEMPLATES[0]?.id ?? '')
  const [busy, setBusy] = useState(false)

  const togglePage = (key: string) => {
    if (key === ALWAYS_VISIBLE_PAGE_KEY) return
    setPageKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    await createDashboardView(supabase, project.id, {
      name: name.trim(),
      kind,
      pageKeys: kind === 'standard' ? pageKeys : undefined,
      templateId: kind === 'template' ? templateId : undefined,
    })
    setBusy(false)
    setName('')
    setPageKeys(defaultPageKeys())
    onCreated()
  }

  return (
    <form onSubmit={submit} className="card" style={{ background: 'var(--bg-subtle, #f5f5f5)' }}>
      <h4 style={{ marginTop: 0 }}>New view</h4>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
          <label>Name</label>
          <input type="text" placeholder="e.g. Reviewer-only" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Built from</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as DashboardViewKind)}>
            <option value="standard">A checklist of the normal pages</option>
            <option value="template">A specially-built template</option>
          </select>
        </div>
      </div>

      {kind === 'standard' ? (
        <div style={{ marginTop: 8 }}>
          <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Which pages this view shows. Dashboard is always included. (Groups and Curriculum Repository
            only actually appear if this project has those turned on.)
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            {DASHBOARD_PAGES.map((p) => (
              <label key={p.key} className="row" style={{ gap: 4, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={p.key === ALWAYS_VISIBLE_PAGE_KEY || pageKeys.includes(p.key)}
                  disabled={p.key === ALWAYS_VISIBLE_PAGE_KEY}
                  onChange={() => togglePage(p.key)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
          <label>Template</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {STUDENT_VIEW_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          {templateId && (
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {STUDENT_VIEW_TEMPLATES.find((t) => t.id === templateId)?.description}
            </p>
          )}
        </div>
      )}

      <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()} style={{ marginTop: 10 }}>
        {busy ? 'Creating…' : 'Create view'}
      </button>
    </form>
  )
}

// ============================================================================
// Groups (migration 075) -- real middle tier between "just me" and "the
// whole project," decided with Dustin 2026-10-02 (see lab_manager's
// docs/design-notes/openlpm-groups-feature-2026-10-02.md). Off by default.
// Owner/maintainer can always create/delete a group regardless of this
// setting -- the role picker below only EXTENDS that to other roles too,
// same additive spirit as self-join rules alongside direct invites.
// ============================================================================

const EXTRA_CREATOR_ROLES: ProjectMemberRole[] = ['editor', 'reviewer', 'contributor', 'viewer']

function GroupsSettingsSection({
  project,
  supabase,
}: {
  project: Database['public']['Tables']['projects']['Row']
  supabase: ProjectOutletContext['supabase']
}) {
  const initial = groupsSettings(project)
  const [enabled, setEnabled] = useState(initial.enabled)
  const [creatorRoles, setCreatorRoles] = useState<ProjectMemberRole[]>(initial.creatorRoles)
  // null = unrestricted (every member may share -- today's real behavior);
  // a real array = only these roles (plus owner/maintainer, always) may.
  const [sharingRoles, setSharingRoles] = useState<ProjectMemberRole[] | null>(initial.sharingRoles)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const flashSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const toggleEnabled = async () => {
    const next = !enabled
    setEnabled(next)
    setBusy(true)
    const { error } = await setGroupsEnabled(supabase, project.id, next)
    setBusy(false)
    if (error) setEnabled(!next)
    else flashSaved()
  }

  const toggleRole = async (r: ProjectMemberRole) => {
    const next = creatorRoles.includes(r) ? creatorRoles.filter((x) => x !== r) : [...creatorRoles, r]
    setCreatorRoles(next)
    setBusy(true)
    const { error } = await setGroupCreatorRoles(supabase, project.id, next)
    setBusy(false)
    if (error) setCreatorRoles(creatorRoles)
    else flashSaved()
  }

  // Real feedback 771f5fa2 (Dustin): "selected roles to determine the
  // functions ... of users within groups" -- restricting who may actually
  // share a Notebook or Favorites into a group, separate from who may
  // create one (toggleRole above). Flipping the checkbox on starts at an
  // empty role list (owner/maintainer only, the same restrictive floor
  // canManageGroups already uses) rather than guessing a starting set.
  const restrictSharing = sharingRoles !== null
  const toggleRestrictSharing = async () => {
    const next = restrictSharing ? null : []
    const prev = sharingRoles
    setSharingRoles(next)
    setBusy(true)
    const { error } = await setGroupSharingRoles(supabase, project.id, next)
    setBusy(false)
    if (error) setSharingRoles(prev)
    else flashSaved()
  }
  const toggleSharingRole = async (r: ProjectMemberRole) => {
    const current = sharingRoles ?? []
    const next = current.includes(r) ? current.filter((x) => x !== r) : [...current, r]
    setSharingRoles(next)
    setBusy(true)
    const { error } = await setGroupSharingRoles(supabase, project.id, next)
    setBusy(false)
    if (error) setSharingRoles(sharingRoles)
    else flashSaved()
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="row"><Users size={16} />Groups</h3>
      <p className="muted">
        Lets project members sort themselves into smaller teams within {project.name}. Each group gets its
        own shared view built from its members&apos; own Notebooks or Favorites — off by default.
      </p>
      <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={enabled} disabled={busy} onChange={toggleEnabled} />
        Turn Groups on for this project
      </label>
      {enabled && (
        <div style={{ marginTop: 10 }}>
          <p className="muted" style={{ marginBottom: 4 }}>
            Owners and maintainers can always create or delete a group. Who else may?
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            {EXTRA_CREATOR_ROLES.map((r) => (
              <label key={r} className="row" style={{ gap: 4, fontSize: 12.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={creatorRoles.includes(r)} disabled={busy} onChange={() => toggleRole(r)} />
                <span className="capitalize">{r}</span>
              </label>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Any member, any role, can join a group once it exists — this only controls who may create or
            delete one.
          </p>

          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={restrictSharing} disabled={busy} onChange={toggleRestrictSharing} />
              Restrict who can share a Notebook or Favorites into a group
            </label>
            <p className="muted" style={{ fontSize: 12, marginTop: 4, marginBottom: restrictSharing ? 8 : 0 }}>
              {restrictSharing
                ? 'Owners and maintainers can always share. Who else may?'
                : 'Off by default: any group member can share their own Notebook or Favorites with the group — this just restricts that.'}
            </p>
            {restrictSharing && (
              <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
                {EXTRA_CREATOR_ROLES.map((r) => (
                  <label key={r} className="row" style={{ gap: 4, fontSize: 12.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={(sharingRoles ?? []).includes(r)} disabled={busy} onChange={() => toggleSharingRole(r)} />
                    <span className="capitalize">{r}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {saved && <p className="muted" style={{ fontSize: 12, marginTop: 6, color: 'var(--good)' }}>Saved.</p>}
    </div>
  )
}

// ============================================================================
// Project federation (migration 083, feedback 20450401) -- a lateral
// relationship between two fully independent projects, distinct from
// parent/child nesting. "Propose" here means THIS project's owner/maintainer
// offering its own members into another project; the real admission only
// happens once that OTHER project's own owner/maintainer explicitly accepts
// (and sees exactly who's about to be added first) -- see this project's own
// Settings page on the other side for that half of the flow. Full design:
// lab_manager/docs/design-notes/openlpm-project-federation-2026-10-02.md.
// ============================================================================

function FederationSection({
  project,
  supabase,
}: {
  project: Database['public']['Tables']['projects']['Row']
  supabase: ProjectOutletContext['supabase']
}) {
  const [outgoing, setOutgoing] = useState<Federation[] | null>(null)
  const [incoming, setIncoming] = useState<Federation[] | null>(null)
  const [names, setNames] = useState<Record<string, ResolvedProject | null>>({})

  const reload = () => {
    listOutgoingFederations(supabase, project.id).then(setOutgoing)
    listIncomingFederations(supabase, project.id).then(setIncoming)
  }

  useEffect(() => {
    setOutgoing(null)
    setIncoming(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  useEffect(() => {
    const otherIds = [
      ...(outgoing ?? []).map((f) => f.target_project_id),
      ...(incoming ?? []).map((f) => f.source_project_id),
    ]
    const unresolved = Array.from(new Set(otherIds)).filter((id) => !(id in names))
    unresolved.forEach((id) => {
      federationCounterparty(supabase, id).then((p) => setNames((prev) => ({ ...prev, [id]: p })))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoing, incoming])

  const revoke = async (f: Federation) => {
    await revokeFederation(supabase, f)
    reload()
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="row"><Link2 size={16} />Federation</h3>
      <p className="muted">
        Extend {project.name}&apos;s own members into another, fully separate project space — or let another
        project&apos;s members reach into this one. Not nesting: both projects stay independent, and either
        side can end it at any time.
      </p>

      <ProposeFederationForm projectId={project.id} supabase={supabase} onProposed={reload} />

      <h4 style={{ marginTop: 16, marginBottom: 6 }}>Outgoing — {project.name}&apos;s members reaching elsewhere</h4>
      {outgoing === null ? (
        <p className="muted">Loading…</p>
      ) : outgoing.length === 0 ? (
        <p className="muted">Not offered into any other project.</p>
      ) : (
        outgoing.map((f) => (
          <FederationRow key={f.id} federation={f} otherProject={names[f.target_project_id]} direction="outgoing" onRevoke={() => revoke(f)} />
        ))
      )}

      <h4 style={{ marginTop: 16, marginBottom: 6 }}>Incoming — other projects&apos; members reaching into {project.name}</h4>
      {incoming === null ? (
        <p className="muted">Loading…</p>
      ) : incoming.length === 0 ? (
        <p className="muted">No other project has proposed federating into this one.</p>
      ) : (
        incoming.map((f) => (
          <IncomingFederationRow key={f.id} federation={f} otherProject={names[f.source_project_id]} supabase={supabase} onChanged={reload} />
        ))
      )}
    </div>
  )
}

function ProposeFederationForm({
  projectId,
  supabase,
  onProposed,
}: {
  projectId: string
  supabase: ProjectOutletContext['supabase']
  onProposed: () => void
}) {
  const [slug, setSlug] = useState('')
  const [role, setRole] = useState<ProjectMemberRole>('viewer')
  const [resolved, setResolved] = useState<ResolvedProject | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = async () => {
    setError(null)
    setResolved(undefined)
    const slugTrim = slug.trim()
    if (!slugTrim) return
    const project = await findProjectForFederation(supabase, slugTrim)
    if (!project) {
      setError(`No project with the slug "${slugTrim}" — check the exact slug with that project's owner.`)
      setResolved(null)
      return
    }
    if (project.id === projectId) {
      setError("That's this project — pick a different one to federate with.")
      setResolved(null)
      return
    }
    setResolved(project)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolved) return
    setBusy(true)
    setError(null)
    const { error } = await proposeFederation(supabase, projectId, resolved.id, role)
    setBusy(false)
    if (error) setError(error.message)
    else {
      setSlug('')
      setResolved(undefined)
      onProposed()
    }
  }

  return (
    <div className="card" style={{ background: 'var(--bg-subtle, #f5f5f5)' }}>
      <h4 style={{ marginTop: 0 }}>Propose a new federation</h4>
      <p className="muted" style={{ fontSize: 12.5 }}>
        You&apos;ll need the exact project slug (ask its owner — e.g. the end of its URL,{' '}
        <code>/dashboard/their-project-slug</code>). The other project&apos;s owner still has to accept before
        anyone actually gets access.
      </p>
      <form onSubmit={submit} className="row" style={{ flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Project slug</label>
          <input
            type="text"
            placeholder="evomentor-sachsen"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setResolved(undefined) }}
            onBlur={lookup}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Role they get here</label>
          <select value={role} onChange={(e) => setRole(e.target.value as ProjectMemberRole)}>
            {FEDERATION_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || !resolved} style={{ alignSelf: 'flex-end' }}>
          {busy ? 'Proposing…' : 'Propose'}
        </button>
      </form>
      {resolved && <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Found: <strong>{resolved.name}</strong></p>}
      {error && <div className="notice notice-bad" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  )
}

// Never 'owner' -- capped the same way the database CHECK constraint caps
// it (migration 083's own comment on why).
const FEDERATION_ROLES: ProjectMemberRole[] = ['maintainer', 'editor', 'reviewer', 'contributor', 'viewer']

const FEDERATION_STATUS_LABEL: Record<Federation['status'], string> = {
  proposed: 'Proposed — waiting on the other side',
  accepted: 'Active',
  revoked: 'Ended',
}

function FederationRow({
  federation,
  otherProject,
  direction,
  onRevoke,
}: {
  federation: Federation
  otherProject: ResolvedProject | null | undefined
  direction: 'outgoing' | 'incoming'
  onRevoke: () => void
}) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span>
        <strong>{otherProject === undefined ? 'Loading…' : otherProject?.name ?? '(project no longer exists)'}</strong>
        <span className="muted" style={{ marginLeft: 6 }}>
          {direction === 'outgoing' ? `their members get ${federation.granted_role} here` : `members here get ${federation.granted_role} there`}
        </span>
      </span>
      <span className="row">
        <span className={`chip ${federation.status === 'accepted' ? 'notice-ok' : ''}`}>{FEDERATION_STATUS_LABEL[federation.status]}</span>
        {federation.status !== 'revoked' && (
          <button className="btn btn-mini btn-danger" onClick={onRevoke}>
            <Trash2 size={11} />{federation.status === 'proposed' ? 'Withdraw' : 'End'}
          </button>
        )}
      </span>
    </div>
  )
}

function IncomingFederationRow({
  federation,
  otherProject,
  supabase,
  onChanged,
}: {
  federation: Federation
  otherProject: ResolvedProject | null | undefined
  supabase: ProjectOutletContext['supabase']
  onChanged: () => void
}) {
  const [reviewing, setReviewing] = useState(false)
  const [preview, setPreview] = useState<FederationPreviewMember[] | null>(null)
  const [busy, setBusy] = useState(false)

  const startReview = async () => {
    setReviewing(true)
    setPreview(null)
    const rows = await federationPreviewMembers(supabase, federation.id)
    setPreview(rows)
  }

  const confirmAccept = async () => {
    setBusy(true)
    await acceptFederation(supabase, federation)
    setBusy(false)
    setReviewing(false)
    onChanged()
  }

  const decline = async () => {
    setBusy(true)
    await revokeFederation(supabase, federation)
    setBusy(false)
    onChanged()
  }

  const end = async () => {
    setBusy(true)
    await revokeFederation(supabase, federation)
    setBusy(false)
    onChanged()
  }

  if (federation.status === 'accepted') {
    return (
      <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
        <span>
          <strong>{otherProject === undefined ? 'Loading…' : otherProject?.name ?? '(project no longer exists)'}</strong>
          <span className="muted" style={{ marginLeft: 6 }}>their members have {federation.granted_role} access here</span>
        </span>
        <span className="row">
          <span className="chip notice-ok">Active</span>
          <button className="btn btn-mini btn-danger" disabled={busy} onClick={end}><Trash2 size={11} />End</button>
        </span>
      </div>
    )
  }

  if (federation.status === 'revoked') {
    return (
      <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
        <span className="muted">{otherProject?.name ?? '(project no longer exists)'}</span>
        <span className="chip">Ended</span>
      </div>
    )
  }

  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>
          <strong>{otherProject === undefined ? 'Loading…' : otherProject?.name ?? '(project no longer exists)'}</strong>
          <span className="muted" style={{ marginLeft: 6 }}>wants their members to get {federation.granted_role} access here</span>
        </span>
        {!reviewing && (
          <span className="row">
            <button className="btn btn-mini btn-primary" onClick={startReview}>Review & accept</button>
            <button className="btn btn-mini" disabled={busy} onClick={decline}>Decline</button>
          </span>
        )}
      </div>
      {reviewing && (
        <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-subtle, #f5f5f5)', borderRadius: 6 }}>
          <p style={{ marginTop: 0, marginBottom: 6 }}>
            {preview === null
              ? 'Loading who would be added…'
              : preview.length === 0
                ? 'They currently have no members — accepting adds nobody right now, but anyone who joins them later will be added automatically while this stays active.'
                : `Accepting adds these ${preview.length} ${preview.length === 1 ? 'person' : 'people'} at ${federation.granted_role}, plus anyone who joins them later:`}
          </p>
          {preview && preview.length > 0 && (
            <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 13 }}>
              {preview.map((m) => (
                <li key={m.user_id}>{m.name} <span className="muted">({m.email})</span></li>
              ))}
            </ul>
          )}
          <div className="row">
            <button className="btn btn-mini btn-primary" disabled={busy || preview === null} onClick={confirmAccept}>
              {busy ? 'Accepting…' : `Confirm & accept these ${preview?.length ?? 0}`}
            </button>
            <button className="btn btn-mini" disabled={busy} onClick={() => setReviewing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
