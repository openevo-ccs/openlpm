import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Activity, BookMarked, ChevronDown, ChevronRight, GitFork, Link2, Plus, X } from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'
import {
  attachCollection,
  countCollectionPapers,
  forkCollectionForProject,
  getCollectionPapers,
  listCanonicalCollections,
  listLinksForProject,
  listLinksForScope,
  removeLink,
  type LinkScope,
  type LiteratureCollectionRow,
  type ProjectLiteratureCollectionLinkRow,
} from '@/lib/supabase/literature-collections'
import type { LiteraturebaseSnapshotRow } from '@/lib/supabase/literature'
import { buildRelationGraph, computeEvidenceStrength, EVIDENCE_LABEL_TEXT } from '@/lib/literature-analytics'
import { LiteratureRelationsGraph } from '@/components/literature-relations-graph'

type Client = SupabaseClient<Database>

const KIND_LABEL: Record<LiteratureCollectionRow['kind'], string> = { subject_area: 'Subject area', cross_cutting: 'Cross-cutting theme' }

/**
 * Shows which shared literature collections (e.g. "Misconceptions in
 * Evolution Education") are attached here, and lets a project member
 * attach one from the shared library -- either live (always reflects the
 * shared version) or as a branch they can freely edit (decision 5 of
 * lab_manager/docs/design-notes/
 * openlpm-literature-collections-and-analytics-strategy-2026-10-23.md).
 * Reused three places: project-wide on the Literature page, and scoped to
 * one strand or one Curriculum Repository record.
 */
export function LiteratureCollectionsPanel({
  projectId,
  scope,
  canManage,
  supabase,
}: {
  projectId: string
  scope?: LinkScope
  canManage: boolean
  supabase: Client
}) {
  const [links, setLinks] = useState<(ProjectLiteratureCollectionLinkRow & { collection: LiteratureCollectionRow })[] | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [canonical, setCanonical] = useState<LiteratureCollectionRow[]>([])
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const reload = async () => {
    const data = scope ? await listLinksForScope(supabase, scope) : await listLinksForProject(supabase, projectId)
    // Project-wide panel shows only project-wide links; a scoped panel
    // (strand/record) shows only links scoped to that same strand/record --
    // listLinksForProject would otherwise also include every scoped link.
    setLinks(scope ? data : data.filter((l) => !l.lpm_thread_id && !l.curriculum_repository_record_id))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, projectId, scope?.lpmThreadId, scope?.curriculumRepositoryRecordId])

  const openPicker = async () => {
    setCanonical(await listCanonicalCollections(supabase))
    setShowPicker(true)
  }

  const attach = async (collection: LiteratureCollectionRow, mode: 'live' | 'branch') => {
    setBusySlug(collection.slug)
    setError(null)
    try {
      const target = mode === 'branch' ? await forkCollectionForProject(supabase, collection, projectId) : collection
      await attachCollection(supabase, projectId, target.id, mode, scope)
      setShowPicker(false)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not attach this collection.')
    } finally {
      setBusySlug(null)
    }
  }

  const detach = async (linkId: string) => {
    await removeLink(supabase, linkId)
    await reload()
  }

  const alreadyAttached = new Set((links ?? []).map((l) => l.collection.domain_tag))

  return (
    <section style={{ marginTop: 16 }}>
      <h4 className="row"><BookMarked size={13} />Literature collections</h4>
      {links === null ? (
        <p className="muted" style={{ fontSize: 13 }}>Loading…</p>
      ) : links.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>No collection attached yet.</p>
      ) : (
        links.map((l) => (
          <CollectionLinkRow
            key={l.id}
            link={l}
            supabase={supabase}
            canManage={canManage}
            expanded={expanded === l.id}
            onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
            onRemove={() => detach(l.id)}
          />
        ))
      )}

      {error && <div className="notice notice-bad" style={{ marginTop: 6 }}>{error}</div>}

      {canManage && (
        !showPicker ? (
          <button className="btn btn-mini" style={{ marginTop: 6 }} onClick={openPicker}>
            <Plus size={12} />Attach a collection
          </button>
        ) : (
          <div className="card" style={{ marginTop: 6, background: 'var(--surface-1)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 12 }}>Shared collections</strong>
              <button className="btn-linklike" onClick={() => setShowPicker(false)}><X size={12} /></button>
            </div>
            {canonical.map((c) => (
              <div key={c.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13 }}>{c.name}</div>
                  <span className="muted" style={{ fontSize: 10.5 }}>{KIND_LABEL[c.kind]}{c.maturity === 'provisional' ? ' — not yet verified' : ''}</span>
                </div>
                {alreadyAttached.has(c.domain_tag) ? (
                  <span className="chip" style={{ fontSize: 10 }}>Attached</span>
                ) : (
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn btn-mini" disabled={busySlug === c.slug} title="Always reflects the shared, shared-library version" onClick={() => attach(c, 'live')}>
                      <Link2 size={11} />{busySlug === c.slug ? '…' : 'Attach'}
                    </button>
                    <button className="btn btn-mini" disabled={busySlug === c.slug} title="Make your own copy you can freely add to or trim" onClick={() => attach(c, 'branch')}>
                      <GitFork size={11} />{busySlug === c.slug ? '…' : 'My copy'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </section>
  )
}

function CollectionLinkRow({
  link,
  supabase,
  canManage,
  expanded,
  onToggle,
  onRemove,
}: {
  link: ProjectLiteratureCollectionLinkRow & { collection: LiteratureCollectionRow }
  supabase: Client
  canManage: boolean
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const [count, setCount] = useState<number | null>(null)
  const [papers, setPapers] = useState<LiteraturebaseSnapshotRow[] | null>(null)
  const [showGraph, setShowGraph] = useState(false)

  useEffect(() => {
    countCollectionPapers(supabase, link.collection).then(setCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, link.collection.id])

  useEffect(() => {
    if (expanded && papers === null) getCollectionPapers(supabase, link.collection).then(setPapers)
  }, [expanded, papers, supabase, link.collection])

  const graph = useMemo(() => (papers ? buildRelationGraph(papers) : null), [papers])
  const evidence = useMemo(() => (graph ? computeEvidenceStrength(graph) : null), [graph])

  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn-linklike row" style={{ gap: 4 }} onClick={onToggle}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <strong style={{ fontSize: 13 }}>{link.collection.name}</strong>
        </button>
        <div className="row" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 11 }}>{count === null ? '…' : `${count} paper${count === 1 ? '' : 's'}`}</span>
          <span className="chip" style={{ fontSize: 10 }}>{link.link_type === 'branch' ? 'my copy' : 'shared'}</span>
          {link.collection.maturity === 'provisional' && <span className="chip" style={{ fontSize: 10 }} title="Built from a fast keyword scan, not yet checked paper-by-paper">not yet verified</span>}
          {canManage && (
            <button className="btn-linklike" aria-label="Remove" title="Remove this collection from here" onClick={onRemove}><X size={12} /></button>
          )}
        </div>
      </div>
      {expanded && (
        papers === null ? (
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Loading papers…</p>
        ) : papers.length === 0 ? (
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>No papers in here yet.</p>
        ) : (
          <div style={{ marginTop: 4 }}>
            {evidence && (
              <div className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <span
                  className="chip"
                  style={{ fontSize: 10 }}
                  title={`${evidence.reinforcingCount} reinforcing link${evidence.reinforcingCount === 1 ? '' : 's'}, ${evidence.tensionCount} contradicts/criticises link${evidence.tensionCount === 1 ? '' : 's'}, out of ${evidence.edgeCount} total real links between these papers — a heuristic over the papers' own recorded relations, not a formal meta-analysis.`}
                >
                  <Activity size={10} style={{ marginRight: 3 }} />{EVIDENCE_LABEL_TEXT[evidence.label]} ({evidence.edgeCount} linked relation{evidence.edgeCount === 1 ? '' : 's'})
                </span>
                <button className="btn-linklike" style={{ fontSize: 11 }} onClick={() => setShowGraph(!showGraph)}>
                  {showGraph ? 'Hide relation map' : 'View relation map'}
                </button>
              </div>
            )}
            {showGraph && graph && (
              <div style={{ marginBottom: 8 }}>
                <LiteratureRelationsGraph graph={graph} onOpenPaper={(id) => {
                  const url = papers.find((p) => p.id === id)?.slug
                  if (url) window.open(`https://github.com/openevo-ccs/literaturebase/blob/main/records/${url}.yaml`, '_blank')
                }} />
              </div>
            )}
            <div style={{ maxHeight: 220, overflow: 'auto' }}>
              {papers.map((p) => (
                <div key={p.id} style={{ fontSize: 12, padding: '3px 0' }}>
                  <a href={`https://github.com/openevo-ccs/literaturebase/blob/main/records/${p.slug}.yaml`} target="_blank" rel="noreferrer">
                    {p.title}
                  </a>
                  <span className="muted"> ({p.year ?? 'n.d.'})</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
