import { useState, type ReactNode } from 'react'
import { Flag, ThumbsUp } from 'lucide-react'
import type { FieldReviewState } from '@/lib/supabase/base-repo-field-reviews'

// The thumbs-up and flag next to one field in the Explorer's edit form (feedback 1551a6e1, Susan Hanisch 2026-11-25).
// A click saves at once, apart from the form's own Save button. Clicking a control that is already on takes it away.
// A flag asks what looks wrong first (optional), so the next person knows what to look at.

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function FieldReviewControls({
  label, fieldLabel, state, unavailableReason, busy, onApprove, onFlag, onClear,
}: {
  /** The field's own label, shown at the left of the row that holds the buttons. */
  label: ReactNode
  fieldLabel: string
  state: FieldReviewState
  /** Why the controls cannot be used for this field right now (unsaved change, empty field). Shown as the buttons' hint. */
  unavailableReason: string | null
  busy: boolean
  onApprove: () => void
  onFlag: (note: string) => void
  onClear: () => void
}) {
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const approved = state.kind === 'approved'
  const flagged = state.kind === 'flagged'
  const who = (state.kind === 'none' ? '' : state.review.reviewer_name) || 'Someone'

  return (
    <div data-testid="field-review" data-state={state.kind}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'nowrap' }}>
      {label}
      <span className="row" style={{ gap: 4, justifyContent: 'flex-end', flexWrap: 'nowrap', flexShrink: 0 }}>
        <button
          type="button" className="btn btn-mini" aria-pressed={approved} aria-label={`Approve ${fieldLabel}`} data-testid="field-approve"
          disabled={busy || (!approved && !!unavailableReason)}
          title={approved ? 'Take the thumbs-up away' : unavailableReason ?? 'This text is correct as it stands'}
          style={approved ? { background: 'var(--success-bg, #e6f4ea)', borderColor: 'var(--success, #2e7d32)', color: 'var(--success-text, #1b5e20)' } : undefined}
          onClick={() => { setAsking(false); if (approved) onClear(); else onApprove() }}
        >
          <ThumbsUp size={13} />
        </button>
        <button
          type="button" className="btn btn-mini" aria-pressed={flagged} aria-label={`Flag ${fieldLabel}`} data-testid="field-flag"
          disabled={busy || (!flagged && !!unavailableReason)}
          title={flagged ? 'Take the flag away' : unavailableReason ?? 'Something here needs another look'}
          style={flagged ? { background: 'var(--warning-bg, #fff4e5)', borderColor: 'var(--warning)', color: 'var(--warning-text)' } : undefined}
          onClick={() => { if (flagged) { setAsking(false); onClear() } else setAsking((a) => !a) }}
        >
          <Flag size={13} />
        </button>
      </span>
      </div>
      {asking && !flagged && (
        <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'nowrap' }}>
          <input
            autoFocus aria-label={`What looks wrong in ${fieldLabel}?`} data-testid="field-flag-note" value={note} placeholder="What looks wrong? (optional)"
            style={{ flex: 1, fontSize: 12, minWidth: 0 }} onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onFlag(note); setAsking(false); setNote('') } }}
          />
          <button type="button" className="btn btn-mini" data-testid="field-flag-save" disabled={busy} onClick={() => { onFlag(note); setAsking(false); setNote('') }}>Flag</button>
        </div>
      )}
      {approved && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Approved by {who}, {when(state.review.reviewed_at)}</div>}
      {state.kind === 'approved-changed' && <div className="muted" style={{ fontSize: 11, marginTop: 2 }} data-testid="field-approval-outdated">Approved by {who} on {when(state.review.reviewed_at)}, before the text changed</div>}
      {flagged && <div style={{ fontSize: 11, marginTop: 2, color: 'var(--warning-text)' }}>Flagged by {who}, {when(state.review.reviewed_at)}{state.review.note ? `: ${state.review.note}` : ''}</div>}
    </div>
  )
}
