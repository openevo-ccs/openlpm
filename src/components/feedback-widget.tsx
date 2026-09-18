import { useEffect, useRef, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { MessageSquareText, X, Camera, RotateCcw, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import { getProjectBySlug } from '@/lib/supabase/projects'

// Port of the same Feedback button built for Me-Mo and Ask Eva the same
// week (see lab_manager memory: memo_session_logging_and_feedback_widget,
// ask_eva_layout_resize_and_feedback_button) -- learned from their real,
// twice-verified implementation rather than designed from scratch, but
// adapted where OpenLPM's own architecture genuinely differs:
//
// - Screenshot capture still uses the real Screen Capture API
//   (getDisplayMedia), not a DOM-to-image library. That choice was driven
//   by Me-Mo/Ask Eva's live WebGL orb, which a DOM rasterizer can't
//   reliably capture -- checked whether the same constraint applies here
//   before copying the choice blindly, and it does: portfolio-explorer.tsx
//   renders its graph via Cytoscape onto a real <canvas>, which a
//   DOM-to-image library would silently render blank, the same class of
//   invisible failure Ask Eva actually hit (see captureScreenshot() below).
// - There is no local per-session server/transcript to append into here --
//   OpenLPM is a hosted multi-tenant app, so feedback is a real Postgres
//   table (supabase/migrations/025_feedback.sql) with its own RLS, not a
//   JSONL file on disk.
// - The image itself never touches that table. It's resized and
//   re-encoded as JPEG client-side, then uploaded to a private Supabase
//   Storage bucket (feedback-screenshots) -- only the resulting path is
//   stored in the feedback row. This is the actual mechanism for staying
//   within Supabase's storage limits: binary bytes never count against the
//   (much smaller, much more expensive) Postgres database quota.

type Tag = 'Problem' | 'Request' | 'Other'
const TAGS: Tag[] = ['Problem', 'Request', 'Other']

const CAPTURE_SUPPORTED =
  typeof navigator !== 'undefined' &&
  !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) &&
  window.isSecureContext !== false

// Keeps every uploaded screenshot well under the migration's 2MB bucket
// cap regardless of the submitter's real screen resolution/DPI -- a 4K
// screen capture can otherwise run 5-10MB as a lossless PNG.
const MAX_SCREENSHOT_WIDTH = 1600
const JPEG_QUALITY = 0.72

interface Rect { x: number; y: number; w: number; h: number }

export function FeedbackWidget() {
  const location = useLocation()
  const { session } = useSession()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [tag, setTag] = useState<Tag>('Other')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rawImageRef = useRef<HTMLImageElement | null>(null)
  const rectsRef = useRef<Rect[]>([])
  const dragStartRef = useRef<Rect | null>(null)
  const [hasScreenshot, setHasScreenshot] = useState(false)

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

  // Same real bug Ask Eva hit and fixed live (eva-graph 4cbc4a3): drawing
  // the captured stream before a real decoded frame has been presented
  // produces a solid black/blank capture with no error at all --
  // requestVideoFrameCallback is the correct primitive for "a real frame
  // exists now", not just loadedmetadata (which only guarantees dimensions).
  const captureScreenshot = async () => {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as MediaTrackConstraints,
        audio: false,
        // @ts-expect-error -- preferCurrentTab is real (Chrome/Edge) but not yet in lib.dom's MediaStreamConstraints
        preferCurrentTab: true,
      })
    } catch {
      // Cancelling the picker is the ordinary case, not an error worth
      // surfacing -- the rest of the form still works.
      return
    }
    try {
      const video = document.createElement('video')
      video.muted = true
      video.srcObject = stream
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('video element could not load the captured stream'))
      })
      await video.play()
      if ('requestVideoFrameCallback' in video) {
        await new Promise<void>((resolve) => (video as any).requestVideoFrameCallback(() => resolve()))
      } else {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      }
      if (!video.videoWidth || !video.videoHeight) throw new Error('the captured frame has no size yet')

      const canvas = canvasRef.current!
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

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
      stream.getTracks().forEach((t) => t.stop())
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
    return { path: location.pathname, project_slug: projectSlug, page, page_title: pageTitle }
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

  return (
    <div className="feedback-panel card">
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

        {!hasScreenshot ? (
          <button
            type="button"
            className="btn btn-mini"
            style={{ marginTop: 8 }}
            onClick={captureScreenshot}
            disabled={!CAPTURE_SUPPORTED}
            title={CAPTURE_SUPPORTED ? undefined : 'Needs a desktop browser (Chrome or Edge) over a secure connection'}
          >
            <Camera size={12} />
            Add a screenshot
          </button>
        ) : (
          <div style={{ marginTop: 8 }}>
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
        )}

        {result && <div className={`notice ${result.ok ? 'notice-ok' : 'notice-bad'}`} style={{ marginTop: 8 }}>{result.text}</div>}

        <button type="button" className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={submit} disabled={busy}>
          {busy ? 'Sending…' : 'Send feedback'}
        </button>
      </div>
    </div>
  )
}
