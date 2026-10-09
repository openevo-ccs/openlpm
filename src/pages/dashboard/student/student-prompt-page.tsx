import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Copy, Save } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import type { Database } from '@/lib/supabase/database.types'
import { getLibraryForProject, resolveOptionLists, resolveSectionLabels, type PromptTemplateLibraryRow } from '@/lib/supabase/prompt-libraries'
import { bkAbbreviation, bkEntries, buildBkLabelMap, getRootConcepts, groupBkIdsByRoot } from '@/lib/supabase/basiskonzepte'
import { buildPrompt, defaultConfig, deriveKlassenstufe, groupLinksByMethod, isBkFocused, toggleBkFocus, CheckGroup, MethodConceptChips, PercentChips, toggleInList, type Config } from '@/lib/prompt-builder'
import { listTopics, type TopicListItem } from '@/lib/supabase/curriculum'
import { listFavoriteIds, listFavoriteMethodKeys, toggleFavoriteMethod } from '@/lib/supabase/favorites'
import { listMethodConceptLinks, type MethodConceptLink } from '@/lib/supabase/method-concept-links'
import { createPromptExperiment, listProjectPromptExperiments, type PromptExperimentRow } from '@/lib/supabase/prompt-experiments'
import { ExperimentCard } from '../portfolios/prompt-generator-page'

type DataObject = Database['public']['Tables']['lpm_data_objects']['Row']
type Scope = 'favoriten' | 'alle' | 'klassenstufe' | 'auswahl'

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
//
// Real feedback 2026-10-01 (Susan, previewing as a student): "Klassenstufe"
// alone still left too many Lernziele to make sense of ("all learning goals
// of one grade is too many") -- she wanted to narrow by individual topic,
// subtopic, and learning goal. Two additions, not a replacement: Thema/
// Unterthema dropdowns narrow "Klassenstufe" further (reusing the real
// thema/unterthema fields listTopics already reads out of each row's own
// content, the same fields the researcher Browse tab's search already
// matches against), and a new "Direkt auswählen" scope adds a real
// pick-any-combination checklist for full manual control, independent of
// favoriting.
export default function StudentPromptPage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const [scope, setScope] = useState<Scope>('favoriten')
  const [gradeFilter, setGradeFilter] = useState<string>('')
  const [themaFilter, setThemaFilter] = useState<string>('')
  const [unterthemaFilter, setUnterthemaFilter] = useState<string>('')
  // Real feedback 2026-10-01: narrowing by Klassenstufe/Thema/Unterthema was
  // all-or-nothing -- Susan wanted to exclude a handful of individual
  // Lernziele from within that already-narrowed range, not just accept the
  // whole set or switch to the separate "Direkt auswählen" scope.
  const [deselectedInRange, setDeselectedInRange] = useState<Set<string>>(new Set())
  const [manualSelection, setManualSelection] = useState<Set<string>>(new Set())
  const [auswahlQuery, setAuswahlQuery] = useState('')
  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [favoriteMethods, setFavoriteMethods] = useState<Set<string>>(new Set())
  const [fullById, setFullById] = useState<Map<string, DataObject>>(new Map())
  const [library, setLibrary] = useState<PromptTemplateLibraryRow | null | undefined>(undefined)
  const [rootConcepts, setRootConcepts] = useState<{ id: string; label: string }[]>([])
  const [cfg, setCfg] = useState<Config | null>(null)
  const [userId, setUserId] = useState<string>()
  const [experiments, setExperiments] = useState<PromptExperimentRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [methodLinks, setMethodLinks] = useState<MethodConceptLink[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id))
    getLibraryForProject(supabase, project).then((lib) => {
      setLibrary(lib)
      if (lib) setCfg(defaultConfig(resolveOptionLists(lib.option_lists)))
    })
    getRootConcepts(supabase, project).then(setRootConcepts)
    listMethodConceptLinks(supabase, project.id).then(setMethodLinks)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project])

  const linksByMethod = useMemo(() => groupLinksByMethod(methodLinks), [methodLinks])

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
    listFavoriteMethodKeys(supabase).then(setFavoriteMethods)
  }, [supabase, project.id, branchId])

  const onToggleFavoriteMethod = async (methodKey: string) => {
    const isFav = favoriteMethods.has(methodKey)
    setFavoriteMethods((prev) => {
      const next = new Set(prev)
      if (isFav) next.delete(methodKey)
      else next.add(methodKey)
      return next
    })
    await toggleFavoriteMethod(supabase, methodKey, isFav)
  }

  const grades = useMemo(() => {
    const set = new Set((topics ?? []).map((t) => t.grade_band).filter(Boolean) as string[])
    const leadingNumber = (s: string) => parseInt(s, 10) || 0
    return Array.from(set).sort((a, b) => leadingNumber(a) - leadingNumber(b))
  }, [topics])

  // Thema options narrow to the currently-picked grade (if any); Unterthema
  // options narrow to the currently-picked grade AND thema -- each level
  // only ever offers choices that can actually return something.
  const themen = useMemo(() => {
    const relevant = (topics ?? []).filter((t) => !gradeFilter || t.grade_band === gradeFilter)
    return Array.from(new Set(relevant.map((t) => t.thema).filter(Boolean) as string[])).sort()
  }, [topics, gradeFilter])

  const unterthemen = useMemo(() => {
    if (!themaFilter) return []
    const relevant = (topics ?? []).filter((t) => (!gradeFilter || t.grade_band === gradeFilter) && t.thema === themaFilter)
    return Array.from(new Set(relevant.map((t) => t.unterthema).filter(Boolean) as string[])).sort()
  }, [topics, gradeFilter, themaFilter])

  const auswahlResults = useMemo(() => {
    if (!topics) return []
    const q = auswahlQuery.trim().toLowerCase()
    return topics.filter((t) => {
      if (gradeFilter && t.grade_band !== gradeFilter) return false
      if (!q) return true
      return t.title.toLowerCase().includes(q) || (t.thema ?? '').toLowerCase().includes(q) || (t.unterthema ?? '').toLowerCase().includes(q)
    })
  }, [topics, gradeFilter, auswahlQuery])

  const toggleManual = (id: string) => {
    setManualSelection((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rangeMatches = useMemo(() => {
    if (!topics || !gradeFilter) return []
    return topics
      .filter((t) => t.grade_band === gradeFilter)
      .filter((t) => !themaFilter || t.thema === themaFilter)
      .filter((t) => !unterthemaFilter || t.unterthema === unterthemaFilter)
  }, [topics, gradeFilter, themaFilter, unterthemaFilter])

  // A range match that gets excluded drops out when the range itself
  // changes underneath it (new grade/thema/unterthema) -- an id excluded
  // from one range shouldn't silently stay excluded from an unrelated one.
  useEffect(() => {
    setDeselectedInRange((prev) => {
      const validIds = new Set(rangeMatches.map((t) => t.id))
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [rangeMatches])

  const toggleDeselected = (id: string) => {
    setDeselectedInRange((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const scopedIds = useMemo(() => {
    if (!topics) return []
    if (scope === 'favoriten') return topics.filter((t) => favorites.has(t.id)).map((t) => t.id)
    if (scope === 'auswahl') return topics.filter((t) => manualSelection.has(t.id)).map((t) => t.id)
    if (scope === 'klassenstufe') return rangeMatches.filter((t) => !deselectedInRange.has(t.id)).map((t) => t.id)
    return topics.map((t) => t.id)
  }, [topics, scope, favorites, manualSelection, rangeMatches, deselectedInRange])

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

  useEffect(() => {
    if (!cfg) return
    const derived = deriveKlassenstufe(items)
    if (derived !== cfg.klassenstufe) setCfg({ ...cfg, klassenstufe: derived })
  }, [items, cfg])

  const bkIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of items) for (const e of bkEntries(item.content)) ids.add(e.basiskonzept_id)
    return Array.from(ids).sort()
  }, [items])
  const bkLabels = useMemo(() => buildBkLabelMap(bkIds, rootConcepts), [bkIds, rootConcepts])
  const bkGroups = useMemo(() => groupBkIdsByRoot(bkIds, rootConcepts), [bkIds, rootConcepts])
  // The real "Einbezogene Basiskonzepte" focus chips (EvoMentor DE v1.2,
  // real feedback 2026-10-01) only ever narrow bkGroups down, never add a
  // concept that isn't actually referenced by the selected items -- a
  // Vorwissen field or prompt line for a concept with zero relevance here
  // would be noise, not a real focus choice.
  const focusedBkGroups = useMemo(() => (cfg ? bkGroups.filter((g) => isBkFocused(cfg, g.rootId)) : bkGroups), [bkGroups, cfg])

  const options = useMemo(() => (library ? resolveOptionLists(library.option_lists) : null), [library])
  const labels = useMemo(() => (library ? resolveSectionLabels(library.section_labels) : null), [library])

  const promptText = useMemo(
    () => (items.length && cfg && library && labels && options ? buildPrompt(items, cfg, focusedBkGroups, library, labels, options, bkLabels) : ''),
    [items, cfg, focusedBkGroups, library, labels, options, bkLabels]
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
              <option value="auswahl">Direkt auswählen</option>
            </select>
          </div>
          {scope === 'klassenstufe' && (
            <>
              <div className="field">
                <label>Klassenstufe</label>
                <select value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setThemaFilter(''); setUnterthemaFilter('') }}>
                  <option value="">Bitte wählen…</option>
                  {grades.map((g) => <option key={g} value={g}>Kl. {g}</option>)}
                </select>
              </div>
              {gradeFilter && themen.length > 0 && (
                <div className="field">
                  <label>Thema</label>
                  <select value={themaFilter} onChange={(e) => { setThemaFilter(e.target.value); setUnterthemaFilter('') }}>
                    <option value="">Alle Themen</option>
                    {themen.map((th) => <option key={th} value={th}>{th}</option>)}
                  </select>
                </div>
              )}
              {themaFilter && unterthemen.length > 0 && (
                <div className="field">
                  <label>Unterthema</label>
                  <select value={unterthemaFilter} onChange={(e) => setUnterthemaFilter(e.target.value)}>
                    <option value="">Alle Unterthemen</option>
                    {unterthemen.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              )}
              {gradeFilter && rangeMatches.length > 0 && (
                <div className="field">
                  <label>Lernziele in diesem Bereich ({rangeMatches.length - deselectedInRange.size} von {rangeMatches.length} ausgewählt)</label>
                  <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 6 }}>
                    {rangeMatches.map((t) => (
                      <label key={t.id} className="row" style={{ gap: 6, fontSize: 12.5, padding: '3px 2px', cursor: 'pointer', alignItems: 'flex-start' }}>
                        <input type="checkbox" checked={!deselectedInRange.has(t.id)} onChange={() => toggleDeselected(t.id)} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ minWidth: 0 }}>{t.title}</span>
                      </label>
                    ))}
                  </div>
                  {/* Real feedback d398a23f (Susan): there should be an
                      option here to select/deselect all. */}
                  <div className="row" style={{ gap: 10, marginTop: 6 }}>
                    <button
                      className="btn-linklike"
                      style={{ fontSize: 12 }}
                      disabled={deselectedInRange.size === 0}
                      onClick={() => setDeselectedInRange(new Set())}
                    >
                      Alle auswählen
                    </button>
                    <button
                      className="btn-linklike"
                      style={{ fontSize: 12 }}
                      disabled={deselectedInRange.size === rangeMatches.length}
                      onClick={() => setDeselectedInRange(new Set(rangeMatches.map((t) => t.id)))}
                    >
                      Alle abwählen
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {scope === 'auswahl' && (
            <div className="field">
              <label>Vorfiltern nach Klassenstufe (optional)</label>
              <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} style={{ marginBottom: 8 }}>
                <option value="">Alle Klassenstufen</option>
                {grades.map((g) => <option key={g} value={g}>Kl. {g}</option>)}
              </select>
              <input
                type="search"
                placeholder="Lernziele durchsuchen…"
                value={auswahlQuery}
                onChange={(e) => setAuswahlQuery(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 6 }}>
                {auswahlResults.length === 0 ? (
                  <p className="muted" style={{ fontSize: 12.5, margin: 4 }}>Keine Treffer.</p>
                ) : (
                  auswahlResults.map((t) => (
                    <label key={t.id} className="row" style={{ gap: 6, fontSize: 12.5, padding: '3px 2px', cursor: 'pointer', alignItems: 'flex-start' }}>
                      <input type="checkbox" checked={manualSelection.has(t.id)} onChange={() => toggleManual(t.id)} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ minWidth: 0 }}>
                        {t.title}
                        {(t.thema || t.unterthema) && (
                          <span className="muted" style={{ display: 'block', fontSize: 11 }}>
                            {[t.thema, t.unterthema].filter(Boolean).join(' › ')}
                          </span>
                        )}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {/* Real feedback d398a23f (Susan): select/deselect all, same
                  as the "Nach Klassenstufe" scope above. */}
              <div className="row" style={{ gap: 10, marginTop: 6 }}>
                <button
                  className="btn-linklike"
                  style={{ fontSize: 12 }}
                  disabled={auswahlResults.length === 0 || manualSelection.size === auswahlResults.length}
                  onClick={() => setManualSelection(new Set(auswahlResults.map((t) => t.id)))}
                >
                  Alle auswählen
                </button>
                {manualSelection.size > 0 && (
                  <button className="btn-linklike" style={{ fontSize: 12 }} onClick={() => setManualSelection(new Set())}>
                    Auswahl zurücksetzen ({manualSelection.size})
                  </button>
                )}
              </div>
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
            <input value={cfg.klassenstufe || '—'} disabled />
            <span className="muted" style={{ fontSize: 11 }}>Wird automatisch aus den gewählten Lernzielen übernommen.</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Anzahl Unterrichtsstunden</label>
              <input type="number" min={1} value={cfg.stunden} onChange={(e) => setCfg({ ...cfg, stunden: Number(e.target.value) || 1 })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Stundenformat (min)</label>
              <input value={cfg.stundenformat} onChange={(e) => setCfg({ ...cfg, stundenformat: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Anteil Evolutionsbezug</label>
            <PercentChips
              value={cfg.anteilEvolutionsbezug}
              onChange={(v) => setCfg({ ...cfg, anteilEvolutionsbezug: v })}
              percentages={['5', '25', '50', '75', '100']}
              notSpecifiedLabel="Nicht angegeben"
            />
          </div>
        </div>

        <div className="card student-prompt-card">
          <h3><span className="num">3</span>Basiskonzeptbezug &amp; Vorwissen</h3>
          {rootConcepts.length > 0 && (
            <div className="field">
              <label>Einbezogene Basiskonzepte</label>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {rootConcepts.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip-btn bk-chip${isBkFocused(cfg, c.id) ? ' active' : ''}`}
                    onClick={() => setCfg({ ...cfg, focusBks: toggleBkFocus(cfg, c.id, rootConcepts.map((r) => r.id)) })}
                  >
                    <span className={`bk-dot bk-dot-${i % 6}`} />
                    {bkAbbreviation(c.label)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {focusedBkGroups.length === 0 ? (
            <p className="muted">Keine Basiskonzept-Bezüge in den ausgewählten Lernzielen im Fokus.</p>
          ) : (
            focusedBkGroups.map((g) => (
              <div key={g.rootId} className="field">
                <label>{g.label} — Vorwissen</label>
                <select
                  value={cfg.vorwissenByBk[g.rootId] ?? options.prior_knowledge_levels[1]?.[0]}
                  onChange={(e) => setCfg({ ...cfg, vorwissenByBk: { ...cfg.vorwissenByBk, [g.rootId]: e.target.value } })}
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
          <CheckGroup
            options={options.methods}
            selected={cfg.methoden}
            onToggle={(v) => setCfg({ ...cfg, methoden: toggleInList(cfg.methoden, v) })}
            favoritedMethods={favoriteMethods}
            onToggleFavoriteMethod={onToggleFavoriteMethod}
            renderExtra={(method) => (
              <MethodConceptChips rootConcepts={rootConcepts} links={linksByMethod.get(method) ?? new Map()} editable={false} />
            )}
          />
          <div style={{ marginTop: 8 }}>
            <CheckGroup options={options.differentiation} selected={cfg.differenzierung} onToggle={(v) => setCfg({ ...cfg, differenzierung: toggleInList(cfg.differenzierung, v) })} />
          </div>
        </div>

        <div className="card student-prompt-card">
          <h3><span className="num">6</span>Evaluation und Leistungserhebung</h3>
          <CheckGroup options={options.assessment} selected={cfg.bewertung} onToggle={(v) => setCfg({ ...cfg, bewertung: toggleInList(cfg.bewertung, v) })} />
        </div>

        <div className="card student-prompt-card">
          <h3><span className="num">7</span>Gesellschaftliche Bezüge</h3>
          <CheckGroup options={options.societal_context} selected={cfg.kontext} onToggle={(v) => setCfg({ ...cfg, kontext: toggleInList(cfg.kontext, v) })} />
          <div className="field" style={{ marginTop: 8 }}>
            <label>Weitere Hinweise (z. B. andere Bezüge)</label>
            <textarea value={cfg.kontextNotizen} onChange={(e) => setCfg({ ...cfg, kontextNotizen: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, position: 'sticky', top: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ marginTop: 0 }}>Vorschau</h3>
          <div className="row">
            {/* Real feedback 7a066ddd (Dustin, 2026-10-02): a real,
                well-formed, detailed prompt at this length is well within
                what any current LLM handles -- the old 20,000-character
                threshold flagged it as "sehr lang, evtl. Auswahl
                verkleinern" anyway, in alarm red, with no real reason to.
                Plain character count stays (harmless, sometimes useful),
                the false alarm doesn't. */}
            <span className="muted" style={{ fontSize: 11.5 }}>
              {charCount.toLocaleString('de-DE')} Zeichen
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
