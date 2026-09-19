import { cn } from '@/lib/utils'

// Colors by MEANING, not literal enum value (see globals.css's chip rules),
// so this one component covers every status column in the app: literature/
// data-object status (draft/submitted/under_review/accepted/rejected),
// schema-element status (proposed/discussed/accepted/deprecated), branch
// status (active/promoted/merged/archived), project status, and portfolio
// visibility. Add a new status value to the bucket map below rather than a
// new bespoke chip class in globals.css.
const BUCKET: Record<string, string> = {
  draft: 'draft',
  proposed: 'draft',
  submitted: 'progress',
  under_review: 'progress',
  discussed: 'progress',
  pending: 'progress',
  active: 'progress',
  'in-development': 'progress',
  'designed-thought-experiment': 'draft',
  // Collapsed Human-Curated/Synthetic-Theoretical project badge (see
  // epistemic-status-badge.tsx) -- a derived display key, not a raw enum
  // value, so both source values that mean "real" share one color.
  'human-curated': 'good',
  'synthetic-theoretical': 'draft',
  planning: 'muted',
  accepted: 'good',
  canonical: 'good',
  promoted: 'good',
  completed: 'good',
  'field-validated-curriculum': 'good',
  // Real, deliberate outcomes -- "didn't make it," not "nothing to report"
  // the way the rest of the muted bucket is -- so these get a real color
  // instead of blending into the plain background every other status avoids.
  rejected: 'critical',
  deprecated: 'critical',
  archived: 'critical',
  merged: 'muted',
  discontinued: 'muted',
  paused: 'muted',
  // Standards version-diff change types (RFC 0003 / data/frameworks/*.json).
  'content-added': 'good',
  'content-removed': 'muted',
  'wording-refinement': 'progress',
  'wording-simplification': 'progress',
  'example-changed': 'progress',
  restructured: 'draft',
  'grade-band-split': 'draft',
  'new-grade-band-coverage': 'draft',
  // Import license verdicts (src/lib/importers/commonStandardsProject.ts).
  allow_full: 'good',
  citation_only: 'draft',
  blocked: 'critical',
  // Feedback triage status (admin-feedback-page.tsx).
  open: 'progress',
  resolved: 'good',
  // Feedback tag (feedback-widget.tsx / admin-feedback-page.tsx) -- capitalized
  // to match the DB CHECK constraint's exact values, unlike every other key here.
  Problem: 'critical',
  Request: 'progress',
  Other: 'muted',
}

export function Chip({ status, children }: { status: string; children?: React.ReactNode }) {
  const bucket = BUCKET[status] ?? 'muted'
  return (
    <span className={cn('chip', `chip-${bucket}`)}>
      <span className="dot" />
      {children ?? status.replace(/[_-]/g, ' ')}
    </span>
  )
}
