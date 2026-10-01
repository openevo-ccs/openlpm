import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Github, KeyRound, Link2, LogIn, Unlink } from 'lucide-react'
import type { UserIdentity } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import { REDIRECT_KEY } from '@/components/require-auth'
import { getUserProjects, type ProjectWithRole } from '@/lib/supabase/projects'
import { listMyJoinableProjects, selfJoinProject, type JoinableProject } from '@/lib/supabase/join'

// Lets a user end up with either or both sign-in methods, added whenever
// they want rather than only at sign-up -- a GitHub-first user can set a
// password here, and a password-first user can connect GitHub, using
// Supabase's own built-in mechanisms for this rather than anything
// custom-built: updateUser({password}) to add password capability to the
// current account, linkIdentity/unlinkIdentity to add or remove an OAuth
// provider. linkIdentity requires "Manual Linking" enabled in the project's
// Auth settings (a Dashboard toggle, off by default) -- if it's not on yet,
// the button below will show Supabase's own clear error rather than fail
// silently.
// A pasted join link looks like ".../#/join/evomentor-thuringia-jena-ws2026"
// (or someone might just type the slug itself) -- take whatever's after the
// last '/join/' if present, otherwise the last path segment, so either form
// works without asking a student to understand the difference.
function extractJoinSlug(input: string): string {
  const trimmed = input.trim()
  const marker = '/join/'
  const idx = trimmed.lastIndexOf(marker)
  const tail = idx >= 0 ? trimmed.slice(idx + marker.length) : trimmed
  return tail.split(/[/?#]/)[0]
}

export default function ProfilePage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [joinInput, setJoinInput] = useState('')
  const supabase = useMemo(() => createClient(), [])
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [memberships, setMemberships] = useState<ProjectWithRole[] | null>(null)
  const [joinable, setJoinable] = useState<JoinableProject[] | null>(null)
  const [joiningId, setJoiningId] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')

  const reload = async () => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUserIdentities()
    if (!error) setIdentities(data.identities)
  }

  const reloadMemberships = () => {
    getUserProjects(supabase).then(setMemberships)
    listMyJoinableProjects(supabase).then(setJoinable)
  }

  useEffect(() => {
    reload()
    reloadMemberships()
  }, [supabase])

  const joinNow = async (jp: JoinableProject) => {
    setJoiningId(jp.project.id)
    setNotice(null)
    const { error } = await selfJoinProject(supabase, jp.project.id, jp.role)
    setJoiningId(null)
    if (error) setNotice({ kind: 'bad', text: error.message })
    else {
      setNotice({ kind: 'ok', text: `Joined ${jp.project.name}.` })
      reloadMemberships()
    }
  }

  // Same grouping convention as project-switcher-page.tsx: a top-level entry
  // is a Project Space, everything nested under one is a Project -- a user
  // can hold a different role on each row, since project_members is unique
  // per (project_id, user_id), not per user, so this must list every
  // membership row individually rather than collapsing to one "role."
  const byId = new Map((memberships ?? []).map((m) => [m.project.id, m]))
  const topLevelMemberships = (memberships ?? []).filter(
    (m) => !m.project.parent_project_id || !byId.has(m.project.parent_project_id)
  )
  const childMembershipsOf = (id: string) => (memberships ?? []).filter((m) => m.project.parent_project_id === id)
  const availableToJoin = (joinable ?? []).filter((jp) => !byId.has(jp.project.id))

  const hasEmailPassword = (identities ?? []).some((i) => i.provider === 'email')
  const hasGithub = (identities ?? []).some((i) => i.provider === 'github')
  const canUnlink = (identities ?? []).length > 1

  const setPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setBusy(false)
    if (error) setNotice({ kind: 'bad', text: error.message })
    else {
      setNotice({ kind: 'ok', text: 'Password set — you can now sign in with your email and this password.' })
      setNewPassword('')
      await reload()
    }
  }

  const connectGithub = async () => {
    setBusy(true)
    setNotice(null)
    const supabase = createClient()
    // redirectTo is deliberately the plain site root, not a hash path --
    // same reason as resetPasswordForEmail in login-page.tsx (a '?code='
    // appended after a '#/...' path lands inside the hash fragment, where
    // detectSessionInUrl never looks). <RequireAuth>'s own REDIRECT_KEY
    // mechanism is what actually gets them back to this page afterward.
    window.localStorage.setItem(REDIRECT_KEY, '/dashboard/profile')
    const { error } = await supabase.auth.linkIdentity({
      provider: 'github',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    setBusy(false)
    if (error) {
      window.localStorage.removeItem(REDIRECT_KEY)
      setNotice({ kind: 'bad', text: error.message })
    }
    // On success this redirects to GitHub, so there's nothing else to do here.
  }

  const unlink = async (identity: UserIdentity) => {
    if (!canUnlink) return
    setBusy(true)
    setNotice(null)
    const supabase = createClient()
    const { error } = await supabase.auth.unlinkIdentity(identity)
    setBusy(false)
    if (error) setNotice({ kind: 'bad', text: error.message })
    else { setNotice({ kind: 'ok', text: 'Disconnected.' }); await reload() }
  }

  return (
    <div className="page-narrow" style={{ maxWidth: 560 }}>
      <h1>Your profile</h1>
      <p className="muted" style={{ marginBottom: 16 }}>{session?.user.email}</p>

      {notice && <div className={`notice notice-${notice.kind}`}>{notice.text}</div>}

      <div className="card">
        <h3>Your projects</h3>
        {memberships === null ? (
          <p className="muted">Loading…</p>
        ) : memberships.length === 0 ? (
          <p className="muted">You aren&apos;t a member of any project space yet.</p>
        ) : (
          topLevelMemberships.map(({ project, role }) => {
            const children = childMembershipsOf(project.id)
            return (
              <div key={project.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <Link to={`/dashboard/${project.slug}`}>{project.name}</Link>
                  <span className="chip capitalize">{role}</span>
                </div>
                {children.map((c) => (
                  <div key={c.project.id} className="row" style={{ justifyContent: 'space-between', paddingLeft: 16, marginTop: 4, fontSize: 13 }}>
                    <Link to={`/dashboard/${c.project.slug}`} className="muted">{c.project.name}</Link>
                    <span className="chip capitalize">{c.role}</span>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      <div className="card">
        <h3 className="row"><LogIn size={16} />Join a group</h3>

        {availableToJoin.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p className="muted" style={{ marginBottom: 6 }}>
              Your account&apos;s email is eligible to join {availableToJoin.length === 1 ? 'this group' : 'these groups'} right
              away:
            </p>
            {availableToJoin.map((jp) => (
              <div
                key={jp.project.id}
                className="row"
                style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}
              >
                <span>
                  <strong>{jp.project.name}</strong>
                  {jp.project.description && (
                    <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{jp.project.description}</span>
                  )}
                </span>
                <button
                  className="btn btn-mini btn-primary"
                  disabled={joiningId === jp.project.id}
                  onClick={() => joinNow(jp)}
                >
                  {joiningId === jp.project.id ? 'Joining…' : `Join as ${jp.role}`}
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="muted">
          {availableToJoin.length > 0
            ? 'Have a join link or code for something else? Paste it here.'
            : "Got a join link from an instructor or research lead? Paste it here — or just type the group's short name if that's all you were given."}
        </p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            const slug = extractJoinSlug(joinInput)
            if (slug) navigate(`/join/${slug}`)
          }}
        >
          <div className="field" style={{ marginBottom: 0, flex: 1 }}>
            <input
              type="text"
              placeholder="e.g. evomentor-thuringia-jena-ws2026, or paste the full link"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={!joinInput.trim()}>Go</button>
        </form>
      </div>

      <div className="card">
        <h3>Sign-in methods</h3>
        <p className="muted">You can use either or both to get in — set up a second one so you're never locked out.</p>

        <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span className="row"><KeyRound size={14} />Email and password</span>
          {hasEmailPassword ? (
            <span className="row">
              <span className="chip chip-good">Connected</span>
              {canUnlink && (
                <button className="btn btn-mini" disabled={busy} onClick={() => unlink(identities!.find((i) => i.provider === 'email')!)}>
                  <Unlink size={11} />Remove
                </button>
              )}
            </span>
          ) : (
            <span className="chip">Not set up</span>
          )}
        </div>

        <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0' }}>
          <span className="row"><Github size={14} />GitHub</span>
          {hasGithub ? (
            <span className="row">
              <span className="chip chip-good">Connected</span>
              {canUnlink && (
                <button className="btn btn-mini" disabled={busy} onClick={() => unlink(identities!.find((i) => i.provider === 'github')!)}>
                  <Unlink size={11} />Remove
                </button>
              )}
            </span>
          ) : (
            <button className="btn btn-mini" disabled={busy} onClick={connectGithub}>
              <Link2 size={11} />Connect
            </button>
          )}
        </div>
      </div>

      {!hasEmailPassword && (
        <div className="card">
          <h3>Set a password</h3>
          <p className="muted">Add a password so you can sign in without GitHub too.</p>
          <form onSubmit={setPassword} className="row">
            <div className="field" style={{ marginBottom: 0, flex: 1 }}>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>Set password</button>
          </form>
        </div>
      )}
    </div>
  )
}
