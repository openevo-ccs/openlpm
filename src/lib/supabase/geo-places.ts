import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { RepositoryRecordRow } from './curriculum-repository'

type Client = SupabaseClient<Database>

export type GeoPlaceRow = Database['public']['Tables']['geo_places']['Row']

export type PlaceRecordSummary = Pick<RepositoryRecordRow, 'id' | 'title' | 'record_type' | 'jurisdiction'>

export interface PlaceMapEntry {
  place: GeoPlaceRow
  /** Records whose jurisdiction names this exact place code. */
  directRecords: PlaceRecordSummary[]
  /** directRecords plus every child place's directRecords -- for a place with no children (today: every state/region) this is the same array as directRecords. */
  rollupRecords: PlaceRecordSummary[]
}

export async function listGeoPlaces(supabase: Client): Promise<GeoPlaceRow[]> {
  const { data } = await supabase.from('geo_places').select('*')
  return data ?? []
}

/**
 * Groups a Curriculum Repository project's records by place, joined against
 * geo_places. A record's jurisdiction can name more than one place at once --
 * curriculum-crosswalk-record rows use a comma-joined value like "DE-SN,
 * DE-ST" for exactly this reason (migration 094's own seed comment) -- so
 * each named place that has a geo_places row is credited with that record.
 * Jurisdiction text that matches no known place_code is returned separately
 * as `unmapped` rather than silently dropped or guessed at.
 */
export async function listRecordsByPlace(
  supabase: Client,
  projectId: string
): Promise<{ places: PlaceMapEntry[]; unmapped: PlaceRecordSummary[] }> {
  const [{ data: records }, places] = await Promise.all([
    supabase.from('curriculum_repository_records').select('id, title, record_type, jurisdiction').eq('project_id', projectId),
    listGeoPlaces(supabase),
  ])

  const placeByCode = new Map(places.map((p) => [p.place_code, p]))
  const directByCode = new Map<string, PlaceRecordSummary[]>()
  const unmapped: PlaceRecordSummary[] = []

  for (const r of records ?? []) {
    const codes = (r.jurisdiction ?? '').split(',').map((c) => c.trim()).filter(Boolean)
    let matchedAny = false
    for (const code of codes) {
      if (!placeByCode.has(code)) continue
      matchedAny = true
      const list = directByCode.get(code) ?? []
      list.push(r)
      directByCode.set(code, list)
    }
    if (!matchedAny) unmapped.push(r)
  }

  const childrenByParent = new Map<string, GeoPlaceRow[]>()
  for (const p of places) {
    if (!p.parent_place_code) continue
    const list = childrenByParent.get(p.parent_place_code) ?? []
    list.push(p)
    childrenByParent.set(p.parent_place_code, list)
  }

  const entries: PlaceMapEntry[] = places
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((place) => {
      const directRecords = directByCode.get(place.place_code) ?? []
      const children = childrenByParent.get(place.place_code) ?? []
      const rollupRecords = children.length === 0 ? directRecords : dedupeById([...directRecords, ...children.flatMap((c) => directByCode.get(c.place_code) ?? [])])
      return { place, directRecords, rollupRecords }
    })
    .filter((entry) => entry.rollupRecords.length > 0)

  return { places: entries, unmapped }
}

function dedupeById(records: PlaceRecordSummary[]): PlaceRecordSummary[] {
  const seen = new Set<string>()
  const out: PlaceRecordSummary[] = []
  for (const r of records) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out
}
