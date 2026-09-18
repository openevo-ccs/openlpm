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
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'

// Built for the Uni Jena Biologiedidaktik pilot (starting ~6 weeks out,
// 2026-09-17 ask): generate a structured German teaching-prep prompt from a
// Notebook's selected Lehrplan-evolution connections, in the same shape and
// language EvoMentor DE v1.2's own KI-Prompt-Generator produces (see
// EvoMentor_DE/apps/evomentor_de_v1_2.html's buildPrompt() -- ported
// directly, not reinvented, since that's the exact tool Dustin wants
// replicated). Deliberately does NOT call any LLM itself -- students test
// the generated prompt on whichever LLM they choose, outside this app, then
// come back and record what they found (llm_name/llm_output/
// evaluation_notes below) -- an explicit scope decision, not an oversight.
//
// Reads real lpm_data_objects content defensively: only `title`,
// `description`, `grade_band` (real columns) and `content.basiskonzeptbezug`
// (confirmed live in concepts-page.tsx's own reader) are treated as always
// present. Richer fields EvoMentor DE's own data sometimes carries
// (didaktische_strategien, originaltext) are used when present and quietly
// skipped when not, rather than assumed -- nothing in this codebase reads
// them today, so their survival through the Thuringia import wasn't
// independently confirmed this session.

type DataObject = Database['public']['Tables']['lpm_data_objects']['Row']

interface BkbEntry {
  basiskonzept_id: string
  relevanz_beurteilung: number
  begruendung: string
  relevante_unterkonzepte_taxonomie?: { value: string }[]
  relevante_evolutionskonzepte_taxonomie?: { value: string }[]
}

const METHODEN = ['Forschendes Lernen', 'Analogien und Vergleiche', 'Konzeptuelles Lernen', 'Diskussion', 'Narrativer Zugang', 'Modelle und Simulationen', 'Erfahrungsbasiertes Lernen', 'Digitale Medien', 'Einblick in Wissenschaftsgeschichte', 'Recherche', 'Kooperative Lernformen', 'Projektbasiertes Lernen']
const DIFFERENZIERUNG = ['Basis- und Erweiterungsaufgaben', 'Sprachliche Differenzierung', 'Unterschiedliche Lerntempi']
const BEWERTUNG = ['Formative Beurteilung (laufend)', 'Quiz', 'Präsentationen, Poster, Flyer', 'Schriftliche Reflexion', 'Portfolio / Lerntagebuch', 'Klassenarbeit / LEK', 'Praktische Leistungen']
const KONTEXT = ['Biodiversitätskrise', 'Naturschutz und Arterhaltung', 'Klimawandel und Artenanpassung', 'Pandemien und Virusevolution', 'Gesundheit und evolutionäre Medizin', 'Antibiotikaresistenz', 'Psychische Gesundheit', 'Landwirtschaft und Lebensmittelherstellung', 'Biotechnologie und Gentechnik']
const AUSGABE = ['Vollständige Unterrichtssequenz mit Verlaufsplänen', 'Operationalisierte Lernziele pro Stunde', 'Methodische Vorschläge pro Stunde', 'Hinweise auf Materialien / Medien', 'Schülerfehlvorstellungen', 'Differenzierungsvorschläge', 'Transfer- und Diskussionsfragen', 'Querverbindungen zwischen Lernzielen']
const VORWISSEN: [string, string][] = [['keins', 'Kein Vorwissen'], ['grundlagen', 'Grundbegriffe bekannt'], ['solide', 'Solides Grundwissen']]

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

const DEFAULT_CONFIG: Config = {
  klassenstufe: '', stunden: 4, stundenformat: '45',
  vorwissenByBk: {}, fachNotizen: '',
  methoden: [], differenzierung: [], didNotizen: '',
  bewertung: ['Formative Beurteilung (laufend)'], evalNotizen: '',
  kontext: [], kontextNotizen: '',
  ausgabeTyp: ['Vollständige Unterrichtssequenz mit Verlaufsplänen', 'Methodische Vorschläge pro Stunde', 'Transfer- und Diskussionsfragen'],
  ton: 'professionell', laenge: 'ausführlich', sonstigeNotizen: '',
}

function bkEntries(obj: DataObject): BkbEntry[] {
  return ((obj.content as any)?.basiskonzeptbezug ?? []) as BkbEntry[]
}

function buildPrompt(items: DataObject[], cfg: Config, bkIds: string[]): string {
  const lines: string[] = []
  lines.push('='.repeat(70))
  lines.push('UNTERRICHTSVORBEREITUNG MIT BASISKONZEPT-INTEGRATION')
  lines.push('='.repeat(70))
  lines.push('')
  lines.push('Du bist eine erfahrene Biologie-Lehrkraft und Fachdidaktikerin. Erstelle')
  lines.push('auf Basis der folgenden Lernziele eine konkrete Unterrichtsplanung, die')
  lines.push('die unten genannten Basiskonzepte gezielt einbindet, ohne den Kernlehrplan')
  lines.push('zu verlassen.')
  lines.push('')
  lines.push(`Klassenstufe(n): ${cfg.klassenstufe || '(siehe Lernziele)'}    Unterrichtsstunden: ${cfg.stunden} × ${cfg.stundenformat} Min.`)
  lines.push('')
  lines.push('BASISKONZEPTBEZUG & VORWISSEN:')
  for (const bkId of bkIds) {
    const vw = VORWISSEN.find((v) => v[0] === (cfg.vorwissenByBk[bkId] ?? 'grundlagen'))
    lines.push(`- ${bkId}: ${vw ? vw[1] : 'unbekannt'}`)
  }
  if (cfg.fachNotizen) lines.push(`Zusätzliche fachliche Schwerpunkte: ${cfg.fachNotizen}`)
  lines.push('')
  lines.push(`LERNZIELE (${items.length}):`)
  lines.push('-'.repeat(70))
  for (const item of items) {
    const c = item.content as any
    lines.push(`\n[${item.id.slice(0, 8)}] ${item.title} (${item.grade_band ?? '?'})`)
    lines.push(`  Wortlaut: ${c?.originaltext ?? item.description ?? '(keine Beschreibung)'}`)
    for (const entry of bkEntries(item)) {
      if (!bkIds.includes(entry.basiskonzept_id)) continue
      lines.push(`  ${entry.basiskonzept_id} (Relevanz ${entry.relevanz_beurteilung}/3): ${entry.begruendung}`)
      const uk = (entry.relevante_unterkonzepte_taxonomie ?? []).map((u) => u.value)
      if (uk.length) lines.push(`    Unterkonzepte: ${uk.join(', ')}`)
      const ek = (entry.relevante_evolutionskonzepte_taxonomie ?? []).map((e) => e.value)
      if (ek.length) lines.push(`    Evolutionskonzepte: ${ek.join(', ')}`)
    }
    if (c?.didaktische_strategien) {
      const ds = c.didaktische_strategien
      if (ds.evolutionsdidaktischer_impuls) lines.push(`  Leitfrage: ${ds.evolutionsdidaktischer_impuls}`)
      if (ds.top3_methoden?.length) lines.push(`  Methoden: ${ds.top3_methoden.map((m: any) => m.methode).join(', ')}`)
      if (ds.moegliche_fehlvorstellungen) lines.push(`  Fehlvorstellungen: ${ds.moegliche_fehlvorstellungen}`)
    }
  }
  lines.push('')
  lines.push('-'.repeat(70))
  if (cfg.methoden.length) lines.push(`WEITERE METHODEN: ${cfg.methoden.join(', ')}`)
  if (cfg.differenzierung.length) lines.push(`DIFFERENZIERUNG: ${cfg.differenzierung.join(', ')}`)
  if (cfg.didNotizen) lines.push(`Didaktische Hinweise: ${cfg.didNotizen}`)
  if (cfg.bewertung.length) lines.push(`EVALUATION: ${cfg.bewertung.join(', ')}`)
  if (cfg.evalNotizen) lines.push(`Hinweise zur Evaluation: ${cfg.evalNotizen}`)
  if (cfg.kontext.length) lines.push(`GESELLSCHAFTLICHE BEZÜGE: ${cfg.kontext.join(', ')}`)
  if (cfg.kontextNotizen) lines.push(`Weitere Hinweise: ${cfg.kontextNotizen}`)
  lines.push('')
  lines.push('GEWÜNSCHTE AUSGABE:')
  lines.push(`- Ton: ${cfg.ton}, Länge: ${cfg.laenge}`)
  for (const t of cfg.ausgabeTyp) lines.push(`- ${t}`)
  if (cfg.sonstigeNotizen) lines.push(`- Sonstige Hinweise: ${cfg.sonstigeNotizen}`)
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
  const [experiments, setExperiments] = useState<PromptExperimentRow[]>([])
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>()

  useEffect(() => {
    if (!portfolioId) return
    getPortfolioCurriculumItems(supabase, portfolioId).then(setItems)
    listPromptExperiments(supabase, portfolioId).then(setExperiments)
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id))
  }, [supabase, portfolioId])

  const bkIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of items ?? []) for (const e of bkEntries(item)) ids.add(e.basiskonzept_id)
    return Array.from(ids).sort()
  }, [items])

  const promptText = useMemo(() => (items ? buildPrompt(items, cfg, bkIds) : ''), [items, cfg, bkIds])

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

  if (items === null) return <p className="muted">Loading…</p>

  return (
    <div>
      <Link to={`/dashboard/${slug}/notebooks/${portfolioId}`} className="row muted" style={{ marginBottom: 12 }}>
        <ArrowLeft size={14} />
        Back to notebook
      </Link>
      <h1>KI-Prompt-Generator</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Builds a structured German teaching-prep prompt from this notebook's {items.length} selected curriculum
        item{items.length === 1 ? '' : 's'}. Test the result on any LLM you choose — outside this app — then come back
        and record what you found below.
      </p>

      {items.length === 0 ? (
        <div className="card empty">
          <p>This notebook has no curriculum items yet — add some from Learning Goals or Concepts first.</p>
        </div>
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Einstellungen</h3>

            <div className="field">
              <label>Klassenstufe(n)</label>
              <input value={cfg.klassenstufe} onChange={(e) => setCfg({ ...cfg, klassenstufe: e.target.value })} placeholder="z.B. 8" />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Unterrichtsstunden</label>
                <input type="number" min={1} value={cfg.stunden} onChange={(e) => setCfg({ ...cfg, stunden: Number(e.target.value) || 1 })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Format (Min.)</label>
                <input value={cfg.stundenformat} onChange={(e) => setCfg({ ...cfg, stundenformat: e.target.value })} />
              </div>
            </div>

            <h3>Basiskonzepte & Vorwissen</h3>
            {bkIds.length === 0 && <p className="muted">Keine Basiskonzeptbezüge in den ausgewählten Elementen gefunden.</p>}
            {bkIds.map((bkId) => (
              <div key={bkId} className="field">
                <label>{bkId}</label>
                <select
                  value={cfg.vorwissenByBk[bkId] ?? 'grundlagen'}
                  onChange={(e) => setCfg({ ...cfg, vorwissenByBk: { ...cfg.vorwissenByBk, [bkId]: e.target.value } })}
                >
                  {VORWISSEN.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            ))}
            <div className="field">
              <label>Zusätzliche fachliche Schwerpunkte</label>
              <textarea value={cfg.fachNotizen} onChange={(e) => setCfg({ ...cfg, fachNotizen: e.target.value })} />
            </div>

            <h3>Methoden & Differenzierung</h3>
            <CheckGroup options={METHODEN} selected={cfg.methoden} onToggle={(v) => setCfg({ ...cfg, methoden: toggle(cfg.methoden, v) })} />
            <div style={{ marginTop: 8 }}>
              <CheckGroup options={DIFFERENZIERUNG} selected={cfg.differenzierung} onToggle={(v) => setCfg({ ...cfg, differenzierung: toggle(cfg.differenzierung, v) })} />
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label>Didaktische Hinweise</label>
              <textarea value={cfg.didNotizen} onChange={(e) => setCfg({ ...cfg, didNotizen: e.target.value })} />
            </div>

            <h3>Bewertung</h3>
            <CheckGroup options={BEWERTUNG} selected={cfg.bewertung} onToggle={(v) => setCfg({ ...cfg, bewertung: toggle(cfg.bewertung, v) })} />

            <h3>Gesellschaftliche Bezüge</h3>
            <CheckGroup options={KONTEXT} selected={cfg.kontext} onToggle={(v) => setCfg({ ...cfg, kontext: toggle(cfg.kontext, v) })} />

            <h3>Gewünschte Ausgabe</h3>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Ton</label>
                <select value={cfg.ton} onChange={(e) => setCfg({ ...cfg, ton: e.target.value })}>
                  <option value="professionell">Professionell</option>
                  <option value="locker">Locker</option>
                  <option value="wissenschaftlich">Wissenschaftlich</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Länge</label>
                <select value={cfg.laenge} onChange={(e) => setCfg({ ...cfg, laenge: e.target.value })}>
                  <option value="kurz">Kurz</option>
                  <option value="ausführlich">Ausführlich</option>
                </select>
              </div>
            </div>
            <CheckGroup options={AUSGABE} selected={cfg.ausgabeTyp} onToggle={(v) => setCfg({ ...cfg, ausgabeTyp: toggle(cfg.ausgabeTyp, v) })} />

            {error && <div className="notice notice-bad" style={{ marginTop: 10 }}>{error}</div>}
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={saving}>
              <Save size={14} />
              {saving ? 'Speichern…' : 'Save this prompt & start an evaluation'}
            </button>
          </div>

          <div className="card" style={{ position: 'sticky', top: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ marginTop: 0 }}>Vorschau</h3>
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
