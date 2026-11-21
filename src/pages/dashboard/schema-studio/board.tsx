import { useMemo, useState } from 'react'
import { Check, ClipboardCopy, Download, MessageCircle, Send, ThumbsUp, Trash2 } from 'lucide-react'
import { KINDS, STATUSES, kindLabel, suggestionMarkdown, type DraftSuggestion, type Suggestion } from '@/lib/schema-studio/data'
import { agoText, useStudio } from './context'
import { Section, gvars, groupOfRepo } from './parts'
import { describeTarget } from './suggest'
import { downloadText } from './table'

interface Actions {
  available: boolean
  me: string | null
  sendDraft: (d: DraftSuggestion) => Promise<string | null>
  removeDraft: (id: string) => void
  setStatus: (id: string, status: Suggestion['status'], note?: string) => Promise<string | null>
  agree: (id: string, on: boolean) => Promise<string | null>
  comment: (id: string, body: string) => Promise<string | null>
  markExported: (ids: string[], batch: string) => Promise<string | null>
  reload: () => void
}

export default function BoardView({ actions }: { actions: Actions }) {
  const { model, suggestions, basket, parsed } = useStudio()
  const [status, setStatus] = useState<string>('active')
  const [repo, setRepo] = useState('all')
  const [kind, setKind] = useState('all')
  const [mine, setMine] = useState(false)
  const [sort, setSort] = useState<'new' | 'agreed' | 'priority'>('new')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)
  const nameOf = (k: string) => (k === 'system' ? 'Whole system' : k === 'core' ? 'openevo-core' : model.repoByKey.get(k)?.name ?? k)
  const snapDate = new Date(model.snap.generatedAt).toLocaleDateString()
  const prio = { high: 0, normal: 1, low: 2 } as const

  const rows = useMemo(() => suggestions.filter((s) =>
    (status === 'all' || (status === 'active' ? ['open', 'discussing', 'accepted'].includes(s.status) : s.status === status)) && (repo === 'all' || s.target_repo === repo) && (kind === 'all' || s.kind === kind) &&
    (!mine || s.author?.email === actions.me) && (parsed.empty || [s.summary, s.rationale, s.proposed_value, s.target_type, s.target_field].join(' ').toLowerCase().includes(parsed.words.join(' ')))
  ).sort((a, b) => sort === 'agreed' ? b.agrees - a.agrees : sort === 'priority' ? prio[a.priority] - prio[b.priority] || b.created_at.localeCompare(a.created_at) : b.created_at.localeCompare(a.created_at)), [suggestions, status, repo, kind, mine, sort, parsed, actions.me])

  const exportable = suggestions.filter((s) => picked.has(s.id))
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500) }

  return (
    <div className="ss-board">
      <p className="ss-lead">Suggestions about the structure, collected in one place. Collect your own in the <b>basket</b>, send them to the <b>board</b>, discuss them, and when a suggestion is accepted, take it into the repository through a normal pull request. Nothing here changes a repository by itself.</p>
      {msg && <p className="ss-flash">{msg}</p>}

      <Section title={`My basket (${basket.length})`} aside={basket.length ? <span className="ss-actions">
        <button type="button" className="btn btn-mini" onClick={() => { navigator.clipboard?.writeText(suggestionMarkdown(basket, nameOf, snapDate)); flash('Copied as Markdown.') }}><ClipboardCopy size={13} /> Copy as Markdown</button>
        <button type="button" className="btn btn-mini" onClick={() => downloadText('schema-suggestions.md', suggestionMarkdown(basket, nameOf, snapDate), 'text/markdown')}><Download size={13} /> Download</button>
        {actions.available && <button type="button" className="btn btn-mini btn-primary" onClick={async () => { for (const d of basket) { const e = await actions.sendDraft(d); if (!e) actions.removeDraft(d.localId); else { flash(e); break } } actions.reload() }}><Send size={13} /> Send all to the board</button>}
      </span> : null}>
        {!basket.length ? <p className="ss-empty">Your basket is empty. Open any repository, record type or field and press <b>Suggest a change</b>.</p> : (
          <ul className="ss-cards">
            {basket.map((d) => (
              <li key={d.localId} className="ss-card draft" style={gvars(groupOfRepo(model, d.target_repo))}>
                <div className="ss-card-head"><span className="ss-pill">{kindLabel(d.kind)}</span><strong>{d.summary}</strong></div>
                <p className="ss-target">{describeTarget(model, { repo: d.target_repo, type: d.target_type ?? undefined, field: d.target_field ?? undefined })}</p>
                {d.proposed_value && <p><b>Proposed.</b> {d.proposed_value}</p>}{d.rationale && <p><b>Why.</b> {d.rationale}</p>}
                <div className="ss-card-foot">
                  {actions.available && <button type="button" className="btn btn-mini" onClick={async () => { const e = await actions.sendDraft(d); if (e) flash(e); else { actions.removeDraft(d.localId); actions.reload() } }}><Send size={12} /> Send</button>}
                  <button type="button" className="btn btn-mini" onClick={() => actions.removeDraft(d.localId)}><Trash2 size={12} /> Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Shared board (${suggestions.length})`} aside={<span className="ss-actions">
        {picked.size > 0 && <><button type="button" className="btn btn-mini" onClick={() => { navigator.clipboard?.writeText(suggestionMarkdown(exportable, nameOf, snapDate)); flash('Copied as Markdown.') }}><ClipboardCopy size={13} /> Copy {picked.size} as Markdown</button>
          <button type="button" className="btn btn-mini" onClick={async () => { const batch = window.prompt('Name this batch (for example the pull request number):', `batch-${new Date().toISOString().slice(0, 10)}`); if (!batch) return; const e = await actions.markExported([...picked], batch); if (e) flash(e); else { setPicked(new Set()); actions.reload(); flash('Marked as sent back.') } }}><Check size={13} /> Mark as sent to a repository</button></>}</span>}>
        {!actions.available ? <p className="ss-empty">The shared board is not switched on yet (migration 252 has not been applied). Suggestions can be collected in the basket and exported in the meantime.</p> : (
          <>
            <div className="ss-filters">
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="active">Open, discussing, accepted</option><option value="all">Every status</option>{STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
              <select value={repo} onChange={(e) => setRepo(e.target.value)} aria-label="Repository"><option value="all">Every repository</option>{[...new Set(suggestions.map((s) => s.target_repo))].map((k) => <option key={k} value={k}>{nameOf(k)}</option>)}</select>
              <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind"><option value="all">Every kind</option>{KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort"><option value="new">Newest first</option><option value="agreed">Most agreed</option><option value="priority">Most urgent</option></select>
              <label className={`ss-toggle${mine ? ' on' : ''}`}><input type="checkbox" checked={mine} onChange={() => setMine((v) => !v)} />Mine only</label>
            </div>
            <ul className="ss-cards">
              {rows.map((s) => <Card key={s.id} s={s} actions={actions} picked={picked.has(s.id)} onPick={() => setPicked((p) => { const n = new Set(p); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n })} />)}
              {!rows.length && <li className="ss-empty">No suggestion matches.</li>}
            </ul>
          </>
        )}
      </Section>
    </div>
  )
}

function Card({ s, actions, picked, onPick }: { s: Suggestion; actions: Actions; picked: boolean; onPick: () => void }) {
  const { model, select, now } = useStudio()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const typeId = s.target_type ?? undefined
  const exists = s.target_repo === 'system' || s.target_repo === 'core' || (!typeId ? model.repoByKey.has(s.target_repo) : model.typeById.has(typeId) && (!s.target_field || model.fieldById.has(`${typeId}#${s.target_field}`)))
  const older = s.snapshot_hash && s.snapshot_hash !== model.snap.contentHash
  const go = () => { if (typeId && s.target_field && model.fieldById.has(`${typeId}#${s.target_field}`)) select({ kind: 'field', fieldId: `${typeId}#${s.target_field}` }); else if (typeId && model.typeById.has(typeId)) select({ kind: 'type', typeId }); else if (model.repoByKey.has(s.target_repo)) select({ kind: 'repo', repo: s.target_repo }) }
  return (
    <li className={`ss-card pr-${s.priority}`} style={gvars(groupOfRepo(model, s.target_repo))}>
      <div className="ss-card-head"><input type="checkbox" checked={picked} onChange={onPick} aria-label="Select for export" /><span className="ss-pill">{kindLabel(s.kind)}</span><strong>{s.summary}</strong><span className={`ss-pill st-${s.status}`}>{STATUSES.find((x) => x.key === s.status)?.label}</span>{s.priority === 'high' && <span className="ss-pill warn">urgent</span>}</div>
      <p className="ss-target"><button type="button" className="ss-link-btn" onClick={go}>{describeTarget(model, { repo: s.target_repo, type: typeId, field: s.target_field ?? undefined })}</button>{!exists && <span className="ss-pill warn" title="This part of the structure no longer exists in the current snapshot">no longer in the structure</span>}{exists && older && <span className="ss-pill" title="The structure has changed since this was written">written against an older structure</span>}</p>
      {s.current_value && <p><b>Now.</b> {s.current_value}</p>}{s.proposed_value && <p><b>Proposed.</b> {s.proposed_value}</p>}{s.rationale && <p><b>Why.</b> {s.rationale}</p>}
      {s.decision_note && <p className="ss-decision"><b>Decision.</b> {s.decision_note}</p>}
      <div className="ss-card-foot">
        <span className="ss-dim">{s.author?.name ?? 'someone'}, {agoText(s.created_at, now)}</span>
        <button type="button" className={`btn btn-mini${s.agreedByMe ? ' btn-primary' : ''}`} onClick={async () => { await actions.agree(s.id, !s.agreedByMe); actions.reload() }}><ThumbsUp size={12} /> {s.agrees || 'Agree'}</button>
        <button type="button" className="btn btn-mini" onClick={() => setOpen((v) => !v)}><MessageCircle size={12} /> {s.comments.length || 'Discuss'}</button>
        <select value={s.status} onChange={async (e) => { const v = e.target.value as Suggestion['status']; if (v === 'accepted' || v === 'declined') { const n = window.prompt('A short note on the decision (optional):', '') ?? ''; await actions.setStatus(s.id, v, n) } else await actions.setStatus(s.id, v); actions.reload() }} aria-label="Status">{STATUSES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
        {s.export_batch && <span className="ss-dim">sent in {s.export_batch}</span>}
      </div>
      {open && (
        <div className="ss-thread">
          {s.comments.map((c) => <p key={c.id}><b>{c.author?.name ?? 'someone'}</b> <span className="ss-dim">{agoText(c.created_at, now)}</span><br />{c.body}</p>)}
          <div className="ss-reply"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment" onKeyDown={async (e) => { if (e.key === 'Enter' && text.trim()) { await actions.comment(s.id, text.trim()); setText(''); actions.reload() } }} /><button type="button" className="btn btn-mini" disabled={!text.trim()} onClick={async () => { await actions.comment(s.id, text.trim()); setText(''); actions.reload() }}>Post</button></div>
        </div>
      )}
    </li>
  )
}
