import { Chip } from '@/components/chip'
import type { Database } from '@/lib/supabase/database.types'

type EpistemicStatus = Database['public']['Tables']['projects']['Row']['epistemic_status']

// 2026-09-13 restructure: collapsed from three displayed labels (Sample/
// Growing/Adopted) to the two questions a project card actually needs to
// answer at a glance, per Dustin's direct request and confirmed with Lab
// Manager -- this stays a pure presentation change, not a schema migration.
// The enum underneath is untouched (still three values, still mirrors
// ConceptBase's oe:epistemicStatus RFC-0019 plus OpenLPM's own local
// 'in-development' extension -- see the Row type/migration 007 for that
// history); Sample = synthetic, everything else = real, which is exactly
// what this component's own prior label set already meant, just rendered as
// three chips instead of two.
//
// Known, named tradeoff: 'in-development' (real but not yet field-tested)
// and 'field-validated-curriculum' (real and field-tested) both collapse
// into "Human-Curated" here. That distinction is real and shouldn't
// silently vanish -- it belongs in the project's own description/notes, the
// same place detail has always lived rather than the chip itself.
const LABEL: Record<EpistemicStatus, string> = {
  'designed-thought-experiment': 'Synthetic-Theoretical',
  'field-validated-curriculum': 'Human-Curated',
  'in-development': 'Human-Curated',
}

// Two source enum values now share the "Human-Curated" label -- they need to
// share one color too, or the same label would render in two different chip
// colors depending on which of the two collapsed values it came from. Maps
// to the two new bucket keys added in chip.tsx rather than the raw enum.
// Exported so the project-listing pages can filter on the same two
// categories the badge displays, rather than re-deriving this mapping.
export type Curation = 'human-curated' | 'synthetic-theoretical'

export const CURATION: Record<EpistemicStatus, Curation> = {
  'designed-thought-experiment': 'synthetic-theoretical',
  'field-validated-curriculum': 'human-curated',
  'in-development': 'human-curated',
}

// Plain-language explanation for the collapsed label, shown as a hover
// tooltip -- "Human-Curated"/"Synthetic-Theoretical" reads as jargon to a
// teacher seeing it for the first time.
const GLOSS: Record<EpistemicStatus, string> = {
  'designed-thought-experiment': 'A designed thought experiment -- not yet tried with real students.',
  'field-validated-curriculum': 'Made by real teachers and researchers, and already tried in a classroom.',
  'in-development': 'Made by real teachers and researchers, not yet tried in a classroom.',
}

export function EpistemicStatusBadge({ status }: { status: EpistemicStatus }) {
  return (
    <span title={GLOSS[status]}>
      <Chip status={CURATION[status]}>{LABEL[status]}</Chip>
    </span>
  )
}
