import { Chip } from '@/components/chip'
import type { Database } from '@/lib/supabase/database.types'

type Maturity = Database['public']['Tables']['projects']['Row']['maturity']

// Plain-language maturity status for a Project -- separate from
// EpistemicStatusBadge (is this content real or a thought experiment).
// "Draft" covers everything a Branch used to mean: an early idea, a
// try-it-out effort, something that might grow into more. "Established"
// covers everything from "this is the main Project Space" down to "this is
// a fully proven regional curriculum already in real use." One word each,
// no in-between tier, matching how a teacher would actually describe it.
const LABEL: Record<Maturity, string> = {
  draft: 'Draft',
  established: 'Established',
}

export function MaturityBadge({ status }: { status: Maturity }) {
  return <Chip status={status === 'draft' ? 'proposed' : 'accepted'}>{LABEL[status]}</Chip>
}
