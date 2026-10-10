import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Network, Star, Users } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import {
  canManageGroups,
  canShareInGroup,
  getGroup,
  getGroupFavoritesSynthesis,
  getGroupNotebookSynthesis,
  listGroupMembers,
  setShareFavorites,
  type GroupMember,
  type ProjectGroup,
} from '@/lib/supabase/groups'
import { listFavoriteIds } from '@/lib/supabase/favorites'
import { GroupNotebookGraph } from '@/components/group-notebook-graph'

type Tab = 'mine' | 'synthesis'

// The toggle Dustin asked for ("view their own individual work... and then
// also toggle to view group-level synthesis") lives here, inside the
// group's own page -- not as a change to the existing Notebooks/Favorites
// pages themselves, which stay exactly as they were (decided 2026-10-02,
// see lab_manager's docs/design-notes/openlpm-groups-feature-2026-10-02.md).
// Synthesis rendering deliberately differs by audience: a simple ranked
// list for student Favorites, a merged graph for researcher Notebooks --
// matching what each view already does rather than forcing one shared look.
export default function GroupDetailPage() {
  const { project, role, slug, supabase, isStudentView } = useOutletContext<ProjectOutletContext>()
  const { groupId } = useParams<{ groupId: string }>()
  const [group, setGroup] = useState<ProjectGroup | null | undefined>(undefined)
  const [members, setMembers] = useState<GroupMember[] | null>(null)
  const [userId, setUserId] = useState<string>()
  const [tab, setTab] = useState<Tab>('mine')

  const canManage = canManageGroups(role, project)

  useEffect(() => {
    if (!groupId) return
    setGroup(undefined)
    getGroup(supabase, groupId).then(setGroup)
    listGroupMembers(supabase, groupId).then(setMembers)
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id))
  }, [supabase, groupId])

  const myMembership = members?.find((m) => m.user_id === userId) ?? null

  const t = isStudentView
    ? { back: 'Alle Gruppen', mine: 'Meine Arbeit', synthesis: 'Gruppenübersicht', roster: 'Mitglieder' }
    : { back: 'All groups', mine: 'My work', synthesis: 'Group synthesis', roster: 'Members' }

  if (group === undefined || !groupId) return <p className="muted">{isStudentView ? 'Lädt…' : 'Loading…'}</p>

  if (!group) {
    return (
      <div>
        <Link to={`/dashboard/${slug}/groups`} className="row muted" style={{ marginBottom: 12 }}><ArrowLeft size={14} />{t.back}</Link>
        <div className="card empty"><p>{isStudentView ? 'Gruppe nicht gefunden.' : 'Group not found.'}</p></div>
      </div>
    )
  }

  return (
    <div>
      <Link to={`/dashboard/${slug}/groups`} className="row muted" style={{ marginBottom: 12 }}><ArrowLeft size={14} />{t.back}</Link>
      <h1 className="row"><Users size={20} />{group.name}</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>{t.roster}</h3>
        {members === null ? (
          <p className="muted">{isStudentView ? 'Lädt…' : 'Loading…'}</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{m.user.name} <span className="muted">{m.user.email}</span></span>
            </div>
          ))
        )}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button className={`chip-btn${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>{t.mine}</button>
        <button className={`chip-btn${tab === 'synthesis' ? ' active' : ''}`} onClick={() => setTab('synthesis')}>{t.synthesis}</button>
      </div>

      {tab === 'mine' ? (
        isStudentView ? (
          <MyFavoritesPane supabase={supabase} project={project} role={role} membership={myMembership} />
        ) : (
          <MyNotebooksPane supabase={supabase} slug={slug} project={project} groupId={groupId} userId={userId} />
        )
      ) : isStudentView ? (
        <FavoritesSynthesisPane supabase={supabase} groupId={groupId} />
      ) : (
        <NotebookSynthesisPane supabase={supabase} project={project} groupId={groupId} />
      )}
    </div>
  )
}

function MyFavoritesPane({
  supabase,
  project,
  role,
  membership,
}: {
  supabase: ProjectOutletContext['supabase']
  project: ProjectOutletContext['project']
  role: ProjectOutletContext['role']
  membership: GroupMember | null
}) {
  const [titles, setTitles] = useState<string[] | null>(null)
  const [sharing, setSharing] = useState(membership?.share_favorites ?? false)
  const [busy, setBusy] = useState(false)
  // Real feedback 771f5fa2 (Dustin) / migration 117: a role the project has
  // restricted from group-sharing can still see their own sharing state
  // (so an owner un-sharing them doesn't look like a bug) but can't turn it
  // ON -- turning it off always stays available, no permission needed.
  const canShare = canShareInGroup(role, project)

  useEffect(() => {
    listFavoriteIds(supabase).then(async (ids) => {
      if (ids.size === 0) { setTitles([]); return }
      const { data } = await supabase.from('lpm_data_objects').select('title').in('id', Array.from(ids))
      setTitles((data ?? []).map((d) => d.title))
    })
  }, [supabase])

  const toggleSharing = async () => {
    if (!membership) return
    if (sharing === false && !canShare) return
    const next = !sharing
    setSharing(next)
    setBusy(true)
    await setShareFavorites(supabase, membership.id, next)
    setBusy(false)
  }

  return (
    <div className="card">
      <h3 className="row"><Star size={14} />Meine Favoriten</h3>
      {membership ? (
        <label className="row" style={{ gap: 6, cursor: canShare || sharing ? 'pointer' : 'default', marginBottom: 10, opacity: canShare || sharing ? 1 : 0.6 }}>
          <input type="checkbox" checked={sharing} disabled={busy || (!canShare && !sharing)} onChange={toggleSharing} />
          Mit dieser Gruppe teilen
          {!canShare && !sharing && <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>(für deine Rolle eingeschränkt)</span>}
        </label>
      ) : (
        <p className="muted">Trete der Gruppe bei, um deine Favoriten zu teilen.</p>
      )}
      {titles === null ? (
        <p className="muted">Lädt…</p>
      ) : titles.length === 0 ? (
        <p className="muted">Noch keine Favoriten markiert.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {titles.map((title, i) => <li key={i} style={{ fontSize: 13 }}>{title}</li>)}
        </ul>
      )}
    </div>
  )
}

function FavoritesSynthesisPane({ supabase, groupId }: { supabase: ProjectOutletContext['supabase']; groupId: string }) {
  const [rows, setRows] = useState<{ title: string; count: number }[] | null>(null)
  const [sharingMemberCount, setSharingMemberCount] = useState(0)

  useEffect(() => {
    setRows(null)
    getGroupFavoritesSynthesis(supabase, groupId).then(async ({ sharingMemberCount, counts }) => {
      setSharingMemberCount(sharingMemberCount)
      if (counts.size === 0) { setRows([]); return }
      const ids = Array.from(counts.keys())
      const { data } = await supabase.from('lpm_data_objects').select('id, title').in('id', ids)
      const titleById = new Map((data ?? []).map((d) => [d.id, d.title]))
      const list = ids
        .map((id) => ({ title: titleById.get(id) ?? '(gelöscht)', count: counts.get(id) ?? 0 }))
        .sort((a, b) => b.count - a.count)
      setRows(list)
    })
  }, [supabase, groupId])

  if (rows === null) return <p className="muted">Lädt…</p>
  if (sharingMemberCount === 0) return <p className="muted">Noch niemand in dieser Gruppe teilt seine Favoriten.</p>

  return (
    <div className="card">
      <p className="muted" style={{ marginBottom: 10 }}>
        {sharingMemberCount} Mitglied{sharingMemberCount === 1 ? '' : 'er'} teil{sharingMemberCount === 1 ? 't' : 'en'} Favoriten.
      </p>
      {rows.length === 0 ? (
        <p className="muted">Noch keine gemeinsamen Favoriten.</p>
      ) : (
        rows.map((r) => (
          <div key={r.title} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <span>{r.title}</span>
            <span className="chip">{r.count} von {sharingMemberCount}</span>
          </div>
        ))
      )}
    </div>
  )
}

function MyNotebooksPane({
  supabase,
  slug,
  project,
  groupId,
  userId,
}: {
  supabase: ProjectOutletContext['supabase']
  slug: string
  project: ProjectOutletContext['project']
  groupId: string
  userId: string | undefined
}) {
  const [names, setNames] = useState<string[] | null>(null)

  useEffect(() => {
    if (!userId) return
    ;(supabase as any)
      .from('portfolios')
      .select('name')
      .eq('project_id', project.id)
      .eq('owner_id', userId)
      .eq('visibility', 'group')
      .eq('group_id', groupId)
      .then(({ data }: { data: { name: string }[] | null }) => setNames((data ?? []).map((d) => d.name)))
  }, [supabase, project.id, groupId, userId])

  return (
    <div className="card">
      <h3 className="row"><Network size={14} />My notebooks shared with this group</h3>
      {names === null ? (
        <p className="muted">Loading…</p>
      ) : names.length === 0 ? (
        <p className="muted">
          None yet. Open a notebook from <Link to={`/dashboard/${slug}/notebooks`}>Notebooks</Link> and set its visibility to
          &ldquo;Group&rdquo; to share it here.
        </p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {names.map((n, i) => <li key={i} style={{ fontSize: 13 }}>{n}</li>)}
        </ul>
      )}
    </div>
  )
}

function NotebookSynthesisPane({
  supabase,
  project,
  groupId,
}: {
  supabase: ProjectOutletContext['supabase']
  project: ProjectOutletContext['project']
  groupId: string
}) {
  const [graph, setGraph] = useState<Awaited<ReturnType<typeof getGroupNotebookSynthesis>> | null>(null)

  useEffect(() => {
    setGraph(null)
    getGroupNotebookSynthesis(supabase, project.id, groupId).then(setGraph)
  }, [supabase, project.id, groupId])

  if (graph === null) return <p className="muted">Loading…</p>
  if (graph.portfolioCount === 0) {
    return <div className="card empty"><Network size={32} /><p>No notebooks shared with this group yet.</p></div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <p className="muted" style={{ marginBottom: 8 }}>
        Merged from {graph.portfolioCount} notebook{graph.portfolioCount === 1 ? '' : 's'} shared with this group.
      </p>
      <GroupNotebookGraph nodes={graph.nodes} edges={graph.edges} />
    </div>
  )
}
