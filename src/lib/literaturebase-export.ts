import yaml from 'js-yaml'
import type { Database } from '@/lib/supabase/database.types'

type LiteratureRow = Database['public']['Tables']['literature_references']['Row']

const TYPE_MAP: Record<string, string> = {
  article: 'journal-article',
  book: 'book',
  chapter: 'book-chapter',
  report: 'report',
  thesis: 'thesis',
}

/**
 * Builds a literature-record.schema.json-shaped draft from a project's own
 * literature reference, for proposing back to the real LiteratureBase repo
 * (feedback 36f3fe54's "integrate with OpenEvo's LiteratureBase"). Mirrors
 * buildTheoryBaseDraftYaml's honesty constraints:
 *
 * - A real `OE-LITERATURE-*` id is only ever assigned once, permanently, by
 *   whoever actually commits it -- this proposes a slug-derived id for a
 *   human (or draft_literaturebase_contribution.mjs) to check against real
 *   collisions, not a final one.
 * - `license` describes this record's own redistribution status, not the
 *   source paper's copyright -- left as 'citation-only' (the safe default
 *   this repo's own records use when redistribution rights aren't
 *   independently confirmed) rather than guessed.
 */
export function buildLiteratureBaseDraftYaml(
  reference: Pick<LiteratureRow, 'title' | 'authors' | 'year' | 'venue' | 'doi' | 'type'> & { notes?: string | null },
  addedBy: string
): string {
  const authors = (Array.isArray(reference.authors) ? reference.authors : []) as string[]
  const firstAuthorSurname = (authors[0] ?? 'unknown').split(',')[0].trim().toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const slug = `${firstAuthorSurname || 'unknown'}-${reference.year ?? 'nd'}`

  const record: Record<string, unknown> = {
    id: `OE-LITERATURE-${slug}`,
    slug,
    citation: {
      title: reference.title,
      year: reference.year ?? null,
      authors: authors.length ? authors : ['UNKNOWN -- fill in before this is reviewed'],
      ...(reference.venue ? { venue: reference.venue } : {}),
      ...(reference.doi ? { doi: reference.doi } : {}),
    },
    type: TYPE_MAP[reference.type ?? 'article'] ?? 'journal-article',
    license: 'citation-only',
    status: 'proposed',
    provisional: {
      created: new Date().toISOString().slice(0, 10),
      blocked_on: 'Proposed from an OpenLPM project; slug/id not yet checked against real LiteratureBase content for collisions, and the DOI (if present) not yet re-verified against Crossref.',
      ...(reference.notes ? { note: `Project's own note on why this reference matters: ${reference.notes}` } : {}),
    },
    provenance: {
      extracted_by: 'human',
      added_by: addedBy,
      date: new Date().toISOString().slice(0, 10),
      review_status: 'author-draft',
      version: '0.1.0',
      contributor_notes: 'Authored in an OpenLPM project via the Literature page, proposed back to LiteratureBase per feedback 36f3fe54.',
    },
  }

  return yaml.dump(record, { lineWidth: 100, noRefs: true })
}
