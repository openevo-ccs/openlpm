import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  listToursForContext,
  markTourOffered,
  tourStrings,
  wasTourOffered,
  type GuidedTour,
  type TourContext,
} from '@/lib/supabase/guided-tours'
import { TourPlayer } from '@/components/guided-tour'

// Guided tours need to know where the reader is (which space, which view),
// but the Help button lives in the outer top bar, above the project routes.
// ProjectLayout reports its space and view here, the Help menu reads it, and
// the tour itself is drawn from here so it survives page changes inside the
// space (a tour moves between pages).
interface Ctx {
  space: TourContext | null
  setSpace: (space: TourContext | null) => void
  tours: GuidedTour[] | null
  refreshTours: () => void
  startTour: (tour: GuidedTour, startAt?: number) => void
  endTour: () => void
  activeTour: GuidedTour | null
}

const C = createContext<Ctx>({
  space: null,
  setSpace: () => {},
  tours: null,
  refreshTours: () => {},
  startTour: () => {},
  endTour: () => {},
  activeTour: null,
})

export function useTours() {
  return useContext(C)
}

export function TourProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [space, setSpace] = useState<TourContext | null>(null)
  const [tours, setTours] = useState<GuidedTour[] | null>(null)
  const [reload, setReload] = useState(0)
  const [active, setActive] = useState<{ tour: GuidedTour; startAt: number } | null>(null)
  const [offer, setOffer] = useState<GuidedTour | null>(null)

  const spaceKey = space ? `${space.projectId}|${space.viewId}|${space.templateId}|${space.canManage}` : ''

  useEffect(() => {
    if (!space) {
      setTours(null)
      return
    }
    let cancelled = false
    setTours(null)
    listToursForContext(supabase, space).then((list) => {
      if (!cancelled) setTours(list)
    })
    return () => {
      cancelled = true
    }
    // space itself changes identity on every publish; the key covers what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceKey, reload, supabase])

  // A tour set to "offer on first visit" is suggested once per browser, and
  // only when it is published.
  useEffect(() => {
    setOffer(null)
    if (!tours || active) return
    const candidate = tours.find((t) => t.is_published && t.offer_on_first_visit && !wasTourOffered(t.id))
    if (candidate) setOffer(candidate)
  }, [tours, active])

  const startTour = useCallback((tour: GuidedTour, startAt = 0) => {
    setOffer(null)
    setActive({ tour, startAt })
  }, [])
  const endTour = useCallback(() => setActive(null), [])
  const refreshTours = useCallback(() => setReload((n) => n + 1), [])

  const value = useMemo<Ctx>(
    () => ({ space, setSpace, tours, refreshTours, startTour, endTour, activeTour: active?.tour ?? null }),
    [space, tours, refreshTours, startTour, endTour, active],
  )

  const s = tourStrings(offer?.language ?? 'de')

  return (
    <C.Provider value={value}>
      {children}
      {active && space && (
        <TourPlayer key={active.tour.id} tour={active.tour} slug={space.slug} startAt={active.startAt} onClose={endTour} />
      )}
      {offer && !active && (
        <div className="tour-offer" role="dialog" aria-label={s.offer}>
          <p>{s.offer}</p>
          <p className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>{offer.title}</p>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary btn-mini"
              onClick={() => {
                markTourOffered(offer.id)
                startTour(offer)
              }}
            >
              {s.offerYes}
            </button>
            <button
              type="button"
              className="btn btn-mini"
              onClick={() => {
                markTourOffered(offer.id)
                setOffer(null)
              }}
            >
              {s.offerNo}
            </button>
          </div>
        </div>
      )}
    </C.Provider>
  )
}
