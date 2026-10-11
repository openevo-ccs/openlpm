import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronUp, Compass, Link2, Rows3, Search, Shapes } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { TabPanels } from '@/components/tab-panels'
import {
  getAssertedConnections,
  getFullThread,
  getThreadStationsForTopic,
  getTopic,
  listTopicContents,
  listTopics,
  type DataObjectRow,
  type FullThread,
  type ResolvedConnection,
  type ThreadStationWithThread,
  type TopicListItem,
} from '@/lib/supabase/curriculum'

// Real feedback b3d9116e (2026-10-03): "We need much better ways of
// visualizing the learning goals in terms of grade bands, concepts,
// provenance... different views available... just like most data spaces
// here!" The data was already there -- content.concepts[] (real ConceptBase
// ids with an emphasis level) and content._source (the real source repo and
// file path) on every real bio-core-lpm-synth row -- just never surfaced.
// Concept ids are real OpenEvo registry ids (OE-CONCEPT-<namespace>-<slug>);
// stripping only the universal "OE-CONCEPT-" prefix and title-casing the
// rest stays correct for ANY project's concept vocabulary rather than
// hardcoding this one dataset's "bio-core-" namespace specifically.
function humanizeConceptId(id: string): string {
  return id
    .replace(/^OE-CONCEPT-/, '')
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

interface TopicProvenance {
  concepts: { id: string; emphasis: string | null }[]
  sourceRepo: string | null
  sourcePath: string | null
  sourceId: string | null
}

function readProvenance(content: unknown): TopicProvenance {
  const c = (content ?? {}) as Record<string, unknown>
  const concepts = Array.isArray(c.concepts)
    ? (c.concepts as any[]).filter((x) => x?.id).map((x) => ({ id: String(x.id), emphasis: x.emphasis ? String(x.emphasis) : null }))
    : []
  const source = (c._source ?? {}) as Record<string, unknown>
  return {
    concepts,
    sourceRepo: typeof source.repo === 'string' ? source.repo : null,
    sourcePath: typeof source.path === 'string' ? source.path : null,
    sourceId: typeof c.source_id === 'string' ? c.source_id : null,
  }
}
import { CaseImportPanel, DirectCaseImportPanel, FwuImportPanel, UploadImportPanel, ExportPanel } from './importers-panels'

// 2026-09-13 restructure: renamed from "Standards" (RFC-0003 stub) and
// merged with the standalone "Explore" tab (which is removed -- Dustin's
// instruction is for "explore" to become a search bar instead of a page) and the
// standalone "Import / export" tab (every one of whose panels writes to
// `lpm_data_objects`, i.e. this page's own content, so import/export
// belongs here as tabs rather than as its own sidebar item). This is the
// real home for formally stated, officially recognized learning goals --
// standards, competency frameworks -- mandated or optionally chosen within
// a jurisdiction.

// Plain-language gloss for the small controlled vocabulary real threads use
// (conceptbase RFC-0018's frameworkRelation terms) -- a fallback humanizes
// anything else (camelCase -> spaced words) so an unfamiliar project's own
// relation vocabulary still renders reasonably instead of erroring.
const RELATION_GLOSS: Record<string, string> = {
  enables: 'which opens the door to',
  requires: 'which depends on',
  regulates: 'which regulates',
  isRegulatedBy: 'which is regulated by',
  implements: 'which puts into practice',
  isImplementedBy: 'which is put into practice by',
  controls: 'which controls',
  isControlledBy: 'which is controlled by',
  explainsOriginOf: 'which explains where this comes from:',
  isExplainedBy: 'which is explained by',
}

function humanizeRelation(type: string | null): string {
  if (!type) return 'connects to'
  return RELATION_GLOSS[type] ?? type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

function gradeLabel(grade: string | null): string {
  return grade ? `Grade ${grade}` : 'Grade —'
}

// A combined band like "5/6" (MNT's real Doppeljahrgangsstufe structure --
// the Thuringia curriculum itself leaves sequencing within the two years to
// the teacher, per LP Thueringen MNT 2026's own "ueber die Anordnung der
// Lerninhalte innerhalb der... Doppelklassenstufe entscheidet die
// Lehrkraft") should show up when a teacher picks EITHER single grade it
// spans, in addition to its own separate "Grade 5/6" filter option -- a
// real gap confirmed live: 37 grade-5/6 items were invisible to anyone
// filtering to "Grade 5" or "Grade 6" specifically, which is how a teacher
// actually browses.
function matchesGrade(band: string | null, filter: string): boolean {
  if (!band) return false
  if (band === filter) return true
  return band.split('/').map((s) => s.trim()).includes(filter)
}

export default function LearningGoalsPage() {
  const { project } = useOutletContext<ProjectOutletContext>()
  // Real feedback 2026-10-10 (Dustin, Biologiedidaktik I): the two US-specific import
  // panels (CASE Network's direct state API and its browse-by-state picker) are dead
  // weight on a project that will only ever import German Lehrplan documents. Rather
  // than removing them globally -- plenty of real projects (EvoMentor, the US/India
  // curriculum repositories) genuinely need them -- a project whose working_languages
  // is German-only has no legitimate use for a US-standards importer, so those two
  // tabs are hidden for it specifically. Any project that also declares English (or
  // any other language) keeps the full set unchanged.
  const germanOnly = project.working_languages?.length === 1 && project.working_languages[0] === 'de'
  const tabs = [
    { label: 'Browse', content: <BrowseTab /> },
    ...(germanOnly ? [] : [
      { label: 'Import: Direct state API', content: <DirectCaseImportPanel /> },
      { label: 'Import: Browse US states', content: <CaseImportPanel /> },
    ]),
    { label: 'Import: German Lehrplan', content: <FwuImportPanel /> },
    { label: 'Import: Upload a file', content: <UploadImportPanel /> },
    { label: 'Export', content: <ExportPanel /> },
  ]
  return (
    <div>
      <h1>Learning goals</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Formally stated, officially recognized learning goals — standards and competency
        frameworks, mandated or optionally chosen within a given jurisdiction.
      </p>

      <TabPanels tabs={tabs} />
    </div>
  )
}

type GroupBy = 'grade' | 'concept'

function BrowseTab() {
  const { project, defaultBranchId, supabase } = useOutletContext<ProjectOutletContext>()
  const { objectId } = useParams<{ objectId?: string }>()
  const navigate = useNavigate()

  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [provenanceByTopic, setProvenanceByTopic] = useState<Map<string, TopicProvenance>>(new Map())
  const [query, setQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  const [conceptFilter, setConceptFilter] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<GroupBy>('grade')

  useEffect(() => {
    setTopics(null)
    listTopics(supabase, project.id, defaultBranchId).then(setTopics)
    listTopicContents(supabase, project.id).then((contents) => {
      const m = new Map<string, TopicProvenance>()
      for (const [id, content] of contents) m.set(id, readProvenance(content))
      setProvenanceByTopic(m)
    })
  }, [supabase, project.id, defaultBranchId])

  const grades = useMemo(() => {
    const set = new Set((topics ?? []).map((t) => t.grade_band).filter(Boolean) as string[])
    // grade_band is free text typed during import (e.g. "9", "9-12", "9/10"),
    // not a plain number -- Number(a) on a range string is NaN, which sorts
    // inconsistently. Sort by the first number in the label instead.
    const leadingNumber = (s: string) => parseInt(s, 10) || 0
    return Array.from(set).sort((a, b) => leadingNumber(a) - leadingNumber(b))
  }, [topics])

  const concepts = useMemo(() => {
    const set = new Set<string>()
    for (const p of provenanceByTopic.values()) for (const c of p.concepts) set.add(c.id)
    return Array.from(set).sort((a, b) => humanizeConceptId(a).localeCompare(humanizeConceptId(b)))
  }, [provenanceByTopic])

  const filtered = useMemo(() => {
    if (!topics) return []
    const q = query.trim().toLowerCase()
    return topics.filter((t) => {
      if (gradeFilter !== 'all' && !matchesGrade(t.grade_band, gradeFilter)) return false
      if (conceptFilter !== 'all' && !(provenanceByTopic.get(t.id)?.concepts ?? []).some((c) => c.id === conceptFilter)) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        (t.thema ?? '').toLowerCase().includes(q) ||
        (t.unterthema ?? '').toLowerCase().includes(q)
      )
    })
  }, [topics, query, gradeFilter, conceptFilter, provenanceByTopic])

  // "just like most data spaces here" (b3d9116e) -- grouped sections instead
  // of one flat grid, the same structural idea as the Timeline's lanes or
  // the Concepts page's taxonomy tree. A topic tagged with more than one
  // concept genuinely belongs under each of them, so the concept grouping
  // can show the same card more than once -- expected behavior for a
  // many-to-many tag.
  const groups = useMemo(() => {
    if (groupBy === 'grade') {
      const byGrade = new Map<string, TopicListItem[]>()
      for (const t of filtered) {
        const key = t.grade_band ?? 'Ungraded'
        const arr = byGrade.get(key) ?? []
        arr.push(t)
        byGrade.set(key, arr)
      }
      const leadingNumber = (s: string) => parseInt(s, 10) || 0
      return Array.from(byGrade.entries())
        .sort((a, b) => leadingNumber(a[0]) - leadingNumber(b[0]))
        .map(([key, items]) => ({ key, label: key === 'Ungraded' ? 'Ungraded' : gradeLabel(key), items }))
    }
    const byConcept = new Map<string, TopicListItem[]>()
    for (const t of filtered) {
      const topicConcepts = provenanceByTopic.get(t.id)?.concepts ?? []
      if (topicConcepts.length === 0) {
        const arr = byConcept.get('__none') ?? []
        arr.push(t)
        byConcept.set('__none', arr)
        continue
      }
      for (const c of topicConcepts) {
        const arr = byConcept.get(c.id) ?? []
        arr.push(t)
        byConcept.set(c.id, arr)
      }
    }
    return Array.from(byConcept.entries())
      .sort((a, b) => (a[0] === '__none' ? 1 : b[0] === '__none' ? -1 : humanizeConceptId(a[0]).localeCompare(humanizeConceptId(b[0]))))
      .map(([key, items]) => ({ key, label: key === '__none' ? 'No concept tagged yet' : humanizeConceptId(key), items }))
  }, [filtered, groupBy, provenanceByTopic])

  return (
    <div className="explorer">
      <div className="notice">
        Covers the Gymnasium (academic-track) curriculum only. Most Thuringia students attend a
        different school type (Regelschule/Gemeinschaftsschule) — that curriculum isn&apos;t
        represented here yet.
      </div>
      <div className="toolbar">
        <div className="row" style={{ flex: 1 }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="search"
            placeholder="Search learning goals by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 240 }}
          />
        </div>
        <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <option value="all">All grades</option>
          {grades.map((g) => (
            <option key={g} value={g}>{gradeLabel(g)}</option>
          ))}
        </select>
        {concepts.length > 0 && (
          <select value={conceptFilter} onChange={(e) => setConceptFilter(e.target.value)} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <option value="all">All concepts</option>
            {concepts.map((c) => (
              <option key={c} value={c}>{humanizeConceptId(c)}</option>
            ))}
          </select>
        )}
        <span className="muted">{topics === null ? 'Loading…' : `${filtered.length} of ${topics.length} learning goals`}</span>
      </div>

      <div className="row" style={{ marginBottom: 10, gap: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>Group by:</span>
        <button type="button" className={`btn btn-mini${groupBy === 'grade' ? ' btn-primary' : ''}`} onClick={() => setGroupBy('grade')}>
          <Rows3 size={12} />Grade band
        </button>
        {concepts.length > 0 && (
          <button type="button" className={`btn btn-mini${groupBy === 'concept' ? ' btn-primary' : ''}`} onClick={() => setGroupBy('concept')}>
            <Shapes size={12} />Concept
          </button>
        )}
      </div>

      <div className="explorer-body">
        <div className="graph-host" style={{ overflow: 'auto', padding: 4 }}>
          {topics === null ? (
            <p className="muted" style={{ padding: 16 }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="card empty">
              <Compass size={28} />
              <p>No learning goals match.</p>
            </div>
          ) : (
            // Real feedback 2026-09-18 (c7d13f30): wanted a visually appealing
            // card layout like EvoMentor DE v1.2, with only relevant info per
            // card -- reuses the exact card grid built 2026-09-30 for the
            // German student Lernziele explorer (globals.css's .topic-card*
            // rules), renamed generic since it's no longer student-only. Light/
            // dark mode comes free from the same var(--...) tokens every other
            // card in the app already uses. The rich detail (required order,
            // suggested connections, import/export) stays exactly where it was,
            // in the drawer -- this only replaces the plain list on the left.
            // Grouped into sections (b3d9116e) rather than one flat grid --
            // a card can legitimately appear under more than one section when
            // grouped by concept, so the key includes the group.
            groups.map((group) => (
              <div key={group.key} style={{ marginBottom: 18 }}>
                <h4 className="row" style={{ gap: 6, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  {groupBy === 'concept' && <Shapes size={13} />}
                  {group.label}
                  <span className="muted" style={{ fontWeight: 400 }}>({group.items.length})</span>
                </h4>
                <div className="topic-card-grid">
                  {group.items.map((t) => {
                    const prov = provenanceByTopic.get(t.id)
                    return (
                      <div
                        key={`${group.key}-${t.id}`}
                        className={`card topic-card${t.id === objectId ? ' active' : ''}`}
                        onClick={() => navigate(`/dashboard/${project.slug}/learning-goals/${t.id}`)}
                      >
                        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                          <span className="chip">{gradeLabel(t.grade_band)}</span>
                          {prov?.concepts.map((c) => (
                            <span key={c.id} className="chip" style={{ fontSize: 10 }}>{humanizeConceptId(c.id)}</span>
                          ))}
                        </div>
                        <strong style={{ display: 'block', marginTop: 6 }}>{t.title}</strong>
                        {(t.thema || t.unterthema) && (
                          <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>
                            {[t.thema, t.unterthema].filter(Boolean).join(' › ')}
                          </span>
                        )}
                        {t.description && <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{t.description}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="drawer-shell wide">
          <div className="drawer">
            {objectId ? (
              <TopicDetail objectId={objectId} projectSlug={project.slug} supabase={supabase} />
            ) : (
              <div className="empty" style={{ paddingTop: 60 }}>
                <Compass size={32} />
                <p>Pick a learning goal on the left.</p>
                <p className="muted">You&apos;ll see how it connects to what comes before, what comes after, and — where curriculum designers have identified it — the bigger idea that ties it to other topics.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TopicDetail({
  objectId,
  projectSlug,
  supabase,
}: {
  objectId: string
  projectSlug: string
  supabase: ProjectOutletContext['supabase']
}) {
  const [topic, setTopic] = useState<DataObjectRow | null | undefined>(undefined)
  const [connections, setConnections] = useState<ResolvedConnection[] | null>(null)
  const [stations, setStations] = useState<ThreadStationWithThread[] | null>(null)

  useEffect(() => {
    setTopic(undefined)
    setConnections(null)
    setStations(null)
    getTopic(supabase, objectId).then(setTopic)
    getAssertedConnections(supabase, objectId).then(setConnections)
    getThreadStationsForTopic(supabase, objectId).then(setStations)
  }, [supabase, objectId])

  if (topic === undefined) return <p className="muted">Loading…</p>
  if (topic === null) return <div className="notice notice-bad">Learning goal not found.</div>

  const requiredBefore = (connections ?? []).filter((c) => c.direction === 'incoming')
  const leadsTo = (connections ?? []).filter((c) => c.direction === 'outgoing')
  const prov = readProvenance(topic.content)

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 style={{ marginBottom: 2 }}>{topic.title}</h2>
        <span className="chip">{gradeLabel(topic.grade_band)}</span>
      </div>
      {prov.concepts.length > 0 && (
        <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {prov.concepts.map((c) => (
            <span key={c.id} className="chip" style={{ fontSize: 10 }} title={c.emphasis ? `${c.emphasis} emphasis` : undefined}>{humanizeConceptId(c.id)}</span>
          ))}
        </div>
      )}
      {topic.description && (
        <blockquote style={{ margin: '8px 0 16px', paddingLeft: 10, borderLeft: '3px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13 }}>
          &ldquo;{topic.description}&rdquo;
        </blockquote>
      )}
      {(prov.sourceRepo || prov.sourceId) && (
        <p className="muted" style={{ fontSize: 12, marginTop: -8, marginBottom: 16 }}>
          Where this comes from: {prov.sourceRepo && <code>{prov.sourceRepo}</code>}
          {prov.sourcePath && <> — <code>{prov.sourcePath}</code></>}
          {prov.sourceId && <> (<code>{prov.sourceId}</code>)</>}
        </p>
      )}

      {(requiredBefore.length > 0 || leadsTo.length > 0) && (
        <section style={{ marginBottom: 18 }}>
          <h3 className="row"><Link2 size={13} />Required order in the curriculum</h3>
          <p className="muted" style={{ marginTop: -4 }}>This order comes from the curriculum's own structure.</p>
          {requiredBefore.map((c) => (
            <ConnLine key={c.connection.id} kind="asserted" arrow="in" object={c.other} projectSlug={projectSlug} />
          ))}
          {leadsTo.map((c) => (
            <ConnLine key={c.connection.id} kind="asserted" arrow="out" object={c.other} projectSlug={projectSlug} />
          ))}
        </section>
      )}

      {stations && stations.length > 0 && (
        <section>
          {stations.map((s) => (
            <ThreadCard key={s.id} station={s} currentObjectId={objectId} projectSlug={projectSlug} supabase={supabase} />
          ))}
        </section>
      )}

      {connections?.length === 0 && stations?.length === 0 && (
        <p className="muted">No recorded connections for this learning goal yet.</p>
      )}
    </div>
  )
}

function ConnLine({
  kind,
  arrow,
  object,
  projectSlug,
}: {
  kind: 'asserted' | 'suggested'
  arrow: 'in' | 'out'
  object: DataObjectRow
  projectSlug: string
}) {
  return (
    <Link
      to={`/dashboard/${projectSlug}/learning-goals/${object.id}`}
      className={`conn-line conn-${kind}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <span className="muted" style={{ fontSize: 12 }}>{arrow === 'in' ? 'Comes before this' : 'Comes after this'}</span>
      <span className="row" style={{ justifyContent: 'space-between' }}>
        <strong>{object.title}</strong>
        <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
      </span>
    </Link>
  )
}

function ThreadCard({
  station,
  currentObjectId,
  projectSlug,
  supabase,
}: {
  station: ThreadStationWithThread
  currentObjectId: string
  projectSlug: string
  supabase: ProjectOutletContext['supabase']
}) {
  const [expanded, setExpanded] = useState(false)
  const [full, setFull] = useState<FullThread | null>(null)

  const toggle = async () => {
    if (!expanded && !full) {
      const f = await getFullThread(supabase, station.thread_id)
      setFull(f)
    }
    setExpanded((v) => !v)
  }

  const hubLabel = station.thread.explained_by?.label ?? null

  return (
    <div className="card conn-suggested" style={{ marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="chip chip-draft">Suggested connection</span>
        {hubLabel && <span className="muted" style={{ fontSize: 12 }}>tied together by: {hubLabel}</span>}
      </div>
      <h3 style={{ marginTop: 8, marginBottom: 4 }}>{station.thread.title}</h3>
      <p style={{ marginBottom: 8 }}>{station.role_note}</p>

      <button className="btn btn-mini" onClick={toggle}>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? 'Hide the full explanation' : 'Why does this connect? See the full thread'}
      </button>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <p><strong>The idea that ties it together:</strong> {station.thread.connecting_idea}</p>
          <p>{station.thread.narrative}</p>
          {station.thread.teaching_prompt && (
            <div className="notice notice-ok" style={{ alignItems: 'flex-start' }}>
              <span><strong>Try this in class:</strong> {station.thread.teaching_prompt}</span>
            </div>
          )}

          {full && (
            <ol className="thread-path">
              {full.stations.map((st) => (
                <li key={st.id} className={st.data_object_id === currentObjectId ? 'thread-station current' : 'thread-station'}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <Link to={`/dashboard/${projectSlug}/learning-goals/${st.object.id}`} style={{ textDecoration: 'none' }}>
                      <strong>{gradeLabel(st.object.grade_band)} — {st.object.title}</strong>
                    </Link>
                  </div>
                  <p className="muted" style={{ margin: '2px 0 0' }}>{st.role_note}</p>
                  {st.relation_to_next && (
                    <p className="muted" style={{ margin: '4px 0 0', fontStyle: 'italic' }}>↓ {humanizeRelation(st.relation_to_next)}</p>
                  )}
                </li>
              ))}
            </ol>
          )}

          {station.thread.evidence_note && (
            <p className="muted" style={{ marginTop: 10 }}>
              <span className="tip" data-tip="How curriculum designers found this connection, so you can judge it yourself rather than take it on faith.">
                <span className="help">?</span>
              </span>{' '}
              How this was identified: {station.thread.evidence_note}
            </p>
          )}
          {Array.isArray(station.thread.gaps) && station.thread.gaps.length > 0 && (
            <div className="notice">
              Known gap: {station.thread.gaps.join(' ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
