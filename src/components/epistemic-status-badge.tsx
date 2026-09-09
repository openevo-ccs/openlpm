import { Chip } from '@/components/chip'
import type { Database } from '@/lib/supabase/database.types'

type EpistemicStatus = Database['public']['Tables']['projects']['Row']['epistemic_status']

// Per RFC 0002 section 6: a project's synthetic/real character must stay a
// clearly visible distinction, not buried metadata. The first two values
// mirror ConceptBase's own oe:epistemicStatus (RFC-0019) exactly --
// 'designed-thought-experiment' / 'field-validated-curriculum', its only two
// real enum values as of this writing. 'in-development' is an OpenLPM-local
// third value with no ConceptBase counterpart yet (that schema's own comment
// anticipates a future 'field-piloted'-style addition via ordinary RFC, but
// hasn't added one) -- used for real, non-synthetic project work that isn't
// yet claiming field-validated status (e.g. a curriculum mid-ingestion).
const LABEL: Record<EpistemicStatus, string> = {
  'designed-thought-experiment': 'Synthetic — thought experiment',
  'field-validated-curriculum': 'Field-validated',
  'in-development': 'Real — in development',
}

export function EpistemicStatusBadge({ status }: { status: EpistemicStatus }) {
  return <Chip status={status}>{LABEL[status]}</Chip>
}
