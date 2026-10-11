import { useEffect, useRef, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import html2canvas from 'html2canvas'
import { MessageSquareText, X, Camera, RotateCcw, Trash2, Mic, MicOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import { getProjectBySlug } from '@/lib/supabase/projects'

// Port of the same Feedback button built for Me-Mo and Ask Eva the same
// week (see lab_manager memory: memo_session_logging_and_feedback_widget,
// ask_eva_layout_resize_and_feedback_button) -- learned from their real,
// twice-verified implementation rather than designed from scratch, but
// adapted where OpenLPM's own architecture genuinely differs:
//
// - Screenshot capture now uses html2canvas (a DOM rasterizer), not the
//   Screen Capture API (getDisplayMedia) Me-Mo/Ask Eva use -- REVERSED
//   2026-09-30 after Dustin reported it erroring for real, repeatedly.
//   getDisplayMedia was the right call for THEM because of a live WebGL
//   orb a DOM rasterizer can't capture -- checked whether that same
//   constraint applies here before copying the choice, and mostly it
//   doesn't: OpenLPM's content is plain DOM, and its one canvas-rendered
//   surface (Cytoscape graphs in Notebooks/Concepts/Basiskonzepte) draws
//   with the ordinary 2D context, which html2canvas can read directly --
//   unlike a live WebGL surface, there's no continuously-redrawn context
//   to race against. The real reason to actually prefer html2canvas here
//   even setting the bug aside: getDisplayMedia has minimal-to-no support
//   on mobile browsers (no reliable tab/window capture on iOS Safari, only
//   experimental/inconsistent support on Android Chrome) -- a real,
//   structural problem for an app real students will open on their
//   phones, not a one-off glitch. html2canvas needs no browser permission
//   dialog at all and works identically on mobile and desktop.
// - There is no local per-session server/transcript to append into here --
//   OpenLPM is a hosted multi-tenant app, so feedback is a real Postgres
//   table (supabase/migrations/026_feedback.sql) with its own RLS, not a
//   JSONL file on disk.
// - The image itself never touches that table. It's resized and
//   re-encoded as JPEG client-side, then uploaded to a private Supabase
//   Storage bucket (feedback-screenshots) -- only the resulting path is
//   stored in the feedback row. This is the actual mechanism for staying
//   within Supabase's storage limits: binary bytes never count against the
//   (much smaller, much more expensive) Postgres database quota.

type Tag = 'Problem' | 'Request' | 'Other'
const TAGS: Tag[] = ['Problem', 'Request', 'Other']

// Real feedback 29fed82b (2026-10-01): "Enable efficient effective
// multilingual voice to speech on feedback form." The Web Speech API's
// SpeechRecognition isn't in TypeScript's own DOM lib (it's still a
// non-standard API, Chrome/Edge/Safari only -- no real Firefox support),
// so these are the handful of fields this file actually touches, not a
// full spec. Scoped with Dustin (2026-10-01): auto-detect which language
// is being spoken from the browser's own locale (navigator.language) --
// one click, no extra picker -- rather than a manual language switch.
interface MinimalSpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => MinimalSpeechRecognition
function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// html2canvas works in every real browser (no permission API, no mobile
// gap) -- this used to gate the button on getDisplayMedia support, which
// is exactly the mobile-unsupported case that caused the real bug.
const CAPTURE_SUPPORTED = true

// Keeps every uploaded screenshot well under the migration's 2MB bucket
// cap regardless of the submitter's real screen resolution/DPI -- a 4K
// screen capture can otherwise run 5-10MB as a lossless PNG.
const MAX_SCREENSHOT_WIDTH = 1600
const JPEG_QUALITY = 0.72

interface Rect { x: number; y: number; w: number; h: number }

// Real gap Dustin flagged 2026-09-30: a feedback report only ever carried
// the CURRENT page's path/title, nothing about what the reporter actually
// did to get there or what was genuinely on screen -- a much thinner
// record than what Ask Eva/Me-Mo capture (their own continuous, server-
// side screen-trace log, see lab_manager memory
// ask_eva_screen_trace_moment_by_moment). That exact mechanism doesn't
// port directly -- it depends on a per-conversation server process neither
// this hosted, multi-tenant Supabase app has -- but the real underlying
// need (know what the reporter was actually looking at and how they got
// there) does. Scoped to what fits this architecture: a small recent-
// navigation breadcrumb kept in sessionStorage (no new table, no ongoing
// server load) plus the current page's real rendered text, both folded
// into the same `context` JSONB column that already exists -- readable by
// whoever's diagnosing without needing a screenshot to have been attached
// at all.
const BREADCRUMB_KEY = 'openlpm:recent_pages'
const BREADCRUMB_MAX = 8
const VISIBLE_TEXT_MAX = 3000

interface PageVisit { path: string; title: string; at: string }

function recordVisit(path: string, title: string) {
  try {
    const raw = sessionStorage.getItem(BREADCRUMB_KEY)
    const list: PageVisit[] = raw ? JSON.parse(raw) : []
    if (list[list.length - 1]?.path !== path) list.push({ path, title, at: new Date().toISOString() })
    while (list.length > BREADCRUMB_MAX) list.shift()
    sessionStorage.setItem(BREADCRUMB_KEY, JSON.stringify(list))
  } catch {
    // Private window / blocked storage -- the breadcrumb just won't
    // accumulate; feedback still works without it.
  }
}

function readBreadcrumb(): PageVisit[] {
  try {
    const raw = sessionStorage.getItem(BREADCRUMB_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function FeedbackWidget() {
  const location = useLocation()
  const { session } = useSession()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [tag, setTag] = useState<Tag>('Other')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)
  // Hides the panel during capture without unmounting it -- unmounting via
  // `open` would null out canvasRef right when the capture needs to draw
  // into it (a real bug in this fix's own first draft, caught before
  // shipping: setOpen(false) removes the panel from the tree entirely, so
  // canvasRef.current is null the moment html2canvas resolves).
  const [capturing, setCapturing] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rawImageRef = useRef<HTMLImageElement | null>(null)
  const rectsRef = useRef<Rect[]>([])
  const dragStartRef = useRef<Rect | null>(null)
  const [hasScreenshot, setHasScreenshot] = useState(false)

  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null)
  const speechSupported = getSpeechRecognitionCtor() !== null

  const toggleVoiceInput = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    const recognition = new Ctor()
    // Auto-detect: matches whatever language the browser/device is
    // already set to, rather than a manual picker -- Dustin's own call,
    // 2026-10-01.
    recognition.lang = navigator.language
    recognition.continuous = true
    recognition.interimResults = true
    const baseComment = comment
    const prefix = baseComment && !baseComment.endsWith(' ') && !baseComment.endsWith('\n') ? `${baseComment} ` : baseComment
    let finalTranscript = ''
    recognition.onresult = (event) => {
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalTranscript += result[0].transcript.trim() + ' '
        else interimTranscript += result[0].transcript
      }
      // Rewrites the whole value each time so the box always shows exactly
      // what's been heard so far, interim words included -- Dustin asked
      // to see live text while speaking, not just the committed phrases.
      setComment(prefix + finalTranscript + interimTranscript)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  // Stop any in-progress dictation if the panel closes mid-recording.
  useEffect(() => {
    if (!open) recognitionRef.current?.stop()
  }, [open])

  // Records every real navigation for the breadcrumb, mounted once at the
  // app shell level (DashboardLayout) so it tracks the whole session, not
  // just whatever pages happen to be visited while the panel is open.
  useEffect(() => {
    recordVisit(location.pathname, document.title)
  }, [location.pathname])

  useEffect(() => {
    if (!open) {
      setResult(null)
    }
  }, [open])

  const resetScreenshot = () => {
    rawImageRef.current = null
    rectsRef.current = []
    setHasScreenshot(false)
  }

  const drawCanvas = () => {
    const canvas = canvasRef.current
    const img = rawImageRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#e04b3f'
    ctx.lineWidth = Math.max(2, canvas.width / 400)
    rectsRef.current.forEach((r) => ctx.strokeRect(r.x, r.y, r.w, r.h))
  }

  // Rasterizes the actual page behind the feedback panel. The panel itself
  // is temporarily hidden during capture (setOpen(false) + a tick to let
  // it unmount) so the screenshot shows what the reporter was looking at,
  // not the feedback form covering it -- confirmed necessary live: without
  // this the very first capture attempt just photographed the panel itself.
  const captureScreenshot = async () => {
    setCapturing(true)
    await new Promise((r) => setTimeout(r, 60))
    try {
      const shot = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        // Real bug found 2026-10-10 (while investigating why a feedback
        // screenshot was mostly unreadable, nearly black): `null` tells
        // html2canvas to leave anywhere it doesn't explicitly paint a
        // background as transparent -- fine for a PNG, but this capture
        // gets flattened to JPEG for upload a few lines down
        // (canvas.toDataURL('image/jpeg', ...)), and JPEG has no alpha
        // channel, so every transparent pixel silently renders as BLACK on
        // flatten, regardless of what the page's real background actually
        // is. Resolving the real computed background color here (body's
        // own `background: var(--page-plane)`, correct in both light and
        // dark mode) instead of `null` means the flatten has a real color
        // to fall back to, not black.
        backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
        // The "Capturing…" indicator shown below replaces the panel for
        // the real multi-second duration of this call -- never let it end
        // up in its own screenshot.
        ignoreElements: (el) => el.classList?.contains('feedback-capturing-indicator'),
        // Real screens run well past 1600px logical width on a 2x/3x
        // display -- capture at native pixel density, downscale happens
        // separately at upload time (compressForUpload).
        scale: Math.min(window.devicePixelRatio || 1, 2),
        // Real bug found live 2026-09-30: capturing the full scrollable
        // page (html2canvas's default against `document.body`) rasterizes
        // its ENTIRE height, not just what's on screen -- on a long page
        // (305 Lernziele cards) that's tens of thousands of pixels tall,
        // past the browser's own hard canvas-size ceiling, which is exactly
        // what "The object exceeded the maximum allowed size" is: the
        // browser's own error for an over-limit canvas, not a bug in this
        // code's own retry/compression logic (that only runs afterward).
        // Clipping to the current viewport avoids the oversized canvas
        // entirely, and also matches what a reporter actually means by
        // "screenshot this" far better than the full page ever did.
        // Real bug found live 2026-10-01 (Dustin: "the screenshot is not
        // exactly where I am in the screen"): `windowWidth`/`windowHeight`
        // were set to the FULL scrollable document size, not the real
        // browser viewport -- these two options tell html2canvas how big
        // the outer *browsing context* is (for responsive CSS/fixed-element
        // layout), a completely different thing from the document's own
        // content height, which html2canvas already measures from the DOM
        // itself. Telling it the window is 28,000+px tall still forces an
        // internal render pass at that full height even though only an
        // 800px-tall slice of it ever reaches the output canvas -- on any
        // page long enough to trigger the original oversized-canvas bug
        // this comment used to describe, that internal pass now silently
        // produces a blank capture instead of throwing. The real browser
        // viewport (innerWidth/innerHeight) is what `windowWidth`/
        // `windowHeight` are actually for; confirmed live against the
        // Lernziele page (305 cards, ~28,800px tall) both scrolled and not.
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      })
      const canvas = canvasRef.current!
      canvas.width = shot.width
      canvas.height = shot.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(shot, 0, 0)

      const img = new Image()
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.src = canvas.toDataURL('image/png')
      })
      rawImageRef.current = img
      rectsRef.current = []
      drawCanvas()
      setHasScreenshot(true)
    } catch (e) {
      setResult({
        text: `Couldn't capture the screenshot (${e instanceof Error ? e.message : 'unknown error'}) — you can still send feedback as text.`,
        ok: false,
      })
    } finally {
      setCapturing(false)
    }
  }

  // Canvas's real pixel size (the capture's own resolution) and its
  // displayed CSS size can differ once scaled to fit the panel -- every
  // pointer coordinate is rescaled by that ratio, same as Ask Eva's version.
  const canvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!rawImageRef.current) return
    const p = canvasPoint(e)
    dragStartRef.current = { x: p.x, y: p.y, w: 0, h: 0 }
    canvasRef.current?.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragStartRef.current
    if (!start) return
    const p = canvasPoint(e)
    drawCanvas()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#e04b3f'
    ctx.lineWidth = Math.max(2, canvasRef.current!.width / 400)
    ctx.strokeRect(start.x, start.y, p.x - start.x, p.y - start.y)
  }
  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragStartRef.current
    if (!start) return
    const p = canvasPoint(e)
    const r: Rect = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }
    dragStartRef.current = null
    if (r.w > 4 && r.h > 4) rectsRef.current.push(r)
    drawCanvas()
  }

  // Downscales + re-encodes the annotated capture as JPEG -- the actual
  // storage-limit safeguard (see file header). Only ever shrinks, never
  // upscales a smaller capture.
  const compressForUpload = (): Blob | null => {
    const source = canvasRef.current
    if (!source || !rawImageRef.current) return null
    const scale = Math.min(1, MAX_SCREENSHOT_WIDTH / source.width)
    const out = document.createElement('canvas')
    out.width = Math.round(source.width * scale)
    out.height = Math.round(source.height * scale)
    const ctx = out.getContext('2d')!
    ctx.drawImage(source, 0, 0, out.width, out.height)
    const dataUrl = out.toDataURL('image/jpeg', JPEG_QUALITY)
    const [, base64] = dataUrl.split(',')
    const bytes = atob(base64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    return new Blob([arr], { type: 'image/jpeg' })
  }

  // Reads whatever's genuinely current from the router/session rather than
  // keeping a shadow copy of app state, same discipline as Ask Eva's own
  // buildContext() -- can't drift from what the submitter actually saw.
  const buildContext = () => {
    const match = matchPath('/dashboard/:project/*', location.pathname)
    const projectSlug = match ? (match.params as { project: string }).project : null
    const rest = match ? ((match.params as { '*'?: string })['*'] || '') : ''
    const page = projectSlug ? rest.split('/')[0] || 'overview' : location.pathname === '/dashboard' ? 'project-switcher' : location.pathname.replace('/dashboard/', '')
    const pageTitle = document.title
    // The panel itself is hidden (display:none) while capturing/submitting
    // isn't relevant here, but reading innerText right now -- before the
    // panel opened -- would miss whatever the reporter is describing, so
    // this deliberately reads document.body as-is, panel included; the
    // panel's own form labels ("What's going on?" etc.) are a small,
    // harmless prefix, not worth special-casing out.
    const visibleText = document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, VISIBLE_TEXT_MAX)
    return {
      path: location.pathname,
      project_slug: projectSlug,
      page,
      page_title: pageTitle,
      visible_text: visibleText,
      recent_pages: readBreadcrumb(),
    }
  }

  const submit = async () => {
    const text = comment.trim()
    if (!text && !hasScreenshot) {
      setResult({ text: 'Add a comment or a screenshot before sending.', ok: false })
      return
    }
    const user = session?.user
    if (!user) {
      setResult({ text: 'You need to be signed in to send feedback.', ok: false })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const ctx = buildContext()

      let projectId: string | null = null
      if (ctx.project_slug) {
        const { project } = await getProjectBySlug(supabase, ctx.project_slug)
        projectId = project?.id ?? null
      }

      let screenshotPath: string | null = null
      if (hasScreenshot) {
        const blob = compressForUpload()
        if (blob) {
          const path = `${user.id}/${crypto.randomUUID()}.jpg`
          const { error: uploadError } = await supabase.storage
            .from('feedback-screenshots')
            .upload(path, blob, { contentType: 'image/jpeg' })
          if (uploadError) throw uploadError
          screenshotPath = path
        }
      }

      const { error: insertError } = await supabase.from('feedback').insert({
        user_id: user.id,
        project_id: projectId,
        tag,
        comment: text || null,
        context: ctx,
        screenshot_path: screenshotPath,
      })
      if (insertError) throw insertError

      setResult({ text: "Thanks — that's on record.", ok: true })
      setComment('')
      resetScreenshot()
      setTag('Other')
      setTimeout(() => setOpen(false), 1400)
    } catch (e) {
      setResult({ text: e instanceof Error ? e.message : "That didn't go through — try again in a moment.", ok: false })
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="feedback-launcher" onClick={() => setOpen(true)} aria-label="Send feedback" title="Send feedback">
        <MessageSquareText size={20} />
      </button>
    )
  }

  // Real bug found live 2026-10-01 (Dustin: "the screenshot is not exactly
  // where I am in the screen"): on a long page (e.g. 305 Lernziele cards)
  // html2canvas genuinely takes several real seconds to render, and while
  // `capturing` is true the whole panel -- the ONLY UI this widget ever
  // shows -- is display:none, so there's nothing at all on screen for that
  // whole stretch. Confirmed empirically (local dev against real
  // production data, Playwright capture compared pixel-for-pixel against
  // a ground-truth screenshot) that the capture itself is correct once it
  // actually finishes; the real gap was having no way to tell it hadn't
  // yet. This small indicator renders as a SIBLING of the panel, not in
  // place of it -- the panel (and the canvas inside it) must stay mounted
  // throughout capture, same reasoning as the canvas's own "always
  // mounted" comment below: an early return here would unmount canvasRef
  // right as captureScreenshot needs to draw into it. Excluded from the
  // capture itself via `ignoreElements` above, so it never ends up in the
  // screenshot.
  return (
    <>
      {capturing && (
        <div className="feedback-capturing-indicator">
          <span className="feedback-capturing-spinner" aria-hidden="true" />
          Capturing…
        </div>
      )}
      <div className={`feedback-panel card${hasScreenshot ? ' feedback-panel-wide' : ''}`} style={capturing ? { display: 'none' } : undefined}>
      <div className="feedback-header">
        <span className="feedback-title">
          <MessageSquareText size={16} />
          Feedback
        </span>
        <button type="button" className="btn btn-mini" onClick={() => setOpen(false)} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className="feedback-body">
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          {TAGS.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip feedback-tag-btn${t === tag ? ' chip-good' : ''}`}
              onClick={() => setTag(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <textarea
          className="feedback-comment"
          placeholder="What's going on? (optional if you're attaching a screenshot)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
        />

        <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {!hasScreenshot && (
            <button
              type="button"
              className="btn btn-mini"
              onClick={captureScreenshot}
              disabled={!CAPTURE_SUPPORTED}
            >
              <Camera size={12} />
              Add a screenshot
            </button>
          )}
          {speechSupported && (
            <button
              type="button"
              className={`btn btn-mini${listening ? ' btn-danger' : ''}`}
              onClick={toggleVoiceInput}
              title={listening ? 'Stop dictating' : 'Dictate your comment by voice'}
              aria-pressed={listening}
            >
              {listening ? <MicOff size={12} /> : <Mic size={12} />}
              {listening ? 'Listening…' : 'Dictate'}
            </button>
          )}
        </div>
        {/* The canvas is ALWAYS mounted, just hidden until there's
            something to show -- the real bug this replaces: it used to
            only exist in the DOM once hasScreenshot was already true, so
            captureScreenshot's very first run always found canvasRef.current
            null (every attempt, every browser, not a mobile-only issue) --
            confirmed live, this is what "couldn't capture the screenshot"
            actually was. */}
        <div style={{ marginTop: 8, display: hasScreenshot ? 'block' : 'none' }}>
          <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Drag on the image to highlight the part you mean.
          </p>
          <canvas
            ref={canvasRef}
            className="feedback-screenshot-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button type="button" className="btn btn-mini" onClick={captureScreenshot}>
              <RotateCcw size={12} />
              Retake
            </button>
            <button type="button" className="btn btn-mini" onClick={resetScreenshot}>
              <Trash2 size={12} />
              Remove
            </button>
          </div>
        </div>

        {result && <div className={`notice ${result.ok ? 'notice-ok' : 'notice-bad'}`} style={{ marginTop: 8 }}>{result.text}</div>}

        <button type="button" className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={submit} disabled={busy}>
          {busy ? 'Sending…' : 'Send feedback'}
        </button>
      </div>
      </div>
    </>
  )
}
