import { useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Download, FileJson, Search, Trash2, Upload } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { TOS_EDITOR_ROLES, TosReviewChip, useTosModel, useTosProfiles } from '@/components/tos-shared'
import { holderKindPlain, parseProfileText, plural, profileFileName, validateProfile, type TosProfile, type ValidationResult } from '@/lib/tos-profile'
import { deleteTosProfile, saveTosProfile, searchTosStatements, type TosElementSearchRow } from '@/lib/supabase/tos-profiles'
import { useSession } from '@/state/session'

// The Profiles page of a Theories of Schooling space (migration 256): the profiles saved in this space, a way to add one (paste or file,
// checked before it is saved), a download for each, and a search over the statements.
export default function TosProfilesPage() {
  const { project, supabase, role } = useOutletContext<ProjectOutletContext>()
  const { session } = useSession()
  const userId = session?.user?.id ?? null
  const canEdit = TOS_EDITOR_ROLES.includes(role)
  const { rows, problem, reload } = useTosProfiles(supabase, project.id)
  const { model, failed: modelFailed } = useTosModel()

  const [source, setSource] = useState('')
  const [fileName, setFileName] = useState('')
  const [checked, setChecked] = useState<{ result: ValidationResult; readError: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<TosElementSearchRow[] | null>(null)
  const [searchProblem, setSearchProblem] = useState<string | null>(null)

  const titleByRow = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r.title])), [rows])

  const check = (text: string) => {
    setNotice(null)
    if (!model) return
    const read = parseProfileText(text)
    if (read.error) {
      setChecked({ result: { ok: false, errors: [], warnings: [], profile: null }, readError: read.error })
      return
    }
    setChecked({ result: validateProfile(read.value, model), readError: null })
  }

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    setSource(text)
    check(text)
  }

  const reset = () => {
    setSource('')
    setFileName('')
    setChecked(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const profile: TosProfile | null = checked?.result.profile ?? null
  const existing = profile ? (rows ?? []).find((r) => r.profile_id === profile.id) : undefined

  const save = async () => {
    if (!profile || !userId) return
    setBusy(true)
    const res = await saveTosProfile(supabase, project.id, userId, profile)
    setBusy(false)
    if (res.error) {
      setNotice({ kind: 'bad', text: res.error })
      if (res.id) reload()
      return
    }
    setNotice({ kind: 'ok', text: res.replaced ? `Replaced the saved version of "${profile.title}" with version ${profile.version}.` : `Saved "${profile.title}" in this space.` })
    reset()
    reload()
  }

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}" from this space? Everyone in the space loses it. Download it first if you want to keep a copy.`)) return
    const err = await deleteTosProfile(supabase, id)
    setNotice(err ? { kind: 'bad', text: err } : { kind: 'ok', text: `Deleted "${title}".` })
    reload()
  }

  const download = (p: TosProfile) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2) + '\n'], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = profileFileName(p)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await searchTosStatements(supabase, project.id, query)
    setHits(res.data)
    setSearchProblem(res.problem)
  }

  return (
    <div>
      <h1 className="row"><FileJson size={18} style={{ color: 'var(--text-muted)' }} />Profiles</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        A profile is one theory of schooling written down: whose it is, the statements in it, where each statement belongs, and the reasons behind
        each proposal. Everyone who is a member of this space can read the profiles saved here.
      </p>
      {notice && <div className={`notice notice-${notice.kind}`}>{notice.text}</div>}
      {problem && <div className="notice notice-bad">{problem}</div>}
      {modelFailed && <div className="notice notice-bad">The list of domains could not load, so a profile cannot be checked now. Reload the page.</div>}

      <div className="card">
        <h3>Saved in this space</h3>
        {rows === null ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">Nothing is saved yet.{canEdit ? ' Add a profile below.' : ''}</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="card" style={{ marginBottom: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>{r.title}</strong>
                  <div className="muted" style={{ marginTop: 2 }}>
                    {model ? holderKindPlain(model, r.holder_kind) : r.holder_kind}
                    {r.data?.holder?.label ? `: ${r.data.holder.label}` : ''} · version {r.version} · {plural(r.data?.elements?.length ?? 0, 'statement')} · saved {new Date(r.updated_at).toLocaleDateString()}
                  </div>
                  <div className="row" style={{ marginTop: 6 }}>
                    <TosReviewChip status={r.review_status} />
                    <span className="chip" title="Who may see the profile outside this space, as the profile itself says">
                      {r.visibility === 'public' ? 'May be published' : r.visibility === 'lab-only' ? 'Lab only' : 'Marked as local'}
                    </span>
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>{r.profile_id}</div>
                </div>
                <div className="row">
                  <button className="btn btn-mini" onClick={() => download(r.data)}><Download size={11} />Download</button>
                  {canEdit && (
                    <button className="btn btn-mini btn-danger" onClick={() => remove(r.id, r.title)}><Trash2 size={11} />Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h3>Add a profile</h3>
        {!canEdit ? (
          <p className="muted">You can read the profiles in this space. Ask an owner for the editor role if you want to add one.</p>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 8 }}>
              Paste the text of a profile file, or choose the file. It is checked first and nothing is saved until you press the save button. If
              the space already holds a profile with the same code, the new one replaces it. Nothing on this page is sent to an AI service.
            </p>
            <div className="field">
              <label htmlFor="tos-file">Choose a profile file</label>
              <input id="tos-file" ref={fileRef} type="file" accept=".json,application/json" onChange={(e) => chooseFile(e.target.files?.[0])} />
              {fileName && <span className="muted">{fileName}</span>}
            </div>
            <div className="field">
              <label htmlFor="tos-paste">Or paste the profile text</label>
              <textarea id="tos-paste" rows={8} value={source} onChange={(e) => { setSource(e.target.value); setChecked(null) }} spellCheck={false} placeholder='{ "schema": "openevo-schooling-theory-profile/1", ... }' />
            </div>
            <div className="row">
              <button className="btn" disabled={!source.trim() || !model} onClick={() => check(source)}><Search size={14} />Check it</button>
              <button className="btn btn-primary" disabled={!profile || busy || !userId} onClick={save}><Upload size={14} />{existing ? 'Replace the saved version' : 'Save to this space'}</button>
              {(source || checked) && <button className="btn" onClick={reset}>Clear</button>}
            </div>

            {checked && (
              <div style={{ marginTop: 12 }}>
                {checked.readError && <div className="notice notice-bad">{checked.readError}</div>}
                {checked.result.errors.length > 0 && (
                  <div className="notice notice-bad" style={{ display: 'block' }}>
                    <strong>This profile cannot be saved yet.</strong>
                    <ul style={{ margin: '6px 0 0 18px' }}>
                      {checked.result.errors.slice(0, 20).map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                    {checked.result.errors.length > 20 && <p style={{ margin: '6px 0 0' }}>And {checked.result.errors.length - 20} more.</p>}
                  </div>
                )}
                {checked.result.warnings.length > 0 && (
                  <div className="notice" style={{ display: 'block' }}>
                    <strong>Worth knowing.</strong>
                    <ul style={{ margin: '6px 0 0 18px' }}>
                      {checked.result.warnings.slice(0, 10).map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
                {profile && (
                  <div className="notice notice-ok" style={{ display: 'block' }}>
                    <strong>{profile.title}</strong> passed the check: {plural(profile.elements.length, 'statement')}, {plural((profile.warrants ?? []).length, 'reason')}.{' '}
                    {existing ? `The space already holds version ${existing.version} of this profile. Saving replaces it with version ${profile.version}.` : 'It is new to this space.'}
                    <div style={{ marginTop: 4 }}><TosReviewChip status={profile.provenance.reviewStatus} /></div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h3>Find a statement</h3>
        <form className="row" onSubmit={runSearch}>
          <input aria-label="Words to look for" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Words from a statement" style={{ flex: 1, minWidth: 200 }} />
          <button className="btn" type="submit" disabled={query.trim().length < 2}><Search size={14} />Search</button>
        </form>
        {searchProblem && <div className="notice notice-bad" style={{ marginTop: 8 }}>{searchProblem}</div>}
        {hits && !searchProblem && (
          <div style={{ marginTop: 8 }}>
            {hits.length === 0 ? <p className="muted">No statement contains those words.</p> : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {hits.map((h) => (
                  <li key={h.id} style={{ marginBottom: 4 }}>
                    {h.statement} <span className="muted">({titleByRow.get(h.profile_row_id) ?? 'a profile in this space'})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
