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
  planning: 'muted',
  accepted: 'good',
  canonical: 'good',
  promoted: 'good',
  completed: 'good',
  'field-validated-curriculum': 'good',
  rejected: 'muted',
  deprecated: 'muted',
  archived: 'muted',
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
