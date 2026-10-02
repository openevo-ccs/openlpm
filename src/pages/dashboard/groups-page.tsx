import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, Plus, Trash2, Users } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import {
  canManageGroups,
  createGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  listGroupsWithMyMembership,
  type ProjectGroup,
} from '@/lib/supabase/groups'

// Real middle tier between "just me" and "the whole project" (migration
// 075, decided with Dustin 2026-10-02 -- see lab_manager's
// docs/design-notes/openlpm-groups-feature-2026-10-02.md). Works for both
// the researcher and student view -- only the copy differs; the actions
// (join/leave/create/delete/open) are identical either way.
export default function GroupsPage() {
  const { project, role, slug, supabase, isStudentView } = useOutletContext<ProjectOutletContext>()
  const [rows, setRows] = useState<{ group: ProjectGroup; membership: { id: string } | null }[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canManage = canManageGroups(role, project)

  const reload = () => listGroupsWithMyMembership(supabase, project.id).then(setRows)

  useEffect(() => {
    setRows(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  const t = isStudentView
    ? {
        title: 'Gruppen',
        intro: 'Finde dich mit anderen zu einer Gruppe zusammen. Jede Gruppe sieht, was ihre Mitglieder gemeinsam markiert haben.',
        empty: 'Noch keine Gruppen.',
        join: 'Beitreten',
        leave: 'Verlassen',
        open: 'Öffnen',
        members: (n: number) => `${n} Mitglied${n === 1 ? '' : 'er'}`,
        newGroup: 'Neue Gruppe',
        namePlaceholder: 'z. B. Team 1',
        create: 'Erstellen',
      }
    : {
        title: 'Groups',
        intro: 'Self-organize into smaller teams within this project. Each group sees a shared view built from its members’ own work.',
        empty: 'No groups yet.',
        join: 'Join',
        leave: 'Leave',
        open: 'Open',
        members: (n: number) => `${n} member${n === 1 ? '' : 's'}`,
        newGroup: 'New group',
        namePlaceholder: 'e.g. Team 1',
        create: 'Create',
      }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const { error: err } = await createGroup(supabase, project.id, name.trim())
    setBusy(false)
    if (err) setError(err.message)
    else { setName(''); reload() }
  }

  const doJoin = async (groupId: string) => { await joinGroup(supabase, groupId); reload() }
  const doLeave = async (membershipId: string) => { await leaveGroup(supabase, membershipId); reload() }
  const doDelete = async (group: ProjectGroup) => {
    if (!window.confirm(isStudentView ? `"${group.name}" wirklich löschen?` : `Delete "${group.name}"? This can't be undone.`)) return
    await deleteGroup(supabase, group.id)
    reload()
  }

  return (
    <div>
      <h1 className="row"><Users size={20} />{t.title}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>{t.intro}</p>

      {rows === null ? (
        <p className="muted">{isStudentView ? 'Lädt…' : 'Loading…'}</p>
      ) : rows.length === 0 ? (
        <div className="card empty">
          <Users size={32} />
          <p>{t.empty}</p>
        </div>
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 20 }}>
          {rows.map(({ group, membership }) => (
            <div key={group.id} className="card">
              <h3>{group.name}</h3>
              <p className="muted" style={{ marginBottom: 10 }}>
                {/* Member counts aren't preloaded per group to keep the list query to one round trip -- the roster itself is one click away on the detail page. */}
                {membership ? (isStudentView ? 'Du bist Mitglied' : 'You’re a member') : null}
              </p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {(membership || canManage) && (
                  <Link to={`/dashboard/${slug}/groups/${group.id}`} className="btn btn-mini">
                    {t.open}<ArrowRight size={11} />
                  </Link>
                )}
                {!membership && (
                  <button className="btn btn-mini btn-primary" onClick={() => doJoin(group.id)}>{t.join}</button>
                )}
                {membership && (
                  <button className="btn btn-mini" onClick={() => doLeave(membership.id)}>{t.leave}</button>
                )}
                {canManage && (
                  <button className="btn btn-mini btn-danger" aria-label="Delete group" onClick={() => doDelete(group)}>
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="card">
          <h3 className="row"><Plus size={14} />{t.newGroup}</h3>
          <form onSubmit={submit} className="row">
            <input
              type="text"
              placeholder={t.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>{t.create}</button>
          </form>
          {error && <div className="notice notice-bad" style={{ marginTop: 8 }}>{error}</div>}
        </div>
      )}
    </div>
  )
}
