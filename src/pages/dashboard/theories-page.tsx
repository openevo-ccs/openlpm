import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BookOpen, Info, Lightbulb, Link2, Plus, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import {
  getTheoryLiteratureLinks,
  getTheoryRelations,
  listTheories,
  resolveRelationLabels,
  type TheoryLiteratureLinkWithReference,
  type TheoryRelationRow,
  type TheoryRow,
} from '@/lib/supabase/theories'
import type { Database } from '@/lib/supabase/database.types'

// New sidebar space, 2026-09-13 restructure -- now backed by real schema
// (migrations 020/021, live). Find/select/create theories, link each to
// literature (theoretical clarification and/or empirical support), and to
// concepts/learning-goals/strands with a labeled relation. TheoryBase
// import is intentionally NOT built here: Lab Manager confirmed TheoryBase
// is a private repo (ConceptBase is the only public Foundational Repo right
// now), so an unauthenticated browser-side fetch -- the pattern Concepts
// uses for ConceptBase -- would silently fail against it. That import
// becomes real once TheoryBase goes public or a server-side proxy exists;
// local authoring below works today regardless.

type EvidentiaryMaturity = TheoryRow['evidentiary_maturity']
type LiteratureRow = Database['public']['Tables']['literature_references']['Row']

const MATURITY_LABEL: Record<NonNullable<EvidentiaryMaturity>, string> = {
  'theoretically-developed': 'Theoretically developed',
  'empirically-recovered': 'Empirically recovered',
  'tested-against-alternatives': 'Tested against alternatives',
  'efficacy-demonstrated': 'Efficacy demonstrated',
}

// Plain-language gloss for each term, shown as a hover tooltip -- same
// pattern already used for the "Private" chip on the project list, since
// none of these four terms are self-explanatory to a reader without a
// research-methods background.
const MATURITY_GLOSS: Record<NonNullable<EvidentiaryMaturity>, string> = {
  'theoretically-developed': 'A well-reasoned idea, but not yet checked against real evidence.',
  'empirically-recovered': 'Someone has found real evidence for this, but it hasn\'t been tested head-to-head against other explanations yet.',
  'tested-against-alternatives': 'Checked directly against competing explanations, and this one held up better.',
  'efficacy-demonstrated': 'Shown to actually work in real, practical use, not just in theory.',
}

export default function TheoriesPage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const [theories, setTheories] = useState<TheoryRow[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const reload = async () => setTheories(await listTheories(supabase, project.id))

  useEffect(() => {
    setTheories(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="row"><Lightbulb size={18} style={{ color: 'var(--text-muted)' }} />Theories</h1>
          <p className="muted" style={{ marginBottom: 12 }}>
            Find and select, or create and curate, the theories informing this LPM — each linkable
            to literature for theoretical clarification or empirical support, and to concepts,
            learning goals, and strands with labeled relations.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          <Plus size={14} />New theory
        </button>
      </div>

      <div className="notice">
        <Info size={14} />
        Importing from TheoryBase isn't available yet — it's a private repo today, unlike
        ConceptBase. Authoring theories directly here works now.
      </div>

      {showCreate && (
        <CreateTheoryForm
          projectId={project.id}
          supabase={supabase}
          onCreated={async (id) => { setShowCreate(false); await reload(); setSelectedId(id) }}
        />
      )}

      {theories === null ? (
        <p className="muted">Loading…</p>
      ) : theories.length === 0 ? (
        <div className="card empty">
          <Lightbulb size={32} />
          <p>No theories yet.</p>
        </div>
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'flex-start' }}>
          <div className="card">
            {theories.map((t) => (
              <button
                key={t.id}
                className="btn-linklike"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0', fontWeight: t.id === selectedId ? 600 : 400 }}
                onClick={() => setSelectedId(t.id)}
              >
                {t.label}
                {t.evidentiary_maturity && (
                  <span className="muted" style={{ fontSize: 11, marginLeft: 8 }} title={MATURITY_GLOSS[t.evidentiary_maturity]}>{MATURITY_LABEL[t.evidentiary_maturity]}</span>
                )}
              </button>
            ))}
          </div>
          <div className="card" style={{ minHeight: 200 }}>
            {selectedId ? (
              <TheoryDetail theoryId={selectedId} projectId={project.id} supabase={supabase} />
            ) : (
              <p className="muted">Pick a theory on the left.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CreateTheoryForm({
  projectId,
  supabase,
  onCreated,
}: {
  projectId: string
  supabase: ProjectOutletContext['supabase']
  onCreated: (id: string) => void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [maturity, setMaturity] = useState<EvidentiaryMaturity>(null)
  const [maturityNote, setMaturityNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim() || !description.trim()) return
    setBusy(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: err } = await supabase
      .from('theories')
      .insert({
        project_id: projectId,
        label: label.trim(),
        description: description.trim(),
        evidentiary_maturity: maturity,
        evidentiary_maturity_note: maturityNote.trim() || null,
        created_by: user?.id ?? null,
      })
      .select('id')
      .single()
    setBusy(false)
    if (err || !data) { setError(err?.message ?? 'Could not create the theory.'); return }
    onCreated(data.id)
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>New theory</h3>
      {error && <div className="notice notice-bad">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label>Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Domain-Central Reasoning (DCR)" required />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required style={{ minHeight: 80 }} />
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label>Evidentiary maturity (optional)</label>
            <select value={maturity ?? ''} onChange={(e) => setMaturity((e.target.value || null) as EvidentiaryMaturity)}>
              <option value="">Not stated</option>
              {Object.entries(MATURITY_LABEL).map(([k, v]) => <option key={k} value={k} title={MATURITY_GLOSS[k as NonNullable<EvidentiaryMaturity>]}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Note (optional)</label>
            <input value={maturityNote} onChange={(e) => setMaturityNote(e.target.value)} placeholder="Why this stage?" />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create theory'}</button>
      </form>
    </div>
  )
}

function TheoryDetail({ theoryId, projectId, supabase }: { theoryId: string; projectId: string; supabase: ProjectOutletContext['supabase'] }) {
  const [theory, setTheory] = useState<TheoryRow | null>(null)
  const [links, setLinks] = useState<TheoryLiteratureLinkWithReference[]>([])
  const [relations, setRelations] = useState<TheoryRelationRow[]>([])
  const [relationLabels, setRelationLabels] = useState<Map<string, string>>(new Map())

  const reload = async () => {
    const [{ data: t }, l, r] = await Promise.all([
      supabase.from('theories').select('*').eq('id', theoryId).maybeSingle(),
      getTheoryLiteratureLinks(supabase, theoryId),
      getTheoryRelations(supabase, theoryId),
    ])
    setTheory(t ?? null)
    setLinks(l)
    setRelations(r)
    setRelationLabels(await resolveRelationLabels(supabase, r))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, theoryId])

  if (!theory) return <p className="muted">Loading…</p>

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>{theory.label}</h3>
      {theory.evidentiary_maturity && (
        <p className="muted" style={{ fontSize: 12 }} title={MATURITY_GLOSS[theory.evidentiary_maturity]}>
          {MATURITY_LABEL[theory.evidentiary_maturity]}{theory.evidentiary_maturity_note ? ` — ${theory.evidentiary_maturity_note}` : ''}
        </p>
      )}
      <p>{theory.description}</p>

      <section style={{ marginTop: 16 }}>
        <h4 className="row"><BookOpen size={13} />Literature</h4>
        {links.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>No literature linked yet.</p>
        ) : (
          links.map((l) => (
            <div key={l.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 13 }}>{l.reference.title}</strong>
                <span className="chip" style={{ fontSize: 10 }}>{l.relation_type.replace(/-/g, ' ')}</span>
              </div>
              {l.note && <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>{l.note}</p>}
            </div>
          ))
        )}
        <AddLiteratureLink theoryId={theoryId} projectId={projectId} supabase={supabase} onAdded={reload} />
      </section>

      <section style={{ marginTop: 16 }}>
        <h4 className="row"><Link2 size={13} />Concepts, learning goals, and strands</h4>
        {relations.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>No relations yet.</p>
        ) : (
          relations.map((r) => (
            <div key={r.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13 }}><strong>{r.relation_label}</strong> {relationLabels.get(r.target_id) ?? '(unknown)'}</span>
                <span className="chip" style={{ fontSize: 10 }}>{r.target_type.replace('_', ' ')}</span>
              </div>
              {r.annotation && <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>{r.annotation}</p>}
            </div>
          ))
        )}
        <AddRelation theoryId={theoryId} projectId={projectId} supabase={supabase} onAdded={reload} />
      </section>
    </div>
  )
}

function AddLiteratureLink({
  theoryId,
  projectId,
  supabase,
  onAdded,
}: {
  theoryId: string
  projectId: string
  supabase: ProjectOutletContext['supabase']
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LiteratureRow[]>([])
  const [relationType, setRelationType] = useState<'theoretical-clarification' | 'empirical-support' | 'empirical-challenge'>('theoretical-clarification')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('literature_references').select('*').eq('project_id', projectId).ilike('title', `%${query.trim()}%`).limit(8)
      setResults(data ?? [])
    }, 250)
    return () => clearTimeout(timer)
  }, [open, query, projectId, supabase])

  const add = async (reference: LiteratureRow) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('theory_literature_links').insert({
      theory_id: theoryId,
      reference_id: reference.id,
      relation_type: relationType,
      note: note.trim() || null,
      created_by: user?.id ?? null,
    })
    setOpen(false); setQuery(''); setResults([]); setNote('')
    onAdded()
  }

  if (!open) return <button className="btn btn-mini" onClick={() => setOpen(true)}><Plus size={12} />Link literature</button>

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>Link literature</strong>
        <button className="btn-linklike" onClick={() => setOpen(false)}><X size={12} /></button>
      </div>
      <div className="field">
        <label>Relation</label>
        <select value={relationType} onChange={(e) => setRelationType(e.target.value as any)}>
          <option value="theoretical-clarification">Theoretical clarification</option>
          <option value="empirical-support">Empirical support</option>
          <option value="empirical-challenge">Empirical challenge</option>
        </select>
      </div>
      <div className="field">
        <label>Search this project's literature</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title…" />
      </div>
      <div className="field">
        <label>Note (optional)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {results.map((r) => (
        <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ fontSize: 13 }}>{r.title}</span>
          <button className="btn btn-mini" onClick={() => add(r)}>Link</button>
        </div>
      ))}
      {query.trim().length >= 2 && results.length === 0 && (
        <p className="muted" style={{ fontSize: 12 }}>No matches in this project's literature collection.</p>
      )}
    </div>
  )
}

type RelationTargetType = 'schema_element' | 'data_object' | 'thread' | 'framework_tag'

const TARGET_TYPE_LABEL: Record<RelationTargetType, string> = {
  schema_element: 'Concept',
  data_object: 'Learning goal',
  thread: 'Strand',
  framework_tag: 'Framework term',
}

function AddRelation({
  theoryId,
  projectId,
  supabase,
  onAdded,
}: {
  theoryId: string
  projectId: string
  supabase: ProjectOutletContext['supabase']
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [targetType, setTargetType] = useState<RelationTargetType>('schema_element')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; label: string }[]>([])
  const [relationLabel, setRelationLabel] = useState('informs')
  const [annotation, setAnnotation] = useState('')

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      const like = `%${query.trim()}%`
      if (targetType === 'schema_element') {
        const { data } = await supabase.from('lpm_schema_elements').select('id, label').eq('project_id', projectId).ilike('label', like).limit(8)
        setResults((data ?? []).map((d) => ({ id: d.id, label: d.label })))
      } else if (targetType === 'data_object') {
        const { data } = await supabase.from('lpm_data_objects').select('id, title').eq('project_id', projectId).ilike('title', like).limit(8)
        setResults((data ?? []).map((d) => ({ id: d.id, label: d.title })))
      } else if (targetType === 'thread') {
        const { data } = await supabase.from('lpm_threads').select('id, title').eq('project_id', projectId).ilike('title', like).limit(8)
        setResults((data ?? []).map((d) => ({ id: d.id, label: d.title })))
      } else {
        const { data } = await supabase.from('framework_tags').select('id, label').ilike('label', like).limit(8)
        setResults((data ?? []).map((d) => ({ id: d.id, label: d.label })))
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [open, query, targetType, projectId, supabase])

  const add = async (target: { id: string; label: string }) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('theory_relations').insert({
      theory_id: theoryId,
      target_type: targetType,
      target_id: target.id,
      relation_label: relationLabel.trim() || 'relates to',
      annotation: annotation.trim() || null,
      created_by: user?.id ?? null,
    })
    setOpen(false); setQuery(''); setResults([]); setAnnotation('')
    onAdded()
  }

  if (!open) return <button className="btn btn-mini" onClick={() => setOpen(true)}><Plus size={12} />Link a concept, goal, or strand</button>

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>Link a concept, goal, or strand</strong>
        <button className="btn-linklike" onClick={() => setOpen(false)}><X size={12} /></button>
      </div>
      <div className="grid grid-2">
        <div className="field">
          <label>What kind of thing?</label>
          <select value={targetType} onChange={(e) => { setTargetType(e.target.value as RelationTargetType); setQuery(''); setResults([]) }}>
            {(Object.keys(TARGET_TYPE_LABEL) as RelationTargetType[]).map((t) => <option key={t} value={t}>{TARGET_TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Relation label</label>
          <input value={relationLabel} onChange={(e) => setRelationLabel(e.target.value)} placeholder="e.g. informs, is tested by" />
        </div>
      </div>
      <div className="field">
        <label>Search {TARGET_TYPE_LABEL[targetType].toLowerCase()}s</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to search…" />
      </div>
      <div className="field">
        <label>Annotation (optional)</label>
        <input value={annotation} onChange={(e) => setAnnotation(e.target.value)} />
      </div>
      {results.map((r) => (
        <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ fontSize: 13 }}>{r.label}</span>
          <button className="btn btn-mini" onClick={() => add(r)}>Link</button>
        </div>
      ))}
      {query.trim().length >= 2 && results.length === 0 && (
        <p className="muted" style={{ fontSize: 12 }}>No matches.</p>
      )}
    </div>
  )
}
