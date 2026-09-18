import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, Save, Trash2 } from 'lucide-react'
import {
  createPromptExperiment,
  deletePromptExperiment,
  getPortfolioCurriculumItems,
  listPromptExperiments,
  updatePromptExperiment,
  type PromptExperimentRow,
} from '@/lib/supabase/prompt-experiments'
import {
  getLibraryForProject,
  resolveOptionLists,
  resolveSectionLabels,
  type PromptOptionLists,
  type PromptTemplateLibraryRow,
  type SectionLabels,
} from '@/lib/supabase/prompt-libraries'
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'

// Built for the Uni Jena Biologiedidaktik pilot (2026-09-17 ask), then
// generalized the same week (2026-09-18 ask): "think about how other users
// in other regions or other working languages can flexibly draw from a
// library of options for generating productive prompt generators." The
// actual role/instruction framing, option vocabularies, and section
// structure below are EvoMentor DE v1.2's own KI-Prompt-Generator, ported
// faithfully (see EvoMentor_DE/apps/evomentor_de_v1_2.html's buildPrompt())
// -- that's still the real, field-tested model this whole page is built
// from. What changed: none of that content is hardcoded in this file
// anymore. It's the first real row in prompt_template_libraries (migration
// 028), and this page renders whatever library the current project points
// at (src/lib/supabase/prompt-libraries.ts). A second project in a
// different language/subject needs a new library row, not a new component.
//
// Deliberate scope line: the GENERATED PROMPT TEXT (what actually gets
// copied to an LLM) is fully library-driven -- role/instruction preamble,
// every section header, every option vocabulary. The FORM around it (this
// page's own field labels, the Save/Copy buttons) stays in OpenLPM's own
// English app-shell language, matching every other page in the app --
// translating the app's own UI chrome is a separate, whole-app concern,
// not something to half-solve on one page.
//
// Still does NOT call any LLM itself -- students test the generated prompt
// on whichever LLM they choose, outside this app, then record what they
// found (llm_name/llm_output/evaluation_notes below).
//
// Reads real lpm_data_objects content defensively: only `title`,
// `description`, `grade_band` (real columns) and `content.basiskonzeptbezug`
// (confirmed live in concepts-page.tsx's own reader) are treated as always
// present. Richer fields EvoMentor DE's own data sometimes carries
// (didaktische_strategien, originaltext) are used when present and quietly
// skipped when not.

type DataObject = Database['public']['Tables']['lpm_data_objects']['Row']

interface BkbEntry {
  basiskonzept_id: string
  relevanz_beurteilung: number
  begruendung: string
  relevante_unterkonzepte_taxonomie?: { value: string }[]
  relevante_evolutionskonzepte_taxonomie?: { value: string }[]
}

interface Config {
  klassenstufe: string
  stunden: number
  stundenformat: string
  vorwissenByBk: Record<string, string>
  fachNotizen: string
  methoden: string[]
  differenzierung: string[]
  didNotizen: string
  bewertung: string[]
  evalNotizen: string
  kontext: string[]
  kontextNotizen: string
  ausgabeTyp: string[]
  ton: string
  laenge: string
  sonstigeNotizen: string
}

function defaultConfig(options: PromptOptionLists): Config {
  return {
    klassenstufe: '', stunden: 4, stundenformat: '45',
    vorwissenByBk: {}, fachNotizen: '',
    methoden: [], differenzierung: [], didNotizen: '',
    bewertung: [...options.default_assessment], evalNotizen: '',
    kontext: [], kontextNotizen: '',
    ausgabeTyp: [...options.default_output_types],
    ton: options.default_tone, laenge: options.default_length, sonstigeNotizen: '',
  }
}

function bkEntries(obj: DataObject): BkbEntry[] {
  return ((obj.content as any)?.basiskonzeptbezug ?? []) as BkbEntry[]
}

function buildPrompt(
  items: DataObject[],
  cfg: Config,
  bkIds: string[],
  library: PromptTemplateLibraryRow,
  labels: SectionLabels,
  options: PromptOptionLists
): string {
  const lines: string[] = []
  lines.push('='.repeat(70))
  lines.push(labels.title)
  lines.push('='.repeat(70))
  lines.push('')
  lines.push(library.role_preamble)
  lines.push(library.instruction_preamble)
  lines.push('')
  lines.push(`${labels.grade_label} ${cfg.klassenstufe || '—'}    ${labels.hours_label} ${cfg.stunden} × ${cfg.stundenformat}`)
  lines.push('')
  lines.push(labels.concepts_section)
  for (const bkId of bkIds) {
    const vw = options.prior_knowledge_levels.find((v) => v[0] === (cfg.vorwissenByBk[bkId] ?? options.prior_knowledge_levels[1]?.[0]))
    lines.push(`- ${bkId}: ${vw ? vw[1] : '—'}`)
  }
  if (cfg.fachNotizen) lines.push(`${labels.extra_focus_label} ${cfg.fachNotizen}`)
  lines.push('')
  lines.push(`${labels.items_section} (${items.length}):`)
  lines.push('-'.repeat(70))
  for (const item of items) {
    const c = item.content as any
    lines.push(`\n[${item.id.slice(0, 8)}] ${item.title} (${item.grade_band ?? '?'})`)
    lines.push(`  ${labels.statement_label} ${c?.originaltext ?? item.description ?? ''}`)
    for (const entry of bkEntries(item)) {
      if (!bkIds.includes(entry.basiskonzept_id)) continue
      lines.push(`  ${entry.basiskonzept_id} (${labels.relevance_label} ${entry.relevanz_beurteilung}/3): ${entry.begruendung}`)
      const uk = (entry.relevante_unterkonzepte_taxonomie ?? []).map((u) => u.value)
      if (uk.length) lines.push(`    ${labels.subconcepts_label} ${uk.join(', ')}`)
      const ek = (entry.relevante_evolutionskonzepte_taxonomie ?? []).map((e) => e.value)
      if (ek.length) lines.push(`    ${labels.evoconcepts_label} ${ek.join(', ')}`)
    }
    if (c?.didaktische_strategien) {
      const ds = c.didaktische_strategien
      if (ds.evolutionsdidaktischer_impuls) lines.push(`  ${ds.evolutionsdidaktischer_impuls}`)
      if (ds.top3_methoden?.length) lines.push(`  ${labels.methods_section} ${ds.top3_methoden.map((m: any) => m.methode).join(', ')}`)
      if (ds.moegliche_fehlvorstellungen) lines.push(`  ${ds.moegliche_fehlvorstellungen}`)
    }
  }
  lines.push('')
  lines.push('-'.repeat(70))
  if (cfg.methoden.length) lines.push(`${labels.methods_section} ${cfg.methoden.join(', ')}`)
  if (cfg.differenzierung.length) lines.push(`${labels.differentiation_section} ${cfg.differenzierung.join(', ')}`)
  if (cfg.didNotizen) lines.push(`${labels.didactic_notes_label} ${cfg.didNotizen}`)
  if (cfg.bewertung.length) lines.push(`${labels.assessment_section} ${cfg.bewertung.join(', ')}`)
  if (cfg.evalNotizen) lines.push(`${labels.eval_notes_label} ${cfg.evalNotizen}`)
  if (cfg.kontext.length) lines.push(`${labels.context_section} ${cfg.kontext.join(', ')}`)
  if (cfg.kontextNotizen) lines.push(`${labels.context_notes_label} ${cfg.kontextNotizen}`)
  lines.push('')
  lines.push(labels.output_section)
  lines.push(`- ${labels.tone_label} ${cfg.ton}, ${labels.length_label} ${cfg.laenge}`)
  for (const t of cfg.ausgabeTyp) lines.push(`- ${t}`)
  if (cfg.sonstigeNotizen) lines.push(`- ${labels.other_notes_label} ${cfg.sonstigeNotizen}`)
  return lines.join('\n')
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function CheckGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => (
        <label key={o} className="row" style={{ gap: 4, fontSize: 12 }}>
          <input type="checkbox" checked={selected.includes(o)} onChange={() => onToggle(o)} />
          {o}
        </label>
      ))}
    </div>
  )
}

export default function PromptGeneratorPage() {
  const { project, slug, supabase } = useOutletContext<ProjectOutletContext>()
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const [items, setItems] = useState<DataObject[] | null>(null)
  const [library, setLibrary] = useState<PromptTemplateLibraryRow | null | undefined>(undefined)
  const [experiments, setExperiments] = useState<PromptExperimentRow[]>([])
  const [cfg, setCfg] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>()

  useEffect(() => {
    if (!portfolioId) return
    getPortfolioCurriculumItems(supabase, portfolioId).then(setItems)
    listPromptExperiments(supabase, portfolioId).then(setExperiments)
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id))
    getLibraryForProject(supabase, project).then((lib) => {
      setLibrary(lib)
      if (lib) setCfg(defaultConfig(resolveOptionLists(lib.option_lists)))
    })
  }, [supabase, portfolioId, project])

  const options = useMemo(() => (library ? resolveOptionLists(library.option_lists) : null), [library])
  const labels = useMemo(() => (library ? resolveSectionLabels(library.section_labels) : null), [library])

  const bkIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of items ?? []) for (const e of bkEntries(item)) ids.add(e.basiskonzept_id)
    return Array.from(ids).sort()
  }, [items])

  const promptText = useMemo(
    () => (items && cfg && library && labels && options ? buildPrompt(items, cfg, bkIds, library, labels, options) : ''),
    [items, cfg, bkIds, library, labels, options]
  )

  const reloadExperiments = () => portfolioId && listPromptExperiments(supabase, portfolioId).then(setExperiments)

  const save = async () => {
    if (!portfolioId) return
    setSaving(true)
    setError(null)
    const { error: err } = await createPromptExperiment(supabase, {
      project_id: project.id,
      portfolio_id: portfolioId,
      config: cfg,
      prompt_text: promptText,
    })
    setSaving(false)
    if (err) setError(err.message)
    else reloadExperiments()
  }

  if (items === null || library === undefined) return <p className="muted">Loading…</p>

  if (library === null || !cfg || !labels || !options) {
    return (
      <div>
        <Link to={`/dashboard/${slug}/notebooks/${portfolioId}`} className="row muted" style={{ marginBottom: 12 }}>
          <ArrowLeft size={14} />
          Back to notebook
        </Link>
        <div className="card empty">
          <p>No prompt-generator library is set up for this project yet.</p>
          <p className="muted">
            A curator needs to add one for this project's working language/subject (see
            prompt_template_libraries) — this isn't a per-project setting anyone can toggle from here yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link to={`/dashboard/${slug}/notebooks/${portfolioId}`} className="row muted" style={{ marginBottom: 12 }}>
        <ArrowLeft size={14} />
        Back to notebook
      </Link>
      <h1>AI Prompt Generator</h1>
      <p className="muted" style={{ marginBottom: 4 }}>
        Builds a structured teaching-prep prompt ({library.label}) from this notebook's {items.length} selected
        curriculum item{items.length === 1 ? '' : 's'}. Test the result on any LLM you choose — outside this app —
        then come back and record what you found below.
      </p>

      {items.length === 0 ? (
        <div className="card empty">
          <p>This notebook has no curriculum items yet — add some from Learning Goals or Concepts first.</p>
        </div>
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Settings</h3>

            <div className="field">
              <label>Grade level(s)</label>
              <input value={cfg.klassenstufe} onChange={(e) => setCfg({ ...cfg, klassenstufe: e.target.value })} placeholder="e.g. 8" />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Lesson hours</label>
                <input type="number" min={1} value={cfg.stunden} onChange={(e) => setCfg({ ...cfg, stunden: Number(e.target.value) || 1 })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Format</label>
                <input value={cfg.stundenformat} onChange={(e) => setCfg({ ...cfg, stundenformat: e.target.value })} />
              </div>
            </div>

            <h3>Concept focus & prior knowledge</h3>
            {bkIds.length === 0 && <p className="muted">No concept tags found on the selected items.</p>}
            {bkIds.map((bkId) => (
              <div key={bkId} className="field">
                <label>{bkId}</label>
                <select
                  value={cfg.vorwissenByBk[bkId] ?? options.prior_knowledge_levels[1]?.[0]}
                  onChange={(e) => setCfg({ ...cfg, vorwissenByBk: { ...cfg.vorwissenByBk, [bkId]: e.target.value } })}
                >
                  {options.prior_knowledge_levels.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            ))}
            <div className="field">
              <label>Additional subject-matter focus</label>
              <textarea value={cfg.fachNotizen} onChange={(e) => setCfg({ ...cfg, fachNotizen: e.target.value })} />
            </div>

            <h3>Methods & differentiation</h3>
            <CheckGroup options={options.methods} selected={cfg.methoden} onToggle={(v) => setCfg({ ...cfg, methoden: toggle(cfg.methoden, v) })} />
            <div style={{ marginTop: 8 }}>
              <CheckGroup options={options.differentiation} selected={cfg.differenzierung} onToggle={(v) => setCfg({ ...cfg, differenzierung: toggle(cfg.differenzierung, v) })} />
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label>Teaching notes</label>
              <textarea value={cfg.didNotizen} onChange={(e) => setCfg({ ...cfg, didNotizen: e.target.value })} />
            </div>

            <h3>Assessment</h3>
            <CheckGroup options={options.assessment} selected={cfg.bewertung} onToggle={(v) => setCfg({ ...cfg, bewertung: toggle(cfg.bewertung, v) })} />
            <div className="field" style={{ marginTop: 8 }}>
              <label>Assessment notes</label>
              <textarea value={cfg.evalNotizen} onChange={(e) => setCfg({ ...cfg, evalNotizen: e.target.value })} />
            </div>

            <h3>Societal context</h3>
            <CheckGroup options={options.societal_context} selected={cfg.kontext} onToggle={(v) => setCfg({ ...cfg, kontext: toggle(cfg.kontext, v) })} />
            <div className="field" style={{ marginTop: 8 }}>
              <label>Further notes</label>
              <textarea value={cfg.kontextNotizen} onChange={(e) => setCfg({ ...cfg, kontextNotizen: e.target.value })} />
            </div>

            <h3>Desired output</h3>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Tone</label>
                <select value={cfg.ton} onChange={(e) => setCfg({ ...cfg, ton: e.target.value })}>
                  {options.tones.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Length</label>
                <select value={cfg.laenge} onChange={(e) => setCfg({ ...cfg, laenge: e.target.value })}>
                  {options.lengths.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <CheckGroup options={options.output_types} selected={cfg.ausgabeTyp} onToggle={(v) => setCfg({ ...cfg, ausgabeTyp: toggle(cfg.ausgabeTyp, v) })} />
            <div className="field" style={{ marginTop: 8 }}>
              <label>Other notes</label>
              <textarea value={cfg.sonstigeNotizen} onChange={(e) => setCfg({ ...cfg, sonstigeNotizen: e.target.value })} />
            </div>

            {error && <div className="notice notice-bad" style={{ marginTop: 10 }}>{error}</div>}
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={saving}>
              <Save size={14} />
              {saving ? 'Saving…' : 'Save this prompt & start an evaluation'}
            </button>
          </div>

          <div className="card" style={{ position: 'sticky', top: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ marginTop: 0 }}>Preview</h3>
              <button className="btn btn-mini" onClick={() => navigator.clipboard.writeText(promptText)}>
                <Copy size={12} />
                Copy
              </button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 500, overflowY: 'auto', margin: 0 }}>{promptText}</pre>
          </div>
        </div>
      )}

      {experiments.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2>Saved prompts & evaluations</h2>
          {experiments.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} supabase={supabase} isOwner={exp.created_by === userId} onChanged={reloadExperiments} />
          ))}
        </div>
      )}
    </div>
  )
}

function ExperimentCard({
  experiment,
  supabase,
  isOwner,
  onChanged,
}: {
  experiment: PromptExperimentRow
  supabase: ProjectOutletContext['supabase']
  isOwner: boolean
  onChanged: () => void
}) {
  const [llmName, setLlmName] = useState(experiment.llm_name ?? '')
  const [llmOutput, setLlmOutput] = useState(experiment.llm_output ?? '')
  const [evalNotes, setEvalNotes] = useState(experiment.evaluation_notes ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    await updatePromptExperiment(supabase, experiment.id, { llm_name: llmName || null, llm_output: llmOutput || null, evaluation_notes: evalNotes || null })
    setBusy(false)
    onChanged()
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="muted">{new Date(experiment.created_at).toLocaleString()}</span>
        {isOwner && (
          <button className="btn btn-mini" onClick={() => deletePromptExperiment(supabase, experiment.id).then(onChanged)}>
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <details>
        <summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>View the prompt that was sent</summary>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{experiment.prompt_text}</pre>
      </details>
      {isOwner ? (
        <div style={{ marginTop: 8 }}>
          <div className="field">
            <label>Which LLM did you test this on?</label>
            <input value={llmName} onChange={(e) => setLlmName(e.target.value)} placeholder="e.g. ChatGPT-5, Claude, Gemini" />
          </div>
          <div className="field">
            <label>What did it produce? (paste the output)</label>
            <textarea value={llmOutput} onChange={(e) => setLlmOutput(e.target.value)} style={{ minHeight: 120 }} />
          </div>
          <div className="field">
            <label>Your evaluation</label>
            <textarea value={evalNotes} onChange={(e) => setEvalNotes(e.target.value)} placeholder="Was it accurate? Useful? What would you change?" />
          </div>
          <button className="btn btn-mini" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save evaluation'}</button>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {experiment.llm_name && <p><strong>{experiment.llm_name}</strong></p>}
          {experiment.evaluation_notes && <p className="muted">{experiment.evaluation_notes}</p>}
        </div>
      )}
    </div>
  )
}
