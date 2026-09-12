import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Download, Upload, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { TabPanels } from '@/components/tab-panels'
import { Chip } from '@/components/chip'
import {
  listJurisdictions,
  getJurisdictionStandardSets,
  getStandardSet,
  classifyLicense,
  leafStandards,
  type Jurisdiction,
  type StandardSetSummary,
  type StandardSetDetail,
  type CaseStandard,
} from '@/lib/importers/commonStandardsProject'
import {
  FWU_LAENDER,
  discoverDocuments,
  discoverFineGrainedContent,
  type FwuDocument,
  type FwuCandidate,
} from '@/lib/importers/fwuLehrplan'
import { todayIso, type CanonicalCurriculumItem } from '@/lib/importers/types'

type Notice = { kind: 'ok' | 'bad'; text: string } | null

function NoticeBox({ notice, onClear }: { notice: Notice; onClear: () => void }) {
  if (!notice) return null
  return (
    <div className={`notice notice-${notice.kind}`}>
      {notice.text}
      <button className="btn btn-mini" onClick={onClear} style={{ marginLeft: 'auto' }}>
        <X size={10} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- CASE (US) import

function CaseImportPanel() {
  const { project, supabase, defaultBranchId } = useOutletContext<ProjectOutletContext>()
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[] | null>(null)
  const [jurisdictionId, setJurisdictionId] = useState('')
  const [sets, setSets] = useState<StandardSetSummary[]>([])
  const [setId, setSetId] = useState('')
  const [detail, setDetail] = useState<StandardSetDetail | null>(null)
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [gradeBand, setGradeBand] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const loadJurisdictions = async () => {
    setBusy(true); setNotice(null)
    try {
      setJurisdictions(await listJurisdictions())
    } catch (err) {
      setNotice({ kind: 'bad', text: err instanceof Error ? err.message : 'Could not reach the standards directory.' })
    }
    setBusy(false)
  }

  const loadSets = async (id: string) => {
    setJurisdictionId(id); setSets([]); setSetId(''); setDetail(null); setSelected(new Set())
    if (!id) return
    setBusy(true); setNotice(null)
    try {
      const all = await getJurisdictionStandardSets(id)
      setSets(all.filter((s) => s.document.publicationStatus === 'Published'))
    } catch (err) {
      setNotice({ kind: 'bad', text: err instanceof Error ? err.message : 'Could not load this state’s standard sets.' })
    }
    setBusy(false)
  }

  const loadDetail = async (id: string) => {
    setSetId(id); setDetail(null); setSelected(new Set())
    if (!id) return
    setBusy(true); setNotice(null)
    try {
      const d = await getStandardSet(id)
      setDetail(d)
      setGradeBand(sets.find((s) => s.id === id)?.educationLevels.join(', ') ?? '')
    } catch (err) {
      setNotice({ kind: 'bad', text: err instanceof Error ? err.message : 'Could not load this standard set.' })
    }
    setBusy(false)
  }

  const verdict = detail ? classifyLicense(detail.license) : null
  const leaves = detail ? leafStandards(detail) : []
  const filtered: CaseStandard[] = keyword.trim()
    ? leaves.filter((s) => s.description.toLowerCase().includes(keyword.trim().toLowerCase()))
    : leaves

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const importSelected = async () => {
    if (!detail || verdict !== 'ALLOW_FULL' || selected.size === 0) return
    setBusy(true); setNotice(null)
    try {
      const rows = Array.from(selected).map((id) => {
        const s = detail.standards[id]
        const item: CanonicalCurriculumItem = {
          sourceFormat: 'case',
          sourceRef: {
            documentUri: detail.document.sourceURL ?? null,
            itemIdentifier: s.statementNotation ?? s.id,
            licenseVerdict: 'ALLOW_FULL',
            license: detail.license,
          },
          jurisdiction: `US-${detail.jurisdiction.title.slice(0, 2).toUpperCase()}`,
          language: 'en',
          subject: detail.subject,
          gradeBand: gradeBand || undefined,
          fullStatement: s.description,
          concepts: [],
          provenance: { ingestedFrom: 'case', ingestedAt: todayIso(), importedVia: 'openlpm-import-ui', conceptTagged: false },
        }
        return {
          project_id: project.id,
          branch_id: defaultBranchId,
          object_type: 'performance_indicator' as const,
          title: s.description.slice(0, 90),
          description: s.description,
          grade_band: gradeBand || null,
          subject_area: detail.subject,
          content: item,
          schema_version: 'case-common-standards-project-v1',
          status: 'draft' as const,
        }
      })
      const { error } = await supabase.from('lpm_data_objects').insert(rows)
      if (error) throw error
      setNotice({ kind: 'ok', text: `Imported ${rows.length} item(s) as drafts. Review and accept them from Explore.` })
      setSelected(new Set())
    } catch (err) {
      setNotice({ kind: 'bad', text: err instanceof Error ? err.message : 'Import failed.' })
    }
    setBusy(false)
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Pulls real, published state standards (CASE format) live from the Common Standards Project
        directory, covering all 50 US states. Every standard set carries its own checked license —
        only sets with a clear open license (e.g. CC BY) can be imported with their real wording.
      </p>
      <NoticeBox notice={notice} onClear={() => setNotice(null)} />

      {!jurisdictions ? (
        <button className="btn btn-primary" onClick={loadJurisdictions} disabled={busy}>
          Browse US states
        </button>
      ) : (
        <>
          <div className="grid grid-2">
            <div className="field">
              <label>State</label>
              <select value={jurisdictionId} onChange={(e) => loadSets(e.target.value)}>
                <option value="">Choose a state…</option>
                {jurisdictions.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>
            {sets.length > 0 && (
              <div className="field">
                <label>Standard set</label>
                <select value={setId} onChange={(e) => loadDetail(e.target.value)}>
                  <option value="">Choose a standard set…</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} — {s.subject} {s.educationLevels.length ? `(grades ${s.educationLevels.join(', ')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {detail && verdict && (
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{detail.title}</h3>
                  <p className="muted" style={{ margin: '2px 0' }}>{detail.document.title}</p>
                </div>
                <Chip status={verdict.toLowerCase()} />
              </div>

              {verdict !== 'ALLOW_FULL' ? (
                <div className="notice notice-bad">
                  {detail.license?.URL
                    ? 'This standard set’s license isn’t a clear open license, so its real wording can’t be imported automatically.'
                    : 'This standard set has no license information at all, so it can’t be imported automatically — reusing its real wording without checking would be a real legal risk.'}
                  {' '}Check with the source agency directly if you need this specific set.
                </div>
              ) : (
                <>
                  <p className="muted" style={{ fontSize: 12 }}>
                    Licensed {detail.license.title} by {detail.license.rightsHolder} — safe to reproduce in full.
                  </p>
                  <div className="grid grid-2">
                    <div className="field">
                      <label>Filter by keyword (optional)</label>
                      <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. evolution" />
                    </div>
                    <div className="field">
                      <label>Grade band label</label>
                      <input value={gradeBand} onChange={(e) => setGradeBand(e.target.value)} placeholder="e.g. 9-12" />
                    </div>
                  </div>
                  <p className="muted" style={{ fontSize: 12 }}>
                    {filtered.length} of {leaves.length} standards shown.
                  </p>
                  <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 10 }}>
                    {filtered.map((s) => (
                      <label key={s.id} className="row" style={{ alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} style={{ marginTop: 3 }} />
                        <span style={{ fontSize: 13 }}>
                          {s.statementNotation && <strong>{s.statementNotation}: </strong>}
                          {s.description}
                        </span>
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={importSelected} disabled={busy || selected.size === 0}>
                    <Upload size={14} /> Import {selected.size || ''} selected item(s) as drafts
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- FWU/MEM-Schule (DE) import

function FwuImportPanel() {
  const { project, supabase, defaultBranchId } = useOutletContext<ProjectOutletContext>()
  const [landUri, setLandUri] = useState(FWU_LAENDER[0].uri)
  const [subjectFilter, setSubjectFilter] = useState('biolog')
  const [documents, setDocuments] = useState<FwuDocument[] | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<FwuDocument | null>(null)
  const [candidates, setCandidates] = useState<FwuCandidate[]>([])
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [gradeBand, setGradeBand] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const search = async () => {
    setBusy(true); setNotice(null); setDocuments(null); setSelectedDoc(null); setCandidates([])
    try {
      const docs = await discoverDocuments(landUri, subjectFilter)
      setDocuments(docs)
      if (docs.length === 0) setNotice({ kind: 'bad', text: 'No documents matched that subject filter for this Bundesland.' })
    } catch (err) {
      setNotice({ kind: 'bad', text: err instanceof Error ? err.message : 'Could not reach the FWU-DE SPARQL endpoint.' })
    }
    setBusy(false)
  }

  const openDocument = async (doc: FwuDocument) => {
    setSelectedDoc(doc); setCandidates([]); setSelected(new Set())
    setBusy(true); setNotice(null)
    try {
      const items = await discoverFineGrainedContent(doc)
      setCandidates(items)
      if (items.length === 0) setNotice({ kind: 'bad', text: 'No fine-grained Lernziel content found in this document.' })
    } catch (err) {
      setNotice({ kind: 'bad', text: err instanceof Error ? err.message : 'Could not query this document’s content.' })
    }
    setBusy(false)
  }

  const filtered = keyword.trim()
    ? candidates.filter((c) => c.label.toLowerCase().includes(keyword.trim().toLowerCase()))
    : candidates

  const toggle = (uri: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uri)) next.delete(uri)
      else next.add(uri)
      return next
    })
  }

  const land = FWU_LAENDER.find((l) => l.uri === landUri)!

  const importSelected = async () => {
    if (selected.size === 0) return
    setBusy(true); setNotice(null)
    try {
      const rows = candidates
        .filter((c) => selected.has(c.uri))
        .map((c) => {
          const item: CanonicalCurriculumItem = {
            sourceFormat: 'fwu-lehrplan-ontologie',
            sourceRef: { individualUri: c.uri, landOntology: land.label, documentUri: c.documentUri },
            jurisdiction: land.jurisdiction,
            language: 'de',
            subject: subjectFilter,
            gradeBand: gradeBand || undefined,
            fullStatement: c.label,
            concepts: [],
            provenance: { ingestedFrom: 'fwu-lehrplan-ontologie', ingestedAt: todayIso(), importedVia: 'openlpm-import-ui', conceptTagged: false },
          }
          return {
            project_id: project.id,
            branch_id: defaultBranchId,
            object_type: 'performance_indicator' as const,
            title: c.label.slice(0, 90),
            description: c.label,
            grade_band: gradeBand || null,
            subject_area: subjectFilter,
            content: item,
            schema_version: 'fwu-lehrplan-ontologie-v1',
            status: 'draft' as const,
          }
        })
      const { error } = await supabase.from('lpm_data_objects').insert(rows)
      if (error) throw error
      setNotice({ kind: 'ok', text: `Imported ${rows.length} item(s) as drafts. Review and accept them from Explore.` })
      setSelected(new Set())
    } catch (err) {
      setNotice({ kind: 'bad', text: err instanceof Error ? err.message : 'Import failed.' })
    }
    setBusy(false)
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Queries FWU-DE's live public Lehrplan-Ontologie for a German Bundesland's curriculum
        documents. Confirmed live for Sachsen, Bayern, Brandenburg, and Rheinland-Pfalz — other
        Länder may not have data loaded upstream yet.
      </p>
      <NoticeBox notice={notice} onClear={() => setNotice(null)} />

      <div className="grid grid-3">
        <div className="field">
          <label>Bundesland</label>
          <select value={landUri} onChange={(e) => setLandUri(e.target.value)}>
            {FWU_LAENDER.map((l) => (
              <option key={l.uri} value={l.uri}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Subject filter</label>
          <input value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} placeholder="e.g. biolog" />
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={search} disabled={busy}>Search documents</button>
        </div>
      </div>

      {documents && documents.length > 0 && (
        <div className="card">
          <h3>Documents ({documents.length})</h3>
          {documents.map((d) => (
            <div key={d.uri} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 13 }}>{d.title}</span>
              <button className="btn btn-mini" onClick={() => openDocument(d)} disabled={busy}>
                {selectedDoc?.uri === d.uri ? 'Selected' : 'Open'}
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedDoc && candidates.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{selectedDoc.title}</h3>
          <div className="grid grid-2">
            <div className="field">
              <label>Filter by keyword (optional)</label>
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. Evolution" />
            </div>
            <div className="field">
              <label>Grade band label</label>
              <input value={gradeBand} onChange={(e) => setGradeBand(e.target.value)} placeholder="e.g. 9-10" />
            </div>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>{filtered.length} of {candidates.length} items shown.</p>
          <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 10 }}>
            {filtered.map((c) => (
              <label key={c.uri} className="row" style={{ alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
                <input type="checkbox" checked={selected.has(c.uri)} onChange={() => toggle(c.uri)} style={{ marginTop: 3 }} />
                <span style={{ fontSize: 13 }}>{c.label}</span>
              </label>
            ))}
          </div>
          <button className="btn btn-primary" onClick={importSelected} disabled={busy || selected.size === 0}>
            <Upload size={14} /> Import {selected.size || ''} selected item(s) as drafts
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Export

function ExportPanel() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const exportProject = async () => {
    setBusy(true); setNotice(null)
    try {
      const { data, error } = await supabase
        .from('lpm_data_objects')
        .select('title, description, grade_band, subject_area, content, status, created_at')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true })
      if (error) throw error

      const payload = {
        exportedFrom: 'OpenLPM',
        project: { slug: project.slug, name: project.name },
        exportedAt: todayIso(),
        itemCount: data?.length ?? 0,
        items: data ?? [],
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.slug}-openlpm-export-${todayIso()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setNotice({ kind: 'ok', text: `Exported ${payload.itemCount} item(s).` })
    } catch (err) {
      setNotice({ kind: 'bad', text: err instanceof Error ? err.message : 'Export failed.' })
    }
    setBusy(false)
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Downloads every curriculum item in this project as a single JSON file, in the same
        canonical shape used across the OpenEvo ecosystem — importable into another OpenLPM
        project, or read by any tool that understands plain JSON.
      </p>
      <NoticeBox notice={notice} onClear={() => setNotice(null)} />
      <button className="btn btn-primary" onClick={exportProject} disabled={busy}>
        <Download size={14} /> Export this project as JSON
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- page

export default function ImportExportPage() {
  return (
    <div>
      <h1>Import &amp; export</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Bring real curriculum data into this project from a live public standards source, or take
        this project's content elsewhere. New items land as drafts — nothing goes live until
        someone reviews and accepts it.
      </p>
      <TabPanels
        tabs={[
          { label: 'US standards (CASE)', content: <CaseImportPanel /> },
          { label: 'German Lehrplan (MEM-Schule)', content: <FwuImportPanel /> },
          { label: 'Export', content: <ExportPanel /> },
        ]}
      />
    </div>
  )
}
