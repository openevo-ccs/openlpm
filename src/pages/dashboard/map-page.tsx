import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Map as MapIcon, Info, Plus, Minus } from 'lucide-react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import type { ProjectOutletContext } from './project-layout'
import { listRecordsByPlace, type PlaceMapEntry, type PlaceRecordSummary } from '@/lib/supabase/geo-places'
import { RECORD_TYPE_LABEL } from '@/lib/supabase/curriculum-repository'

// Public-domain (Natural Earth, via world-atlas) country outlines, fetched
// client-side by react-simple-maps at render time. This repo stores none of
// that shape data itself. It's purely visual context for where geo_places'
// points sit -- which records belong where is decided entirely by
// jurisdiction/geo_places, joined in listRecordsByPlace.
const WORLD_GEOGRAPHY_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const MIN_ZOOM = 1
const MAX_ZOOM = 24

// A stable reference for the "still loading" case -- `data?.places ?? []`
// would otherwise hand back a brand-new empty array every render, which
// breaks the useMemo/useEffect below (computeView's result would never
// compare equal to itself, feeding setView in an infinite render loop).
const NO_PLACES: PlaceMapEntry[] = []

/** Centers and zooms on the bounding box of places that actually have content, so a project with everything in one country (or one state) opens already readable instead of a tiny dot on a world view. Real German states sit close enough together that even a single-country view needs a fairly tight span to keep neighboring markers from overlapping -- the +/- controls cover anything this guess doesn't get exactly right. */
function computeView(entries: PlaceMapEntry[]): { center: [number, number]; zoom: number } {
  const points = entries.map((e) => [e.place.longitude as number, e.place.latitude as number] as [number, number])
  if (points.length === 0) return { center: [10, 20], zoom: 1 }
  const lons = points.map((p) => p[0])
  const lats = points.map((p) => p[1])
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const center: [number, number] = [(minLon + maxLon) / 2, (minLat + maxLat) / 2]
  const span = Math.max(maxLon - minLon, maxLat - minLat)
  const zoom = span < 2 ? 14 : span < 5 ? 9 : span < 10 ? 6 : span < 30 ? 3 : span < 80 ? 1.5 : 1
  return { center, zoom: Math.min(MAX_ZOOM, zoom) }
}

export default function MapPage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const navigate = useNavigate()
  const [data, setData] = useState<{ places: PlaceMapEntry[]; unmapped: PlaceRecordSummary[] } | null>(null)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [view, setView] = useState<{ center: [number, number]; zoom: number }>({ center: [10, 20], zoom: 1 })

  // A curriculum-repository-custom-view (migration 095) holds no records of
  // its own -- it's a view of its parent Curriculum Repository's content --
  // so this resolves to the PARENT's id, same as curriculum-repository-page.tsx/timeline-page.tsx.
  const repoProjectId =
    (project as any).project_kind === 'curriculum-repository-custom-view'
      ? ((project as any).parent_project_id ?? project.id)
      : project.id

  useEffect(() => {
    setData(null)
    setSelectedCode(null)
    listRecordsByPlace(supabase, repoProjectId).then(setData)
  }, [supabase, repoProjectId])

  const places = data?.places ?? NO_PLACES
  const defaultView = useMemo(() => computeView(places), [places])
  useEffect(() => setView(defaultView), [defaultView])
  const maxCount = useMemo(() => Math.max(1, ...places.map((p) => p.rollupRecords.length)), [places])
  const zoomBy = (factor: number) => setView((v) => ({ ...v, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor)) }))
  const totalRecords = useMemo(() => places.reduce((sum, p) => sum + p.directRecords.length, 0), [places])
  const selected = places.find((p) => p.place.place_code === selectedCode) ?? null

  return (
    <div>
      <h1 className="row"><MapIcon size={18} style={{ color: 'var(--text-muted)' }} />Map</h1>
      <p className="muted" style={{ marginBottom: 12, maxWidth: 640 }}>
        Where this repository&apos;s content is actually tagged to. Dot size reflects how much is
        filed there; a country&apos;s dot also rolls up everything filed under one of its regions.
        Click a place to see what&apos;s there.
      </p>

      {data === null ? (
        <p className="muted">Loading…</p>
      ) : places.length === 0 ? (
        <div className="card empty">
          <MapIcon size={32} />
          <p>No jurisdiction-tagged content to plot yet.</p>
        </div>
      ) : (
        <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', flex: '3 1 480px', minHeight: 480 }}>
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button type="button" className="btn btn-mini" aria-label="Zoom in" onClick={() => zoomBy(1.6)}><Plus size={13} /></button>
              <button type="button" className="btn btn-mini" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.6)}><Minus size={13} /></button>
            </div>
            <ComposableMap projectionConfig={{ scale: 150 }} style={{ width: '100%', height: 480, display: 'block' }}>
              <ZoomableGroup
                center={view.center}
                zoom={view.zoom}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                onMoveEnd={({ coordinates, zoom: z }) => { if (coordinates) setView({ center: coordinates, zoom: z ?? view.zoom }) }}
              >
                <Geographies geography={WORLD_GEOGRAPHY_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="var(--border)"
                        stroke="var(--background, #fff)"
                        strokeWidth={0.5}
                        style={{ outline: 'none' }}
                      />
                    ))
                  }
                </Geographies>
                {places.map((entry) => {
                  const count = entry.rollupRecords.length
                  // Markers live inside ZoomableGroup's own scale transform,
                  // so a fixed SVG radius would grow right along with the
                  // zoom -- the gap between two close points and their size
                  // would grow in lockstep, and zooming in would never
                  // actually separate them. Dividing by the current zoom
                  // factor keeps the on-screen size roughly constant, so
                  // zooming in genuinely increases the visual gap between
                  // nearby markers (standard technique for point markers on
                  // a zoomable projection).
                  const radius = (4 + 9 * Math.sqrt(count / maxCount)) / view.zoom
                  const isSelected = entry.place.place_code === selectedCode
                  return (
                    <Marker
                      key={entry.place.place_code}
                      coordinates={[entry.place.longitude as number, entry.place.latitude as number]}
                      onClick={() => setSelectedCode(entry.place.place_code)}
                      style={{ cursor: 'pointer' }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${entry.place.display_name} — ${count} record${count === 1 ? '' : 's'}`}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCode(entry.place.place_code) } }}
                    >
                      <circle
                        r={radius}
                        fill="var(--brand-teal)"
                        fillOpacity={0.7}
                        stroke={isSelected ? 'var(--brand-navy)' : '#fff'}
                        strokeWidth={(isSelected ? 2.5 : 1) / view.zoom}
                      />
                    </Marker>
                  )
                })}
              </ZoomableGroup>
            </ComposableMap>
          </div>

          <div className="card" style={{ flex: '1 1 280px', minHeight: 300 }}>
            {selected ? (
              <PlaceDetail entry={selected} allPlaces={places} onNavigateRecord={(id) => navigate(`/dashboard/${project.slug}/curriculum-repository/${id}`)} />
            ) : (
              <p className="muted">
                Click a place on the map. ({places.length} place{places.length === 1 ? '' : 's'} with content, {totalRecords} record{totalRecords === 1 ? '' : 's'} total)
              </p>
            )}

            {data.unmapped.length > 0 && (
              <div className="notice" style={{ marginTop: 12 }}>
                <Info size={14} />
                {data.unmapped.length} record{data.unmapped.length === 1 ? '' : 's'} {data.unmapped.length === 1 ? "isn't" : "aren't"} shown on the map — their jurisdiction value doesn&apos;t match a place this map knows about yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PlaceDetail({
  entry,
  allPlaces,
  onNavigateRecord,
}: {
  entry: PlaceMapEntry
  allPlaces: PlaceMapEntry[]
  onNavigateRecord: (recordId: string) => void
}) {
  const { place, directRecords, rollupRecords } = entry
  const parent = place.parent_place_code ? allPlaces.find((p) => p.place.place_code === place.parent_place_code) : null
  const hasRollup = rollupRecords.length !== directRecords.length

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: 2 }}>{place.display_name}</h3>
      {parent && <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Part of {parent.place.display_name}</p>}
      <p className="muted" style={{ fontSize: 13 }}>
        {rollupRecords.length} record{rollupRecords.length === 1 ? '' : 's'}{hasRollup ? ' filed here or in a place under it' : ' filed here'}
      </p>
      <div style={{ maxHeight: 440, overflowY: 'auto' }}>
        {rollupRecords.map((r) => (
          <button
            key={r.id}
            className="btn-linklike"
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0' }}
            onClick={() => onNavigateRecord(r.id)}
          >
            {r.title}
            <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>
              {RECORD_TYPE_LABEL[r.record_type]}{r.jurisdiction ? ` · ${r.jurisdiction}` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
