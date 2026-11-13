import { useMemo, useState } from 'react'
import { Check, History, RotateCcw } from 'lucide-react'
import type { createClient } from '@/lib/supabase/client'
import type { BaseRepoKey, SnapshotRow } from '@/lib/supabase/base-repo-explorer'
import {
  currentValue, describePath, fieldsFor, hasLanguagePairs, LANGUAGE_NAMES, otherEditLang, parseInput, sameValue, sourceLine, splitChoices, toInput,
  type EditField, type EditLang, type EditValue, type FieldVocabulary, type SourceEntry,
} from '@/lib/base-repo-edit-fields'
import { resetEdit, saveEdits, type BaseRepoEdit, type FieldChange } from '@/lib/supabase/base-repo-edits'
import { LanguageSwitch } from '@/components/language-switch'

// Edit form for one Base Repo record, shown inside the Explorer card (feedback 0afc62a5, Susan Hanisch 2026-11-08).
// Every changed field is saved as its own edit with what it said before, who changed it and an optional note.
// The record's source repo is not touched; edits wait there to be sent back in a batch (see base-repo-edits.ts).
//
// The form follows the English/German switch of the page (Dustin, 2026-11-13): every text and tag shows in that language, with the other
// language in grey under each text for reference. Whatever was typed in the other language is kept while switching and saved together.

type Client = ReturnType<typeof createClient>

const OTHER_SHOWN_CHARS = 260

export function RecordEditor({
  supabase, userId, repoKey, row, vocab, lang, onLangChange, onSaved, onCancel,
}: {
  supabase: Client
  userId: string
  repoKey: BaseRepoKey
  row: SnapshotRow
  vocab: FieldVocabulary
  /** The language of the page, 'en' or 'de'. */
  lang: string
  onLangChange: (lang: string) => void
  onSaved: () => void
  onCancel: () => void
}) {
  const viewLang: EditLang = lang === 'de' ? 'de' : 'en'
  const otherLang = otherEditLang(viewLang)
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

  const pairs = hasLanguagePairs(repoKey) || fields.some((f) => f.lang)
  const shown = fields.filter((f) => !f.lang || f.lang === viewLang)
  const main = shown.filter((f) => f.group !== 'other')
  const folded = shown.filter((f) => f.group === 'other')
  const changedIn = (l: EditLang) => changes.filter((c) => c.path.endsWith(`.${l}`)).length
  const hiddenChanges = changedIn(otherLang)

  const renderField = (f: EditField) => {
    const edited = row.editedPaths?.includes(f.path)
    const id = `edit-${f.path}`
    const common = {
      id, value: values[f.path] ?? '', style: { width: '100%', fontSize: 12 } as const,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [f.path]: e.target.value })),
    }
    const currentTags = f.kind === 'tags' ? (parseInput(f, values[f.path] ?? '') as string[]) : []
    // The same text in the other language, as it stands in the form now.
    const sibling = f.pair ? fields.find((x) => x.pair === f.pair && x.lang && x.lang !== f.lang) : undefined
    const otherRaw = sibling ? (values[sibling.path] ?? '').trim() : ''
    const otherShown = otherRaw.replace(/\n+/g, ' | ')
    const emptyHere = f.lang && !(values[f.path] ?? '').trim()
    return (
      <div key={f.path} style={{ marginBottom: 10 }}>
        <label htmlFor={id} className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>
          {f.label}{edited ? ' · edited in OpenLPM' : ''}
        </label>
        {f.kind === 'text' && <input {...common} placeholder={emptyHere ? `Not written in ${LANGUAGE_NAMES[viewLang]} yet` : undefined} />}
        {f.kind === 'longtext' && <textarea {...common} placeholder={emptyHere ? `Not written in ${LANGUAGE_NAMES[viewLang]} yet` : undefined} rows={Math.min(10, Math.max(3, Math.ceil((values[f.path] ?? '').length / 45)))} />}
        {(f.kind === 'lines' || f.kind === 'sources') && <textarea {...common} placeholder={emptyHere ? `Not written in ${LANGUAGE_NAMES[viewLang]} yet` : undefined} rows={Math.min(10, Math.max(3, (values[f.path] ?? '').split('\n').length + 1))} />}
        {f.kind === 'tags' && <input {...common} placeholder="tag one, tag two" />}
        {f.kind === 'multi' && (() => {
          // Several choices: the picked ones as removable chips, the rest in a menu that adds one. The form keeps them as comma-separated text.
          const chosen = splitChoices(values[f.path] ?? '')
          const labelOf = (v: string) => (f.reading ? f.reading(v, viewLang) : f.choices?.find((c) => c.value === v)?.label ?? v)
          const setChosen = (list: string[]) => setValues((cur) => ({ ...cur, [f.path]: list.join(',') }))
          const remaining = (f.choices ?? []).filter((c) => !chosen.includes(c.value))
          return (
            <div>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                {chosen.length === 0 && <span className="muted">None</span>}
                {chosen.map((v) => (
                  <button key={v} type="button" className="btn btn-mini" title="Remove" onClick={() => setChosen(chosen.filter((x) => x !== v))}>{labelOf(v)} ×</button>
                ))}
              </div>
              <select id={id} value="" onChange={(e) => { if (e.target.value) setChosen([...chosen, e.target.value]) }} style={{ width: '100%', fontSize: 12 }}>
                <option value="">Add…</option>
                {remaining.map((c) => <option key={c.value} value={c.value}>{labelOf(c.value)}</option>)}
              </select>
            </div>
          )
        })()}
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
        {f.lang && (
          <div className="muted" data-testid="other-language-text" style={{ fontSize: 11, marginTop: 3, overflowWrap: 'anywhere' }}>
            <strong>{LANGUAGE_NAMES[otherLang]}:</strong>{' '}
            {otherShown ? (otherShown.length > OTHER_SHOWN_CHARS ? `${otherShown.slice(0, OTHER_SHOWN_CHARS)}…` : otherShown) : <em>no {LANGUAGE_NAMES[otherLang]} text yet</em>}
          </div>
        )}
        {f.hint && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{f.hint}</div>}
      </div>
    )
  }

  return (
    <div data-testid="record-editor" style={{ fontSize: 12 }}>
      {pairs ? (
        <div data-testid="editing-language" style={{ marginBottom: 10, marginTop: -14, position: 'sticky', top: -14, zIndex: 2, background: 'var(--surface-2)', padding: '14px 0 6px' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <span className="muted" style={{ fontSize: 11 }}>Editing in</span>
            <LanguageSwitch value={viewLang} onChange={onLangChange} uiLang="en" languages={['en', 'de']} />
          </div>
          <div className="muted" style={{ fontSize: 11 }}>
            Texts and tag names show in {LANGUAGE_NAMES[viewLang]}. The {LANGUAGE_NAMES[otherLang]} text is in grey under each box. What you type in either language is kept when you switch, and saved together.
          </div>
        </div>
      ) : (
        <div className="muted" data-testid="english-only-note" style={{ fontSize: 11, marginBottom: 10 }}>
          This repo holds English text only so far, so there is one box per field. German texts for it come later.
        </div>
      )}
      {main.map(renderField)}
      {folded.length > 0 && (
        <details data-testid="other-fields" style={{ marginBottom: 10 }}>
          <summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>Other fields, the same in both languages ({folded.length})</summary>
          <div style={{ marginTop: 8 }}>{folded.map(renderField)}</div>
        </details>
      )}
      <div style={{ marginBottom: 10 }}>
        <label htmlFor="edit-note" className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>What did you change, and why? (optional)</label>
        <input id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', fontSize: 12 }} />
      </div>
      {error && <div className="notice" style={{ marginBottom: 8 }}>Not saved: {error}</div>}
      {pairs && hiddenChanges > 0 && (
        <div className="muted" data-testid="hidden-language-changes" style={{ fontSize: 11, marginBottom: 6 }}>
          {hiddenChanges} of the changes are in {LANGUAGE_NAMES[otherLang]}. They are saved with the rest.
        </div>
      )}
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
              <div><strong>{describePath(e.field_path)}</strong>{' '}
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
