import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { BookOpen, Info, Lightbulb, Link2, Network, Plus, Search, Send, Trash2, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import {
  addTheoryProposition,
  createTheoryContribution,
  getTheoryLiteratureLinks,
  getTheoryRelations,
  getTheorybaseLink,
  importTheoryFromSnapshot,
  listProjectTheoryRelations,
  listTheories,
  listTheoryContributions,
  listTheoryPropositions,
  removeTheoryProposition,
  resolveRelationLabels,
  searchTheorybaseSnapshot,
  setTheorybaseLink,
  type ProjectBaseLinkRow,
  type TheoryContributionRow,
  type TheoryLiteratureLinkWithReference,
  type TheoryPropositionRow,
  type TheoryRelationRow,
  type TheoryRow,
  type TheorybaseSnapshotRow,
} from '@/lib/supabase/theories'
import { buildTheoryBaseDraftYaml } from '@/lib/theorybase-export'
import { TheoryRelationsGraph } from '@/components/theory-relations-graph'
import type { Database } from '@/lib/supabase/database.types'

// New sidebar space, 2026-09-13 restructure -- now backed by real schema
// (migrations 020/021, live). Find/select/create theories, link each to
// literature (theoretical clarification and/or empirical support), and to
// concepts/learning-goals/strands with a labeled relation.
//
// Extended 2026-10-03 per feedback 35924e8a ("findability, UI/UX, and data
// visualization of OpenEvo TheoryBase... OpenLPM as a place for
// constructing FAIR Theories... drive cycles of TheoryBase data quality
// improvement"), scoped in lab_manager/docs/design-notes/
// openlpm-theorybase-fair-theory-construction-scoping-2026-10-03.md as
// three options -- Dustin asked for all three:
// 1. Findability + visualization: a Browse TheoryBase panel (reads a
//    periodically-refreshed snapshot -- TheoryBase is still a private
//    repo, so a live browser fetch like ConceptBase's import still can't
//    work here) and a relations-graph view of a project's own theories.
// 2. Construction: the create/edit form now collects held_by/
//    authorship_provenance/characterization_status and a real
//    propositions/assumptions sub-list, matching TheoryBase's own
//    theory-record.schema.json structure instead of a bare label+paragraph.
// 3. Quality-improvement cycles: a "Propose to TheoryBase" action on a
//    locally-authored theory, which drafts a real schema-shaped record.
//    Actually landing it in the real theorybase repo (a branch + commit)
//    is scripts/draft_theorybase_contribution.mjs's job, run by a human --
//    same boundary every other write to a shared governed resource hits
//    in this lab.
//
// All three are gated behind project_base_links (base_repo = 'theorybase'),
// the existing platform-wide per-project opt-in already wired up for
// ConceptBase -- TheoryBase stays an explicit choice, not an always-on.

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
  'efficacy-demonstrated': 'Demonstrated to work in real classroom use.',
}

export default function TheoriesPage() {
  const { project, role, supabase } = useOutletContext<ProjectOutletContext>()
  const canManage = role !== 'viewer'
  // project_base_links' own RLS (migration 004) only lets an owner/maintainer
  // write it -- a narrower check than canManage, used only for the link toggle.
  const canManageBaseLink = role === 'owner' || role === 'maintainer'
  const { theoryId } = useParams<{ theoryId?: string }>()
  const navigate = useNavigate()
  const [theories, setTheories] = useState<TheoryRow[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [baseLink, setBaseLink] = useState<ProjectBaseLinkRow | null | undefined>(undefined)
  const [showBrowse, setShowBrowse] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [relations, setRelations] = useState<TheoryRelationRow[]>([])
  const [targetLabels, setTargetLabels] = useState<Map<string, string>>(new Map())

  const reload = async () => setTheories(await listTheories(supabase, project.id))

  useEffect(() => {
    setTheories(null)
    reload()
    getTheorybaseLink(supabase, project.id).then(setBaseLink)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  useEffect(() => {
    if (!showGraph || !theories || theories.length === 0) return
    listProjectTheoryRelations(supabase, theories.map((t) => t.id)).then(async (r) => {
      setRelations(r)
      setTargetLabels(await resolveRelationLabels(supabase, r))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGraph, theories, supabase])

  const linked = !!baseLink

  const toggleLink = async () => {
    await setTheorybaseLink(supabase, project.id, !linked)
    setBaseLink(await getTheorybaseLink(supabase, project.id))
  }

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
        <div className="row" style={{ gap: 8 }}>
          {theories && theories.length > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowGraph((v) => !v)}>
              <Network size={14} />{showGraph ? 'Hide' : 'Show'} relations graph
            </button>
          )}
          {canManage && (
            <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
              <Plus size={14} />New theory
            </button>
          )}
        </div>
      </div>

      {baseLink === undefined ? null : !linked ? (
        <div className="notice">
          <Info size={14} />
          This project isn't linked to TheoryBase yet — findability, a cached browse view, and
          proposing theories back to the shared library all need that link first.
          {canManageBaseLink && (
            <button className="btn btn-mini" style={{ marginLeft: 10 }} onClick={toggleLink}>Link this project to TheoryBase</button>
          )}
        </div>
      ) : (
        <div className="notice">
          <Info size={14} />
          Linked to TheoryBase. Browsing below reads a periodically-refreshed snapshot, not a live
          connection — TheoryBase is still a private repo, so there's no live browser fetch the way
          ConceptBase's import works.
          <button className="btn btn-mini" style={{ marginLeft: 10 }} onClick={() => setShowBrowse((v) => !v)}>
            <Search size={12} />{showBrowse ? 'Hide' : 'Browse'} TheoryBase
          </button>
          {canManageBaseLink && (
            <button className="btn-linklike" style={{ marginLeft: 10, fontSize: 12 }} onClick={toggleLink}>Unlink</button>
          )}
        </div>
      )}

      {linked && showBrowse && (
        <TheorybaseBrowsePanel
          projectId={project.id}
          supabase={supabase}
          onImported={async (id) => { setShowBrowse(false); await reload(); navigate(`/dashboard/${project.slug}/theories/${id}`) }}
        />
      )}

      {showGraph && theories && (
        <div className="card" style={{ marginBottom: 16 }}>
          <TheoryRelationsGraph
            theories={theories}
            relations={relations}
            targetLabels={targetLabels}
            onSelectTheory={(id) => navigate(`/dashboard/${project.slug}/theories/${id}`)}
          />
        </div>
      )}

      {canManage && showCreate && (
        <CreateTheoryForm
          projectId={project.id}
          supabase={supabase}
          onCreated={async (id) => { setShowCreate(false); await reload(); navigate(`/dashboard/${project.slug}/theories/${id}`) }}
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
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 0', fontWeight: t.id === theoryId ? 600 : 400 }}
                onClick={() => navigate(`/dashboard/${project.slug}/theories/${t.id}`)}
              >
                {t.label}
                {t.evidentiary_maturity && (
                  <span className="muted" style={{ fontSize: 11, marginLeft: 8 }} title={MATURITY_GLOSS[t.evidentiary_maturity]}>{MATURITY_LABEL[t.evidentiary_maturity]}</span>
                )}
                {t.base_repo === 'theorybase' && t.base_repo_ref && (
                  <span className="chip" style={{ fontSize: 10, marginLeft: 8 }} title={`Corresponds to ${t.base_repo_ref} in TheoryBase`}>{t.base_repo_ref}</span>
                )}
              </button>
            ))}
          </div>
          <div className="card" style={{ minHeight: 200 }}>
            {theoryId ? (
              <TheoryDetail theoryId={theoryId} projectId={project.id} canManage={canManage} supabase={supabase} linked={linked} />
            ) : (
              <p className="muted">Pick a theory on the left.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Browse TheoryBase (Option 1, findability) -- searches the periodically-
// refreshed snapshot (scripts/sync_theorybase_snapshot.mjs), not a live
// fetch. Mirrors the shape of ConceptBase's import tool on the Concepts
// page, adapted for a search-then-import flow since TheoryBase's real
// content today is a dozen or so records about one specific dispute, not
// a big vocabulary worth importing wholesale.
// ============================================================================

function TheorybaseBrowsePanel({
  projectId,
  supabase,
  onImported,
}: {
  projectId: string
  supabase: ProjectOutletContext['supabase']
  onImported: (theoryId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TheorybaseSnapshotRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      searchTheorybaseSnapshot(supabase, query).then(setResults)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, supabase])

  const doImport = async (row: TheorybaseSnapshotRow) => {
    setBusyId(row.id); setError(null)
    try {
      const id = await importTheoryFromSnapshot(supabase, projectId, row)
      onImported(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import this record.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="field">
        <label>Search TheoryBase</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. organism behavior, integrated causal reasoning…" />
      </div>
      {error && <div className="notice notice-bad">{error}</div>}
      {results === null ? (
        <p className="muted" style={{ fontSize: 12 }}>Loading…</p>
      ) : results.length === 0 ? (
        <p className="muted" style={{ fontSize: 12 }}>
          No matches. TheoryBase's real content today is mostly about one specific research
          dispute (organism behavior in evolutionary explanation) — most searches outside that
          area will come up empty until more gets added.
        </p>
      ) : (
        results.map((r) => (
          <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: 13 }}>{r.label}</strong>
                <span className="chip" style={{ fontSize: 10, marginLeft: 6 }}>{r.record_type.replace(/_/g, ' ')}</span>
                {r.authorship_provenance === 'openevo_reconstruction_of_external_position' && (
                  <span className="muted" style={{ fontSize: 10, marginLeft: 6 }} title="This is OpenEvo's own characterization of someone else's published position, not that scholar's own authored or reviewed statement.">
                    third-party reconstruction
                  </span>
                )}
              </div>
              <button className="btn btn-mini" disabled={busyId === r.id} onClick={() => doImport(r)}>
                {busyId === r.id ? 'Importing…' : 'Import as local theory'}
              </button>
            </div>
            {r.summary && <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>{r.summary}</p>}
          </div>
        ))
      )}
    </div>
  )
}

type AuthorshipProvenance = TheoryRow['authorship_provenance']
type CharacterizationStatus = TheoryRow['characterization_status']

const AUTHORSHIP_LABEL: Record<NonNullable<AuthorshipProvenance>, string> = {
  native: 'This project\'s own position',
  openevo_reconstruction_of_external_position: 'A reconstruction of someone else\'s published position',
}
const CHARACTERIZATION_LABEL: Record<NonNullable<CharacterizationStatus>, string> = {
  author_stated: 'Stated by the position\'s own author',
  openevo_reconstruction_unreviewed: 'Reconstructed here, not yet checked by whoever actually holds it',
  openevo_reconstruction_reviewed: 'Reconstructed here, and checked by whoever actually holds it',
}

interface DraftProp { kind: 'proposition' | 'assumption'; label: string; statement: string }

/** Shared add-row UI for propositions/assumptions -- used both for a brand-new theory's draft list and an existing theory's live list, since the fields are identical either way. */
function PropositionDraftRow({ onAdd }: { onAdd: (p: DraftProp) => void }) {
  const [kind, setKind] = useState<'proposition' | 'assumption'>('proposition')
  const [label, setLabel] = useState('')
  const [statement, setStatement] = useState('')
  return (
    <div className="row" style={{ gap: 6, marginTop: 6, alignItems: 'flex-start' }}>
      <select value={kind} onChange={(e) => setKind(e.target.value as 'proposition' | 'assumption')} style={{ width: 110 }}>
        <option value="proposition">Proposition</option>
        <option value="assumption">Assumption</option>
      </select>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Short name" style={{ width: 140 }} />
      <input value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="The claim itself, in one or two sentences" style={{ flex: 1 }} />
      <button
        type="button"
        className="btn btn-mini"
        disabled={!label.trim() || !statement.trim()}
        onClick={() => { onAdd({ kind, label: label.trim(), statement: statement.trim() }); setLabel(''); setStatement('') }}
      >
        <Plus size={12} />Add
      </button>
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
  const [heldBy, setHeldBy] = useState('')
  const [authorship, setAuthorship] = useState<AuthorshipProvenance>(null)
  const [characterization, setCharacterization] = useState<CharacterizationStatus>(null)
  const [propositions, setPropositions] = useState<DraftProp[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim() || !description.trim()) return
    setBusy(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const heldByArray = heldBy.split(',').map((s) => s.trim()).filter(Boolean)
    const { data, error: err } = await supabase
      .from('theories')
      .insert({
        project_id: projectId,
        label: label.trim(),
        description: description.trim(),
        evidentiary_maturity: maturity,
        evidentiary_maturity_note: maturityNote.trim() || null,
        held_by: heldByArray.length ? heldByArray : null,
        authorship_provenance: authorship,
        characterization_status: authorship === 'openevo_reconstruction_of_external_position' ? characterization : null,
        created_by: user?.id ?? null,
      })
      .select('id')
      .single()
    if (err || !data) { setBusy(false); setError(err?.message ?? 'Could not create the theory.'); return }
    for (let i = 0; i < propositions.length; i++) {
      const p = propositions[i]
      await addTheoryProposition(supabase, data.id, p.kind, p.label, p.statement, i)
    }
    setBusy(false)
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

        <div className="field">
          <label title="Who actually holds this position -- a real person or research group's name. This matters for fairness: a theory credited to no one reads as if it belongs to everyone, or to whoever's convenient.">
            Who holds this position? (comma-separated names, optional for now)
          </label>
          <input value={heldBy} onChange={(e) => setHeldBy(e.target.value)} placeholder="e.g. Jane Researcher, Some University Lab" />
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label title="Is this your own project's position, or your own characterization of a position someone else published? Being honest about this up front is what keeps a reconstruction from quietly being read as that person's own words.">
              Whose position is this? (optional)
            </label>
            <select value={authorship ?? ''} onChange={(e) => setAuthorship((e.target.value || null) as AuthorshipProvenance)}>
              <option value="">Not stated</option>
              {Object.entries(AUTHORSHIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {authorship === 'openevo_reconstruction_of_external_position' && (
            <div className="field">
              <label title="If this is a reconstruction of someone else's position, has that person actually checked it for accuracy? Marking it unreviewed is the honest default -- it's not a criticism of the reconstruction, just a true statement about what hasn't happened yet.">
                Has the real author checked this characterization?
              </label>
              <select value={characterization ?? ''} onChange={(e) => setCharacterization((e.target.value || null) as CharacterizationStatus)}>
                <option value="">Not stated</option>
                {Object.entries(CHARACTERIZATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="field">
          <label title="Breaking a theory down into its individual claims (propositions) and the things it takes for granted (assumptions) is what actually makes it checkable, rather than one paragraph nobody can agree on the meaning of. Optional here -- can be added later.">
            Propositions and assumptions (optional, can add more later)
          </label>
          {propositions.map((p, i) => (
            <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5 }}>
              <span><span className="chip" style={{ fontSize: 10, marginRight: 6 }}>{p.kind}</span><strong>{p.label}</strong>: {p.statement}</span>
              <button type="button" className="btn-linklike" onClick={() => setPropositions((prev) => prev.filter((_, j) => j !== i))}><Trash2 size={12} /></button>
            </div>
          ))}
          <PropositionDraftRow onAdd={(p) => setPropositions((prev) => [...prev, p])} />
        </div>

        <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 10 }}>{busy ? 'Creating…' : 'Create theory'}</button>
      </form>
    </div>
  )
}

function TheoryDetail({ theoryId, projectId, canManage, supabase, linked }: { theoryId: string; projectId: string; canManage: boolean; supabase: ProjectOutletContext['supabase']; linked: boolean }) {
  const [theory, setTheory] = useState<TheoryRow | null>(null)
  const [links, setLinks] = useState<TheoryLiteratureLinkWithReference[]>([])
  const [relations, setRelations] = useState<TheoryRelationRow[]>([])
  const [relationLabels, setRelationLabels] = useState<Map<string, string>>(new Map())
  const [propositions, setPropositions] = useState<TheoryPropositionRow[]>([])
  const [contributions, setContributions] = useState<TheoryContributionRow[]>([])

  const reload = async () => {
    const [{ data: t }, l, r, p, c] = await Promise.all([
      supabase.from('theories').select('*').eq('id', theoryId).maybeSingle(),
      getTheoryLiteratureLinks(supabase, theoryId),
      getTheoryRelations(supabase, theoryId),
      listTheoryPropositions(supabase, theoryId),
      listTheoryContributions(supabase, theoryId),
    ])
    setTheory(t ?? null)
    setLinks(l)
    setRelations(r)
    setRelationLabels(await resolveRelationLabels(supabase, r))
    setPropositions(p)
    setContributions(c)
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
      {theory.base_repo === 'theorybase' && theory.base_repo_ref && (
        <p className="muted" style={{ fontSize: 12 }} title="A label, not a live link -- TheoryBase is still a private repo.">
          Corresponds to <strong>{theory.base_repo_ref}</strong> in TheoryBase
        </p>
      )}
      <p>{theory.description}</p>
      {(theory.held_by?.length || theory.authorship_provenance) && (
        <p className="muted" style={{ fontSize: 12 }}>
          {theory.held_by?.length ? <>Held by {theory.held_by.join(', ')}. </> : null}
          {theory.authorship_provenance && (
            <span title={theory.characterization_status ? CHARACTERIZATION_LABEL[theory.characterization_status] : undefined}>
              {AUTHORSHIP_LABEL[theory.authorship_provenance]}
              {theory.characterization_status ? ` (${CHARACTERIZATION_LABEL[theory.characterization_status].toLowerCase()})` : ''}.
            </span>
          )}
        </p>
      )}

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
        <AddLiteratureLink theoryId={theoryId} projectId={projectId} canManage={canManage} supabase={supabase} onAdded={reload} />
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
        <AddRelation theoryId={theoryId} projectId={projectId} canManage={canManage} supabase={supabase} onAdded={reload} />
      </section>

      <section style={{ marginTop: 16 }}>
        <h4 className="row" title="The individual claims (propositions) and taken-for-granted premises (assumptions) this theory breaks down into -- the real structure TheoryBase's own records use, not just a paragraph.">
          <Lightbulb size={13} />Propositions and assumptions
        </h4>
        {propositions.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Not broken down yet.</p>
        ) : (
          propositions.map((p) => (
            <div key={p.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13 }}><span className="chip" style={{ fontSize: 10, marginRight: 6 }}>{p.kind}</span><strong>{p.label}</strong></span>
                {canManage && <button className="btn-linklike" onClick={async () => { await removeTheoryProposition(supabase, p.id); reload() }}><Trash2 size={12} /></button>}
              </div>
              <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>{p.statement}</p>
            </div>
          ))
        )}
        {canManage && (
          <PropositionDraftRow onAdd={async (draft) => { await addTheoryProposition(supabase, theoryId, draft.kind, draft.label, draft.statement, propositions.length); reload() }} />
        )}
      </section>

      {linked && canManage && !theory.base_repo && (
        <ProposeToTheoryBase theory={theory} propositions={propositions} projectId={projectId} supabase={supabase} contributions={contributions} onProposed={reload} />
      )}
    </div>
  )
}

// ============================================================================
// Propose to TheoryBase (Option 2, quality-improvement cycles). Shown only
// for a theory that isn't already tagged as corresponding to a real
// TheoryBase record -- proposing something that's already a tracked import
// would be proposing TheoryBase's own content back at itself.
// ============================================================================

function ProposeToTheoryBase({
  theory,
  propositions,
  projectId,
  supabase,
  contributions,
  onProposed,
}: {
  theory: TheoryRow
  propositions: TheoryPropositionRow[]
  projectId: string
  supabase: ProjectOutletContext['supabase']
  contributions: TheoryContributionRow[]
  onProposed: () => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildPreview = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setPreview(buildTheoryBaseDraftYaml(theory, propositions, user?.email ?? 'an OpenLPM researcher'))
  }

  const submit = async () => {
    if (!preview) return
    setBusy(true); setError(null)
    try {
      await createTheoryContribution(supabase, theory.id, projectId, preview)
      setPreview(null)
      onProposed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record this proposal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h4 className="row"><Send size={13} />Propose to TheoryBase</h4>
      <p className="muted" style={{ fontSize: 12.5 }}>
        Package this theory in TheoryBase's own record format and flag it for a human to actually
        commit to the real repo on a new branch, as a real reviewed contribution -- not a silent
        copy. This doesn't touch the real TheoryBase repo by itself.
      </p>
      {contributions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {contributions.map((c) => (
            <div key={c.id} className="row" style={{ justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
              <span>Proposed {new Date(c.created_at ?? '').toLocaleDateString()}</span>
              <span className="chip" style={{ fontSize: 10 }}>{c.status.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      )}
      {error && <div className="notice notice-bad">{error}</div>}
      {!preview ? (
        <button className="btn btn-mini" onClick={buildPreview}>Draft a proposal</button>
      ) : (
        <div className="card" style={{ marginTop: 6 }}>
          <strong style={{ fontSize: 12.5 }}>Draft record (review before sending)</strong>
          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', background: 'var(--surface-1)', padding: 8, borderRadius: 6 }}>{preview}</pre>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Recording…' : 'Record this proposal'}</button>
            <button className="btn-linklike" onClick={() => setPreview(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  )
}

function AddLiteratureLink({
  theoryId,
  projectId,
  canManage,
  supabase,
  onAdded,
}: {
  theoryId: string
  projectId: string
  canManage: boolean
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

  if (!open) return canManage ? <button className="btn btn-mini" onClick={() => setOpen(true)}><Plus size={12} />Link literature</button> : null

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
  canManage,
  supabase,
  onAdded,
}: {
  theoryId: string
  projectId: string
  canManage: boolean
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

  if (!open) return canManage ? <button className="btn btn-mini" onClick={() => setOpen(true)}><Plus size={12} />Link a concept, goal, or strand</button> : null

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
