import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { RECORD_TYPE_LABEL, type RepositoryRecordRow } from './curriculum-repository'

type Client = SupabaseClient<Database>
type StandardsDocumentRow = Database['public']['Tables']['standards_documents']['Row']

export type TimelineSource = 'repository-record' | 'standards-document'

// One row per `record_type` (schema foundation migration 094) plus a single
// group for every `standards_documents` row -- version history and
// individual policy-repository events share one timeline, per the design
// note's "Real dates on individual records too" section, grouped so a
// document's own version chain (adopted_at/effective_from/effective_until,
// migration 044) reads as its own lane rather than colliding with unrelated
// documents on one shared row.
export interface TimelineItem {
  id: string
  source: TimelineSource
  laneKey: string
  laneLabel: string
  title: string
  subtitle: string | null
  jurisdiction: string | null
  start: Date
  end: Date | null
  // No effective_from/effective_until at all -- a single point in time
  // (policy-timeline-event's event_date, or a standards_documents row with
  // only adopted_at set), rendered as a marker rather than a bar.
  isPoint: boolean
  // effective_from set, effective_until not -- still in force, drawn
  // extended to "today" rather than stopping short.
  openEnded: boolean
  // effective_until set, effective_from not -- known end, unknown start.
  openStart: boolean
  recordId: string | null
  detail: { label: string; value: string }[]
}

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null
}

function repositoryRecordToItem(r: RepositoryRecordRow): TimelineItem | null {
  const eventDate = toDate(r.event_date)
  const from = toDate(r.effective_from)
  const until = toDate(r.effective_until)
  const start = from ?? eventDate ?? until
  if (!start) return null
  return {
    id: r.id,
    source: 'repository-record',
    laneKey: r.record_type,
    laneLabel: RECORD_TYPE_LABEL[r.record_type],
    title: r.title,
    subtitle: r.jurisdiction,
    jurisdiction: r.jurisdiction,
    start,
    end: until,
    isPoint: !from && !until,
    openEnded: !!from && !until,
    openStart: !from && !!until,
    recordId: r.id,
    detail: [
      { label: 'Kind', value: RECORD_TYPE_LABEL[r.record_type] },
      ...(r.jurisdiction ? [{ label: 'Jurisdiction', value: r.jurisdiction }] : []),
    ],
  }
}

function standardsDocumentToItem(d: StandardsDocumentRow): TimelineItem | null {
  const adopted = toDate(d.adopted_at)
  const from = toDate(d.effective_from)
  const until = toDate(d.effective_until)
  const start = from ?? adopted ?? until
  if (!start) return null
  const laneKey = `standards-document:${d.jurisdiction ?? ''}:${d.subject ?? ''}`
  const laneLabel = [d.subject, d.jurisdiction].filter(Boolean).join(' · ') || 'Standards document'
  return {
    id: d.id,
    source: 'standards-document',
    laneKey,
    laneLabel,
    title: d.version_label,
    subtitle: [d.subject, d.jurisdiction].filter(Boolean).join(' · ') || null,
    jurisdiction: d.jurisdiction,
    start,
    end: until,
    isPoint: !from && !until,
    openEnded: !!from && !until,
    openStart: !from && !!until,
    recordId: null,
    detail: [
      ...(d.subject ? [{ label: 'Subject', value: d.subject }] : []),
      ...(d.jurisdiction ? [{ label: 'Jurisdiction', value: d.jurisdiction }] : []),
      { label: 'Adoption', value: d.adoption_status === 'mandated' ? 'Mandated' : 'Optional' },
      ...(d.adopted_at ? [{ label: 'Adopted', value: d.adopted_at }] : []),
    ],
  }
}

// Repository-record lanes keep the record-type order already used on the
// browse page (curriculum-repository.ts's RECORD_TYPE_LABEL); standards-
// document lanes (one per subject/jurisdiction combination) sort
// alphabetically and always come after.
export function sortLanes(items: TimelineItem[]): { laneKey: string; laneLabel: string; source: TimelineSource }[] {
  const seen = new Map<string, { laneKey: string; laneLabel: string; source: TimelineSource }>()
  for (const item of items) {
    if (!seen.has(item.laneKey)) seen.set(item.laneKey, { laneKey: item.laneKey, laneLabel: item.laneLabel, source: item.source })
  }
  const recordTypeOrder = Object.keys(RECORD_TYPE_LABEL)
  return Array.from(seen.values()).sort((a, b) => {
    if (a.source !== b.source) return a.source === 'repository-record' ? -1 : 1
    if (a.source === 'repository-record') return recordTypeOrder.indexOf(a.laneKey) - recordTypeOrder.indexOf(b.laneKey)
    return a.laneLabel.localeCompare(b.laneLabel)
  })
}

// Every curriculum_repository_records / standards_documents row for this
// project that has at least one real-world date set -- rows with none
// (the large majority today, since backfilling existing content is a
// separate pass) simply don't appear rather than cluttering the timeline
// with undated placeholders. Errors (e.g. the schema-foundation columns not
// deployed to this environment yet) resolve to an empty list, same
// swallow-and-return-empty convention `listRepositoryRecords` already uses.
export async function listTimelineItems(supabase: Client, projectId: string): Promise<TimelineItem[]> {
  const [{ data: records }, { data: documents }] = await Promise.all([
    supabase
      .from('curriculum_repository_records')
      .select('*')
      .eq('project_id', projectId)
      .or('event_date.not.is.null,effective_from.not.is.null,effective_until.not.is.null'),
    supabase
      .from('standards_documents')
      .select('*')
      .eq('project_id', projectId)
      .or('adopted_at.not.is.null,effective_from.not.is.null,effective_until.not.is.null'),
  ])

  const items: TimelineItem[] = []
  for (const r of records ?? []) {
    const item = repositoryRecordToItem(r)
    if (item) items.push(item)
  }
  for (const d of documents ?? []) {
    const item = standardsDocumentToItem(d)
    if (item) items.push(item)
  }
  return items
}
