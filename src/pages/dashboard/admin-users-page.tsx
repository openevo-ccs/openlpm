import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronRight, FolderTree, Globe, Library, Lock, Mail, MessageSquareText, Pencil, ShieldAlert, Trash2, UserCheck, Users, UserX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import { ADMIN_EMAIL } from '@/lib/admin'
import { inviteMembers, removeMember, updateMemberRole, type ProjectMemberRole } from '@/lib/supabase/members'
import { deleteProject, updateProjectMetadata, type ProjectMetadataPatch } from '@/lib/supabase/projects'
import { listFeedback, type FeedbackItem } from '@/lib/supabase/feedback'
import { projectColorHex, projectColorTint } from '@/lib/project-colors'
import {
  addAdminJoinRule,
  listAllJoinRules,
  listAllMemberships,
  listAllProjects,
  listAllUsers,
  removeAdminJoinRule,
  setUserBlocked,
  type AdminJoinRule,
  type AdminMembershipRow,
  type AdminProjectRow,
  type AdminUserRow,
} from '@/lib/supabase/admin-users'

// Scoped 2026-09-30 via the openlpm-design-session skill -- see
// lab_manager/docs/design-notes/openlpm-system-wide-admin-page-scoping-2026-09-30.md
// for the real decision record (feedback 908d1311). Everything here centralizes
// actions that already existed per-project (dashboard-page.tsx's Members card)
// plus one genuinely new capability: a reversible sign-in lock. Gated the same
// way admin-feedback-page.tsx is -- client-side ADMIN_EMAIL check for what
// renders, migration 049's RLS is the real boundary underneath.

const ROLES: ProjectMemberRole[] = ['owner', 'maintainer', 'editor', 'reviewer', 'contributor', 'viewer']

// Real feedback ede6dade (2026-10-01): "no way to sort between real human
// users and test accounts." A plain heuristic, not a stored flag -- every
// real test/QA account in this app so far (the standing QA account, its
// mailinator throwaways) matches one of these three patterns, and nothing
// real does. Visual grouping only; blocking/deleting still works exactly
// the same regardless of which group an account lands in.
function looksLikeTestAccount(email: string): boolean {
  const lower = email.toLowerCase()
  const [local, domain] = lower.split('@')
  if (!domain) return false
  if (local.includes('+')) return true
  if (domain === 'mailinator.com') return true
  if (/(^|[-_.])(test|qa|nonexistent|dummy)([-_.]|\d|$)/.test(local)) return true
  return false
}

// Same list new-project-wizard.tsx offers at creation time -- kept in sync
// by hand rather than shared, since it's an 8-entry constant, not logic.
const COMMON_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ar', label: 'Arabic' },
]

const EPISTEMIC_STATUS_OPTIONS: { value: AdminProjectRow['epistemic_status']; label: string }[] = [
  { value: 'in-development', label: 'Human-curated — real content, still being built' },
  { value: 'field-validated-curriculum', label: 'Human-curated — already in real classroom use' },
  { value: 'designed-thought-experiment', label: 'Synthetic-theoretical — a designed comparison or research construct' },
]

export default function AdminUsersPage() {
  const { session } = useSession()
  const supabase = useMemo(() => createClient(), [])
  const [users, setUsers] = useState<AdminUserRow[] | null>(null)
  const [memberships, setMemberships] = useState<AdminMembershipRow[] | null>(null)
  const [projects, setProjects] = useState<AdminProjectRow[] | null>(null)
  const [joinRules, setJoinRules] = useState<AdminJoinRule[] | null>(null)
  const [feedback, setFeedback] = useState<FeedbackItem[] | null>(null)

  const isAdmin = session?.user.email === ADMIN_EMAIL

  const reload = () => {
    listAllUsers(supabase).then(setUsers)
    listAllMemberships(supabase).then(setMemberships)
    listAllProjects(supabase).then(setProjects)
    listAllJoinRules(supabase).then(setJoinRules)
    listFeedback(supabase).then(setFeedback)
  }

  useEffect(() => {
    if (!isAdmin) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, isAdmin])

  if (!isAdmin) {
    return (
      <div>
        <h1>Admin</h1>
        <p className="muted">This page isn&apos;t available to your account.</p>
      </div>
    )
  }

  const membershipsByUser = new Map<string, AdminMembershipRow[]>()
  for (const m of memberships ?? []) {
    const list = membershipsByUser.get(m.user_id) ?? []
    list.push(m)
    membershipsByUser.set(m.user_id, list)
  }

  return (
    <div>
      <h1 className="row"><Users size={18} style={{ color: 'var(--text-muted)' }} />Admin</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Every real account and every project across all of OpenLPM, in one place — regardless of
        which projects your own account happens to belong to.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Accounts</h3>
        {users === null || memberships === null ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            {/* Real feedback e1c77a65 (2026-10-01): a 1-row "Quick stats"
                summary for this section, so the overall shape of the user
                base is visible at a glance without reading every row. */}
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              {users.length} account{users.length === 1 ? '' : 's'}
              {' · '}
              {users.filter((u) => u.blocked_at).length} blocked
              {' · '}
              {users.filter((u) => (membershipsByUser.get(u.id) ?? []).length === 0).length} not in any project
            </p>
            {users.filter((u) => !looksLikeTestAccount(u.email)).map((u) => (
              <UserRow
                key={u.id}
                user={u}
                memberships={membershipsByUser.get(u.id) ?? []}
                projects={projects ?? []}
                supabase={supabase}
                isSelf={u.email === ADMIN_EMAIL}
                onChanged={reload}
              />
            ))}
            <TestAccountsSection
              users={users.filter((u) => looksLikeTestAccount(u.email))}
              membershipsByUser={membershipsByUser}
              projects={projects ?? []}
              supabase={supabase}
              onChanged={reload}
            />
          </>
        )}
      </div>

      <ProjectsAdminSection
        supabase={supabase}
        projects={projects}
        memberships={memberships}
        onChanged={reload}
      />

      <JoinRulesAdminSection
        supabase={supabase}
        projects={projects}
        joinRules={joinRules}
        onChanged={reload}
      />

      <FeedbackAdminSection feedback={feedback} />
    </div>
  )
}

// Real feedback ede6dade (2026-10-01): "no way to sort between real human
// users and test accounts." Collapsed by default -- these accounts exist
// on purpose (the standing QA account, this skill's mint_qa_session.mjs
// tooling) but shouldn't compete for attention with the real people above.
function TestAccountsSection({
  users,
  membershipsByUser,
  projects,
  supabase,
  onChanged,
}: {
  users: AdminUserRow[]
  membershipsByUser: Map<string, AdminMembershipRow[]>
  projects: AdminProjectRow[]
  supabase: ReturnType<typeof createClient>
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  if (users.length === 0) return null
  return (
    <div style={{ marginTop: 8 }}>
      <button
        className="btn btn-mini"
        onClick={() => setOpen((v) => !v)}
        style={{ color: 'var(--text-muted)' }}
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        Test &amp; placeholder accounts ({users.length})
      </button>
      {open && (
        <div style={{ marginTop: 6, opacity: 0.75 }}>
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              memberships={membershipsByUser.get(u.id) ?? []}
              projects={projects}
              supabase={supabase}
              isSelf={u.email === ADMIN_EMAIL}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AddToProjectControl({
  user,
  memberships,
  projects,
  supabase,
  onChanged,
}: {
  user: AdminUserRow
  memberships: AdminMembershipRow[]
  projects: AdminProjectRow[]
  supabase: ReturnType<typeof createClient>
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [role, setRole] = useState<ProjectMemberRole>('contributor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const memberProjectIds = new Set(memberships.map((m) => m.project.id))
  const available = projects.filter((p) => !memberProjectIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name))

  if (!adding) {
    return (
      <button className="btn btn-mini" onClick={() => { setAdding(true); setProjectId(available[0]?.id ?? '') }} disabled={available.length === 0}>
        <FolderTree size={10} />Add to project
      </button>
    )
  }

  const confirmAdd = async () => {
    if (!projectId) return
    setBusy(true)
    setError(null)
    const results = await inviteMembers(supabase, projectId, [user.email], role)
    setBusy(false)
    if (results[0]?.outcome === 'error') setError(results[0].detail ?? 'Could not add them.')
    else { setAdding(false); onChanged() }
  }

  return (
    <span className="row" style={{ gap: 4 }}>
      <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ fontSize: 12 }}>
        {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select value={role} onChange={(e) => setRole(e.target.value as ProjectMemberRole)} style={{ fontSize: 12 }}>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button className="btn btn-mini btn-primary" disabled={busy || !projectId} onClick={confirmAdd}>{busy ? 'Adding…' : 'Add'}</button>
      <button className="btn btn-mini" disabled={busy} onClick={() => { setAdding(false); setError(null) }}>Cancel</button>
      {error && <span style={{ color: 'var(--critical)', fontSize: 11 }}>{error}</span>}
    </span>
  )
}

// Real feedback 50fb138d (2026-10-01): "every row for a given user should
// be collapsible (default collapsed)". Collapsed, a row is just name, email,
// blocked status and a membership count -- enough to scan 7+ accounts
// without a wall of per-project chips. Expanding reveals the same controls
// that were always here (block/unblock, per-project role, add to project).
function UserRow({
  user,
  memberships,
  projects,
  supabase,
  isSelf,
  onChanged,
}: {
  user: AdminUserRow
  memberships: AdminMembershipRow[]
  projects: AdminProjectRow[]
  supabase: ReturnType<typeof createClient>
  isSelf: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const blocked = !!user.blocked_at

  const toggleBlocked = async () => {
    setBusy(true)
    await setUserBlocked(supabase, user.id, !blocked)
    setBusy(false)
    onChanged()
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <button
          type="button"
          className="btn-linklike row"
          style={{ gap: 6, textDecoration: 'none', color: 'inherit', flexWrap: 'wrap' }}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={13} style={{ flexShrink: 0 }} /> : <ChevronRight size={13} style={{ flexShrink: 0 }} />}
          <strong>{user.name}</strong>
          <span className="muted">{user.email}</span>
          {blocked && <span className="chip chip-critical">Blocked</span>}
          {!expanded && (
            <span className="muted" style={{ fontSize: 12 }}>
              {memberships.length === 0 ? '· not in any project' : `· ${memberships.length} project${memberships.length === 1 ? '' : 's'}`}
            </span>
          )}
        </button>
        {isSelf ? (
          <span className="muted" style={{ fontSize: 12, flexShrink: 0 }}>This is you</span>
        ) : (
          <button
            className={`btn btn-mini${blocked ? '' : ' btn-danger'}`}
            disabled={busy}
            onClick={toggleBlocked}
            title={blocked ? 'Let them sign in again' : "Block this account from signing in -- reversible, nothing is deleted"}
            style={{ flexShrink: 0 }}
          >
            {blocked ? <UserCheck size={11} /> : <UserX size={11} />}
            {blocked ? 'Unblock' : 'Block'}
          </button>
        )}
      </div>

      {expanded && (
        <>
          {memberships.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Not a member of any project.</p>
          ) : (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {memberships.map((m) => (
                <MembershipChip key={m.id} membership={m} supabase={supabase} onChanged={onChanged} />
              ))}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <AddToProjectControl user={user} memberships={memberships} projects={projects} supabase={supabase} onChanged={onChanged} />
          </div>
        </>
      )}
    </div>
  )
}

function MembershipChip({
  membership,
  supabase,
  onChanged,
}: {
  membership: AdminMembershipRow
  supabase: ReturnType<typeof createClient>
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)

  const changeRole = async (role: ProjectMemberRole) => {
    setBusy(true)
    await updateMemberRole(supabase, membership.id, role)
    setBusy(false)
    onChanged()
  }

  const remove = async () => {
    setBusy(true)
    await removeMember(supabase, membership.id)
    setBusy(false)
    onChanged()
  }

  return (
    <span
      className="row"
      style={{ gap: 4, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
    >
      <Link to={`/dashboard/${membership.project.slug}`}>{membership.project.name}</Link>
      <select
        value={membership.role}
        disabled={busy}
        onChange={(e) => changeRole(e.target.value as ProjectMemberRole)}
        style={{ fontSize: 12 }}
      >
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button className="btn btn-mini btn-danger" disabled={busy} aria-label="Remove from project" title="Remove from project" onClick={remove}>
        <Trash2 size={10} />
      </button>
    </span>
  )
}

// Real feedback 016e4a19 + b1345486 (2026-10-01): "select multiple projects
// and conduct bulk edits across the meta-data of selected projects or
// sub-project spaces (including self-join allow lists)." Design decision
// recorded in lab_manager/docs/design-notes/openlpm-admin-bulk-project-edit-
// 2026-10-01.md -- Dustin chose all four offered fields (privacy, curation
// status, self-join rules, working languages); name/description stay
// single-project-only since a shared value across dissimilar projects isn't
// meaningful.
function ProjectsAdminSection({
  supabase,
  projects,
  memberships,
  onChanged,
}: {
  supabase: ReturnType<typeof createClient>
  projects: AdminProjectRow[] | null
  memberships: AdminMembershipRow[] | null
  onChanged: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkEditing, setBulkEditing] = useState(false)

  const childrenByParent = new Map<string, AdminProjectRow[]>()
  const topLevel: AdminProjectRow[] = []
  for (const p of projects ?? []) {
    if (p.parent_project_id) {
      const list = childrenByParent.get(p.parent_project_id) ?? []
      list.push(p)
      childrenByParent.set(p.parent_project_id, list)
    } else {
      topLevel.push(p)
    }
  }
  const childCountByParent = new Map<string, number>()
  for (const [parentId, kids] of childrenByParent) childCountByParent.set(parentId, kids.length)
  const memberCountByProject = new Map<string, number>()
  for (const m of memberships ?? []) {
    memberCountByProject.set(m.project.id, (memberCountByProject.get(m.project.id) ?? 0) + 1)
  }

  // Curriculum Repositories are a distinct part of the ontology, not just
  // another project space -- real feedback 8e9545c6. Listed in their own
  // group here rather than interleaved into the same tree as ordinary
  // project spaces (project_kind, migration 072).
  const isRepository = (p: AdminProjectRow) => (p as any).project_kind === 'curriculum-repository'
  const repoTopLevel = topLevel.filter(isRepository)
  const standardTopLevel = topLevel.filter((p) => !isRepository(p))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => { setSelectedIds(new Set()); setBulkEditing(false) }
  const selectedProjects = (projects ?? []).filter((p) => selectedIds.has(p.id))
  const repoProjects = (projects ?? []).filter(isRepository)
  const standardProjects = (projects ?? []).filter((p) => !isRepository(p))

  // Real feedback 74e440a3 (2026-10-01): "Curriculum repositories are
  // different than projects even if they share underlying infrastructure --
  // they should be in their own frame." Two separate cards now, not two
  // headings sharing one. Bulk-select/edit stays scoped to real project
  // spaces below -- a curriculum repository's own metadata is edited
  // one-at-a-time via its row, same as before.
  return (
    <>
      {repoTopLevel.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="row"><Library size={16} />Curriculum Repositories</h3>
          <p className="muted" style={{ marginBottom: 12 }}>
            Curated national/regional curriculum-policy source material, kept separate from
            research project spaces below.
          </p>
          <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            {repoProjects.length} repositor{repoProjects.length === 1 ? 'y' : 'ies'}
            {' · '}
            {repoTopLevel.length} top-level
            {' · '}
            {repoProjects.length - repoTopLevel.length} nested
          </p>
          {repoTopLevel.map((p) => (
            <ProjectTreeRow
              key={p.id}
              project={p}
              parentName={null}
              childrenByParent={childrenByParent}
              memberCountByProject={memberCountByProject}
              childCountByParent={childCountByParent}
              supabase={supabase}
              onChanged={onChanged}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              selectable={false}
            />
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="row"><FolderTree size={16} />Projects</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          Every project space across OpenLPM. Deleting one is permanent — everything inside it
          (Learning Goals, Concepts, membership, discussions, and so on) goes with it, with no undo.
          Check any number of projects below to edit their meta-data together.
        </p>
        {projects === null ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            {/* Real feedback e1c77a65 (2026-10-01): same "Quick stats" ask as
                the Accounts section above. */}
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              {standardProjects.length} project{standardProjects.length === 1 ? '' : 's'}
              {' · '}
              {standardTopLevel.length} space{standardTopLevel.length === 1 ? '' : 's'}
              {' · '}
              {standardProjects.length - standardTopLevel.length} sub-project{(standardProjects.length - standardTopLevel.length) === 1 ? '' : 's'}
              {' · '}
              {(memberships ?? []).length} membership{(memberships ?? []).length === 1 ? '' : 's'} total
            </p>

            {selectedIds.size > 0 && (
              <div
                className="row"
                style={{
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  marginBottom: 10,
                  borderRadius: 6,
                  background: 'var(--bg-subtle, transparent)',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 13 }}>
                  <strong>{selectedIds.size}</strong> project{selectedIds.size === 1 ? '' : 's'} selected
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <button className="btn btn-mini btn-primary" onClick={() => setBulkEditing((v) => !v)}>
                    <Pencil size={11} />{bulkEditing ? 'Close bulk edit' : 'Bulk edit selected'}
                  </button>
                  <button className="btn btn-mini" onClick={clearSelection}>Clear selection</button>
                </span>
              </div>
            )}

            {bulkEditing && selectedProjects.length > 0 && (
              <BulkEditPanel
                projects={selectedProjects}
                supabase={supabase}
                onApplied={onChanged}
                onClose={clearSelection}
              />
            )}

            {standardTopLevel.map((p) => (
              <ProjectTreeRow
                key={p.id}
                project={p}
                parentName={null}
                childrenByParent={childrenByParent}
                memberCountByProject={memberCountByProject}
                childCountByParent={childCountByParent}
                supabase={supabase}
                onChanged={onChanged}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            ))}
          </>
        )}
      </div>
    </>
  )
}

// Real feedback b1345486 (2026-10-01): "bulk edits of such meta-data
// (including self-join allow lists) across a selection of project and/or
// sub-project spaces." Privacy/curation status only apply to a top-level
// project space, mirroring ProjectEditForm's own single-project rule (a
// sub-project inherits both from its parent, never edits them independently)
// -- a sub-project in the selection is silently skipped for those two fields
// and counted in the summary. Languages and the self-join rule are always
// additive (never replace a project's existing languages or rules), matching
// how both already work one-at-a-time elsewhere in this app.
function BulkEditPanel({
  projects,
  supabase,
  onApplied,
  onClose,
}: {
  projects: AdminProjectRow[]
  supabase: ReturnType<typeof createClient>
  onApplied: () => void
  onClose: () => void
}) {
  const NO_CHANGE = '__no_change__'
  const [privacyChoice, setPrivacyChoice] = useState<string>(NO_CHANGE)
  const [statusChoice, setStatusChoice] = useState<string>(NO_CHANGE)
  const [addLanguages, setAddLanguages] = useState<Set<string>>(new Set())
  const [customLanguage, setCustomLanguage] = useState('')
  const [addJoinRule, setAddJoinRule] = useState(false)
  const [ruleType, setRuleType] = useState<'domain' | 'email'>('domain')
  const [ruleValue, setRuleValue] = useState('')
  const [ruleRole, setRuleRole] = useState<ProjectMemberRole>('contributor')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [resultHadErrors, setResultHadErrors] = useState(false)

  const subProjectCount = projects.filter((p) => p.parent_project_id).length
  const touchesPrivacyOrStatus = privacyChoice !== NO_CHANGE || statusChoice !== NO_CHANGE

  const toggleLanguage = (code: string) => {
    setAddLanguages((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const hasChanges = touchesPrivacyOrStatus || addLanguages.size > 0 || (addJoinRule && ruleValue.trim().length > 0)

  const apply = async () => {
    setBusy(true)
    setResult(null)
    let metadataUpdated = 0
    let metadataSkipped = 0
    let ruleRowsAdded = 0
    const errors: string[] = []

    for (const project of projects) {
      const isSubProject = !!project.parent_project_id
      const patch: ProjectMetadataPatch = {}
      if (touchesPrivacyOrStatus) {
        if (isSubProject) {
          metadataSkipped += 1
        } else {
          if (privacyChoice !== NO_CHANGE) patch.is_private = privacyChoice === 'private'
          if (statusChoice !== NO_CHANGE) patch.epistemic_status = statusChoice as AdminProjectRow['epistemic_status']
        }
      }
      if (addLanguages.size > 0) {
        const merged = new Set([...(project.working_languages ?? []), ...addLanguages])
        patch.working_languages = Array.from(merged)
      }
      if (Object.keys(patch).length > 0) {
        const { error } = await updateProjectMetadata(supabase, project.id, patch)
        if (error) errors.push(`${project.name}: ${error.message}`)
        else metadataUpdated += 1
      }
      if (addJoinRule && ruleValue.trim()) {
        const { error } = await addAdminJoinRule(supabase, project.id, ruleType, ruleValue, ruleRole)
        if (error) errors.push(`${project.name} (self-join rule): ${error.message}`)
        else ruleRowsAdded += 1
      }
    }

    setBusy(false)
    const parts: string[] = []
    if (metadataUpdated > 0) parts.push(`${metadataUpdated} project${metadataUpdated === 1 ? '' : 's'} updated`)
    if (metadataSkipped > 0) parts.push(`${metadataSkipped} sub-project${metadataSkipped === 1 ? '' : 's'} skipped for privacy/curation status (inherited from parent)`)
    if (ruleRowsAdded > 0) parts.push(`self-join rule added to ${ruleRowsAdded} project${ruleRowsAdded === 1 ? '' : 's'}`)
    if (errors.length > 0) parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}: ${errors.join('; ')}`)
    setResult(parts.join(' · ') || 'Nothing to apply.')
    setResultHadErrors(errors.length > 0)
    // Reload the underlying project list right away (so it reflects the
    // change even while this panel's summary is still showing), but leave
    // the panel itself open until the user dismisses it -- closing
    // immediately would unmount this summary before anyone could read it.
    onApplied()
  }

  return (
    <div className="card" style={{ marginBottom: 12, background: 'var(--bg-subtle, transparent)' }}>
      <h4 style={{ marginTop: 0 }}>Bulk edit {projects.length} project{projects.length === 1 ? '' : 's'}</h4>
      <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        {projects.map((p) => p.name).join(', ')}
      </p>
      {subProjectCount > 0 && (
        <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          {subProjectCount} of these {subProjectCount === 1 ? 'is a sub-project' : 'are sub-projects'} — privacy and
          curation status are inherited from a sub-project&apos;s parent space, so any change to those two fields
          below will skip {subProjectCount === 1 ? 'it' : 'them'}. Languages and self-join rules still apply.
        </p>
      )}

      <div className="field">
        <label>Public / Private</label>
        <select value={privacyChoice} onChange={(e) => setPrivacyChoice(e.target.value)}>
          <option value={NO_CHANGE}>Don&apos;t change</option>
          <option value="private">Make private</option>
          <option value="public">Make public</option>
        </select>
      </div>

      <div className="field">
        <label>Curation status</label>
        <select value={statusChoice} onChange={(e) => setStatusChoice(e.target.value)}>
          <option value={NO_CHANGE}>Don&apos;t change</option>
          {EPISTEMIC_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Add working language(s)</label>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {COMMON_LANGUAGES.map((l) => (
            <label key={l.code} className="row" style={{ gap: 4 }}>
              <input type="checkbox" checked={addLanguages.has(l.code)} onChange={() => toggleLanguage(l.code)} />
              {l.label}
            </label>
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <input value={customLanguage} onChange={(e) => setCustomLanguage(e.target.value)} placeholder="Other language code, e.g. sw, hi" style={{ width: 200 }} />
          <button type="button" className="btn btn-mini" onClick={() => { if (customLanguage.trim()) { toggleLanguage(customLanguage.trim()); setCustomLanguage('') } }}>
            Add
          </button>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
          Only adds — a project&apos;s existing languages are never removed by this.
        </p>
      </div>

      <div className="field">
        <label className="row" style={{ gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={addJoinRule} onChange={(e) => setAddJoinRule(e.target.checked)} />
          Add a self-join rule to all selected projects
        </label>
        {addJoinRule && (
          <div className="row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
            <select value={ruleType} onChange={(e) => setRuleType(e.target.value as 'domain' | 'email')} style={{ fontSize: 12 }}>
              <option value="domain">Email domain</option>
              <option value="email">Specific email</option>
            </select>
            <input
              type="text"
              placeholder={ruleType === 'domain' ? 'uni-jena.de' : 'someone@example.org'}
              value={ruleValue}
              onChange={(e) => setRuleValue(e.target.value)}
              style={{ width: 200 }}
            />
            <select value={ruleRole} onChange={(e) => setRuleRole(e.target.value as ProjectMemberRole)} style={{ fontSize: 12 }}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}
        <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
          Added on top of whatever self-join rules each project already has — nothing existing is removed.
        </p>
      </div>

      {result && <div className={`notice ${resultHadErrors ? 'notice-bad' : 'notice-ok'}`} style={{ marginBottom: 8 }}>{result}</div>}

      <div className="row">
        {result ? (
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        ) : (
          <>
            <button className="btn btn-primary" disabled={busy || !hasChanges} onClick={apply}>
              {busy ? 'Applying…' : `Apply to ${projects.length} project${projects.length === 1 ? '' : 's'}`}
            </button>
            <button className="btn btn-mini" disabled={busy} onClick={onClose}>Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}

// Real feedback 391551b6 (2026-10-01): "show sub-projects as nested under
// a (collapsible) project row -- using subtle color and indent to clarify
// the structures." Wraps ProjectRow (unchanged) with an indented,
// collapsible block of its own children, recursing in case a sub-project
// ever has children of its own (the schema doesn't forbid it, even though
// every real project today is only one level deep).
function ProjectTreeRow({
  project,
  parentName,
  childrenByParent,
  memberCountByProject,
  childCountByParent,
  supabase,
  onChanged,
  selectedIds,
  onToggleSelect,
  selectable = true,
}: {
  project: AdminProjectRow
  parentName: string | null
  childrenByParent: Map<string, AdminProjectRow[]>
  memberCountByProject: Map<string, number>
  childCountByParent: Map<string, number>
  supabase: ReturnType<typeof createClient>
  onChanged: () => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  selectable?: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const children = childrenByParent.get(project.id) ?? []
  const tint = projectColorTint((project as any).color)

  return (
    <div>
      <div className="row" style={{ alignItems: 'flex-start', gap: 4 }}>
        {selectable ? (
          <input
            type="checkbox"
            checked={selectedIds.has(project.id)}
            onChange={() => onToggleSelect(project.id)}
            aria-label={`Select ${project.name} for bulk edit`}
            style={{ marginTop: 12, flexShrink: 0 }}
          />
        ) : (
          <span style={{ width: 13, flexShrink: 0 }} />
        )}
        {children.length > 0 ? (
          <button
            type="button"
            className="btn-linklike"
            style={{ marginTop: 10, flexShrink: 0 }}
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? 'Collapse sub-projects' : 'Expand sub-projects'}
            title={expanded ? 'Collapse sub-projects' : 'Expand sub-projects'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <ProjectRow
            project={project}
            parentName={parentName}
            memberCount={memberCountByProject.get(project.id) ?? 0}
            childCount={childCountByParent.get(project.id) ?? 0}
            supabase={supabase}
            onChanged={onChanged}
          />
        </div>
      </div>

      {expanded && children.length > 0 && (
        <div
          style={{
            marginLeft: 26,
            paddingLeft: 12,
            paddingTop: 6,
            paddingBottom: 2,
            borderLeft: `2px solid ${projectColorHex((project as any).color) ?? 'var(--series-a, var(--border))'}`,
            borderRadius: '0 6px 6px 0',
            background: tint ?? 'var(--bg-subtle, transparent)',
          }}
        >
          {children.map((c) => (
            <ProjectTreeRow
              key={c.id}
              project={c}
              parentName={project.name}
              childrenByParent={childrenByParent}
              memberCountByProject={memberCountByProject}
              childCountByParent={childCountByParent}
              supabase={supabase}
              onChanged={onChanged}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              selectable={selectable}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectEditForm({
  project,
  isSpace,
  supabase,
  onSaved,
  onCancel,
}: {
  project: AdminProjectRow
  isSpace: boolean
  supabase: ReturnType<typeof createClient>
  onSaved: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [epistemicStatus, setEpistemicStatus] = useState(project.epistemic_status)
  const [isPrivate, setIsPrivate] = useState(project.is_private)
  const [languages, setLanguages] = useState<Set<string>>(new Set(project.working_languages ?? []))
  const [customLanguage, setCustomLanguage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleLanguage = (code: string) => {
    setLanguages((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    const patch: ProjectMetadataPatch = {
      name: name.trim(),
      description: description.trim() || null,
      working_languages: Array.from(languages),
      ...(isSpace ? { epistemic_status: epistemicStatus, is_private: isPrivate } : {}),
    }
    const { error: err } = await updateProjectMetadata(supabase, project.id, patch)
    setBusy(false)
    if (err) setError(err.message)
    else onSaved()
  }

  return (
    <div className="card" style={{ marginTop: 8, background: 'var(--bg-subtle, transparent)' }}>
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this for?" />
      </div>

      {isSpace ? (
        <>
          <div className="field">
            <label>Is this real, human-curated curriculum content, or a synthetic/theoretical construct?</label>
            <select value={epistemicStatus} onChange={(e) => setEpistemicStatus(e.target.value as AdminProjectRow['epistemic_status'])}>
              {EPISTEMIC_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="row" style={{ gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              Private — only members can see this project exists
            </label>
          </div>
        </>
      ) : (
        <p className="muted" style={{ fontSize: 12 }}>
          Curation status and privacy are inherited from this project&apos;s parent space — edit those there.
        </p>
      )}

      <div className="field">
        <label>Languages</label>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {COMMON_LANGUAGES.map((l) => (
            <label key={l.code} className="row" style={{ gap: 4 }}>
              <input type="checkbox" checked={languages.has(l.code)} onChange={() => toggleLanguage(l.code)} />
              {l.label}
            </label>
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <input value={customLanguage} onChange={(e) => setCustomLanguage(e.target.value)} placeholder="Other language code, e.g. sw, hi" style={{ width: 200 }} />
          <button type="button" className="btn btn-mini" onClick={() => { if (customLanguage.trim()) { toggleLanguage(customLanguage.trim()); setCustomLanguage('') } }}>
            Add
          </button>
        </div>
        {Array.from(languages).filter((c) => !COMMON_LANGUAGES.some((l) => l.code === c)).length > 0 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Also added: {Array.from(languages).filter((c) => !COMMON_LANGUAGES.some((l) => l.code === c)).join(', ')}
          </p>
        )}
      </div>

      {error && <div className="notice notice-bad" style={{ marginBottom: 8 }}>{error}</div>}

      <div className="row">
        <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={save}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button className="btn btn-mini" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function ProjectRow({
  project,
  parentName,
  memberCount,
  childCount,
  supabase,
  onChanged,
}: {
  project: AdminProjectRow
  parentName: string | null
  memberCount: number
  childCount: number
  supabase: ReturnType<typeof createClient>
  onChanged: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [typedSlug, setTypedSlug] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancel = () => {
    setConfirming(false)
    setTypedSlug('')
    setError(null)
  }

  const confirmDelete = async () => {
    if (typedSlug.trim() !== project.slug) return
    setBusy(true)
    setError(null)
    const { error: err } = await deleteProject(supabase, project.id)
    setBusy(false)
    if (err) setError(err.message)
    else onChanged()
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span>
          <Link to={`/dashboard/${project.slug}`}><strong>{project.name}</strong></Link>
          <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>{project.slug}</span>
          {project.is_private && <span className="chip" style={{ marginLeft: 6 }}><Lock size={10} />Private</span>}
          {parentName && <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>Inside {parentName}</span>}
          <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>
            {memberCount} member{memberCount === 1 ? '' : 's'}
            {childCount > 0 ? `, ${childCount} sub-project${childCount === 1 ? '' : 's'}` : ''}
          </span>
        </span>
        {!confirming && (
          <span className="row" style={{ gap: 6 }}>
            <button className="btn btn-mini" onClick={() => setEditing((e) => !e)}>
              <Pencil size={11} />{editing ? 'Close' : 'Edit'}
            </button>
            <button className="btn btn-mini btn-danger" onClick={() => setConfirming(true)} disabled={childCount > 0}
              title={childCount > 0 ? 'Delete or move its sub-projects first' : 'Permanently delete this project'}>
              <Trash2 size={11} />Delete
            </button>
          </span>
        )}
      </div>

      {editing && !confirming && (
        <ProjectEditForm
          project={project}
          isSpace={!project.parent_project_id}
          supabase={supabase}
          onSaved={() => { setEditing(false); onChanged() }}
          onCancel={() => setEditing(false)}
        />
      )}

      {childCount > 0 && !confirming && (
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Has {childCount} sub-project{childCount === 1 ? '' : 's'} — delete or move {childCount === 1 ? 'it' : 'those'} first.
        </p>
      )}

      {confirming && (
        <div className="notice notice-bad" style={{ marginTop: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0 }}>
              This permanently deletes <strong>{project.name}</strong> and everything in it —
              Learning Goals, Concepts, Theories, Strands, Literature, discussions, and all
              {memberCount === 1 ? ' 1 membership' : ` ${memberCount} memberships`}. This cannot be undone.
            </p>
            <p style={{ margin: '6px 0 4px' }}>Type <strong>{project.slug}</strong> to confirm:</p>
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
              <button className="btn btn-mini" onClick={cancel} disabled={busy}>Cancel</button>
            </div>
            {error && <p style={{ margin: '6px 0 0', color: 'var(--critical)' }}>{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function JoinRulesAdminSection({
  supabase,
  projects,
  joinRules,
  onChanged,
}: {
  supabase: ReturnType<typeof createClient>
  projects: AdminProjectRow[] | null
  joinRules: AdminJoinRule[] | null
  onChanged: () => void
}) {
  const [projectId, setProjectId] = useState('')
  const [ruleType, setRuleType] = useState<'domain' | 'email'>('domain')
  const [value, setValue] = useState('')
  const [role, setRole] = useState<ProjectMemberRole>('contributor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId && projects && projects.length > 0) setProjectId(projects[0].id)
  }, [projects, projectId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId) return
    setBusy(true)
    setError(null)
    const { error } = await addAdminJoinRule(supabase, projectId, ruleType, value, role)
    setBusy(false)
    if (error) setError(error.message)
    else {
      setValue('')
      onChanged()
    }
  }

  const remove = async (rule: AdminJoinRule) => {
    await removeAdminJoinRule(supabase, rule.id)
    onChanged()
  }

  return (
    <div className="card">
      <h3 className="row"><ShieldAlert size={16} />Self-join allow-lists</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        Every project&apos;s self-join rules (who can join automatically by email or school domain), in one place
        instead of opening each project&apos;s own settings.
      </p>

      <form onSubmit={submit} className="row" style={{ marginBottom: 12 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Type</label>
          <select value={ruleType} onChange={(e) => setRuleType(e.target.value as 'domain' | 'email')}>
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
        <button className="btn btn-primary" type="submit" disabled={busy || !projectId || !value.trim()} style={{ alignSelf: 'flex-end' }}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
      {error && <div className="notice notice-bad" style={{ marginBottom: 8 }}>{error}</div>}

      {joinRules === null ? (
        <p className="muted">Loading…</p>
      ) : joinRules.length === 0 ? (
        <p className="muted">No self-join rules anywhere yet.</p>
      ) : (
        joinRules.map((r) => (
          <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="row">
              {r.rule_type === 'domain' ? <Globe size={13} /> : <Mail size={13} />}
              {r.rule_type === 'domain' ? `Anyone @${r.value}` : r.value}
              <Link to={`/dashboard/${r.project.slug}`} className="muted" style={{ marginLeft: 6 }}>{r.project.name}</Link>
            </span>
            <span className="row">
              <span className="chip capitalize">{r.role}</span>
              <button className="btn btn-mini" onClick={() => remove(r)}><Trash2 size={11} />Remove</button>
            </span>
          </div>
        ))
      )}
    </div>
  )
}

// Real feedback c0829815 (2026-10-01): "Move 'Feedback' on the header
// menu into a section on the Admin page - also with its own short
// dashboard e.g. # open, # resolved total, graph of # open/resolved over
// last 6 months." The full feedback list + resolve/reopen UI stays
// exactly where it already lives (admin-feedback-page.tsx, unchanged) --
// this is just the entry point + the real quick-look dashboard, replacing
// the topbar's own direct link (dashboard-layout.tsx).
// Catmull-Rom -> cubic Bezier, for a smoothed line through a set of points
// without pulling in a charting library -- this app hand-rolls every chart.
function smoothedPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

// Real feedback c0829815 (2026-10-01): "Move 'Feedback' on the header
// menu into a section on the Admin page - also with its own short
// dashboard e.g. # open, # resolved total, graph of # open/resolved over
// last 6 months." The full feedback list + resolve/reopen UI stays
// exactly where it already lives (admin-feedback-page.tsx, unchanged) --
// this is just the entry point + the real quick-look dashboard, replacing
// the topbar's own direct link (dashboard-layout.tsx).
//
// Real feedback 54f91ed0 (2026-10-01): "use something better than bar
// charts - like semi-transparent heavily smoothed line charts... maybe
// have higher resolution, like at least by week." Weekly buckets (26 of
// them for 6 months) instead of monthly, two smoothed lines with a
// semi-transparent fill under each instead of stacked bars. Bucketed the
// same way the old chart was: by each item's created_at falling in that
// week, split by its CURRENT status -- this app doesn't record a
// resolved_at, so "resolved" means "created in that week, already
// resolved by now," same meaning the bar chart used, just redrawn.
function FeedbackAdminSection({ feedback }: { feedback: FeedbackItem[] | null }) {
  const openCount = (feedback ?? []).filter((f) => f.status === 'open').length
  const resolvedCount = (feedback ?? []).filter((f) => f.status === 'resolved').length

  // 26 weeks (~6 months), oldest first, each a Monday-start 7-day window
  // ending today for the most recent bucket.
  const WEEKS = 26
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const end = new Date(today)
    end.setDate(end.getDate() - (WEEKS - 1 - i) * 7)
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    return { start, end, label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
  })
  const buckets = weeks.map(({ start, end, label }) => {
    const inWeek = (feedback ?? []).filter((f) => {
      const c = new Date(f.created_at)
      return c >= start && c <= end
    })
    return {
      label,
      open: inWeek.filter((f) => f.status === 'open').length,
      resolved: inWeek.filter((f) => f.status === 'resolved').length,
    }
  })
  const maxValue = Math.max(1, ...buckets.map((b) => Math.max(b.open, b.resolved)))

  // Plot geometry: a 0-600 x 0-100 viewBox, y grows downward so invert.
  const W = 600
  const H = 100
  const stepX = W / (buckets.length - 1)
  const toY = (v: number) => H - (v / maxValue) * (H - 6) - 2
  const openPoints = buckets.map((b, i) => ({ x: i * stepX, y: toY(b.open) }))
  const resolvedPoints = buckets.map((b, i) => ({ x: i * stepX, y: toY(b.resolved) }))
  const openPath = smoothedPath(openPoints)
  const resolvedPath = smoothedPath(resolvedPoints)
  const openArea = `${openPath} L ${W} ${H} L 0 ${H} Z`
  const resolvedArea = `${resolvedPath} L ${W} ${H} L 0 ${H} Z`
  // Every 4th week labeled (~monthly) so the axis doesn't crowd.
  const labeledEvery = 4

  return (
    <div className="card">
      <h3 className="row"><MessageSquareText size={16} />Feedback</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        Every real submission from the in-app Feedback button, across every project.
      </p>

      {feedback === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="bk-stat-tiles" style={{ marginBottom: 16 }}>
            <div className="bk-stat-tile">
              <div className="n">{openCount}</div>
              <div className="l">Open</div>
            </div>
            <div className="bk-stat-tile">
              <div className="n">{resolvedCount}</div>
              <div className="l">Resolved total</div>
            </div>
            <div className="bk-stat-tile">
              <div className="n">{(feedback ?? []).length}</div>
              <div className="l">All-time total</div>
            </div>
          </div>

          <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Last 6 months, by week -- open vs. resolved</p>
          <svg viewBox={`0 0 ${W} ${H + 16}`} style={{ width: '100%', height: 110 }} role="img" aria-label="Feedback submitted per week, open vs. resolved, last 6 months">
            <line x1={0} y1={H} x2={W} y2={H} stroke="var(--border)" strokeWidth={1} />
            <path d={openArea} fill="var(--warning)" fillOpacity={0.12} stroke="none" />
            <path d={resolvedArea} fill="var(--good)" fillOpacity={0.12} stroke="none" />
            {/* Open: dashed stroke -- a secondary, non-color cue from Resolved's solid line, since amber/green sit close together for red-green color blindness. */}
            <path d={openPath} fill="none" stroke="var(--warning)" strokeWidth={2} strokeDasharray="5 3" strokeLinecap="round" />
            <path d={resolvedPath} fill="none" stroke="var(--good)" strokeWidth={2} strokeLinecap="round" />
            {buckets.map((b, i) => (
              <g key={`hit-${i}`}>
                <circle cx={i * stepX} cy={toY(b.open)} r={7} fill="transparent"><title>{`${b.label}: ${b.open} open`}</title></circle>
                <circle cx={i * stepX} cy={toY(b.resolved)} r={7} fill="transparent"><title>{`${b.label}: ${b.resolved} resolved`}</title></circle>
              </g>
            ))}
            {buckets.map((b, i) => (
              i % labeledEvery === 0 && (
                <text key={`lbl-${i}`} x={i * stepX} y={H + 13} fontSize={9} fill="var(--text-muted)" textAnchor="middle">{b.label}</text>
              )
            ))}
          </svg>
          <div className="row" style={{ gap: 14, fontSize: 11.5, marginTop: 4, marginBottom: 14 }}>
            <span className="row" style={{ gap: 4 }}>
              <svg width={14} height={9}><line x1={0} y1={4.5} x2={14} y2={4.5} stroke="var(--warning)" strokeWidth={2} strokeDasharray="4 2.5" /></svg>
              Open
            </span>
            <span className="row" style={{ gap: 4 }}>
              <svg width={14} height={9}><line x1={0} y1={4.5} x2={14} y2={4.5} stroke="var(--good)" strokeWidth={2} /></svg>
              Resolved
            </span>
          </div>
        </>
      )}

      <Link to="/dashboard/admin/feedback" className="btn btn-mini">
        <MessageSquareText size={12} />
        Open full feedback list
      </Link>
    </div>
  )
}
