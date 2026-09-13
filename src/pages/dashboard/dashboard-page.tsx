import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, BookOpen, Clock, FileText, FolderKanban, Mail, MessageSquare, Trash2, UserPlus, Users } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { describeActivity, listRecentActivity, type ActivityEntry } from '@/lib/supabase/activity'
import { EpistemicStatusBadge } from '@/components/epistemic-status-badge'
import { MaturityBadge } from '@/components/maturity-badge'
import { WorkingLanguagesTag } from '@/components/working-languages-tag'
import {
  inviteMembers,
  listMembers,
  listPendingInvites,
  removeMember,
  revokeInvite,
  updateMemberRole,
  type InviteResult,
  type InviteRow,
  type MemberWithUser,
  type ProjectMemberRole,
} from '@/lib/supabase/members'

// 2026-09-13 restructure: renamed from "Overview," folding in the former
// standalone Projects and Members tabs (per Dustin's explicit instruction)
// plus a new "needs attention" digest built from tables that already exist.
// An editable multi-language intro/overview text block is planned (RFC-0005's
// content_translations pattern) but not built in this pass -- it needs its
// own small schema addition beyond what this restructure already has queued.

type CountTable = 'literature_references' | 'lpm_schema_elements' | 'lpm_data_objects' | 'discussion_topics'
type Project = Database['public']['Tables']['projects']['Row']
const ROLES: ProjectMemberRole[] = ['owner', 'maintainer', 'editor', 'reviewer', 'contributor', 'viewer']

async function countFor(supabase: ProjectOutletContext['supabase'], table: CountTable, projectId: string) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('project_id', projectId)
  return count ?? 0
}

export default function DashboardPage() {
  const { project, role, supabase } = useOutletContext<ProjectOutletContext>()
  const [counts, setCounts] = useState<[number, number, number, number] | null>(null)
  const [pendingReviews, setPendingReviews] = useState<number | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null)
  const [maturity, setMaturity] = useState(project.maturity)
  const [busy, setBusy] = useState(false)

  const canManage = role === 'owner' || role === 'maintainer'

  useEffect(() => {
    setCounts(null)
    Promise.all([
      countFor(supabase, 'literature_references', project.id),
      countFor(supabase, 'lpm_schema_elements', project.id),
      countFor(supabase, 'lpm_data_objects', project.id),
      countFor(supabase, 'discussion_topics', project.id),
    ]).then((c) => setCounts(c as [number, number, number, number]))
  }, [supabase, project.id])

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

  const stats = [
    { label: 'Papers and sources', count: counts?.[0] ?? 0, icon: BookOpen },
    { label: 'Concepts', count: counts?.[1] ?? 0, icon: FileText },
    { label: 'Learning goals', count: counts?.[2] ?? 0, icon: FileText },
    { label: 'Discussion topics', count: counts?.[3] ?? 0, icon: MessageSquare },
  ]

  return (
    <div>
      <h1>{project.name}</h1>
      <p className="muted" style={{ marginBottom: 8 }}>{project.description}</p>

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
            <div style={{ fontSize: 24, fontWeight: 700 }}>{counts === null ? '—' : count}</div>
          </div>
        ))}
      </div>

      <ProjectsSection project={project} canManage={canManage} supabase={supabase} />
      <MembersSection project={project} role={role} supabase={supabase} />

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
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  const reload = async () => {
    const { data } = await supabase.from('projects').select('*').eq('parent_project_id', project.id).order('created_at', { ascending: true })
    setChildren(data ?? [])
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  const createProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setBusy(true); setNotice(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const newSlug = String(formData.get('slug') ?? '').trim()
    const name = String(formData.get('name') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim() || null
    const focusType = String(formData.get('focus_type') ?? 'general') as Project['focus_type']

    if (!newSlug || !name) { setBusy(false); return }

    const { error } = await supabase.from('projects').insert({
      slug: newSlug,
      name,
      description,
      focus_type: focusType,
      maturity: 'draft',
      epistemic_status: project.epistemic_status,
      parent_project_id: project.id,
      created_by: user?.id ?? null,
    })

    if (error) setNotice({ kind: 'bad', text: error.message })
    else { setNotice({ kind: 'ok', text: `Started "${name}" as a new project in ${project.name}.` }); e.currentTarget.reset(); await reload() }
    setBusy(false)
  }

  return (
    <>
      <h2 className="row" style={{ marginTop: 8 }}><FolderKanban size={16} style={{ color: 'var(--text-muted)' }} />Projects in this Space</h2>
      <p className="muted" style={{ marginBottom: 12 }}>
        Real efforts inside {project.name} — some fully proven, some still early drafts.
      </p>

      {notice && (
        <div className={`notice notice-${notice.kind}`}>
          {notice.text}
        </div>
      )}

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

      {canManage && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Start a new project</h3>
          <p className="muted">
            Shares nothing automatically — a new project starts empty and marked as a draft.
          </p>
          <form onSubmit={createProject} className="grid grid-2">
            <div className="field">
              <label>Short address</label>
              <input name="slug" placeholder="e.g. evomentor-france" required />
            </div>
            <div className="field">
              <label>Name</label>
              <input name="name" placeholder="e.g. EvoMentor France" required />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <input name="description" placeholder="What is this for?" />
            </div>
            <div className="field">
              <label>What kind of project is this?</label>
              <select name="focus_type" defaultValue="general">
                <option value="general">General</option>
                <option value="regional">A specific region or jurisdiction</option>
                <option value="thematic">A specific theme or topic</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>Start it</button>
            </div>
          </form>
        </div>
      )}
    </>
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
}: {
  project: Database['public']['Tables']['projects']['Row']
  role: ProjectOutletContext['role']
  supabase: ProjectOutletContext['supabase']
}) {
  const [members, setMembers] = useState<MemberWithUser[] | null>(null)
  const [invites, setInvites] = useState<InviteRow[] | null>(null)
  const canManage = role === 'owner' || role === 'maintainer'

  const reload = () => {
    listMembers(supabase, project.id).then(setMembers)
    if (canManage) listPendingInvites(supabase, project.id).then(setInvites)
  }

  useEffect(() => {
    setMembers(null)
    setInvites(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  return (
    <>
      <h2 className="row" style={{ marginTop: 8 }}><Users size={16} style={{ color: 'var(--text-muted)' }} />Members</h2>
      <p className="muted" style={{ marginBottom: 12 }}>Who can see and work on {project.name}.</p>

      {canManage && <InviteForm projectId={project.id} supabase={supabase} onInvited={reload} />}

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
              </span>
              {canManage ? (
                <span className="row">
                  <select value={m.role} onChange={(e) => updateMemberRole(supabase, m.id, e.target.value as ProjectMemberRole).then(reload)}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button className="btn btn-mini btn-danger" onClick={() => removeMember(supabase, m.id).then(reload)}><Trash2 size={11} /></button>
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
