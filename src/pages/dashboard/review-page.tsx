import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CheckCircle2, Clock, ExternalLink, XCircle } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { useSession } from '@/state/session'
import { listPendingConnections, reviewConnection, type PendingConnection } from '@/lib/supabase/coherence'

// The journal-submission-style gate for new connections: propose (the
// coherence tool's "record a connection" form), cite evidence if there is
// any, get reviewed by someone other than the proposer, only then does it
// reach lpm_connections.status='accepted' and become visible on the
// teacher-facing Explore view (see curriculum.ts's own status filter).
// Deliberately lightweight -- no reviewer assignment step, no multi-round
// revision cycle, matching Commons' own precedent (RFC 0006 §-equivalent
// decision, relayed via lab-manager: "any active user can review" by
// default) rather than a heavier academic-journal process this app's small
// curriculum teams don't need.
export default function ReviewPage() {
  const { project, defaultBranchId, role, supabase } = useOutletContext<ProjectOutletContext>()
  const { session } = useSession()
  const [items, setItems] = useState<PendingConnection[] | null>(null)
  const canReview = role !== 'viewer'

  const reload = () => listPendingConnections(supabase, project.id, defaultBranchId).then(setItems)

  useEffect(() => {
    setItems(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id, defaultBranchId])

  return (
    <div>
      <h1 className="row"><Clock size={18} style={{ color: 'var(--text-muted)' }} />Review queue</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Every connection proposed here waits for someone other than its author to check it before
        it reaches the topic-browsing view teachers actually use. Already-established curriculum
        content never had to go through this — it's for new additions only.
      </p>

      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card empty">
          <CheckCircle2 size={32} />
          <p>Nothing waiting for review.</p>
        </div>
      ) : (
        items.map((item) => (
          <ReviewCard
            key={item.connection.id}
            item={item}
            canReview={canReview}
            isOwnProposal={!!session && item.connection.created_by === session.user.id}
            projectId={project.id}
            supabase={supabase}
            onReviewed={reload}
          />
        ))
      )}
    </div>
  )
}

function ReviewCard({
  item,
  canReview,
  isOwnProposal,
  projectId,
  supabase,
  onReviewed,
}: {
  item: PendingConnection
  canReview: boolean
  isOwnProposal: boolean
  projectId: string
  supabase: ProjectOutletContext['supabase']
  onReviewed: () => void
}) {
  const [reviewText, setReviewText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const decide = async (decision: 'accepted' | 'rejected') => {
    if (!reviewText.trim()) {
      setError('Say why, even briefly — a decision with no reasoning is exactly what this queue exists to avoid.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: err } = await reviewConnection(supabase, { projectId, connectionId: item.connection.id, decision, reviewText: reviewText.trim() })
    setBusy(false)
    if (err) setError(err.message)
    else onReviewed()
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ marginBottom: 4 }}>
          {item.fromObject.title} <ExternalLink size={11} style={{ display: 'inline', margin: '0 4px', color: 'var(--text-muted)' }} /> {item.toObject.title}
        </h3>
        <span className={`chip ${item.connection.kind === 'asserted' ? 'chip-good' : 'chip-draft'}`}>{item.connection.kind}</span>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Grade {item.fromObject.grade_band} → Grade {item.toObject.grade_band}</p>
      <p><strong>Proposed reason:</strong> {item.connection.rationale}</p>

      {item.evidence.length > 0 ? (
        <p className="muted">
          <strong>Cited:</strong> {item.evidence.map((e) => e.reference?.title).filter(Boolean).join('; ')}
        </p>
      ) : (
        <p className="muted">No literature cited — backed only by the proposer&apos;s own reasoning above.</p>
      )}

      {!canReview ? (
        <p className="muted">Only editors and above can review proposals here.</p>
      ) : isOwnProposal ? (
        <div className="notice">You proposed this one — someone else needs to review it.</div>
      ) : (
        <>
          <div className="field">
            <label>Your reasoning for accepting or rejecting</label>
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
          </div>
          {error && <div className="notice notice-bad">{error}</div>}
          <div className="row">
            <button className="btn" style={{ borderColor: 'var(--good)', color: 'var(--good)' }} disabled={busy} onClick={() => decide('accepted')}>
              <CheckCircle2 size={14} />Accept
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={() => decide('rejected')}>
              <XCircle size={14} />Reject
            </button>
          </div>
        </>
      )}
    </div>
  )
}
