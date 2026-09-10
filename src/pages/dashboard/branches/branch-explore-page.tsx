import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronUp, Compass, Link2, Search } from 'lucide-react'
import type { BranchOutletContext } from './branch-layout'
import {
  getAssertedConnections,
  getFullThread,
  getThreadStationsForTopic,
  getTopic,
  listTopics,
  type DataObjectRow,
  type FullThread,
  type ResolvedConnection,
  type ThreadStationWithThread,
  type TopicListItem,
} from '@/lib/supabase/curriculum'

// Plain-language gloss for the small controlled vocabulary real threads use
// (conceptbase RFC-0018's frameworkRelation terms) -- a fallback humanizes
// anything else (camelCase -> spaced words) so an unfamiliar project's own
// relation vocabulary still renders reasonably instead of erroring.
const RELATION_GLOSS: Record<string, string> = {
  enables: 'which opens the door to',
  requires: 'which depends on',
  regulates: 'which regulates',
  isRegulatedBy: 'which is regulated by',
  implements: 'which puts into practice',
  isImplementedBy: 'which is put into practice by',
  controls: 'which controls',
  isControlledBy: 'which is controlled by',
  explainsOriginOf: 'which explains where this comes from:',
  isExplainedBy: 'which is explained by',
}

function humanizeRelation(type: string | null): string {
  if (!type) return 'connects to'
  return RELATION_GLOSS[type] ?? type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

function gradeLabel(grade: string | null): string {
  return grade ? `Grade ${grade}` : 'Grade —'
}

export default function BranchExplorePage() {
  const { project, branch, supabase } = useOutletContext<BranchOutletContext>()
  const { objectId } = useParams<{ objectId?: string }>()
  const navigate = useNavigate()

  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [query, setQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState<string>('all')

  useEffect(() => {
    setTopics(null)
    listTopics(supabase, project.id, branch.id).then(setTopics)
  }, [supabase, project.id, branch.id])

  const grades = useMemo(() => {
    const set = new Set((topics ?? []).map((t) => t.grade_band).filter(Boolean) as string[])
    return Array.from(set).sort((a, b) => Number(a) - Number(b))
  }, [topics])

  const filtered = useMemo(() => {
    if (!topics) return []
    const q = query.trim().toLowerCase()
    return topics.filter((t) => {
      if (gradeFilter !== 'all' && t.grade_band !== gradeFilter) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        (t.thema ?? '').toLowerCase().includes(q) ||
        (t.unterthema ?? '').toLowerCase().includes(q)
      )
    })
  }, [topics, query, gradeFilter])

  return (
    <div className="explorer">
      <div className="notice">
        Covers the Gymnasium (academic-track) curriculum only. Most Thuringia students attend a
        different school type (Regelschule/Gemeinschaftsschule) — that curriculum isn&apos;t
        represented here yet.
      </div>
      <div className="toolbar">
        <div className="row" style={{ flex: 1 }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="search"
            placeholder="Search topics by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 240 }}
          />
        </div>
        <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <option value="all">All grades</option>
          {grades.map((g) => (
            <option key={g} value={g}>{gradeLabel(g)}</option>
          ))}
        </select>
        <span className="muted">{topics === null ? 'Loading…' : `${filtered.length} of ${topics.length} topics`}</span>
      </div>

      <div className="explorer-body">
        <div className="graph-host" style={{ overflow: 'auto', padding: 4 }}>
          {topics === null ? (
            <p className="muted" style={{ padding: 16 }}>Loading topics…</p>
          ) : filtered.length === 0 ? (
            <div className="card empty">
              <Compass size={28} />
              <p>No topics match.</p>
            </div>
          ) : (
            <ul className="topic-list">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    className={`topic-list-item${t.id === objectId ? ' active' : ''}`}
                    onClick={() => navigate(`/dashboard/${project.slug}/branches/${branch.slug}/explore/${t.id}`)}
                  >
                    <span className="chip" style={{ flexShrink: 0 }}>{gradeLabel(t.grade_band)}</span>
                    <span>
                      <strong style={{ display: 'block' }}>{t.title}</strong>
                      {t.unterthema && <span className="muted">{t.unterthema}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="drawer-shell wide">
          <div className="drawer">
            {objectId ? (
              <TopicDetail objectId={objectId} projectSlug={project.slug} branchSlug={branch.slug} supabase={supabase} />
            ) : (
              <div className="empty" style={{ paddingTop: 60 }}>
                <Compass size={32} />
                <p>Pick a topic on the left.</p>
                <p className="muted">You&apos;ll see how it connects to what comes before, what comes after, and — where curriculum designers have identified it — the bigger idea that ties it to other topics.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TopicDetail({
  objectId,
  projectSlug,
  branchSlug,
  supabase,
}: {
  objectId: string
  projectSlug: string
  branchSlug: string
  supabase: BranchOutletContext['supabase']
}) {
  const [topic, setTopic] = useState<DataObjectRow | null | undefined>(undefined)
  const [connections, setConnections] = useState<ResolvedConnection[] | null>(null)
  const [stations, setStations] = useState<ThreadStationWithThread[] | null>(null)

  useEffect(() => {
    setTopic(undefined)
    setConnections(null)
    setStations(null)
    getTopic(supabase, objectId).then(setTopic)
    getAssertedConnections(supabase, objectId).then(setConnections)
    getThreadStationsForTopic(supabase, objectId).then(setStations)
  }, [supabase, objectId])

  if (topic === undefined) return <p className="muted">Loading…</p>
  if (topic === null) return <div className="notice notice-bad">Topic not found.</div>

  const requiredBefore = (connections ?? []).filter((c) => c.direction === 'incoming')
  const leadsTo = (connections ?? []).filter((c) => c.direction === 'outgoing')

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 style={{ marginBottom: 2 }}>{topic.title}</h2>
        <span className="chip">{gradeLabel(topic.grade_band)}</span>
      </div>
      {topic.description && (
        <blockquote style={{ margin: '8px 0 16px', paddingLeft: 10, borderLeft: '3px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13 }}>
          &ldquo;{topic.description}&rdquo;
        </blockquote>
      )}

      {(requiredBefore.length > 0 || leadsTo.length > 0) && (
        <section style={{ marginBottom: 18 }}>
          <h3 className="row"><Link2 size={13} />Required order in the curriculum</h3>
          <p className="muted" style={{ marginTop: -4 }}>The curriculum itself sequences these — not a suggestion.</p>
          {requiredBefore.map((c) => (
            <ConnLine key={c.connection.id} kind="asserted" arrow="in" object={c.other} projectSlug={projectSlug} branchSlug={branchSlug} />
          ))}
          {leadsTo.map((c) => (
            <ConnLine key={c.connection.id} kind="asserted" arrow="out" object={c.other} projectSlug={projectSlug} branchSlug={branchSlug} />
          ))}
        </section>
      )}

      {stations && stations.length > 0 && (
        <section>
          {stations.map((s) => (
            <ThreadCard key={s.id} station={s} currentObjectId={objectId} projectSlug={projectSlug} branchSlug={branchSlug} supabase={supabase} />
          ))}
        </section>
      )}

      {connections?.length === 0 && stations?.length === 0 && (
        <p className="muted">No recorded connections for this topic yet.</p>
      )}
    </div>
  )
}

function ConnLine({
  kind,
  arrow,
  object,
  projectSlug,
  branchSlug,
}: {
  kind: 'asserted' | 'suggested'
  arrow: 'in' | 'out'
  object: DataObjectRow
  projectSlug: string
  branchSlug: string
}) {
  return (
    <Link
      to={`/dashboard/${projectSlug}/branches/${branchSlug}/explore/${object.id}`}
      className={`conn-line conn-${kind}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <span className="muted" style={{ fontSize: 12 }}>{arrow === 'in' ? 'Comes before this topic' : 'Comes after this topic'}</span>
      <span className="row" style={{ justifyContent: 'space-between' }}>
        <strong>{object.title}</strong>
        <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
      </span>
    </Link>
  )
}

function ThreadCard({
  station,
  currentObjectId,
  projectSlug,
  branchSlug,
  supabase,
}: {
  station: ThreadStationWithThread
  currentObjectId: string
  projectSlug: string
  branchSlug: string
  supabase: BranchOutletContext['supabase']
}) {
  const [expanded, setExpanded] = useState(false)
  const [full, setFull] = useState<FullThread | null>(null)

  const toggle = async () => {
    if (!expanded && !full) {
      const f = await getFullThread(supabase, station.thread_id)
      setFull(f)
    }
    setExpanded((v) => !v)
  }

  const hubLabel = station.thread.explained_by?.label ?? null

  return (
    <div className="card conn-suggested" style={{ marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="chip chip-draft">Suggested connection</span>
        {hubLabel && <span className="muted" style={{ fontSize: 12 }}>tied together by: {hubLabel}</span>}
      </div>
      <h3 style={{ marginTop: 8, marginBottom: 4 }}>{station.thread.title}</h3>
      <p style={{ marginBottom: 8 }}>{station.role_note}</p>

      <button className="btn btn-mini" onClick={toggle}>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? 'Hide the full explanation' : 'Why does this connect? See the full thread'}
      </button>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <p><strong>The idea that ties it together:</strong> {station.thread.connecting_idea}</p>
          <p>{station.thread.narrative}</p>
          {station.thread.teaching_prompt && (
            <div className="notice notice-ok" style={{ alignItems: 'flex-start' }}>
              <span><strong>Try this in class:</strong> {station.thread.teaching_prompt}</span>
            </div>
          )}

          {full && (
            <ol className="thread-path">
              {full.stations.map((st) => (
                <li key={st.id} className={st.data_object_id === currentObjectId ? 'thread-station current' : 'thread-station'}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <Link to={`/dashboard/${projectSlug}/branches/${branchSlug}/explore/${st.object.id}`} style={{ textDecoration: 'none' }}>
                      <strong>{gradeLabel(st.object.grade_band)} — {st.object.title}</strong>
                    </Link>
                  </div>
                  <p className="muted" style={{ margin: '2px 0 0' }}>{st.role_note}</p>
                  {st.relation_to_next && (
                    <p className="muted" style={{ margin: '4px 0 0', fontStyle: 'italic' }}>↓ {humanizeRelation(st.relation_to_next)}</p>
                  )}
                </li>
              ))}
            </ol>
          )}

          {station.thread.evidence_note && (
            <p className="muted" style={{ marginTop: 10 }}>
              <span className="tip" data-tip="How curriculum designers found this connection, so you can judge it yourself rather than take it on faith.">
                <span className="help">?</span>
              </span>{' '}
              How this was identified: {station.thread.evidence_note}
            </p>
          )}
          {Array.isArray(station.thread.gaps) && station.thread.gaps.length > 0 && (
            <div className="notice">
              Known gap: {station.thread.gaps.join(' ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
