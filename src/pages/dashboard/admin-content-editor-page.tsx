import { useEffect, useMemo, useState } from 'react'
import { Download, Upload, LayoutGrid, Table2, History, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/state/session'
import {
  EDITABLE_FIELDS,
  DISPLAY_FIELDS,
  type EditableTable,
  type EditLogRow,
  getCurrentNote,
  setCurrentNote,
  updateRecordWithLog,
  deleteRecordWithLog,
  listEditLog,
} from '@/lib/supabase/content-editing'
import { rowsToJsonBlob, rowsToCsvBlob, rowsToXlsxBlob, downloadBlob, parseJsonFile, parseCsvFile, parseXlsxFile } from '@/lib/export-import'

// Admin-only live content editing (Dustin, 2026-10-22): a real in-app way
// to fix a Lernziel's wording or a Curriculum Repository record, instead
// of every correction going through a hand-written SQL migration -- the
// exact thing this same day's own feedback-follow-up session did by hand,
// repeatedly. Two tables for now, chosen because they're the two Dustin
// named directly and RLS already supports admin writes on both (migration
// 162 added the missing piece for lpm_data_objects).
//
// Table/Cards view toggle and the list-left/detail-right layout mirror the
// Base Repo Explorer's own pattern (admin-base-repo-explorer-page.tsx) --
// consistent with this app's one other admin "browse lots of records"
// screen, even though that one is read-only and this one writes.
//
// Running-note annotation (not an explicit start/stop session) per
// Dustin's own 2026-10-22 answer: the note box at the top stays live while
// editing; every save made while it's set gets tagged with it.

type ViewMode = 'table' | 'cards'

const TABLE_LABELS: Record<EditableTable, string> = {
  lpm_data_objects: 'Learning Goals (Lernziele)',
  curriculum_repository_records: 'Curriculum Repository Records',
}

export default function AdminContentEditorPage() {
  const { isAdmin, session } = useSession()
  const user = session?.user ?? null
  const supabase = useMemo(() => createClient(), [])

  const [table, setTable] = useState<EditableTable>('lpm_data_objects')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [note, setNote] = useState(getCurrentNote())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  useEffect(() => {
    setCurrentNote(note)
  }, [note])

  async function reload() {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await (supabase as any)
      .from(table)
      .select(DISPLAY_FIELDS[table].join(','))
      .order('id')
      .limit(2000)
    if (error) setLoadError(error.message)
    else setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    setSelectedId(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  const selectedRow = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId])

  if (!isAdmin) {
    return (
      <div>
        <h1>Edit Data</h1>
        <p className="muted">This page isn&apos;t available to your account.</p>
      </div>
    )
  }

  async function handleSave(recordId: string, patch: Record<string, unknown>, fieldNote?: string) {
    if (!user) return
    const { error, logError } = await updateRecordWithLog(supabase, user.id, table, recordId, patch, fieldNote)
    if (error) {
      setNotice({ kind: 'bad', text: `Save failed: ${error.message}` })
      return
    }
    if (logError) {
      setNotice({ kind: 'bad', text: `Saved, but the change note didn't save: ${logError.message}` })
    } else {
      setNotice({ kind: 'ok', text: 'Saved.' })
    }
    await reload()
  }

  async function handleDelete(recordId: string) {
    if (!user) return
    if (!window.confirm('Delete this record? This cannot be undone from here -- the change log will keep a copy of what it contained.')) return
    const { error, logError } = await deleteRecordWithLog(supabase, user.id, table, recordId)
    if (error) {
      setNotice({ kind: 'bad', text: `Delete failed: ${error.message}` })
      return
    }
    setNotice({ kind: logError ? 'bad' : 'ok', text: logError ? `Deleted, but the change note didn't save: ${logError.message}` : 'Deleted.' })
    setSelectedId(null)
    await reload()
  }

  function doExport(format: 'json' | 'csv' | 'xlsx') {
    const stamp = new Date().toISOString().slice(0, 10)
    if (format === 'json') {
      downloadBlob(rowsToJsonBlob(filtered), `${table}-${stamp}.json`)
      return
    }
    const columns = DISPLAY_FIELDS[table]
    if (format === 'csv') {
      downloadBlob(rowsToCsvBlob(filtered, columns), `${table}-${stamp}.csv`)
    } else {
      rowsToXlsxBlob(filtered, columns).then((blob) => downloadBlob(blob, `${table}-${stamp}.xlsx`))
    }
  }

  async function handleImportFile(file: File) {
    if (!user) return
    try {
      const ext = file.name.toLowerCase().split('.').pop()
      const incoming =
        ext === 'json' ? await parseJsonFile(file) : ext === 'csv' ? await parseCsvFile(file) : ext === 'xlsx' ? await parseXlsxFile(file) : null
      if (!incoming) {
        setNotice({ kind: 'bad', text: 'Unrecognized file type -- use .json, .csv, or .xlsx.' })
        return
      }
      const editable = new Set(EDITABLE_FIELDS[table])
      let updated = 0
      let skipped = 0
      const errors: string[] = []
      for (const incomingRow of incoming) {
        const id = incomingRow.id as string | undefined
        if (!id) {
          skipped += 1
          continue
        }
        const patch: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(incomingRow)) {
          if (editable.has(key)) patch[key] = value
        }
        if (Object.keys(patch).length === 0) {
          skipped += 1
          continue
        }
        const { error, logError } = await updateRecordWithLog(supabase, user.id, table, id, patch, `Imported from ${file.name}`)
        if (error) errors.push(`${id}: ${error.message}`)
        else {
          updated += 1
          if (logError) errors.push(`${id}: saved, but change note failed`)
        }
      }
      setNotice({
        kind: errors.length > 0 ? 'bad' : 'ok',
        text: `Import from ${file.name}: ${updated} updated, ${skipped} skipped (no id or no editable fields)${errors.length ? `, ${errors.length} error(s): ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '…' : ''}` : '.'}`,
      })
      await reload()
    } catch (e) {
      setNotice({ kind: 'bad', text: `Import failed: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  return (
    <div>
      <h1>Edit Data</h1>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        Admin-only. Edits here write directly to the live database. Every save is tagged with the note below, if you've set one.
      </p>

      {notice && (
        <div className={`notice ${notice.kind === 'ok' ? 'notice-ok' : 'notice-bad'}`} style={{ marginBottom: 12 }}>
          {notice.text}
          <button type="button" className="btn btn-mini" style={{ marginLeft: 8 }} onClick={() => setNotice(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Dataset</label>
            <select value={table} onChange={(e) => setTable(e.target.value as EditableTable)}>
              {(Object.keys(TABLE_LABELS) as EditableTable[]).map((t) => (
                <option key={t} value={t}>
                  {TABLE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
            <label>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter the list below…" />
          </div>
          <div className="row" style={{ gap: 4 }}>
            <button type="button" className={`btn btn-mini ${view === 'table' ? 'btn-active' : ''}`} onClick={() => setView('table')} title="Table view">
              <Table2 size={14} />
            </button>
            <button type="button" className={`btn btn-mini ${view === 'cards' ? 'btn-active' : ''}`} onClick={() => setView('cards')} title="Card view">
              <LayoutGrid size={14} />
            </button>
          </div>
          <button type="button" className="btn btn-mini" onClick={() => setShowLog((v) => !v)}>
            <History size={12} /> Change log
          </button>
        </div>

        <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
          <label>Note for your current edits (shown on everything you save while this is set)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder='e.g. "Fixing Susan&apos;s 2026-10-21 feedback batch"' />
        </div>

        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Export visible rows:
          </span>
          <button type="button" className="btn btn-mini" onClick={() => doExport('json')}>
            <Download size={12} /> JSON
          </button>
          <button type="button" className="btn btn-mini" onClick={() => doExport('csv')}>
            <Download size={12} /> CSV
          </button>
          <button type="button" className="btn btn-mini" onClick={() => doExport('xlsx')}>
            <Download size={12} /> XLSX
          </button>
          <label className="btn btn-mini" style={{ cursor: 'pointer' }}>
            <Upload size={12} /> Import (.json/.csv/.xlsx)
            <input
              type="file"
              accept=".json,.csv,.xlsx"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImportFile(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
          CSV/XLSX import matches rows by <code>id</code> and only updates editable fields -- it can&apos;t create new rows. Use JSON export/import, or
          the card view, for the full nested content; CSV/XLSX hold it as one JSON-text column.
        </p>
      </div>

      {showLog && <ChangeLogPanel supabase={supabase} table={table} />}

      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : loadError ? (
            <div className="notice notice-bad">{loadError}</div>
          ) : filtered.length === 0 ? (
            <div className="card empty">
              <p>No records match.</p>
            </div>
          ) : view === 'table' ? (
            <EditableTableView table={table} rows={filtered} onSelect={setSelectedId} onSave={handleSave} />
          ) : (
            <CardsListView rows={filtered} onSelect={setSelectedId} />
          )}
        </div>

        {selectedRow && (
          <DetailPanel
            table={table}
            row={selectedRow}
            onClose={() => setSelectedId(null)}
            onSave={handleSave}
            onDelete={handleDelete}
            supabase={supabase}
          />
        )}
      </div>
    </div>
  )
}

function EditableTableView({
  table,
  rows,
  onSelect,
  onSave,
}: {
  table: EditableTable
  rows: Record<string, unknown>[]
  onSelect: (id: string) => void
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>
}) {
  // Inline-editable flat columns only -- `content` opens the detail panel instead of an in-cell editor.
  const columns = DISPLAY_FIELDS[table].filter((c) => c !== 'content' && c !== 'project_id')
  const [editing, setEditing] = useState<{ id: string; col: string; value: string } | null>(null)

  function startEdit(row: Record<string, unknown>, col: string) {
    if (!EDITABLE_FIELDS[table].includes(col)) return
    setEditing({ id: row.id as string, col, value: row[col] == null ? '' : String(row[col]) })
  }

  async function commitEdit() {
    if (!editing) return
    await onSave(editing.id, { [editing.col]: editing.value === '' ? null : editing.value })
    setEditing(null)
  }

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th>content</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id as string}>
              {columns.map((c) => {
                const current = editing
                const isEditingCell = current !== null && current.id === row.id && current.col === c
                return (
                  <td
                    key={c}
                    onClick={() => !isEditingCell && startEdit(row, c)}
                    style={{ cursor: EDITABLE_FIELDS[table].includes(c) ? 'text' : 'default', maxWidth: 240 }}
                  >
                    {isEditingCell && current ? (
                      <input
                        autoFocus
                        value={current.value}
                        onChange={(e) => setEditing({ ...current, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit()
                          if (e.key === 'Escape') setEditing(null)
                        }}
                      />
                    ) : (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {row[c] == null ? '' : String(row[c])}
                      </span>
                    )}
                  </td>
                )
              })}
              <td>
                <button type="button" className="btn btn-mini" onClick={() => onSelect(row.id as string)}>
                  View / edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CardsListView({ rows, onSelect }: { rows: Record<string, unknown>[]; onSelect: (id: string) => void }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
      {rows.map((row) => (
        <div key={row.id as string} className="card" style={{ cursor: 'pointer' }} onClick={() => onSelect(row.id as string)}>
          <strong>{(row.title as string) ?? row.id}</strong>
          {typeof row.status === 'string' && <p className="muted" style={{ fontSize: 12 }}>{row.status}</p>}
          {typeof row.record_type === 'string' && <p className="muted" style={{ fontSize: 12 }}>{row.record_type}</p>}
        </div>
      ))}
    </div>
  )
}

function DetailPanel({
  table,
  row,
  onClose,
  onSave,
  onDelete,
  supabase,
}: {
  table: EditableTable
  row: Record<string, unknown>
  onClose: () => void
  onSave: (id: string, patch: Record<string, unknown>, fieldNote?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  supabase: ReturnType<typeof createClient>
}) {
  const fields = EDITABLE_FIELDS[table]
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {}
    for (const f of fields) {
      const v = row[f]
      d[f] = v == null ? '' : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)
    }
    return d
  })
  const [fieldNote, setFieldNote] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  function setField(name: string, value: string) {
    setDraft((d) => ({ ...d, [name]: value }))
    if (name === 'content') {
      try {
        JSON.parse(value)
        setJsonError(null)
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : 'Invalid JSON')
      }
    }
  }

  async function handleSaveAll() {
    if (jsonError) return
    const patch: Record<string, unknown> = {}
    for (const f of fields) {
      const original = row[f]
      const originalStr = original == null ? '' : typeof original === 'object' ? JSON.stringify(original, null, 2) : String(original)
      if (draft[f] === originalStr) continue
      if (f === 'content') patch[f] = JSON.parse(draft[f] || '{}')
      else if (f === 'curriculum_sequence') patch[f] = draft[f] === '' ? null : Number(draft[f])
      else patch[f] = draft[f] === '' ? null : draft[f]
    }
    await onSave(row.id as string, patch, fieldNote || undefined)
    setFieldNote('')
  }

  return (
    <div className="card" style={{ width: 460, flexShrink: 0 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>Edit record</strong>
        <button type="button" className="btn btn-mini" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>
        id: {row.id as string}
      </p>

      {fields.map((f) =>
        f === 'content' ? (
          <div className="field" key={f}>
            <label>content (JSON)</label>
            <textarea rows={14} value={draft[f]} onChange={(e) => setField(f, e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12 }} />
            {jsonError && <p className="notice notice-bad" style={{ fontSize: 12 }}>{jsonError}</p>}
          </div>
        ) : f === 'status' ? (
          <div className="field" key={f}>
            <label>status</label>
            <select value={draft[f]} onChange={(e) => setField(f, e.target.value)}>
              {['draft', 'submitted', 'under_review', 'accepted', 'rejected'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : f === 'access_tier' ? (
          <div className="field" key={f}>
            <label>access_tier</label>
            <select value={draft[f]} onChange={(e) => setField(f, e.target.value)}>
              {['full-text-stored', 'excerpt-only', 'summary-only', 'citation-only'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : f === 'description' || f === 'license_or_rights_note' ? (
          <div className="field" key={f}>
            <label>{f}</label>
            <textarea rows={3} value={draft[f]} onChange={(e) => setField(f, e.target.value)} />
          </div>
        ) : (
          <div className="field" key={f}>
            <label>{f}</label>
            <input value={draft[f]} onChange={(e) => setField(f, e.target.value)} />
          </div>
        ),
      )}

      <div className="field">
        <label>Note for this specific save (optional -- on top of the running note above, if any)</label>
        <input value={fieldNote} onChange={(e) => setFieldNote(e.target.value)} placeholder="Why this particular change, if worth calling out" />
      </div>

      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button type="button" className="btn" disabled={!!jsonError} onClick={handleSaveAll}>
          Save
        </button>
        <button type="button" className="btn btn-mini btn-danger" onClick={() => onDelete(row.id as string)}>
          <Trash2 size={12} /> Delete
        </button>
        <button type="button" className="btn btn-mini" onClick={() => setShowHistory((v) => !v)}>
          <History size={12} /> History
        </button>
      </div>

      {showHistory && <RecordHistory supabase={supabase} table={table} recordId={row.id as string} />}
    </div>
  )
}

function RecordHistory({ supabase, table, recordId }: { supabase: ReturnType<typeof createClient>; table: EditableTable; recordId: string }) {
  const [entries, setEntries] = useState<EditLogRow[] | null>(null)

  useEffect(() => {
    listEditLog(supabase, { table, recordId, limit: 50 }).then(({ data }) => setEntries(data))
  }, [supabase, table, recordId])

  if (entries === null) return <p className="muted">Loading history…</p>
  if (entries.length === 0) return <p className="muted">No logged edits yet for this record.</p>

  return (
    <div style={{ marginTop: 8, fontSize: 12 }}>
      {entries.map((e) => (
        <div key={e.id} className="card" style={{ marginBottom: 6, padding: 8 }}>
          <div>
            <strong>{e.field_name}</strong> &middot; {new Date(e.edited_at).toLocaleString()} &middot; {e.editor_email ?? e.edited_by}
          </div>
          {(e.note || e.session_note) && <div className="muted">{e.note || e.session_note}</div>}
        </div>
      ))}
    </div>
  )
}

function ChangeLogPanel({ supabase, table }: { supabase: ReturnType<typeof createClient>; table: EditableTable }) {
  const [entries, setEntries] = useState<EditLogRow[] | null>(null)

  useEffect(() => {
    listEditLog(supabase, { table, limit: 50 }).then(({ data }) => setEntries(data))
  }, [supabase, table])

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <strong>Recent edits to {TABLE_LABELS[table]}</strong>
      {entries === null ? (
        <p className="muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="muted">No edits logged yet.</p>
      ) : (
        <div style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
          {entries.map((e) => (
            <div key={e.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border, #e5e5e5)' }}>
              <strong>{e.field_name}</strong> on <code>{e.record_id}</code> &middot; {new Date(e.edited_at).toLocaleString()} &middot;{' '}
              {e.editor_email ?? e.edited_by}
              {(e.note || e.session_note) && <div className="muted">{e.note || e.session_note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
