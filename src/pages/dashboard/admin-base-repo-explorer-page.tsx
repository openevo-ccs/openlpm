import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { BookOpen, CheckCircle2, Clock, LayoutGrid, MessageSquare, Network, Search, Table2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import {
  BASE_REPO_CONFIGS,
  listSnapshotRows,
  type BaseRepoKey,
  type SnapshotRow,
} from '@/lib/supabase/base-repo-explorer'
import {
  completeGenericReview,
  listGlobalReviewQueue,
  submitBaseRepoRecordForReview,
  resolveBaseRepoReviewTarget,
  type GenericReviewItem,
} from '@/lib/supabase/generic-review'
import { createGlobalTopic, createPost, listGlobalTopicsForTarget, listPosts, type PostWithAuthor } from '@/lib/supabase/discussions'
import { layoutTier } from '@/lib/graph-layout'

// Base Repo Explorer (2026-10-21): a site-wide, admin-only area to browse,
// review, and discuss real content from the OpenEvo CCS Foundational
// Repos -- across every project, not any one project's own local copy of
// one. Admin-gated for now (Dustin's own call) -- the broader
// "approved, not necessarily admin" access tier this will eventually need
// is a later phase, once this first version proves out.
//
// Scope: Base Repos only -- ConceptBase already has its own working
// live-fetch browse path elsewhere (Schema page) and isn't duplicated
// here; SpeciesBase/TeachingBase have no snapshot pipeline yet; the
// ccs-graph/openevo-graph/eva-graph layer is a deliberately separate
// layer and explicitly out of scope (Dustin, 2026-10-21).
//
// Table/Cards/Graph view-mode toggle mirrors PortfolioExplorer's existing
// pattern (src/components/portfolio-explorer.tsx). The graph view uses the
// same deterministic tiered layout (src/lib/graph-layout.ts) every other
// concept/learning-goal graph in this app uses, not a physics layout --
// Dustin's own explicit, twice-given feedback (2026-09-30, Netz tab)
// rejected 'cose' for exactly this shape of graph (many nodes sharing a
// category, no dense direct edges) because it reads as "random" even when
// it technically isn't.

type ViewMode = 'table' | 'cards' | 'graph'
type TabKey = 'all' | BaseRepoKey

const REPO_COLOR: Record<BaseRepoKey, string> = {
  theorybase: '#2a78d6',
  literaturebase: '#008300',
  methodsbase: '#c98500',
  questionbase: '#7a4fd1',
  quotebase: '#0d8f8f',
  competencybase: '#a3365b',
  projectbase: '#5a6b2e',
}

const REPO_SHAPE: Record<BaseRepoKey, string> = {
  theorybase: 'ellipse',
  literaturebase: 'round-rectangle',
  methodsbase: 'triangle',
  questionbase: 'diamond',
  quotebase: 'hexagon',
  competencybase: 'pentagon',
  projectbase: 'star',
}

function token(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

interface NodeRef {
  repoKey: BaseRepoKey
  row: SnapshotRow
}

export default function AdminBaseRepoExplorerPage() {
  const { isAdmin } = useSession()
  const supabase = useMemo(() => createClient(), [])

  const [tab, setTab] = useState<TabKey>('all')
  const [view, setView] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [rowsByRepo, setRowsByRepo] = useState<Map<BaseRepoKey, SnapshotRow[]>>(new Map())
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<NodeRef | null>(null)
  const [reviewQueue, setReviewQueue] = useState<GenericReviewItem[] | null>(null)
  const [showReviewQueue, setShowReviewQueue] = useState(false)

  const reloadReviewQueue = () => listGlobalReviewQueue(supabase).then(setReviewQueue)

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    setLoading(true)
    const repoKeys: BaseRepoKey[] = tab === 'all' ? BASE_REPO_CONFIGS.map((c) => c.key) : [tab]
    Promise.all(repoKeys.map(async (key) => [key, await listSnapshotRows(supabase, key, search)] as const)).then((pairs) => {
      if (!active) return
      setRowsByRepo(new Map(pairs))
      setLoading(false)
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, isAdmin, tab, search])

  useEffect(() => {
    if (isAdmin) reloadReviewQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const allRows: NodeRef[] = useMemo(() => {
    const out: NodeRef[] = []
    for (const [repoKey, rows] of rowsByRepo) for (const row of rows) out.push({ repoKey, row })
    return out
  }, [rowsByRepo])

  const totalCount = allRows.length

  if (!isAdmin) {
    return (
      <div>
        <h1>Base Repo Explorer</h1>
        <p className="muted">This page isn&apos;t available to your account.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="row"><BookOpen size={18} style={{ color: 'var(--text-muted)' }} />Base Repo Explorer</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Browse, review, and discuss real content from the OpenEvo CCS Foundational Repos, across every
        project. Admin-only for now. ConceptBase is browsable via its own Schema page; the dispute/graph
        layer isn&apos;t covered here.
      </p>

      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`btn btn-mini${tab === 'all' ? ' btn-primary' : ''}`} onClick={() => setTab('all')}>
          All ({totalCount})
        </button>
        {BASE_REPO_CONFIGS.map((cfg) => (
          <button
            key={cfg.key}
            className={`btn btn-mini${tab === cfg.key ? ' btn-primary' : ''}`}
            onClick={() => setTab(cfg.key)}
          >
            {cfg.name} ({rowsByRepo.get(cfg.key)?.length ?? 0})
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search label…" />
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button className={`btn btn-mini${view === 'table' ? ' btn-primary' : ''}`} onClick={() => setView('table')}><Table2 size={13} />Table</button>
          <button className={`btn btn-mini${view === 'cards' ? ' btn-primary' : ''}`} onClick={() => setView('cards')}><LayoutGrid size={13} />Cards</button>
          <button className={`btn btn-mini${view === 'graph' ? ' btn-primary' : ''}`} onClick={() => setView('graph')}><Network size={13} />Graph</button>
          <button className="btn btn-mini" onClick={() => setShowReviewQueue((v) => !v)}>
            <Clock size={13} />Review queue {reviewQueue ? `(${reviewQueue.filter((i) => i.assignment.status === 'pending').length})` : ''}
          </button>
        </div>
      </div>

      {showReviewQueue && (
        <ReviewQueuePanel items={reviewQueue} supabase={supabase} onReviewed={reloadReviewQueue} />
      )}

      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : totalCount === 0 ? (
            <div className="card empty"><p>No records match.</p></div>
          ) : view === 'table' ? (
            <TableView rows={allRows} onSelect={setSelected} />
          ) : view === 'cards' ? (
            <CardsView rows={allRows} onSelect={setSelected} />
          ) : (
            <GraphView rows={allRows} onSelect={setSelected} />
          )}
        </div>

        {selected && (
          <DetailPanel
            nodeRef={selected}
            supabase={supabase}
            onClose={() => setSelected(null)}
            onSubmittedForReview={reloadReviewQueue}
          />
        )}
      </div>
    </div>
  )
}

function TableView({ rows, onSelect }: { rows: NodeRef[]; onSelect: (r: NodeRef) => void }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Repo</th>
          <th>Label</th>
          <th>Detail</th>
          <th>Review status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ repoKey, row }) => (
          <tr key={`${repoKey}:${row.id}`} onClick={() => onSelect({ repoKey, row })} style={{ cursor: 'pointer' }}>
            <td><span className="chip" style={{ borderColor: REPO_COLOR[repoKey], color: REPO_COLOR[repoKey] }}>{repoKey}</span></td>
            <td>{row.label}</td>
            <td className="muted">{row.secondary ?? row.filterValue ?? ''}</td>
            <td className="muted">{row.review_status ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CardsView({ rows, onSelect }: { rows: NodeRef[]; onSelect: (r: NodeRef) => void }) {
  return (
    <div className="grid grid-3">
      {rows.map(({ repoKey, row }) => (
        <div key={`${repoKey}:${row.id}`} className="card" style={{ cursor: 'pointer' }} onClick={() => onSelect({ repoKey, row })}>
          <span className="chip" style={{ borderColor: REPO_COLOR[repoKey], color: REPO_COLOR[repoKey], marginBottom: 6 }}>{repoKey}</span>
          <h3 style={{ marginBottom: 4 }}>{row.label}</h3>
          {row.secondary && <p className="muted" style={{ fontSize: 12 }}>{row.secondary}</p>}
          {row.review_status && <p className="muted" style={{ fontSize: 11 }}>Review: {row.review_status}</p>}
        </div>
      ))}
    </div>
  )
}

function GraphView({ rows, onSelect }: { rows: NodeRef[]; onSelect: (r: NodeRef) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const byId = new Map(rows.map((r) => [`${r.repoKey}:${r.row.id}`, r]))
    const { positions } = layoutTier(
      rows.map((r) => ({ id: `${r.repoKey}:${r.row.id}` })),
      0, 0, 900, 90, 70
    )

    const edges: { source: string; target: string; field: string }[] = []
    for (const r of rows) {
      const cfg = BASE_REPO_CONFIGS.find((c) => c.key === r.repoKey)
      if (!cfg) continue
      for (const rel of cfg.relationFields) {
        const raw = (r.row.data as any)?.[rel.field]
        const targetIds: string[] = Array.isArray(raw) ? raw : raw ? [raw] : []
        for (const targetId of targetIds) {
          const targetKey = `${rel.targetRepo}:${targetId}`
          if (byId.has(targetKey)) edges.push({ source: `${r.repoKey}:${r.row.id}`, target: targetKey, field: rel.field })
        }
      }
    }

    const elements: ElementDefinition[] = [
      ...rows.map((r) => {
        const id = `${r.repoKey}:${r.row.id}`
        const pos = positions.get(id)
        return { data: { id, label: r.row.label, repoKey: r.repoKey }, position: pos ? { x: pos.x, y: pos.y } : undefined }
      }),
      ...edges.map((e, i) => ({ data: { id: `edge-${i}`, source: e.source, target: e.target, label: e.field } })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      layout: { name: 'preset' },
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)', 'font-size': 9, 'text-wrap': 'wrap', 'text-max-width': '90px',
            'text-valign': 'bottom', 'text-margin-y': 6, color: token('--text-primary', '#0b0b0b'),
            width: 26, height: 26,
          },
        },
        ...(Object.keys(REPO_COLOR) as BaseRepoKey[]).map((key) => ({
          selector: `node[repoKey = "${key}"]`,
          style: { 'background-color': REPO_COLOR[key], shape: REPO_SHAPE[key] as any },
        })),
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': token('--text-primary', '#0b0b0b') } },
        {
          selector: 'edge',
          style: {
            width: 1, 'line-color': token('--baseline', '#c3c2b7'), 'target-arrow-color': token('--baseline', '#c3c2b7'),
            'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'font-size': 8, color: token('--text-secondary', '#52514e'),
            'opacity': 0.6,
          },
        },
      ],
    })

    cy.on('tap', 'node', (evt) => {
      const id = evt.target.id() as string
      const found = byId.get(id)
      if (found) onSelect(found)
    })

    cyRef.current = cy
    return () => { cy.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  return (
    <div>
      <div className="row" style={{ gap: 10, marginBottom: 8, flexWrap: 'wrap', fontSize: 12 }}>
        {(Object.keys(REPO_COLOR) as BaseRepoKey[]).map((key) => (
          <span key={key} className="row" style={{ gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: REPO_COLOR[key], display: 'inline-block' }} />
            {key}
          </span>
        ))}
      </div>
      <div ref={containerRef} style={{ height: 560, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Edges show relations already present in each record&apos;s own data (e.g. a question&apos;s
        <code> motivatedBy</code>, a method&apos;s <code>relatedQuestions</code>) where the target is also loaded here.
      </p>
    </div>
  )
}

function DetailPanel({
  nodeRef,
  supabase,
  onClose,
  onSubmittedForReview,
}: {
  nodeRef: NodeRef
  supabase: ReturnType<typeof createClient>
  onClose: () => void
  onSubmittedForReview: () => void
}) {
  const { repoKey, row } = nodeRef
  const [targetId, setTargetId] = useState<string | null>(null)
  const [topics, setTopics] = useState<Awaited<ReturnType<typeof listGlobalTopicsForTarget>> | null>(null)
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [newPost, setNewPost] = useState('')
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setTargetId(null); setTopics(null); setPosts([]); setNotice(null)
    resolveBaseRepoReviewTarget(supabase, { baseRepo: repoKey, recordId: row.id }).then(async (id) => {
      if (!active) return
      setTargetId(id)
      const t = await listGlobalTopicsForTarget(supabase, 'base_repo_record', id)
      if (!active) return
      setTopics(t)
      if (t.length > 0) setPosts(await listPosts(supabase, t[0].id))
    })
    return () => { active = false }
  }, [repoKey, row.id, supabase])

  const submitReview = async () => {
    setBusy(true); setNotice(null)
    const { error } = await submitBaseRepoRecordForReview(supabase, { baseRepo: repoKey, recordId: row.id })
    setBusy(false)
    setNotice(error ? error.message : 'Submitted for review.')
    if (!error) onSubmittedForReview()
  }

  const startDiscussion = async () => {
    if (!targetId || !newTopicTitle.trim()) return
    setBusy(true); setNotice(null)
    const { data, error } = await createGlobalTopic(supabase, { title: newTopicTitle.trim(), linkedType: 'base_repo_record', linkedId: targetId })
    setBusy(false)
    if (error) { setNotice(error.message); return }
    setNewTopicTitle('')
    setTopics(data ? [data, ...(topics ?? [])] : topics)
  }

  const submitPost = async () => {
    const topicId = topics?.[0]?.id
    if (!topicId || !newPost.trim()) return
    setBusy(true); setNotice(null)
    const { error } = await createPost(supabase, { topicId, content: newPost.trim() })
    setBusy(false)
    if (error) { setNotice(error.message); return }
    setNewPost('')
    setPosts(await listPosts(supabase, topicId))
  }

  return (
    <div className="card" style={{ width: 360, flexShrink: 0, position: 'sticky', top: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ marginBottom: 4 }}>{row.label}</h3>
        <button className="btn btn-mini" onClick={onClose}>×</button>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>{repoKey} · {row.id}</p>
      {row.review_status && <p className="muted" style={{ fontSize: 12 }}>Review status (source repo): {row.review_status}</p>}

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12 }} className="muted">Full record</summary>
        <pre style={{ fontSize: 10, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(row.data, null, 2)}</pre>
      </details>

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <button className="btn btn-mini" disabled={busy} onClick={submitReview}><CheckCircle2 size={13} />Submit for review</button>
      </div>
      {notice && <p className="muted" style={{ fontSize: 12 }}>{notice}</p>}

      <h4 className="row" style={{ marginTop: 16, fontSize: 13 }}><MessageSquare size={13} />Discuss</h4>
      {!topics ? (
        <p className="muted" style={{ fontSize: 12 }}>Loading…</p>
      ) : topics.length === 0 ? (
        <div className="row" style={{ gap: 6 }}>
          <input value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)} placeholder="Start a discussion…" style={{ fontSize: 12 }} />
          <button className="btn btn-mini" disabled={busy || !newTopicTitle.trim()} onClick={startDiscussion}>Start</button>
        </div>
      ) : (
        <>
          <div style={{ maxHeight: 180, overflow: 'auto', marginBottom: 6 }}>
            {posts.length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>No posts yet.</p>
            ) : (
              posts.map((p) => (
                <div key={p.id} style={{ fontSize: 12, marginBottom: 6 }}>
                  <strong>{p.author?.name ?? p.author?.email ?? 'Someone'}</strong>: {p.content}
                </div>
              ))
            )}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <input value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="Add a comment…" style={{ fontSize: 12 }} />
            <button className="btn btn-mini" disabled={busy || !newPost.trim()} onClick={submitPost}>Post</button>
          </div>
        </>
      )}
    </div>
  )
}

function ReviewQueuePanel({
  items,
  supabase,
  onReviewed,
}: {
  items: GenericReviewItem[] | null
  supabase: ReturnType<typeof createClient>
  onReviewed: () => void
}) {
  const [reviewText, setReviewText] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const decide = async (assignmentId: string, decision: 'accept' | 'reject') => {
    const text = reviewText[assignmentId]?.trim()
    if (!text) return
    setBusy(assignmentId)
    await completeGenericReview(supabase, { assignmentId, decision, reviewText: text })
    setBusy(null)
    onReviewed()
  }

  const pending = (items ?? []).filter((i) => i.assignment.status === 'pending')

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 8 }}>Review queue</h3>
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : pending.length === 0 ? (
        <p className="muted">Nothing waiting for review.</p>
      ) : (
        pending.map((item) => (
          <div key={item.assignment.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            <p><strong>{item.label}</strong> {item.detail && <span className="muted">— {item.detail}</span>}</p>
            <div className="row" style={{ gap: 6 }}>
              <input
                placeholder="Your reasoning…"
                value={reviewText[item.assignment.id] ?? ''}
                onChange={(e) => setReviewText((s) => ({ ...s, [item.assignment.id]: e.target.value }))}
                style={{ fontSize: 12, flex: 1 }}
              />
              <button className="btn btn-mini" disabled={busy === item.assignment.id} onClick={() => decide(item.assignment.id, 'accept')}>
                <CheckCircle2 size={13} />Accept
              </button>
              <button className="btn btn-mini btn-danger" disabled={busy === item.assignment.id} onClick={() => decide(item.assignment.id, 'reject')}>
                <XCircle size={13} />Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
