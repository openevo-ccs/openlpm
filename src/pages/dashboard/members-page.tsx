import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Mail, Trash2, UserPlus, Users } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
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

const ROLES: ProjectMemberRole[] = ['owner', 'maintainer', 'editor', 'reviewer', 'contributor', 'viewer']

export default function MembersPage() {
  const { project, role, supabase } = useOutletContext<ProjectOutletContext>()
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
    <div>
      <h1 className="row"><Users size={18} style={{ color: 'var(--text-muted)' }} />Members</h1>
      <p className="muted" style={{ marginBottom: 16 }}>Who can see and work on {project.name}.</p>

      {canManage && <InviteForm projectId={project.id} supabase={supabase} onInvited={reload} />}

      {invites !== null && invites.length > 0 && (
        <div className="card">
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

      <div className="card">
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
