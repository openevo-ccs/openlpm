import { useMemo, useState } from 'react'
import { Check, History, RotateCcw } from 'lucide-react'
import type { createClient } from '@/lib/supabase/client'
import type { BaseRepoKey, SnapshotRow } from '@/lib/supabase/base-repo-explorer'
import {
  currentValue, fieldsFor, parseInput, sameValue, sourceLine, toInput, type EditField, type EditValue, type FieldVocabulary, type SourceEntry,
} from '@/lib/base-repo-edit-fields'
import { resetEdit, saveEdits, type BaseRepoEdit, type FieldChange } from '@/lib/supabase/base-repo-edits'

// Edit form for one Base Repo record, shown inside the Explorer card (feedback 0afc62a5, Susan Hanisch 2026-11-08).
// Every changed field is saved as its own edit with what it said before, who changed it and an optional note.
// The record's source repo is not touched; edits wait there to be sent back in a batch (see base-repo-edits.ts).

type Client = ReturnType<typeof createClient>

export function RecordEditor({
  supabase, userId, repoKey, row, vocab, onSaved, onCancel,
}: {
  supabase: Client
  userId: string
  repoKey: BaseRepoKey
  row: SnapshotRow
  vocab: FieldVocabulary
  onSaved: () => void
  onCancel: () => void
}) {
  const fields = useMemo(() => fieldsFor(repoKey, row.data, vocab), [repoKey, row.data, vocab])
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of fields) init[f.path] = toInput(f, currentValue(f, row.data))
    return init
  })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changes: FieldChange[] = useMemo(() => {
    const out: FieldChange[] = []
    for (const f of fields) {
      const before = currentValue(f, row.data)
      const after = parseInput(f, values[f.path] ?? '')
      // A field left alone comes back from the box trimmed (stray spaces, blank lines), so compare against the trimmed original.
      if (!sameValue(parseInput(f, toInput(f, before)), after)) out.push({ path: f.path, before, after })
    }
    return out
  }, [fields, values, row.data])

  const save = async () => {
    setBusy(true); setError(null)
    const message = await saveEdits(supabase, { repoKey, recordId: row.id, userId, changes, note })
    setBusy(false)
    if (message) { setError(message); return }
    onSaved()
  }

  const addTag = (field: EditField, tag: string) => {
    const list = parseInput(field, values[field.path] ?? '') as string[]
    if (list.includes(tag)) return
    setValues((v) => ({ ...v, [field.path]: toInput(field, [...list, tag]) }))
  }

  return (
    <div data-testid="record-editor" style={{ fontSize: 12 }}>
      {fields.map((f) => {
        const edited = row.editedPaths?.includes(f.path)
        const id = `edit-${f.path}`
        const common = {
          id, value: values[f.path] ?? '', style: { width: '100%', fontSize: 12 } as const,
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [f.path]: e.target.value })),
        }
        const currentTags = f.kind === 'tags' ? (parseInput(f, values[f.path] ?? '') as string[]) : []
        return (
          <div key={f.path} style={{ marginBottom: 10 }}>
            <label htmlFor={id} className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>
              {f.label}{edited ? ' · edited in OpenLPM' : ''}
            </label>
            {f.kind === 'text' && <input {...common} />}
            {f.kind === 'longtext' && <textarea {...common} rows={Math.min(10, Math.max(3, Math.ceil((values[f.path] ?? '').length / 45)))} />}
            {(f.kind === 'lines' || f.kind === 'sources') && <textarea {...common} rows={Math.min(10, Math.max(3, (values[f.path] ?? '').split('\n').length + 1))} />}
            {f.kind === 'tags' && <input {...common} placeholder="tag one, tag two" />}
            {f.kind === 'select' && (
              <select {...common}>
                <option value="">(none)</option>
                {Array.from(new Set([...(f.options ?? []), values[f.path] ?? ''])).filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {f.kind === 'tags' && (f.options?.length ?? 0) > 0 && (
              <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {f.options!.filter((o) => !currentTags.includes(o)).map((o) => (
                  <button key={o} type="button" className="btn btn-mini" style={{ fontSize: 11 }} onClick={() => addTag(f, o)} title="Add this tag">+ {o}</button>
                ))}
              </div>
            )}
            {f.hint && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{f.hint}</div>}
          </div>
        )
      })}
      <div style={{ marginBottom: 10 }}>
        <label htmlFor="edit-note" className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>What did you change, and why? (optional)</label>
        <input id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', fontSize: 12 }} />
      </div>
      {error && <div className="notice" style={{ marginBottom: 8 }}>Not saved: {error}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-mini btn-primary" disabled={busy || changes.length === 0} onClick={save}>
          <Check size={13} />{changes.length === 0 ? 'Save (no changes yet)' : `Save ${changes.length} change${changes.length === 1 ? '' : 's'}`}
        </button>
        <button className="btn btn-mini" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

const preview = (v: unknown): string => {
  const text = Array.isArray(v) ? v.map((x) => (x && typeof x === 'object' ? sourceLine(x as SourceEntry) : String(x))).join(' | ') : v === null || v === undefined || v === '' ? '(empty)' : String(v)
  return text.length > 140 ? `${text.slice(0, 140)}…` : text
}

/** Who changed what on this record and when, newest first, with a one-click way back to the repo copy of a field. */
export function EditHistory({
  supabase, userId, repoKey, row, history, onChanged,
}: {
  supabase: Client
  userId: string
  repoKey: BaseRepoKey
  row: SnapshotRow
  history: BaseRepoEdit[]
  onChanged: () => void
}) {
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (history.length === 0) return null
  const undo = async (path: string, before: unknown) => {
    setBusyPath(path); setError(null)
    const message = await resetEdit(supabase, { repoKey, recordId: row.id, userId, path, before })
    setBusyPath(null)
    if (message) setError(message)
    else onChanged()
  }
  const live = new Set(row.editedPaths ?? [])
  return (
    <details data-testid="edit-history" style={{ marginTop: 10 }}>
      <summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}><History size={12} style={{ verticalAlign: '-2px' }} /> Edits to this record ({history.length})</summary>
      {error && <div className="notice" style={{ margin: '6px 0' }}>{error}</div>}
      <ul style={{ margin: '6px 0 0', paddingLeft: 0, listStyle: 'none', fontSize: 12 }}>
        {history.map((e, i) => {
          const isLatestForPath = history.findIndex((h) => h.field_path === e.field_path) === i
          return (
            <li key={e.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <div><strong>{e.field_path}</strong>{' '}
                <span className="muted">{e.editor_name ?? 'Someone'} · {new Date(e.edited_at).toLocaleString()}</span>
              </div>
              {e.is_reset ? (
                <div className="muted">Put back to the repo copy.</div>
              ) : (
                <>
                  <div className="muted">Before: {preview(e.before_value)}</div>
                  <div>Now: {preview(e.after_value)}</div>
                </>
              )}
              {e.note && <div className="muted">Note: {e.note}</div>}
              <div className="muted">{e.exported_at ? 'Sent back to the repo.' : e.is_reset ? '' : 'Waiting to be sent back to the repo.'}</div>
              {!e.is_reset && isLatestForPath && live.has(e.field_path) && (
                <button className="btn btn-mini" disabled={busyPath === e.field_path} onClick={() => undo(e.field_path, e.after_value)} style={{ marginTop: 4 }}>
                  <RotateCcw size={12} />Put back to the repo copy
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

export type { EditValue }
