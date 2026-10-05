import { AlertTriangle, ArrowLeftRight, Building2, CalendarClock, FileText, Flag, GitBranch, Lightbulb, Scale, type LucideIcon } from 'lucide-react'
import { RECORD_TYPE_LABEL, type RepositoryRecordRow } from './supabase/curriculum-repository'

type RecordType = RepositoryRecordRow['record_type']

// The real gap behind the 2026-10-05 feedback cluster on the Curriculum
// Repository's list/map/timeline views: every record renders through the
// same generic template, so there's no visual or written cue for what KIND
// of thing you're looking at -- an institution, a dated event, an analytical
// finding, a draft proposal -- before reading the whole thing. One icon,
// one color, and one plain-language sentence per kind, defined once here and
// reused everywhere a record shows up (list rows, the detail panel, the
// map's place sidebar) so the same visual language holds across all three
// views instead of each one inventing its own.
//
// Reuses the app's existing 6-color categorical palette (--map-1..6, see
// globals.css / concepts-page.tsx's taxonomy map) rather than introducing a
// 7th-9th color for 9 record kinds -- two pairs of rarer kinds share a
// color, distinguished by icon instead.
export const RECORD_TYPE_ICON: Record<RecordType, LucideIcon> = {
  'institutional-actor-record': Building2,
  'institutional-mandate-record': Scale,
  'policy-timeline-event': CalendarClock,
  'coherence-finding-record': AlertTriangle,
  'latent-connection-record': GitBranch,
  'curriculum-crosswalk-record': ArrowLeftRight,
  'synthetic-curriculum-redesign-record': Lightbulb,
  'policy-principle-record': Flag,
  'policy-brief-manifest': FileText,
}

export const RECORD_TYPE_COLOR: Record<RecordType, string> = {
  'institutional-actor-record': 'var(--map-3)',
  'institutional-mandate-record': 'var(--map-4)',
  'policy-timeline-event': 'var(--map-5)',
  'coherence-finding-record': 'var(--map-2)',
  'latent-connection-record': 'var(--map-1)',
  'curriculum-crosswalk-record': 'var(--map-1)',
  'synthetic-curriculum-redesign-record': 'var(--map-6)',
  'policy-principle-record': 'var(--map-6)',
  'policy-brief-manifest': 'var(--map-4)',
}

// One plain sentence explaining what this kind of record actually IS --
// shown the first time someone encounters it (the detail panel, and the new
// list-page legend) rather than assumed from the label alone. Written for a
// researcher or policy collaborator with no prior OpenLPM context, not for
// someone who already knows this schema.
export const RECORD_TYPE_BLURB: Record<RecordType, string> = {
  'institutional-actor-record': 'A real government office, ministry, or institution involved in this curriculum.',
  'institutional-mandate-record': 'A law, decree, or official requirement that is in force over a period of time.',
  'policy-timeline-event': 'Something that happened at a specific point in time -- a policy launched, a document adopted, a body created.',
  'coherence-finding-record': 'An analytical observation about a gap, overlap, or inconsistency in how this curriculum is structured -- not an official document itself.',
  'latent-connection-record': 'A possible relationship between two things in this repository that has not been confirmed yet.',
  'curriculum-crosswalk-record': 'A side-by-side comparison of how two different places handle the same topic.',
  'synthetic-curriculum-redesign-record': 'A draft proposal for how a piece of curriculum could be restructured -- a suggestion, not something official.',
  'policy-principle-record': "A stated guiding principle behind this jurisdiction's curriculum policy.",
  'policy-brief-manifest': 'A short written brief summarizing policy findings or recommendations.',
}

/** Small icon + colored dot matching a record's kind, for consistent use in list rows, map sidebars, and detail headers. */
export function RecordKindIcon({ type, size = 13 }: { type: RecordType; size?: number }) {
  const Icon = RECORD_TYPE_ICON[type]
  const color = RECORD_TYPE_COLOR[type]
  return <Icon size={size} style={{ color, flexShrink: 0 }} />
}

/** Icon + label + (optionally) the one-line plain-language explainer, for anywhere a record's kind needs introducing rather than just naming. */
export function RecordKindLine({ type, withBlurb = false }: { type: RecordType; withBlurb?: boolean }) {
  return (
    <span className="row" style={{ gap: 5, fontSize: 11, color: 'var(--text-secondary)', alignItems: 'center' }}>
      <RecordKindIcon type={type} />
      <span>
        {RECORD_TYPE_LABEL[type]}
        {withBlurb && <span className="muted"> — {RECORD_TYPE_BLURB[type]}</span>}
      </span>
    </span>
  )
}
