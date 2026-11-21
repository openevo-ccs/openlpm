import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { createClient } from '@/lib/supabase/client'
import { NEW_ENTRY_SPECS, checkNewEntryName, createEntry } from '@/lib/supabase/base-repo-edits'
import type { BaseRepoKey } from '@/lib/supabase/base-repo-explorer'

// "Add entry" for every tab of the Base Repo Explorer (feedback 5016dccd, Susan Hanisch, 2026-11-18: "need an option to add a new entry into the base repo";
// 2026-11-21: "each base could have that option, with the only restriction regarding fields maybe being the name/label").
// The person types the name. That creates the entry, and the ordinary edit form opens on it for everything else (other language, description,
// tags, sources). The entry is stored in the edit log like any other change and waits there until a session copies it into the repo.
// What each base asks for (id prefix, name field, starter fields) is the table NEW_ENTRY_SPECS in base-repo-edits.ts.

type Client = ReturnType<typeof createClient>

export function NewEntryPanel({
  repoKey, supabase, userId, existingIds, onCreated, onClose,
}: {
  repoKey: BaseRepoKey
  supabase: Client
  userId: string
  /** The ids of every record of this base shown now, so a name that is taken is refused. */
  existingIds: string[]
  /** Called with the new record's id once it is saved. */
  onCreated: (id: string) => void
  onClose: () => void
}) {
  const spec = NEW_ENTRY_SPECS[repoKey]!
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const check = useMemo(() => (title.trim() ? checkNewEntryName(repoKey, title, existingIds) : null), [repoKey, title, existingIds])

  const create = async () => {
    setBusy(true); setError(null)
    const { error: message, id } = await createEntry(supabase, repoKey, { userId, title, existingIds })
    setBusy(false)
    if (message || !id) { setError(message ?? 'Not saved.'); return }
    onCreated(id)
  }

  return (
    <div className="card" data-testid="new-entry-panel" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 6 }}>Add a {spec.noun}</h3>
      <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Type the name. The new entry opens in the edit form right away, where you fill in everything else. Only the name is required.
        It shows here at once and goes into the repo with the next batch of edits.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label htmlFor="new-entry-title" className="muted" style={{ fontSize: 12 }}>{spec.nameLabel}</label>
        <input
          id="new-entry-title"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && check?.ok && !busy) create() }}
          placeholder={spec.placeholder}
          style={{ minWidth: 340, flex: 1 }}
        />
        <button className="btn btn-mini btn-primary" data-testid="create-entry" disabled={busy || !check?.ok} onClick={create}>
          <Plus size={13} />Create and edit
        </button>
        <button className="btn btn-mini" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
      {check && !check.ok && <p className="muted" style={{ fontSize: 12, marginTop: 6 }} data-testid="new-entry-problem">{check.problem}</p>}
      {check?.ok && <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Its id will be <code>{check.id}</code>. Whoever copies it into the repo may finish it.</p>}
      {error && <div className="notice" style={{ marginTop: 8 }}>Not saved: {error}</div>}
    </div>
  )
}
