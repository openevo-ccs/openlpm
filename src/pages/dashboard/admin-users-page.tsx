import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, FolderTree, Globe, Lock, Mail, ShieldAlert, Trash2, UserCheck, Users, UserX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import { ADMIN_EMAIL } from '@/lib/admin'
import { removeMember, updateMemberRole, type ProjectMemberRole } from '@/lib/supabase/members'
import { deleteProject } from '@/lib/supabase/projects'
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

export default function AdminUsersPage() {
  const { session } = useSession()
  const supabase = useMemo(() => createClient(), [])
  const [users, setUsers] = useState<AdminUserRow[] | null>(null)
  const [memberships, setMemberships] = useState<AdminMembershipRow[] | null>(null)
  const [projects, setProjects] = useState<AdminProjectRow[] | null>(null)
  const [joinRules, setJoinRules] = useState<AdminJoinRule[] | null>(null)

  const isAdmin = session?.user.email === ADMIN_EMAIL

  const reload = () => {
    listAllUsers(supabase).then(setUsers)
    listAllMemberships(supabase).then(setMemberships)
    listAllProjects(supabase).then(setProjects)
    listAllJoinRules(supabase).then(setJoinRules)
  }

  useEffect(() => {
    if (!isAdmin) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, isAdmin])

  if (!isAdmin) {
    return (
      <div>
        <h1>Users</h1>
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
      <h1 className="row"><Users size={18} style={{ color: 'var(--text-muted)' }} />Users</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Every real account across OpenLPM, which project(s) they&apos;re in, and what role they hold in each.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Accounts</h3>
        {users === null || memberships === null ? (
          <p className="muted">Loading…</p>
        ) : (
          users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              memberships={membershipsByUser.get(u.id) ?? []}
              supabase={supabase}
              isSelf={u.email === ADMIN_EMAIL}
              onChanged={reload}
            />
          ))
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
    </div>
  )
}

function UserRow({
  user,
  memberships,
  supabase,
  isSelf,
  onChanged,
}: {
  user: AdminUserRow
  memberships: AdminMembershipRow[]
  supabase: ReturnType<typeof createClient>
  isSelf: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
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
        <span>
          <strong>{user.name}</strong>
          <span className="muted" style={{ marginLeft: 6 }}>{user.email}</span>
          {blocked && <span className="chip chip-critical" style={{ marginLeft: 6 }}>Blocked</span>}
        </span>
        {isSelf ? (
          <span className="muted" style={{ fontSize: 12 }}>This is you</span>
        ) : (
          <button
            className={`btn btn-mini${blocked ? '' : ' btn-danger'}`}
            disabled={busy}
            onClick={toggleBlocked}
            title={blocked ? 'Let them sign in again' : "Block this account from signing in -- reversible, nothing is deleted"}
          >
            {blocked ? <UserCheck size={11} /> : <UserX size={11} />}
            {blocked ? 'Unblock' : 'Block'}
          </button>
        )}
      </div>

      {memberships.length === 0 ? (
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Not a member of any project.</p>
      ) : (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {memberships.map((m) => (
            <MembershipChip key={m.id} membership={m} supabase={supabase} onChanged={onChanged} />
          ))}
        </div>
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
  const childCountByParent = new Map<string, number>()
  for (const p of projects ?? []) {
    if (!p.parent_project_id) continue
    childCountByParent.set(p.parent_project_id, (childCountByParent.get(p.parent_project_id) ?? 0) + 1)
  }
  const memberCountByProject = new Map<string, number>()
  for (const m of memberships ?? []) {
    memberCountByProject.set(m.project.id, (memberCountByProject.get(m.project.id) ?? 0) + 1)
  }
  const parentNameById = new Map((projects ?? []).map((p) => [p.id, p.name]))

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 className="row"><FolderTree size={16} />Projects</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        Every project space across OpenLPM. Deleting one is permanent — everything inside it
        (Learning Goals, Concepts, membership, discussions, and so on) goes with it, with no undo.
      </p>
      {projects === null ? (
        <p className="muted">Loading…</p>
      ) : (
        projects.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            parentName={p.parent_project_id ? parentNameById.get(p.parent_project_id) ?? null : null}
            memberCount={memberCountByProject.get(p.id) ?? 0}
            childCount={childCountByParent.get(p.id) ?? 0}
            supabase={supabase}
            onChanged={onChanged}
          />
        ))
      )}
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
          <button className="btn btn-mini btn-danger" onClick={() => setConfirming(true)} disabled={childCount > 0}
            title={childCount > 0 ? 'Delete or move its sub-projects first' : 'Permanently delete this project'}>
            <Trash2 size={11} />Delete
          </button>
        )}
      </div>

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
