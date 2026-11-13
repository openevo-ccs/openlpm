import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

// The review area of the Base Repo Explorer (Dustin, 2026-11-13: "all the features for reviewing are totally taking up way too much space in
// the user interface for each base repo view ... maybe just a different way to go into the review space"). Everything about reviewing sits
// behind one "Review" button in the toolbar and opens here instead of above the table: what waits for review, the edits that still have to go
// back to the source repos, and for TeachingBase the lesson links with their progress and the reviewers. "Back" returns to the repo view.

export type ReviewSectionKey = 'queue' | 'edits' | 'lessons'

export interface ReviewSectionInfo {
  key: ReviewSectionKey
  label: string
  /** Number shown next to the label, when there is one. */
  count?: number | null
}

export function ReviewSpace({
  repoName, sections, section, onSection, onClose, children,
}: {
  /** Name of the repo view the person came from, for the "Back" button. */
  repoName: string
  sections: ReviewSectionInfo[]
  section: ReviewSectionKey
  onSection: (key: ReviewSectionKey) => void
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div data-testid="review-space" style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" className="btn btn-mini" onClick={onClose} data-testid="review-space-back"><ArrowLeft size={13} />Back to {repoName}</button>
        <h2 style={{ margin: 0, fontSize: 18 }}>Review</h2>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="tablist" aria-label="Review sections">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={s.key === section}
              className={`btn btn-mini${s.key === section ? ' btn-primary' : ''}`}
              onClick={() => onSection(s.key)}
            >
              {s.label}{s.count !== null && s.count !== undefined ? ` (${s.count})` : ''}
            </button>
          ))}
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}
