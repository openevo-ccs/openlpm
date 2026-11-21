import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Model, Target } from '@/lib/schema-studio/model'
import { friendlyType, explainType } from '@/lib/schema-studio/meanings'
import { KINDS, type DraftSuggestion, type Kind } from '@/lib/schema-studio/data'

export interface SuggestRequest { target: Target; kind?: string; prefill?: Partial<DraftSuggestion> }

export function describeTarget(model: Model, t: Target): string {
  if (t.repo === 'system') return 'The whole system (across repositories)'
  const repo = t.repo === 'core' ? 'openevo-core' : model.repoByKey.get(t.repo)?.name ?? t.repo
  const type = t.type ? model.typeById.get(t.type)?.title : null
  return [repo, type, t.field].filter(Boolean).join(' › ')
}

function currentText(model: Model, t: Target): string {
  if (t.type && t.field) {
    const f = model.fieldById.get(`${t.type}#${t.field}`)
    if (f) return `${f.path}: holds ${friendlyType(f.field)}${f.field.required ? ', required' : ', optional'}.${f.field.description ? ' ' + f.field.description : ''}${f.field.enum ? ` Allowed values: ${f.field.enum.join(', ')}.` : ''}`
  }
  if (t.type) { const n = model.typeById.get(t.type); if (n) return `${n.title}: ${explainType(n, model).one}` }
  return ''
}

export default function SuggestDialog({ req, model, canSend, onClose, onBasket, onSend }: {
  req: SuggestRequest; model: Model; canSend: boolean; onClose: () => void
  onBasket: (d: DraftSuggestion) => void; onSend: (d: DraftSuggestion) => Promise<string | null>
}) {
  const [kind, setKind] = useState<Kind>((KINDS.some((k) => k.key === req.kind) ? req.kind : 'clarify') as Kind)
  const [summary, setSummary] = useState(req.prefill?.summary ?? '')
  const [current, setCurrent] = useState(req.prefill?.current_value ?? currentText(model, req.target))
  const [proposed, setProposed] = useState(req.prefill?.proposed_value ?? '')
  const [why, setWhy] = useState(req.prefill?.rationale ?? '')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>(req.prefill?.priority ?? 'normal')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => { first.current?.focus() }, [])
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  const valid = summary.trim().length >= 3
  const draft = (): DraftSuggestion => ({
    localId: crypto.randomUUID(), target_repo: req.target.repo, target_type: req.target.type ?? null, target_field: req.target.field ?? null, kind, summary: summary.trim().slice(0, 200),
    current_value: current.trim().slice(0, 2000), proposed_value: proposed.trim().slice(0, 4000), rationale: why.trim().slice(0, 4000), priority, snapshot_hash: model.snap.contentHash, created_at: new Date().toISOString(),
  })
  const kindHelp = useMemo(() => KINDS.find((k) => k.key === kind)?.help, [kind])
  return (
    <div className="ss-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ss-modal" role="dialog" aria-modal="true" aria-label="Suggest a change">
        <header><div><h3>Suggest a change</h3><p className="ss-target">{describeTarget(model, req.target)}</p></div><button type="button" className="ss-iconbtn" aria-label="Close" onClick={onClose}><X size={17} /></button></header>
        <div className="ss-modal-body">
          <fieldset className="ss-kinds"><legend>What kind of change?</legend>
            {KINDS.map((k) => <label key={k.key} className={kind === k.key ? 'on' : ''}><input type="radio" name="kind" checked={kind === k.key} onChange={() => setKind(k.key)} />{k.label}</label>)}
          </fieldset>
          {kindHelp && <p className="ss-hint">{kindHelp}</p>}
          <label className="ss-fld">In one line, what should change?<input ref={first} value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} placeholder="For example: call this field relatedLiterature everywhere" /></label>
          <label className="ss-fld">What it says or does now<textarea rows={3} value={current} maxLength={2000} onChange={(e) => setCurrent(e.target.value)} /></label>
          <label className="ss-fld">What it should say or do instead<textarea rows={3} value={proposed} maxLength={4000} onChange={(e) => setProposed(e.target.value)} placeholder="Describe the new name, the new field, the new list of values, or the new link." /></label>
          <label className="ss-fld">Why it would help<textarea rows={3} value={why} maxLength={4000} onChange={(e) => setWhy(e.target.value)} placeholder="Who is affected, and what goes wrong or gets easier?" /></label>
          <div className="ss-fld"><span>How urgent is it?</span>
            <div className="ss-seg">{(['low', 'normal', 'high'] as const).map((p) => <button key={p} type="button" className={priority === p ? 'on' : ''} onClick={() => setPriority(p)}>{p === 'low' ? 'Whenever' : p === 'normal' ? 'Normal' : 'Soon'}</button>)}</div></div>
          {err && <p className="ss-error">{err}</p>}
        </div>
        <footer>
          <button type="button" className="btn" disabled={!valid || busy} onClick={() => { onBasket(draft()); onClose() }} title="Keep it in your basket in this browser and send several together later">Add to my basket</button>
          {canSend
            ? <button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={async () => { setBusy(true); const e = await onSend(draft()); setBusy(false); if (e) setErr(e); else onClose() }}>{busy ? 'Sending...' : 'Send to the board'}</button>
            : <span className="ss-hint">The shared board opens once migration 253 is applied. Until then suggestions stay in your basket and can be exported.</span>}
        </footer>
      </div>
    </div>
  )
}
