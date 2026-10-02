import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { AlertTriangle, Check, Copy, Globe, Mail, Trash2, UserPlus, Users } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { countSubProjects, deleteProject } from '@/lib/supabase/projects'
import {
  addJoinRule,
  inviteMembers,
  listJoinRules,
  listMembers,
  listPendingInvites,
  removeJoinRule,
  removeMember,
  revokeInvite,
  updateMemberRole,
  type InviteResult,
  type InviteRow,
  type JoinRule,
  type JoinRuleType,
  type MemberWithUser,
  type ProjectMemberRole,
} from '@/lib/supabase/members'
import { STUDENT_VIEW_TEMPLATES } from '@/lib/student-view-templates'
import { PROJECT_COLORS } from '@/lib/project-colors'
import { groupsSettings, setGroupCreatorRoles, setGroupsEnabled } from '@/lib/supabase/groups'

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

  return (
    <div>
      <h1>Settings</h1>
      <p className="muted" style={{ marginBottom: 20 }}>Manage {project.name} — color, members, who can join, and more.</p>

      {canManage && <ProjectColorSection project={project} supabase={supabase} />}
      <MembersSection project={project} role={role} supabase={supabase} />
      {canManage && <GroupsSettingsSection project={project} supabase={supabase} />}
      {role === 'owner' && <DangerZoneSection project={project} supabase={supabase} />}
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
      {canManage && <JoinRulesSection project={project} supabase={supabase} />}
      {canManage && <StudentViewSection project={project} supabase={supabase} />}

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
// Project color (migration 064) -- a small fixed palette, not a free
// picker, shown as a subtle left-border accent on this project's own card
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
// Student view template (migration 045) -- a real, separate setting from
// self-join above. Real bug found live 2026-09-30: "Preview as student"
// used to appear on every project any owner manages and always rendered
// the same German Jena-pilot UI, because the student view was gated purely
// on the VIEWER's role, never on whether THIS project actually opted into
// one. An owner now explicitly turns this on here and picks which
// template -- "none" is the correct default for every project that isn't
// the Jena pilot.
// ============================================================================

function StudentViewSection({
  project,
  supabase,
}: {
  project: Database['public']['Tables']['projects']['Row']
  supabase: ProjectOutletContext['supabase']
}) {
  // student_view_template (migration 045) isn't in the generated types yet.
  const [value, setValue] = useState<string>((project as any).student_view_template ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async (next: string) => {
    setValue(next)
    setBusy(true)
    setSaved(false)
    const { error } = await (supabase as any)
      .from('projects')
      .update({ student_view_template: next || null })
      .eq('id', project.id)
    setBusy(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Student view</h3>
      <p className="muted">
        A simplified, language-adapted view for people who join this specific project space themselves.
        Off by default — turning it on doesn&apos;t change who can join, only what they see once they&apos;re in.
      </p>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Template</label>
        <select value={value} disabled={busy} onChange={(e) => save(e.target.value)}>
          <option value="">None — everyone sees the full researcher view</option>
          {STUDENT_VIEW_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
      {value && (
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {STUDENT_VIEW_TEMPLATES.find((t) => t.id === value)?.description}
        </p>
      )}
      {saved && <p className="muted" style={{ fontSize: 12, marginTop: 4, color: 'var(--good)' }}>Saved.</p>}
    </div>
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
        </div>
      )}
      {saved && <p className="muted" style={{ fontSize: 12, marginTop: 6, color: 'var(--good)' }}>Saved.</p>}
    </div>
  )
}
