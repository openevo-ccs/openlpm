import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ClipboardCopy, MessageSquareText } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { TosReviewChip, useTosModel, useTosProfiles } from '@/components/tos-shared'
import { plural, type TosDomain } from '@/lib/tos-profile'
import { buildTosContext, KIND_PLAIN, listStatements, NOT_PLACED, type Audience } from '@/lib/tos-prompt-builder'
import { listProfileIdsOpenToAi } from '@/lib/supabase/tos-profiles'

const LIST_CAP = 200

// The Prompt context page of a Theories of Schooling space (migration 256): pick theories, domains and statements, and see the plain-language
// text a chat assistant would get. The page only builds the text. A person copies it, and nothing is sent from here.
//
// AI opt-out rule (CLAUDE.md): a profile whose creator opted out of AI processing is left out of the choices. If the page cannot find out who
// opted out, it offers nothing.
export default function TosPromptContextPage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const { rows, problem } = useTosProfiles(supabase, project.id)
  const { model, failed: modelFailed } = useTosModel()

  const [openIds, setOpenIds] = useState<Set<string> | null | undefined>(undefined)
  const [offProfiles, setOffProfiles] = useState<Set<string>>(new Set())
  const [domainIds, setDomainIds] = useState<string[]>([])
  const [leftOut, setLeftOut] = useState<Set<string>>(new Set())
  const [audience, setAudience] = useState<Audience>('lab')
  const [firmOnly, setFirmOnly] = useState(false)
  const [question, setQuestion] = useState('')
  const [copied, setCopied] = useState<'yes' | 'select' | null>(null)
  const outRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let alive = true
    setOpenIds(undefined)
    listProfileIdsOpenToAi(supabase, project.id).then((ids) => alive && setOpenIds(ids))
    return () => {
      alive = false
    }
  }, [supabase, project.id])

  // Profiles the person may use: saved in this space, open to AI use, and not switched off below.
  const offered = useMemo(() => (rows && openIds ? rows.filter((r) => openIds.has(r.id)) : []), [rows, openIds])
  const heldBack = rows && openIds ? rows.length - offered.length : 0
  const profiles = useMemo(() => offered.filter((r) => !offProfiles.has(r.id)).map((r) => r.data), [offered, offProfiles])
  const statements = useMemo(() => listStatements(profiles), [profiles])

  const result = useMemo(() => {
    if (!model || profiles.length === 0) return null
    const codes = statements.filter((s) => !leftOut.has(s.code)).map((s) => s.code)
    return buildTosContext(profiles, model, { audience, domainIds, statementCodes: codes, firmOnly, question })
  }, [model, profiles, statements, leftOut, audience, domainIds, firmOnly, question])

  const visible = useMemo(() => {
    if (!model) return []
    return statements.filter((s) => {
      if (domainIds.length === 0) return true
      const placed = [...(s.element.placement?.super ?? []), ...(s.element.placement?.sub ?? [])].map((p) => (typeof p === 'string' ? p : p.id))
      return domainIds.some((d) => (d === NOT_PLACED ? placed.length === 0 : placed.includes(d)))
    })
  }, [model, statements, domainIds])

  const toggle = <T,>(set: Set<T>, v: T): Set<T> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const copy = async () => {
    const text = result?.text ?? ''
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied('yes')
    } catch {
      outRef.current?.select()
      let ok = false
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      setCopied(ok ? 'yes' : 'select')
    }
  }

  const domainChip = (d: TosDomain | { id: string; name: string; short: string; means: string }) => (
    <button
      key={d.id}
      type="button"
      className={`btn btn-mini${domainIds.includes(d.id) ? ' active' : ''}`}
      aria-pressed={domainIds.includes(d.id)}
      title={d.means}
      onClick={() => setDomainIds((cur) => (cur.includes(d.id) ? cur.filter((x) => x !== d.id) : [...cur, d.id]))}
    >
      {d.short}
    </button>
  )

  return (
    <div>
      <h1 className="row"><MessageSquareText size={18} style={{ color: 'var(--text-muted)' }} />Prompt context</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Choose which parts of the theories in this space a chat assistant should know about. The text below is written in everyday words and is
        ready to paste at the start of a chat. This page only builds the text. Nothing is sent from here.
      </p>
      {problem && <div className="notice notice-bad">{problem}</div>}
      {modelFailed && <div className="notice notice-bad">The list of domains could not load. Reload the page.</div>}
      {openIds === null && (
        <div className="notice notice-bad">
          This page could not find out whose writing may be given to an AI assistant, so it offers nothing. Reload the page, or ask an admin if it
          keeps happening.
        </div>
      )}
      {heldBack > 0 && (
        <div className="notice">
          {plural(heldBack, 'profile')} left out. The person who added {heldBack === 1 ? 'it' : 'them'} asked that their writing is not passed to AI services.
        </div>
      )}

      {rows && openIds && offered.length === 0 && !problem && (
        <div className="card empty"><p>There is no theory to build a text from yet. Add one on the Profiles page.</p></div>
      )}

      {model && offered.length > 0 && (
        <>
          <div className="card">
            <h3>1. Which theories</h3>
            {offered.map((r) => (
              <label key={r.id} className="row" style={{ gap: 8, padding: '3px 0' }}>
                <input type="checkbox" checked={!offProfiles.has(r.id)} onChange={() => setOffProfiles((cur) => toggle(cur, r.id))} />
                <span>{r.title}</span>
                <TosReviewChip status={r.review_status} />
              </label>
            ))}
          </div>

          <div className="card">
            <h3>2. Which domains</h3>
            <p className="muted" style={{ marginBottom: 8 }}>Choose none to cover all of them.</p>
            <p className="muted" style={{ margin: '4px 0' }}>Broad ideas about people and societies</p>
            <div className="row" style={{ marginBottom: 8 }}>{model.supers.map((d) => domainChip(d))}</div>
            <p className="muted" style={{ margin: '4px 0' }}>Aspects of schooling</p>
            <div className="row" style={{ marginBottom: 8 }}>{model.subs.map((d) => domainChip(d))}</div>
            <div className="row">
              {domainChip({ id: NOT_PLACED, name: 'Not placed yet', short: 'Not placed yet', means: 'Statements that nobody has sorted into a domain yet.' })}
              {domainIds.length > 0 && <button type="button" className="btn btn-mini" onClick={() => setDomainIds([])}>Clear the choice</button>}
            </div>
            <label className="row" style={{ gap: 8, marginTop: 10 }}>
              <input type="checkbox" checked={firmOnly} onChange={() => setFirmOnly((v) => !v)} />
              Only list a statement under the domains it clearly belongs to
            </label>
          </div>

          <div className="card">
            <h3>3. Which statements</h3>
            <p className="muted" style={{ marginBottom: 8 }}>
              {plural(visible.length, 'statement')} in the chosen domains. All are included unless you untick them.
            </p>
            <div className="row" style={{ marginBottom: 8 }}>
              <button type="button" className="btn btn-mini" onClick={() => setLeftOut((cur) => { const n = new Set(cur); visible.forEach((s) => n.delete(s.code)); return n })}>Include all shown</button>
              <button type="button" className="btn btn-mini" onClick={() => setLeftOut((cur) => { const n = new Set(cur); visible.forEach((s) => n.add(s.code)); return n })}>Leave out all shown</button>
            </div>
            <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
              {visible.slice(0, LIST_CAP).map((s) => (
                <label key={s.code} className="row" style={{ gap: 8, alignItems: 'flex-start', padding: '3px 0' }}>
                  <input type="checkbox" checked={!leftOut.has(s.code)} onChange={() => setLeftOut((cur) => toggle(cur, s.code))} />
                  <span><span className="muted">{KIND_PLAIN[s.element.type] ?? s.element.type}: </span>{s.element.statement}</span>
                </label>
              ))}
              {visible.length > LIST_CAP && <p className="muted">Showing the first {LIST_CAP}. The others follow the same choices as the domains above.</p>}
            </div>
          </div>

          <div className="card">
            <h3>4. Who will read the answer</h3>
            <label className="row" style={{ gap: 8 }}>
              <input type="radio" name="tos-audience" checked={audience === 'lab'} onChange={() => setAudience('lab')} />
              People in the lab. Every statement appears in full.
            </label>
            <label className="row" style={{ gap: 8 }}>
              <input type="radio" name="tos-audience" checked={audience === 'public'} onChange={() => setAudience('public')} />
              People outside the lab. A statement marked lab-only appears only as its short name.
            </label>
          </div>

          <div className="card">
            <h3>5. Your question (optional)</h3>
            <div className="field">
              <label htmlFor="tos-question">Added at the end of the text, as you write it</label>
              <textarea id="tos-question" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} />
            </div>
          </div>

          <div className="card">
            <h3>The text</h3>
            {result ? (
              <>
                <p className="muted" style={{ marginBottom: 8 }}>
                  {plural(result.included, 'statement')} written out
                  {result.withheld > 0 ? `, ${result.withheld} of them by short name only` : ''}
                  {result.skipped > 0 ? `. ${plural(result.skipped, 'chosen statement')} did not fit the chosen domains and ${result.skipped === 1 ? 'is' : 'are'} left out` : ''}.
                </p>
                <textarea ref={outRef} readOnly rows={18} value={result.text} aria-label="Context text to copy" style={{ width: '100%', fontFamily: 'inherit' }} onFocus={() => setCopied(null)} />
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn btn-primary" onClick={copy}><ClipboardCopy size={14} />Copy the text</button>
                  {copied === 'yes' && <span className="muted" role="status">Copied.</span>}
                  {copied === 'select' && <span className="muted" role="status">Select the text above and copy it.</span>}
                </div>
              </>
            ) : (
              <p className="muted">Tick at least one theory above.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
