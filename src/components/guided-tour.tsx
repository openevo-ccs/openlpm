import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { anchorSelector } from '@/lib/tour-anchors'
import { tourStrings, type GuidedTour } from '@/lib/supabase/guided-tours'

// Draws one guided tour: a dimmed screen with a bright window around the part
// being explained, and a card beside it with the text and Back/Next buttons.
// The bright window never blocks clicks, so a step can ask the reader to try
// something on the very element it points at ("Probiere es aus").
//
// A step can live on another page of the space; moving to it happens only when
// the step changes, so a reader who wanders off is not dragged back.

const PAD = 6
const GAP = 14
const EDGE = 12
// How long a step waits for its target before it explains that the part is
// not on screen.
const SETTLE_MS = 1400
// How long before a step clicks its "open first" element.
const OPEN_FIRST_MS = 700

interface Box {
  top: number
  left: number
  width: number
  height: number
}

function sameBox(a: Box | null, b: Box | null) {
  if (!a || !b) return a === b
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  )
}

function stripSlashes(path: string) {
  return path.replace(/\/+$/, '')
}

function onRightPage(pathname: string, slug: string, page: string): boolean {
  const base = `/dashboard/${slug}`
  const here = stripSlashes(pathname)
  if (page === '') {
    // The start page also answers at /<space>/<goal id> when a goal is deep-linked.
    return here === base || new RegExp(`^${base}/[0-9a-f-]{36}$`).test(here)
  }
  return here === `${base}/${page}`
}

function place(card: HTMLElement, box: Box | null) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cw = card.offsetWidth
  const ch = card.offsetHeight
  const clampX = (x: number) => Math.max(EDGE, Math.min(x, vw - cw - EDGE))
  const clampY = (y: number) => Math.max(EDGE, Math.min(y, vh - ch - EDGE))
  let x: number
  let y: number

  if (!box) {
    x = (vw - cw) / 2
    y = Math.max(EDGE, (vh - ch) / 2)
  } else {
    const t = box.top - PAD
    const l = box.left - PAD
    const r = box.left + box.width + PAD
    const b = box.top + box.height + PAD
    const fits = (cx: number, cy: number) => cx >= EDGE && cy >= EDGE && cx + cw <= vw - EDGE && cy + ch <= vh - EDGE
    const narrow = vw < 700
    const candidates: Array<[number, number]> = narrow
      ? [
          [clampX(l), b + GAP],
          [clampX(l), t - ch - GAP],
        ]
      : [
          [r + GAP, clampY(t)],
          [l - cw - GAP, clampY(t)],
          [clampX(l), b + GAP],
          [clampX(l), t - ch - GAP],
        ]
    const hit = candidates.find(([cx, cy]) => fits(cx, cy))
    if (hit) {
      ;[x, y] = hit
    } else {
      // The target is too large to sit beside: take the first corner of the
      // screen that does not cover it.
      const corners: Array<[number, number]> = [
        [vw - cw - EDGE - 4, vh - ch - EDGE],
        [EDGE, vh - ch - EDGE],
        [vw - cw - EDGE - 4, EDGE],
        [EDGE, EDGE],
      ]
      const free = corners.find(
        ([cx, cy]) => cx + cw < l || cx > r || cy + ch < t || cy > b,
      )
      ;[x, y] = free ?? corners[0]
    }
  }
  card.style.left = `${Math.round(x)}px`
  card.style.top = `${Math.round(y)}px`
}

export function TourPlayer({
  tour,
  slug,
  startAt,
  onClose,
}: {
  tour: GuidedTour
  slug: string
  startAt: number
  onClose: () => void
}) {
  const s = tourStrings(tour.language)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const steps = tour.steps
  const [index, setIndex] = useState(Math.min(Math.max(startAt, 0), Math.max(steps.length - 1, 0)))
  const step = steps[index]
  const [box, setBox] = useState<Box | null>(null)
  const [settled, setSettled] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const stepStartedAt = useRef(0)
  const openedFirst = useRef(false)
  const scrolledFor = useRef<Element | null>(null)
  const pathRef = useRef(pathname)
  pathRef.current = pathname

  const wantedPage = step?.page
  const pageOk = wantedPage === undefined || onRightPage(pathname, slug, wantedPage)

  // Moving to a step: go to its page, restart the waiting clock.
  useEffect(() => {
    stepStartedAt.current = performance.now()
    openedFirst.current = false
    scrolledFor.current = null
    setBox(null)
    setSettled(false)
    if (wantedPage !== undefined && !onRightPage(pathRef.current, slug, wantedPage)) {
      navigate(`/dashboard/${slug}${wantedPage ? `/${wantedPage}` : ''}`)
    }
    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [index, wantedPage, slug, navigate])

  // Follow the target every frame. The page can re-render, scroll, resize or
  // show the part late (the subtopic menu only exists after a topic is chosen),
  // so the element is looked up again each time instead of kept.
  useEffect(() => {
    if (!step?.anchor) {
      setBox(null)
      return
    }
    let frame = 0
    const loop = () => {
      const el = document.querySelector(anchorSelector(step.anchor as string)) as HTMLElement | null
      let next: Box | null = null
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) next = { top: r.top, left: r.left, width: r.width, height: r.height }
      }
      if (!el || !next) {
        scrolledFor.current = null
        const waited = performance.now() - stepStartedAt.current
        if (step.openFirst && !openedFirst.current && waited > OPEN_FIRST_MS && pageOk) {
          const opener = document.querySelector(anchorSelector(step.openFirst)) as HTMLElement | null
          if (opener) {
            openedFirst.current = true
            opener.click()
          }
        }
      } else if (scrolledFor.current !== el) {
        scrolledFor.current = el
        const r = el.getBoundingClientRect()
        const vh = window.innerHeight
        const fullyVisible = r.top >= 70 && r.bottom <= vh - 20
        if (!fullyVisible) {
          el.style.scrollMarginTop = '84px'
          el.scrollIntoView({ block: r.height > vh * 0.6 ? 'start' : 'center', behavior: 'smooth' })
        }
      }
      setBox((prev) => (sameBox(prev, next) ? prev : next))
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [step, pageOk])

  useLayoutEffect(() => {
    if (cardRef.current) place(cardRef.current, box)
  })

  useEffect(() => {
    const onResize = () => cardRef.current && place(cardRef.current, box)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [box])

  const last = index >= steps.length - 1
  const goNext = useCallback(() => {
    if (last) onClose()
    else setIndex((i) => i + 1)
  }, [last, onClose])
  const goBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goBack()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [goNext, goBack, onClose])

  if (!step) return null

  const pointing = !!step.anchor
  const found = pointing && !!box
  const missing = pointing && !box && settled
  // Hold the card back until the target shows up, so it does not jump.
  const ready = !pointing || found || settled
  const paragraphs = step.body.split(/\n{2,}/).filter(Boolean)

  return (
    <div className="tour-layer" data-tour-layer>
      {found && box ? (
        <div
          className="tour-spot"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
          }}
        />
      ) : (
        <div className="tour-dim" />
      )}

      <div
        ref={cardRef}
        className="tour-card"
        role="dialog"
        aria-live="polite"
        aria-label={step.title}
        style={{ visibility: ready ? 'visible' : 'hidden' }}
      >
        <div className="tour-card-top">
          <span className="tour-count">{s.step(index + 1, steps.length)}</span>
          <button type="button" className="tour-x" onClick={onClose} aria-label={s.end} title={s.end}>
            <X size={15} />
          </button>
        </div>
        <div className="tour-progress" aria-hidden="true">
          <div style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>

        <h3 className="tour-title">{step.title}</h3>
        {paragraphs.map((p, i) => (
          <p key={i} className="tour-body">{p}</p>
        ))}

        {step.tryIt && !missing && (
          <div className="tour-try">
            <strong>{s.tryIt}</strong>
            <span>{step.tryIt}</span>
          </div>
        )}

        {missing && (
          <div className="tour-missing">
            <span>{step.hint || s.notVisible}</span>
            {!pageOk && wantedPage !== undefined && (
              <button
                type="button"
                className="btn btn-mini"
                style={{ marginTop: 6 }}
                onClick={() => navigate(`/dashboard/${slug}${wantedPage ? `/${wantedPage}` : ''}`)}
              >
                {s.goToPage}
              </button>
            )}
          </div>
        )}

        <div className="tour-actions">
          <button type="button" className="btn btn-mini" onClick={goBack} disabled={index === 0}>
            <ChevronLeft size={13} />
            {s.back}
          </button>
          <button type="button" className="btn btn-primary btn-mini" onClick={goNext}>
            {last ? s.done : s.next}
            {!last && <ChevronRight size={13} />}
          </button>
        </div>
        <button type="button" className="tour-end" onClick={onClose}>{s.end}</button>
      </div>
    </div>
  )
}
