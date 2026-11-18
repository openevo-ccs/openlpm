import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { createClient } from '@/lib/supabase/client'
import { checkNewMethodTitle, createMethodEntry } from '@/lib/supabase/base-repo-edits'

// "Add entry" for the Methods tab of the Base Repo Explorer (feedback 5016dccd, Susan Hanisch, 2026-11-18: "need an option to add a new entry into the base repo").
// The person types the English title. That creates the entry, and the ordinary edit form opens on it for everything else (German name, description,
// steps, tags, sources). The entry is stored in the edit log like any other change and waits there until a session copies it into the repo.

type Client = ReturnType<typeof createClient>

export function NewEntryPanel({
  supabase, userId, existingIds, onCreated, onClose,
}: {
  supabase: Client
  userId: string
  /** The ids of every method shown now, so a title that is taken is refused. */
  existingIds: string[]
  /** Called with the new record's id once it is saved. */
  onCreated: (id: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const check = useMemo(() => (title.trim() ? checkNewMethodTitle(title, existingIds) : null), [title, existingIds])

  const create = async () => {
    setBusy(true); setError(null)
    const { error: message, id } = await createMethodEntry(supabase, { userId, title, existingIds })
    setBusy(false)
    if (message || !id) { setError(message ?? 'Not saved.'); return }
    onCreated(id)
  }

  return (
    <div className="card" data-testid="new-entry-panel" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 6 }}>Add a method</h3>
      <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Type the English title. The new entry opens in the edit form right away, where you add the German title, description, steps, tags and sources.
        It shows here at once and goes into the MethodsBase repo with the next batch of edits.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label htmlFor="new-entry-title" className="muted" style={{ fontSize: 12 }}>Title (English)</label>
        <input
          id="new-entry-title"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && check?.ok && !busy) create() }}
          placeholder="For example: Model evolutionary trees with different materials"
          style={{ minWidth: 340, flex: 1 }}
        />
        <button className="btn btn-mini btn-primary" data-testid="create-entry" disabled={busy || !check?.ok} onClick={create}>
          <Plus size={13} />Create and edit
        </button>
        <button className="btn btn-mini" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
      {check && !check.ok && <p className="muted" style={{ fontSize: 12, marginTop: 6 }} data-testid="new-entry-problem">{check.problem}</p>}
      {check?.ok && <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Its permanent id will be <code>{check.id}</code>.</p>}
      {error && <div className="notice" style={{ marginTop: 8 }}>Not saved: {error}</div>}
    </div>
  )
}
