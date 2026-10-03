import yaml from 'js-yaml'
import type { TheoryRow } from '@/lib/supabase/theories'

export interface DraftProposition {
  kind: 'proposition' | 'assumption'
  label: string
  statement: string
}

/**
 * Builds a theory-record.schema.json-shaped draft from a locally-authored
 * theory, for proposing back to the real TheoryBase repo (feedback
 * 35924e8a's "drive cycles of TheoryBase quality improvement").
 *
 * Two real gaps this has to be honest about rather than paper over:
 * - A real `OE-THEORY-*` id is only ever assigned once, permanently, by
 *   whoever actually commits it (RFC-0002) -- this proposes a slug-derived
 *   id for a human to check against real collisions, not a final one.
 * - TheoryBase's `propositions`/`assumptions` fields are arrays of ids
 *   pointing at separately-registered Proposition/Assumption records, not
 *   inline text. This project's own propositions/assumptions don't have
 *   those ids yet (minting them is its own separate contribution), so
 *   they're carried here as readable text in `provisional.note`, not
 *   stuffed into `propositions`/`assumptions` as if they were real
 *   resolvable references -- that would be a schema-shaped sentence that
 *   isn't actually true (the DOA problem the FAIR Theory workflow exists
 *   to catch).
 */
export function buildTheoryBaseDraftYaml(
  theory: Pick<TheoryRow, 'label' | 'description' | 'held_by' | 'authorship_provenance' | 'characterization_status'>,
  propositions: DraftProposition[],
  addedBy: string
): string {
  const slug = theory.label
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  // Joined with blank lines, not single newlines: js-yaml dumps a
  // multi-line string as a folded block scalar (`>-`), which collapses a
  // single `\n` into a space but preserves a blank line as a real line
  // break -- single newlines here would silently run every bullet
  // together into one paragraph once re-parsed.
  const propositionLines = propositions
    .filter((p) => p.kind === 'proposition')
    .map((p) => `- ${p.label}: ${p.statement}`)
  const assumptionLines = propositions
    .filter((p) => p.kind === 'assumption')
    .map((p) => `- ${p.label}: ${p.statement}`)

  const noteParts: string[] = []
  if (propositionLines.length) noteParts.push(`Draft propositions (not yet minted as their own OE-PROPOSITION- records):\n\n${propositionLines.join('\n\n')}`)
  if (assumptionLines.length) noteParts.push(`Draft assumptions (not yet minted as their own OE-ASSUMPTION- records):\n\n${assumptionLines.join('\n\n')}`)

  const record: Record<string, unknown> = {
    id: `OE-THEORY-${slug}`,
    slug,
    label: theory.label,
    status: 'proposed',
    heldBy: theory.held_by && theory.held_by.length > 0 ? theory.held_by : ['UNKNOWN -- fill in before this is reviewed'],
    scope: theory.description,
    authorshipProvenance: theory.authorship_provenance ?? 'native',
    characterizationStatus: theory.characterization_status ?? 'author_stated',
    provisional: {
      created: new Date().toISOString().slice(0, 10),
      blocked_on: 'Proposed from an OpenLPM project; id not yet checked against real TheoryBase content for collisions, and any decomposed propositions/assumptions below are not yet separate, resolvable TheoryBase records.',
      ...(noteParts.length ? { note: noteParts.join('\n\n') } : {}),
    },
    provenance: {
      extracted_by: 'human-llm-collaborative',
      added_by: addedBy,
      date: new Date().toISOString().slice(0, 10),
      review_status: 'author-draft',
      version: '0.1.0',
      sourceProvenance: 'Authored in an OpenLPM project via the Theories page, proposed back to TheoryBase per feedback 35924e8a.',
    },
  }

  return yaml.dump(record, { lineWidth: 100, noRefs: true })
}
