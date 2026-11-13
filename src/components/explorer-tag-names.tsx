import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import type { createClient } from '@/lib/supabase/client'
import { saveTagNames, type TagNameChange } from '@/lib/supabase/base-repo-edits'
import { tagNameIn, tagTerms, type TagField } from '@/lib/method-text'

// The names of the method tags (learning approaches, lesson phases) in English and German, in one place (Dustin, 2026-11-13: "edit all the
// tags in either language"). A tag is stored once. Each name is saved as an edit, so it has the same log, undo and way back to MethodsBase
// as every other edit. A tag with a name in one language only is shown by that name in the other language until someone adds one.

type Client = ReturnType<typeof createClient>
const FIELDS: { field: TagField; title: string }[] = [
  { field: 'learningApproaches', title: 'Learning approaches' },
  { field: 'lessonPhases', title: 'Lesson phases' },
]
const LANGS = [{ code: 'en' as const, name: 'English' }, { code: 'de' as const, name: 'German' }]

export function TagNamesPanel({ supabase, userId, onSaved, onClose }: { supabase: Client; userId: string; onSaved: () => void; onClose: () => void }) {
  // What was typed, by "field|tag|language". A box that was not touched shows the name the tag has now.
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [add, setAdd] = useState<{ field: TagField; en: string; de: string }>({ field: 'learningApproaches', en: '', de: '' })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = (field: TagField, term: string, lang: string) => `${field}|${term}|${lang}`

  const changes: Record<string, TagNameChange[]> = useMemo(() => {
    const out: Record<string, TagNameChange[]> = {}
    for (const { field } of FIELDS) {
      for (const term of tagTerms(field)) {
        for (const { code } of LANGS) {
          const typed = (draft[key(field, term, code)] ?? '').trim()
          const now = tagNameIn(field, term, code)
          if (typed && typed !== now) (out[field] ??= []).push({ term, lang: code, before: now, after: typed })
        }
      }
    }
    // A new tag: named by its German name when it has one, else by its English name. Both names are saved when both are typed.
    const en = add.en.trim(); const de = add.de.trim()
    const term = de || en
    if (term && !tagTerms(add.field).includes(term)) {
      if (en) (out[add.field] ??= []).push({ term, lang: 'en', before: null, after: en })
      if (de) (out[add.field] ??= []).push({ term, lang: 'de', before: null, after: de })
    }
    return out
  }, [draft, add])
  const total = Object.values(changes).reduce((n, l) => n + l.length, 0)
  const clash = (() => { const t = add.de.trim() || add.en.trim(); return !!t && tagTerms(add.field).includes(t) })()

  const save = async () => {
    setBusy(true); setError(null)
    for (const [field, list] of Object.entries(changes)) {
      const message = await saveTagNames(supabase, { field: field as TagField, userId, changes: list, note })
      if (message) { setBusy(false); setError(message); return }
    }
    setBusy(false)
    setDraft({}); setAdd((a) => ({ ...a, en: '', de: '' })); setNote('')
    onSaved()
  }

  return (
    <div className="card" data-testid="tag-names-panel" style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ marginBottom: 4 }}>Tag names in English and German</h3>
        <button className="btn btn-mini" onClick={onClose} aria-label="Close tag names">×</button>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        A tag is saved once and shown by its name in the language of the page. A tag with a name in one language only shows that name in the other until someone adds the second one. Changes are saved like every other edit and wait to be sent back to MethodsBase.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {FIELDS.map(({ field, title }) => (
          <div key={field}>
            <h4 style={{ fontSize: 13, margin: '0 0 6px' }}>{title}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }} className="muted">
              {LANGS.map((l) => <span key={l.code}>{l.name}</span>)}
            </div>
            {tagTerms(field).map((term) => (
              <div key={term} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 4 }}>
                {LANGS.map((l) => {
                  const now = tagNameIn(field, term, l.code)
                  return (
                    <input
                      key={l.code} style={{ fontSize: 12, width: '100%' }}
                      aria-label={`${title}: ${term}, ${l.name} name`} data-testid={`tag-name-${field}-${term}-${l.code}`}
                      value={draft[key(field, term, l.code)] ?? now ?? ''}
                      placeholder={`needs a ${l.name} name`}
                      onChange={(e) => setDraft((d) => ({ ...d, [key(field, term, l.code)]: e.target.value }))}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <h4 style={{ fontSize: 13, margin: '14px 0 6px' }}>Add a tag</h4>
      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
        <select aria-label="Which tags the new one belongs to" value={add.field} onChange={(e) => setAdd((a) => ({ ...a, field: e.target.value as TagField }))} style={{ fontSize: 12 }}>
          {FIELDS.map((f) => <option key={f.field} value={f.field}>{f.title}</option>)}
        </select>
        <input aria-label="New tag, English name" data-testid="add-tag-en" value={add.en} onChange={(e) => setAdd((a) => ({ ...a, en: e.target.value }))} placeholder="English name" style={{ fontSize: 12 }} />
        <input aria-label="New tag, German name" data-testid="add-tag-de" value={add.de} onChange={(e) => setAdd((a) => ({ ...a, de: e.target.value }))} placeholder="German name" style={{ fontSize: 12 }} />
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
        One name is enough. {clash ? 'A tag with that name exists already, so nothing is added for it.' : 'The other one can be added later.'}
      </div>
      <div style={{ marginTop: 10 }}>
        <label htmlFor="tag-names-note" className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>What did you change, and why? (optional)</label>
        <input id="tag-names-note" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', fontSize: 12 }} />
      </div>
      {error && <div className="notice" style={{ marginTop: 8 }}>Not saved: {error}</div>}
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className="btn btn-mini btn-primary" disabled={busy || total === 0} onClick={save} data-testid="save-tag-names">
          <Check size={13} />{total === 0 ? 'Save (no changes yet)' : `Save ${total} name${total === 1 ? '' : 's'}`}
        </button>
        <button className="btn btn-mini" disabled={busy} onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
