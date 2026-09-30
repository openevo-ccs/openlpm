import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Copy, Save } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { getLibraryForProject, resolveOptionLists, resolveSectionLabels, type PromptTemplateLibraryRow } from '@/lib/supabase/prompt-libraries'
import { bkEntries, buildBkLabelMap, getRootConcepts } from '@/lib/supabase/basiskonzepte'
import { buildPrompt, defaultConfig, CheckGroup, toggleInList, type Config } from '@/lib/prompt-builder'
import { listTopics, type TopicListItem } from '@/lib/supabase/curriculum'
import { listFavoriteIds } from '@/lib/supabase/favorites'
import { createPromptExperiment, listProjectPromptExperiments, type PromptExperimentRow } from '@/lib/supabase/prompt-experiments'
import { ExperimentCard } from '../portfolios/prompt-generator-page'

type DataObject = Database['public']['Tables']['lpm_data_objects']['Row']
type Scope = 'favoriten' | 'alle' | 'klassenstufe'

// EvoMentor DE v1.2's own real KI-Prompt-Generator picks its scope
// (Umfang: Favoriten / Alle / nach Klassenstufe) directly inside the
// generator itself -- no separate curation step first. The researcher-
// facing OpenLPM generator instead requires items pre-selected into a
// Notebook; matching EvoMentor's real flow here means this page reads
// straight from Lernziele + the student's own favorites (migration 040),
// with no notebook involved -- prompt_experiments.portfolio_id is null for
// exactly this case (see that table's own migration comment).
//
// Real, deliberate guardrail this page adds that EvoMentor DE's own app
// doesn't have: EvoMentor's "Alle" scope with "sehr ausführlich" length can
// silently generate a ~167,000-character prompt with zero warning
// (confirmed live, 2026-09-30 review) -- a live character counter below
// makes that visible before a student copies it out.
export default function StudentPromptPage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const [scope, setScope] = useState<Scope>('favoriten')
  const [gradeFilter, setGradeFilter] = useState<string>('')
  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [fullById, setFullById] = useState<Map<string, DataObject>>(new Map())
  const [library, setLibrary] = useState<PromptTemplateLibraryRow | null | undefined>(undefined)
  const [rootConcepts, setRootConcepts] = useState<{ id: string; label: string }[]>([])
  const [cfg, setCfg] = useState<Config | null>(null)
  const [userId, setUserId] = useState<string>()
  const [experiments, setExperiments] = useState<PromptExperimentRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id))
    getLibraryForProject(supabase, project).then((lib) => {
      setLibrary(lib)
      if (lib) setCfg(defaultConfig(resolveOptionLists(lib.option_lists)))
    })
    getRootConcepts(supabase, project).then(setRootConcepts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project])

  useEffect(() => {
    if (!userId) return
    listProjectPromptExperiments(supabase, project.id, userId).then(setExperiments)
  }, [supabase, project.id, userId])

  // defaultBranchId isn't on ProjectOutletContext's German consumer here --
  // read it the same way project-layout.tsx resolves it, once.
  const [branchId, setBranchId] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('branches').select('id').eq('project_id', project.id).eq('is_trunk', true).maybeSingle()
      .then(({ data }) => setBranchId(data?.id ?? null))
  }, [supabase, project.id])

  useEffect(() => {
    if (!branchId) return
    listTopics(supabase, project.id, branchId).then(setTopics)
    listFavoriteIds(supabase).then(setFavorites)
  }, [supabase, project.id, branchId])

  const grades = useMemo(() => {
    const set = new Set((topics ?? []).map((t) => t.grade_band).filter(Boolean) as string[])
    const leadingNumber = (s: string) => parseInt(s, 10) || 0
    return Array.from(set).sort((a, b) => leadingNumber(a) - leadingNumber(b))
  }, [topics])

  const scopedIds = useMemo(() => {
    if (!topics) return []
    if (scope === 'favoriten') return topics.filter((t) => favorites.has(t.id)).map((t) => t.id)
    if (scope === 'klassenstufe') return topics.filter((t) => t.grade_band === gradeFilter).map((t) => t.id)
    return topics.map((t) => t.id)
  }, [topics, scope, favorites, gradeFilter])

  useEffect(() => {
    const missing = scopedIds.filter((id) => !fullById.has(id))
    if (missing.length === 0) return
    Promise.all(missing.map((id) => supabase.from('lpm_data_objects').select('*').eq('id', id).maybeSingle())).then((rows) => {
      setFullById((prev) => {
        const next = new Map(prev)
        for (const { data } of rows) if (data) next.set(data.id, data)
        return next
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedIds])

  const items = useMemo(() => scopedIds.map((id) => fullById.get(id)).filter((o): o is DataObject => !!o), [scopedIds, fullById])

  const bkIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of items) for (const e of bkEntries(item.content)) ids.add(e.basiskonzept_id)
    return Array.from(ids).sort()
  }, [items])
  const bkLabels = useMemo(() => buildBkLabelMap(bkIds, rootConcepts), [bkIds, rootConcepts])

  const options = useMemo(() => (library ? resolveOptionLists(library.option_lists) : null), [library])
  const labels = useMemo(() => (library ? resolveSectionLabels(library.section_labels) : null), [library])

  const promptText = useMemo(
    () => (items.length && cfg && library && labels && options ? buildPrompt(items, cfg, bkIds, library, labels, options, bkLabels) : ''),
    [items, cfg, bkIds, library, labels, options, bkLabels]
  )

  const reloadExperiments = () => userId && listProjectPromptExperiments(supabase, project.id, userId).then(setExperiments)

  const save = async () => {
    setSaving(true)
    setError(null)
    const { error: err } = await createPromptExperiment(supabase, {
      project_id: project.id,
      portfolio_id: null,
      config: cfg,
      prompt_text: promptText,
    })
    setSaving(false)
    if (err) setError(err.message)
    else reloadExperiments()
  }

  if (library === undefined || !branchId) return <p className="muted">Lädt…</p>

  if (library === null || !cfg || !labels || !options) {
    return (
      <div className="student-page">
        <h1>KI-Prompt-Generator</h1>
        <div className="card empty">
          <p>Für diesen Bereich ist noch keine Prompt-Vorlage eingerichtet.</p>
        </div>
      </div>
    )
  }

  const charCount = promptText.length
  const isLarge = charCount > 20000

  return (
    <div className="student-page">
      <h1>KI-Prompt-Generator</h1>
      <p className="muted" style={{ marginBottom: 16 }}>Unterrichtsvorbereitung mit KI-Unterstützung</p>

      <div className="student-prompt-grid">
        <div className="card student-prompt-card">
          <h3><span className="num">1</span>Lernziel-Auswahl</h3>
          <div className="field">
            <label>Umfang</label>
            <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              <option value="favoriten">Meine Favoriten (★)</option>
              <option value="alle">Alle Lernziele</option>
              <option value="klassenstufe">Nach Klassenstufe</option>
            </select>
          </div>
          {scope === 'klassenstufe' && (
            <div className="field">
              <label>Klassenstufe</label>
              <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
                <option value="">Bitte wählen…</option>
                {grades.map((g) => <option key={g} value={g}>Kl. {g}</option>)}
              </select>
            </div>
          )}
          <p className="muted" style={{ fontSize: 12.5 }}>
            {scope === 'favoriten' && favorites.size === 0
              ? 'Noch keine Favoriten markiert — bei den Lernzielen auf den Stern klicken.'
              : `${items.length} Lernziel${items.length === 1 ? '' : 'e'} ausgewählt.`}
          </p>
        </div>

        <div className="card student-prompt-card">
          <h3><span className="num">2</span>Unterrichtsrahmen</h3>
          <div className="field">
            <label>Klassenstufe(n)</label>
            <input value={cfg.klassenstufe} onChange={(e) => setCfg({ ...cfg, klassenstufe: e.target.value })} placeholder="z. B. 7 oder 7–8" />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Anzahl Unterrichtsstunden</label>
              <input type="number" min={1} value={cfg.stunden} onChange={(e) => setCfg({ ...cfg, stunden: Number(e.target.value) || 1 })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Stundenformat</label>
              <input value={cfg.stundenformat} onChange={(e) => setCfg({ ...cfg, stundenformat: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card student-prompt-card">
          <h3><span className="num">3</span>Basiskonzeptbezug &amp; Vorwissen</h3>
          {bkIds.length === 0 ? (
            <p className="muted">Keine Basiskonzept-Bezüge in den ausgewählten Lernzielen gefunden.</p>
          ) : (
            bkIds.map((bkId) => (
              <div key={bkId} className="field">
                <label>{bkLabels[bkId] ?? bkId} — Vorwissen</label>
                <select
                  value={cfg.vorwissenByBk[bkId] ?? options.prior_knowledge_levels[1]?.[0]}
                  onChange={(e) => setCfg({ ...cfg, vorwissenByBk: { ...cfg.vorwissenByBk, [bkId]: e.target.value } })}
                >
                  {options.prior_knowledge_levels.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))
          )}
        </div>

        <div className="card student-prompt-card">
          <h3><span className="num">4</span>Wissenschaftlich-konzeptueller Fokus</h3>
          <div className="field">
            <label>Zusätzliche fachliche Schwerpunkte</label>
            <textarea value={cfg.fachNotizen} onChange={(e) => setCfg({ ...cfg, fachNotizen: e.target.value })} placeholder="z. B. Schwerpunkt auf molekulare Belege…" />
          </div>
        </div>

        <div className="card student-prompt-card">
          <h3><span className="num">5</span>Didaktische Methoden</h3>
          <CheckGroup options={options.methods} selected={cfg.methoden} onToggle={(v) => setCfg({ ...cfg, methoden: toggleInList(cfg.methoden, v) })} />
          <div style={{ marginTop: 8 }}>
            <CheckGroup options={options.differentiation} selected={cfg.differenzierung} onToggle={(v) => setCfg({ ...cfg, differenzierung: toggleInList(cfg.differenzierung, v) })} />
          </div>
        </div>

        <div className="card student-prompt-card">
          <h3><span className="num">6</span>Evaluation und Leistungserhebung</h3>
          <CheckGroup options={options.assessment} selected={cfg.bewertung} onToggle={(v) => setCfg({ ...cfg, bewertung: toggleInList(cfg.bewertung, v) })} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, position: 'sticky', top: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ marginTop: 0 }}>Vorschau</h3>
          <div className="row">
            <span className="muted" style={{ fontSize: 11.5, color: isLarge ? 'var(--critical)' : undefined }}>
              {charCount.toLocaleString('de-DE')} Zeichen{isLarge ? ' — sehr lang, evtl. Auswahl verkleinern' : ''}
            </span>
            <button className="btn btn-mini" onClick={() => navigator.clipboard.writeText(promptText)}>
              <Copy size={12} />Kopieren
            </button>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="muted">Noch keine Lernziele ausgewählt.</p>
        ) : (
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 420, overflowY: 'auto', margin: 0 }}>{promptText}</pre>
        )}
        {error && <div className="notice notice-bad" style={{ marginTop: 10 }}>{error}</div>}
        {items.length > 0 && (
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={saving}>
            <Save size={14} />{saving ? 'Speichert…' : 'Prompt speichern & Auswertung starten'}
          </button>
        )}
      </div>

      {experiments.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2>Gespeicherte Prompts &amp; Auswertungen</h2>
          {experiments.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} supabase={supabase} isOwner={exp.created_by === userId} onChanged={reloadExperiments} />
          ))}
        </div>
      )}
    </div>
  )
}
