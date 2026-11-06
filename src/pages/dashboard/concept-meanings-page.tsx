import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ReviewStateChip } from '@/components/review-state-chip'
import { reviewSummary } from '@/lib/review-state'
import {
  PILE_ORDER,
  alignmentStatusChip,
  alignmentStatusLabel,
  alignmentsFor,
  citationsByOldId,
  definitionRows,
  idChanges,
  loadMeaningsSnapshot,
  matchTypeLabel,
  pileHelp,
  pileLabel,
  searchConcepts,
  usesFor,
  vocabularyShort,
  type MeaningConcept,
  type MeaningsSnapshot,
} from '@/lib/concept-meanings'

// Concept meanings: what ConceptBase says a word means, side by side, with the comparisons between word lists and the places that use the
// word. Read-only first version (design note conceptbase-many-meanings-review-and-explorer-design-2026-11-04.md, step 2). The data is a dated
// copy (src/data/concept-meanings.json). Nothing here writes to ConceptBase, and a model's topic tag is never linked to a concept by its name.

const BASE = '/dashboard/concept-meanings'
const NO_REVIEW = reviewSummary(undefined)
type Tab = 'concepts' | 'tags' | 'ids'

function Missing({ children }: { children: React.ReactNode }) {
  return <p className="muted">{children}</p>
}

function ConceptLink({ id, snap }: { id: string; snap: MeaningsSnapshot }) {
  const c = snap.concepts.find((x) => x.id === id) ?? snap.pending.find((x) => x.id === id)
  if (!c) return <span title="Not in this copy of ConceptBase">{id}</span>
  return (
    <>
      <Link to={`${BASE}/${encodeURIComponent(id)}`}>{c.label}</Link>
      {c.tier === 'pending' && <span className="muted"> (draft in the unmerged branch)</span>}
    </>
  )
}

function TierChip({ c }: { c: MeaningConcept }) {
  if (c.tier === 'pending') return <span className="chip chip-draft"><span className="dot" />Drafted in an unmerged branch</span>
  if (c.tier === 'sandbox') return <span className="chip chip-proposed"><span className="dot" />Trial entry</span>
  return <span className="chip chip-good"><span className="dot" />In ConceptBase{c.status ? `, ${c.status}` : ''}</span>
}

function Detail({ id, snap }: { id: string; snap: MeaningsSnapshot }) {
  const concept = snap.concepts.find((c) => c.id === id) ?? snap.pending.find((c) => c.id === id)
  if (!concept) {
    return (
      <div className="card">
        <p>This copy of ConceptBase has no concept with the id <code>{id}</code>.</p>
        <Link to={BASE}>Back to all concepts</Link>
      </div>
    )
  }
  const defs = definitionRows(concept)
  const comparisons = alignmentsFor(concept.id, snap.alignments)
  const uses = usesFor(concept.id, concept.label, snap)
  const citedMap = new Map<string, { title: string; count: number; files: number }>()
  for (const c of uses.cited) {
    const row = citedMap.get(c.guideTitle) ?? { title: c.guideTitle, count: 0, files: 0 }
    row.count += c.count
    row.files += 1
    citedMap.set(c.guideTitle, row)
  }
  const citedByTitle = [...citedMap.values()]
  const drafted = snap.pending.find((p) => p.replaces === concept.id)
  const replaces = concept.tier === 'pending' && concept.replaces ? snap.concepts.find((c) => c.id === concept.replaces) : undefined
  const aliases = Object.values(concept.aliases).flat()
  const otherRelations: [string, string[]][] = [['Broader ideas', concept.broader], ['Narrower ideas', concept.narrower], ['Related ideas', concept.related]]

  return (
    <div>
      <p className="muted"><Link to={BASE}>All concepts</Link></p>
      <h1>{concept.label}</h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <TierChip c={concept} />
        <span className="chip">{vocabularyShort(concept.vocabulary)}</span>
        <ReviewStateChip summary={NO_REVIEW} />
      </div>
      <p className="muted">
        <code>{concept.id}</code>
        {aliases.length > 0 && <> · Also called: {aliases.join(', ')}</>}
      </p>

      {drafted && (
        <div className="notice" style={{ marginBottom: 12 }}>
          <div>
            The unmerged Bio-Core branch drafts this concept again under the new id <Link to={`${BASE}/${encodeURIComponent(drafted.id)}`}><code>{drafted.id}</code></Link>
            {drafted.sameDefinitionAsReplaced ? ', with the same English definition word for word' : ', with a different English definition'}. Everything that cites{' '}
            <code>{concept.id}</code> would need the new id if the branch merges as written.
          </div>
        </div>
      )}
      {replaces && (
        <div className="notice" style={{ marginBottom: 12 }}>
          <div>
            This is a draft in an unmerged branch. ConceptBase today holds the same word as <Link to={`${BASE}/${encodeURIComponent(replaces.id)}`}>{replaces.label}</Link> (<code>{replaces.id}</code>).
          </div>
        </div>
      )}

      <div className="card">
        <h2>What it means</h2>
        {defs.length === 0 ? (
          <Missing>No definition is stated for this concept.</Missing>
        ) : (
          <div className="grid grid-2">
            {defs.map((d) => (
              <div key={`${d.lang}-${d.discipline}`} style={{ borderLeft: '3px solid var(--map-3)', paddingLeft: 10 }}>
                <div className="muted">
                  {d.discipline === 'general' ? 'In general' : `In ${d.discipline}`} · {d.lang.toUpperCase()} · {vocabularyShort(concept.vocabulary)}
                </div>
                <p style={{ margin: '4px 0 0' }}>{d.text}</p>
              </div>
            ))}
          </div>
        )}
        {concept.citations.length > 0 && <p className="muted" style={{ marginTop: 10 }}>Sources: {concept.citations.join(' · ')}</p>}
      </div>

      {(concept.examples.length > 0 || concept.nonExamples.length > 0) && (
        <div className="card">
          <h2>Test cases</h2>
          <p className="muted">Two meanings are as close as they sort the same cases the same way. These are the cases ConceptBase already holds for this concept.</p>
          <div className="grid grid-2">
            <div>
              <strong>Counts as this concept</strong>
              <ul>{concept.examples.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
            <div>
              <strong>Does not count</strong>
              <ul>{concept.nonExamples.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>How it compares with concepts in other word lists</h2>
        {comparisons.length === 0 ? (
          <Missing>No comparison is recorded for this concept yet.</Missing>
        ) : (
          comparisons.map(({ alignment: a, other }) => (
            <div key={a.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <strong>{matchTypeLabel(a.matchType)}:</strong>
                <ConceptLink id={other.id} snap={snap} />
                <span className="muted">({vocabularyShort(other.vocabulary)})</span>
                <span className={`chip chip-${alignmentStatusChip(a.status)}`}><span className="dot" />{alignmentStatusLabel(a.status)}</span>
              </div>
              <details>
                <summary className="muted">Why ({a.id}, {a.date ?? 'no date'}, asserted by {a.assertedBy.join(', ') || 'no one named'})</summary>
                <p>{a.rationale}</p>
              </details>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2>Where the word is used</h2>
        <h3 style={{ fontSize: 14 }}>Strand guides that cite this entry by its id</h3>
        {uses.cited.length === 0 ? (
          <Missing>No NetLogo strand guide cites this id.</Missing>
        ) : (
          <ul>
            {citedByTitle.map((g) => (
              <li key={g.title}>
                {g.title}{' '}
                <span className="muted">
                  (cited {g.count} {g.count === 1 ? 'time' : 'times'}{g.files > 1 ? ` across ${g.files} versions of the guide` : ''}; AI-written guide, no expert has reviewed it)
                </span>
              </li>
            ))}
          </ul>
        )}
        <h3 style={{ fontSize: 14 }}>NetLogo models that use the same word as a topic tag</h3>
        {uses.sameWordTags.length === 0 ? (
          <Missing>No NetLogo model carries this word as a tag.</Missing>
        ) : (
          <>
            <ul>
              {uses.sameWordTags.map((t) => (
                <li key={t.tag}>“{t.tag}” in {t.models.map((m) => m.title).join(', ')}</li>
              ))}
            </ul>
            <p className="muted">Sharing a word proves nothing yet. The tags have no definition of their own, so nobody has compared what the models mean with what this entry says.</p>
          </>
        )}
      </div>

      {otherRelations.some(([, ids]) => ids.length > 0) && (
        <div className="card">
          <h2>Ideas next to it in the same word list</h2>
          {otherRelations.filter(([, ids]) => ids.length > 0).map(([title, ids]) => (
            <p key={title}>
              <strong>{title}:</strong>{' '}
              {ids.map((x, i) => (
                <span key={x}>{i > 0 && ', '}<ConceptLink id={x} snap={snap} /></span>
              ))}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function ConceptsTab({ snap }: { snap: MeaningsSnapshot }) {
  const [q, setQ] = useState('')
  const [showTrial, setShowTrial] = useState(false)
  const rows = useMemo(() => searchConcepts(snap.concepts.filter((c) => showTrial || c.tier === 'registered'), q), [snap, q, showTrial])
  const byVocab = useMemo(() => {
    const m = new Map<string, MeaningConcept[]>()
    for (const c of rows) m.set(vocabularyShort(c.vocabulary), [...(m.get(vocabularyShort(c.vocabulary)) ?? []), c])
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])
  return (
    <div>
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="cm-search">Search by word, id or definition</label>
        <input id="cm-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="for example selection" />
      </div>
      <label style={{ fontSize: 12 }}>
        <input type="checkbox" checked={showTrial} onChange={(e) => setShowTrial(e.target.checked)} /> Also show trial entries (they expire if nobody promotes them)
      </label>
      {byVocab.length === 0 && <Missing>No concept matches.</Missing>}
      {byVocab.map(([vocab, list]) => (
        <div className="card" key={vocab} style={{ marginTop: 12 }}>
          <h2>{vocab} <span className="muted">({list.length})</span></h2>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Concept</th><th>Meanings</th><th>Comparisons</th><th>Cited by NetLogo guides</th></tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const n = definitionRows(c).length
                  const cmp = alignmentsFor(c.id, snap.alignments).length
                  const cited = snap.netlogoCitations.filter((x) => x.concept === c.id).length
                  return (
                    <tr key={c.id}>
                      <td><Link to={`${BASE}/${encodeURIComponent(c.id)}`}>{c.label}</Link></td>
                      <td>{n}</td>
                      <td>{cmp > 0 ? cmp : ''}</td>
                      <td>{cited > 0 ? `${cited} ${cited === 1 ? 'guide' : 'guides'}` : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function TagsTab({ snap }: { snap: MeaningsSnapshot }) {
  return (
    <div>
      <p>
        The {snap.netlogoTags.length} topic tags that the NetLogo models carry. A tag is a name with no definition. Nothing links a tag to a concept by its name,
        because the same word can carry another meaning. The sort below is a first pass by an AI session on 4 Nov 2026 and needs a person who knows the models.
      </p>
      {PILE_ORDER.map((pile) => {
        const rows = snap.netlogoTags.filter((t) => t.pile === pile)
        if (rows.length === 0) return null
        return (
          <div className="card" key={pile}>
            <h2>
              {pileLabel(pile)} <span className="muted">({rows.length})</span>{' '}
              <span className="chip chip-draft" title="Made by an AI session; no person has checked it"><span className="dot" />AI sort, unchecked</span>
            </h2>
            <p className="muted">{pileHelp(pile)}</p>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Tag</th><th>Used in models</th><th>Same word in ConceptBase</th></tr></thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.tag}>
                      <td>{t.tag}</td>
                      <td>{t.models.map((m) => m.title).join(', ')}</td>
                      <td>
                        {t.sameWord.length > 0 && t.sameWord.map((id, i) => <span key={id}>{i > 0 && ', '}<ConceptLink id={id} snap={snap} /></span>)}
                        {t.candidate && <span className="muted"> Possible match: <ConceptLink id={t.candidate} snap={snap} /></span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function IdsTab({ snap }: { snap: MeaningsSnapshot }) {
  const changes = useMemo(() => idChanges(snap.pending), [snap])
  const cited = useMemo(() => citationsByOldId(changes, snap.netlogoCitations), [changes, snap])
  const total = [...cited.values()].reduce((a, b) => a + b, 0)
  const brand = snap.pending.filter((p) => !p.replaces)
  return (
    <div>
      <p>
        The unmerged Bio-Core branch ({snap.sources.conceptbase.pendingBranch}) replaces the readable ids of {changes.length} existing concepts with numbers. It carries no list that
        says which old id became which new one. This table is that list, matched by the concept's label and checked against its English definition.
      </p>
      <p className="muted">
        {changes.filter((c) => c.sameDefinition).length} of {changes.length} keep the same English definition word for word. NetLogo strand guides cite the old ids {total} times.
        Merging the branch as written would leave those citations, and any comparison that names an old id, pointing at entries that no longer exist.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Concept</th><th>Id today</th><th>Id in the branch</th><th>Same definition</th><th>NetLogo citations of the old id</th></tr></thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.oldId}>
                <td>{c.label}</td>
                <td><Link to={`${BASE}/${encodeURIComponent(c.oldId)}`}><code>{c.oldId}</code></Link></td>
                <td><Link to={`${BASE}/${encodeURIComponent(c.newId)}`}><code>{c.newId}</code></Link></td>
                <td>{c.sameDefinition ? 'Yes' : 'No'}</td>
                <td>{cited.get(c.oldId) || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">The branch also adds {brand.length} entries that ConceptBase does not have today (most are marked proposed there).</p>
    </div>
  )
}

export default function ConceptMeaningsPage() {
  const { conceptId } = useParams<{ conceptId: string }>()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'concepts'
  const [snap, setSnap] = useState<MeaningsSnapshot | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadMeaningsSnapshot()
      .then((s) => !cancelled && setSnap(s))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  if (failed) return <div className="notice notice-bad">The copy of ConceptBase could not be loaded.</div>
  if (!snap) return <p className="muted">Loading the copy of ConceptBase…</p>

  if (conceptId) return <Detail id={decodeURIComponent(conceptId)} snap={snap} />

  return (
    <div>
      <h1>Concept meanings</h1>
      <p>
        What ConceptBase says each concept means, in every discipline and word list, with the comparisons between word lists and the places that use the word.
        You can read it here. Nothing on this page changes ConceptBase.
      </p>
      <p className="muted">
        Copy of {snap.asOf} · ConceptBase {snap.sources.conceptbase.commit} · NetLogo {snap.sources.netlogo.commit}. Every definition and every sort on this page is shown with its own
        review state. No expert has reviewed the NetLogo sort or the guides.
      </p>
      <div className="tabs" role="tablist">
        {([['concepts', 'Concepts'], ['tags', `Words in NetLogo models (${snap.netlogoTags.length})`], ['ids', 'Bio-Core id change']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setParams(k === 'concepts' ? {} : { tab: k })}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'concepts' && <ConceptsTab snap={snap} />}
      {tab === 'tags' && <TagsTab snap={snap} />}
      {tab === 'ids' && <IdsTab snap={snap} />}
    </div>
  )
}
