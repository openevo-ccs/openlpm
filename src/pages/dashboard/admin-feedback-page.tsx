import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ImageIcon, MessageSquareText, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import { Chip } from '@/components/chip'
import { getScreenshotUrl, listFeedback, setFeedbackStatus, type FeedbackItem } from '@/lib/supabase/feedback'
import { ADMIN_EMAIL } from '@/lib/admin'

// 2026-09-19: built the same night Dustin flagged that his feedback
// submissions seemed to go nowhere -- correctly. The feedback table
// (migration 026) had no SELECT policy at all; this is the first real way
// to actually read it, gated by the global admin role (migration 033).
// Not a per-project page -- feedback spans every project plus project-less
// pages (the switcher, profile), so it lives as its own top-level route.

export default function AdminFeedbackPage() {
  const { session } = useSession()
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<FeedbackItem[] | null>(null)
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  const isAdmin = session?.user.email === ADMIN_EMAIL

  const reload = () => listFeedback(supabase).then(setItems)

  useEffect(() => {
    if (!isAdmin) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, isAdmin])

  if (!isAdmin) {
    return (
      <div>
        <h1>Feedback</h1>
        <p className="muted">This page isn&apos;t available to your account.</p>
      </div>
    )
  }

  const visible = (items ?? []).filter((f) => filter === 'all' || f.status === 'open')

  return (
    <div>
      <h1 className="row"><MessageSquareText size={18} style={{ color: 'var(--text-muted)' }} />Feedback</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Every real submission from the Feedback button, across every project.
      </p>

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button className={`btn btn-mini${filter === 'open' ? ' btn-primary' : ''}`} onClick={() => setFilter('open')}>Open</button>
        <button className={`btn btn-mini${filter === 'all' ? ' btn-primary' : ''}`} onClick={() => setFilter('all')}>All</button>
        <span className="muted">
          {items === null ? 'Loading…' : `${visible.length} of ${items.length}`}
        </span>
      </div>

      {items === null ? (
        <p className="muted">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="card empty">
          <CheckCircle2 size={32} />
          <p>{filter === 'open' ? 'Nothing open.' : 'No feedback yet.'}</p>
        </div>
      ) : (
        visible.map((f) => <FeedbackCard key={f.id} item={f} supabase={supabase} onChanged={reload} />)
      )}
    </div>
  )
}

function FeedbackCard({
  item,
  supabase,
  onChanged,
}: {
  item: FeedbackItem
  supabase: ReturnType<typeof createClient>
  onChanged: () => void
}) {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const loadScreenshot = async () => {
    if (!item.screenshot_path) return
    const url = await getScreenshotUrl(supabase, item.screenshot_path)
    setScreenshotUrl(url)
  }

  const toggleStatus = async () => {
    setBusy(true)
    await setFeedbackStatus(supabase, item.id, item.status === 'open' ? 'resolved' : 'open')
    setBusy(false)
    onChanged()
  }

  const ctx = item.context as { path?: string; project_slug?: string | null; page?: string; page_title?: string } | null

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 6 }}>
          <Chip status={item.tag} />
          <Chip status={item.status} />
        </div>
        <span className="muted" style={{ fontSize: 12 }}>{new Date(item.created_at).toLocaleString()}</span>
      </div>

      {item.comment && <p style={{ marginTop: 8 }}>{item.comment}</p>}

      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {item.submitter ? `${item.submitter.name} (${item.submitter.email})` : 'Unknown submitter'}
        {' — '}
        {item.project ? (
          <Link to={`/dashboard/${item.project.slug}`}>{item.project.name}</Link>
        ) : (
          'no project'
        )}
        {ctx?.page_title ? ` — "${ctx.page_title}"` : ''}
        {ctx?.path ? ` (${ctx.path})` : ''}
      </p>

      {item.screenshot_path && (
        screenshotUrl === undefined ? (
          <button className="btn btn-mini" style={{ marginTop: 8 }} onClick={loadScreenshot}>
            <ImageIcon size={12} />View screenshot
          </button>
        ) : screenshotUrl ? (
          <img src={screenshotUrl} alt="Feedback screenshot" style={{ marginTop: 8, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
        ) : (
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Couldn&apos;t load the screenshot.</p>
        )
      )}

      <button className="btn btn-mini" style={{ marginTop: 10 }} disabled={busy} onClick={toggleStatus}>
        {item.status === 'open' ? <><CheckCircle2 size={12} />Mark resolved</> : <><RotateCcw size={12} />Reopen</>}
      </button>
    </div>
  )
}
