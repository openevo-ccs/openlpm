import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Compass } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { TOS_EDITOR_ROLES, TOS_PROGRESS_EVENT, useTosProfiles } from '@/components/tos-shared'
import { useSession } from '@/state/session'
import { parseAtlasEdit } from '@/lib/tos-edits'
import { loadReviewProgress, loadUserName, saveTosEdit } from '@/lib/supabase/tos-edits'

// The Atlas page of a Theories of Schooling space (migration 256): the Theory of Schooling Atlas widget, drawn from the profiles saved in
// this space. The widget is a copy kept in public/vendor/openevo-atlas (see the README there). It is plain JavaScript that draws into a
// div, so the page loads its two scripts when it opens, waits for the widget to say it is ready, and then hands it each profile.
//
// Editors can also check the sorting (migration 257). The page switches editing on in the widget (data-editable), saves each change the widget announces
// (atlas:edit) one after the other, and hands the saved profiles over again when a save fails, so the widget never keeps a change that was not saved.

const WIDGET_BASE = `${import.meta.env.BASE_URL}vendor/openevo-atlas/`
const SCRIPTS = [`${WIDGET_BASE}core/oew.js`, `${WIDGET_BASE}atlas/atlas.js`]

function loadScript(src: string): Promise<HTMLScriptElement> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = false
    el.dataset.tosAtlas = '1'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error(`could not load ${src}`))
    document.head.appendChild(el)
  })
}

export default function TosAtlasPage() {
  const { project, supabase, slug, role } = useOutletContext<ProjectOutletContext>()
  const { rows, problem, reload } = useTosProfiles(supabase, project.id)
  const { session } = useSession()
  const userId = session?.user?.id ?? null
  const mayEdit = TOS_EDITOR_ROLES.includes(role) && !!userId
  // null while the page asks whether migration 257 is applied; true when it is, false when it is not.
  const [editingReady, setEditingReady] = useState<boolean | null>(null)
  const [editorName, setEditorName] = useState('')
  const [saving, setSaving] = useState(0)
  const [saveNote, setSaveNote] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const editing = mayEdit && editingReady === true
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const notPublic = (rows ?? []).filter((r) => r.visibility !== 'public').length

  // The widget registers itself when its script runs and mounts into every matching div that exists at that moment. A script that ran
  // once never mounts a div that appears later, so the scripts are added again each time this page opens and removed when it closes.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let alive = true
    setReady(false)
    const onReady = () => alive && setReady(true)
    host.addEventListener('atlas:ready', onReady)
    ;(async () => {
      try {
        await loadScript(SCRIPTS[0])
        // The page may have closed while the first script loaded. The second script is the one that mounts the widget.
        if (alive) await loadScript(SCRIPTS[1])
      } catch {
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
      host.removeEventListener('atlas:ready', onReady)
      host.removeAttribute('data-ready')
      document.querySelectorAll('script[data-tos-atlas]').forEach((s) => s.remove())
    }
  }, [])

  useEffect(() => {
    if (!mayEdit || !userId) return
    let alive = true
    loadReviewProgress(supabase, project.id).then((p) => alive && setEditingReady(p !== null))
    loadUserName(supabase, userId).then((n) => alive && setEditorName(n))
    return () => {
      alive = false
    }
  }, [mayEdit, userId, supabase, project.id])

  // Handing the profiles over again also makes the widget look at its editing attributes again, so this runs when they change.
  useEffect(() => {
    const host = hostRef.current
    if (!ready || !host || !rows) return
    for (const row of rows) host.dispatchEvent(new CustomEvent('atlas:add-theory', { detail: row.data }))
  }, [ready, rows, editing, editorName])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !editing || !userId) return
    const onEdit = (ev: Event) => {
      const parsed = parseAtlasEdit((ev as CustomEvent).detail)
      if (!parsed.ok) {
        setSaveNote({ kind: 'bad', text: `${parsed.problem} The saved version is shown again.` })
        void reload()
        return
      }
      setSaving((n) => n + 1)
      chain.current = chain.current.then(async () => {
        const err = await saveTosEdit(supabase, project.id, userId, parsed.detail)
        if (err) {
          setSaveNote({ kind: 'bad', text: `${err} The saved version is shown again.` })
          await reload()
        } else {
          setSaveNote({ kind: 'ok', text: 'Saved.' })
          window.dispatchEvent(new Event(TOS_PROGRESS_EVENT))
        }
        setSaving((n) => n - 1)
      })
    }
    host.addEventListener('atlas:edit', onEdit)
    return () => host.removeEventListener('atlas:edit', onEdit)
  }, [editing, userId, supabase, project.id, reload])

  return (
    <div>
      <h1 className="row"><Compass size={18} style={{ color: 'var(--text-muted)' }} />Atlas</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Every theory of schooling saved in this space, sorted into the broad ideas about people and societies it draws on and the aspects of
        schooling it speaks to. Select a box or a ribbon to see the statements behind it.
      </p>
      {problem && <div className="notice notice-bad">{problem}</div>}
      {mayEdit && editingReady === false && (
        <div className="notice">Checking statements is not switched on yet. The database update that adds it has not been applied. Ask an admin.</div>
      )}
      {editing && (
        <div className="notice">
          You can check the sorting here. Select a statement and say whether it is placed right, or open the <strong>Review</strong> tab to go through the
          statements one at a time. Each change is saved as you go, shows who made it, and can be undone. A language model did the first sorting.
        </div>
      )}
      {editing && (saving > 0 || saveNote) && (
        <div className={saveNote?.kind === 'bad' ? 'notice notice-bad' : 'muted'} role="status" style={{ fontSize: 13 }}>
          {saving > 0 ? 'Saving…' : saveNote?.text}
        </div>
      )}
      {failed && <div className="notice notice-bad">The atlas could not load. Reload the page to try again.</div>}
      {notPublic > 0 && (
        <div className="notice">
          {notPublic === 1 ? '1 profile here is' : `${notPublic} profiles here are`} marked lab-only or local. {notPublic === 1 ? 'It is' : 'They are'} saved in this space and every
          member of the space can read {notPublic === 1 ? 'it' : 'them'}. The atlas may say {notPublic === 1 ? 'such a profile was' : 'such profiles were'} opened from a file on your own computer.
          That sentence belongs to the viewer and does not describe how this space keeps them.
        </div>
      )}
      {rows && rows.length === 0 && !problem && (
        <div className="notice">
          No theory is saved in this space yet. Add one on the <Link to={`/dashboard/${slug}/profiles`}>Profiles</Link> page. You can also write statements
          straight into the atlas below. Those stay in your browser until you download them.
        </div>
      )}
      <div ref={hostRef} className="tos-atlas-host" data-openevo-atlas="" data-theories="" data-private-links="show" data-height="clamp(680px, 85vh, 860px)" data-narrow-auto="1" data-editable={editing ? '1' : undefined} data-editor-name={editing && editorName ? editorName : undefined} />
    </div>
  )
}
