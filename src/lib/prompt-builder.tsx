import { Star } from 'lucide-react'
import type { Database } from './supabase/database.types'
import type { PromptOptionLists, PromptTemplateLibraryRow, SectionLabels } from './supabase/prompt-libraries'
import { bkEntries, type BkGroup } from './supabase/basiskonzepte'

type DataObject = Database['public']['Tables']['lpm_data_objects']['Row']

export interface Config {
  klassenstufe: string
  stunden: number
  stundenformat: string
  // How much of the lesson/unit time should actually involve evolutionary
  // concepts -- real feedback from Susan Hanisch 2026-10-01, modeled on
  // EvoMentor DE v1.2's own grade/hours line but with no v1.2 precedent to
  // port (this field doesn't exist there). '' means "not specified" --
  // omitted from the generated prompt entirely rather than printing a blank.
  anteilEvolutionsbezug: string
  vorwissenByBk: Record<string, string>
  // Which root Basiskonzepte are actually in focus for this prompt --
  // EvoMentor DE v1.2's own real "Einbezogene Basiskonzepte" chip picker
  // (cfg.selectedBks there), ALWAYS offered for all 6 real root concepts
  // regardless of which ones the currently-selected items happen to touch.
  // Empty array means "no explicit narrowing yet" -- every concept actually
  // referenced by the selected items is in focus, same as this tool's
  // original auto-detect-only behavior. A non-empty array is the real,
  // deliberate subset a teacher narrowed down to.
  focusBks: string[]
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

export function defaultConfig(options: PromptOptionLists): Config {
  return {
    klassenstufe: '', stunden: 4, stundenformat: '45', anteilEvolutionsbezug: '',
    vorwissenByBk: {}, focusBks: [], fachNotizen: '',
    methoden: [], differenzierung: [], didNotizen: '',
    bewertung: [...options.default_assessment], evalNotizen: '',
    kontext: [], kontextNotizen: '',
    ausgabeTyp: [...options.default_output_types],
    ton: options.default_tone, laenge: options.default_length, sonstigeNotizen: '',
  }
}

/** True if a root Basiskonzept is in focus: explicit if focusBks is non-empty, otherwise everything is (see Config.focusBks' own comment). */
export function isBkFocused(cfg: Config, rootId: string): boolean {
  return cfg.focusBks.length === 0 || cfg.focusBks.includes(rootId)
}

/** Toggles one root concept in/out of focus, expanding an empty ("everything") selection to the real full list first so the very first click narrows rather than starting from nothing. */
export function toggleBkFocus(cfg: Config, rootId: string, allRootIds: string[]): string[] {
  const current = cfg.focusBks.length ? cfg.focusBks : allRootIds
  return current.includes(rootId) ? current.filter((id) => id !== rootId) : [...current, rootId]
}

/**
 * Shared between the researcher Prompt Generator (per-notebook) and the
 * student one (per scope selection) -- EvoMentor DE v1.2's own buildPrompt()
 * logic, ported faithfully (see prompt-generator-page.tsx's own header
 * comment for the history), extracted here 2026-09-30 so both pages produce
 * byte-identical output for the same inputs rather than two copies that can
 * drift.
 */
export function buildPrompt(
  items: DataObject[],
  cfg: Config,
  bkGroups: BkGroup[],
  library: PromptTemplateLibraryRow,
  labels: SectionLabels,
  options: PromptOptionLists,
  bkLabels: Record<string, string>
): string {
  // Real bug found live 2026-09-30, reported with a screenshot: the real
  // Thuringia data has more than one raw id spelling for the same
  // Basiskonzept (see groupBkIdsByRoot's own comment in basiskonzepte.ts).
  // Iterating the raw id list here used to print the same real concept
  // twice in the generated prompt's own "concept focus" section, each with
  // its own independently-set (and possibly different) prior-knowledge
  // level -- confusing for whoever reads the generated prompt, and simply
  // wrong as a summary of what's actually being taught. bkGroups collapses
  // that before it ever reaches the generated text.
  const allRawIds = new Set(bkGroups.flatMap((g) => g.rawIds))
  const lines: string[] = []
  lines.push('='.repeat(70))
  lines.push(labels.title)
  lines.push('='.repeat(70))
  lines.push('')
  lines.push(library.role_preamble)
  lines.push(library.instruction_preamble)
  lines.push('')
  lines.push(`${labels.grade_label} ${cfg.klassenstufe || '—'}    ${labels.hours_label} ${cfg.stunden} × ${cfg.stundenformat}`)
  // Not library-driven like the siblings above -- EvoMentor DE v1.2 has no
  // equivalent field to port a real German label from, and this codebase's
  // only real library today is German anyway, so the plain requested label
  // IS the right default. Revisit if a non-German library ever needs this.
  if (cfg.anteilEvolutionsbezug) lines.push(`Anteil Evolutionsbezug: ${cfg.anteilEvolutionsbezug}%`)
  lines.push('')
  lines.push(labels.concepts_section)
  for (const g of bkGroups) {
    const vw = options.prior_knowledge_levels.find((v) => v[0] === (cfg.vorwissenByBk[g.rootId] ?? options.prior_knowledge_levels[1]?.[0]))
    lines.push(`- ${g.label}: ${vw ? vw[1] : '—'}`)
  }
  if (cfg.fachNotizen) lines.push(`${labels.extra_focus_label} ${cfg.fachNotizen}`)
  lines.push('')
  lines.push(`${labels.items_section} (${items.length}):`)
  lines.push('-'.repeat(70))
  for (const item of items) {
    const c = item.content as any
    lines.push(`\n[${item.id.slice(0, 8)}] ${item.title} (${item.grade_band ?? '?'})`)
    lines.push(`  ${labels.statement_label} ${c?.originaltext ?? item.description ?? ''}`)
    for (const entry of bkEntries(item.content)) {
      if (!allRawIds.has(entry.basiskonzept_id)) continue
      lines.push(`  ${bkLabels[entry.basiskonzept_id] ?? entry.basiskonzept_id} (${labels.relevance_label} ${entry.relevanz_beurteilung}/3): ${entry.begruendung}`)
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

// Real feedback bdd96114 (Susan Hanisch, 2026-10-02): a separately
// hand-typed grade field was redundant with the grade(s) the chosen
// learning goals already carry via their own grade_band. Collapses the
// distinct grade_band values actually present in the current item set into
// a compact display string -- a contiguous run reads "7–9", separate runs
// join with ", " (e.g. "5–6, 9").
export function deriveKlassenstufe(items: { grade_band: string | null }[]): string {
  const grades = Array.from(new Set(items.map((i) => i.grade_band).filter((g): g is string => !!g)))
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)
  if (grades.length === 0) return ''
  const runs: string[] = []
  let start = grades[0]
  let prev = grades[0]
  for (let i = 1; i <= grades.length; i++) {
    const g = grades[i]
    if (g === prev + 1) {
      prev = g
      continue
    }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`)
    if (i < grades.length) { start = g; prev = g }
  }
  return runs.join(', ')
}

export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

// favoritedMethods/onToggleFavoriteMethod are optional -- only the Methods
// list (real feedback 7b32d01c) passes them; every other CheckGroup call
// (differentiation/assessment/kontext/output_types) renders exactly as
// before.
export function CheckGroup({
  options,
  selected,
  onToggle,
  favoritedMethods,
  onToggleFavoriteMethod,
}: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  favoritedMethods?: Set<string>
  onToggleFavoriteMethod?: (v: string) => void
}) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => (
        <label key={o} className="row" style={{ gap: 4, fontSize: 12 }}>
          <input type="checkbox" checked={selected.includes(o)} onChange={() => onToggle(o)} />
          {o}
          {onToggleFavoriteMethod && (
            <button
              type="button"
              className="btn-linklike"
              aria-label="Favorite method"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavoriteMethod(o) }}
              style={{ padding: 0, display: 'inline-flex' }}
            >
              <Star size={11} fill={favoritedMethods?.has(o) ? 'var(--series-a, gold)' : 'none'} />
            </button>
          )}
        </label>
      ))}
    </div>
  )
}

// Real feedback bdd96114 (Susan Hanisch, 2026-10-02): "the Anteil
// Evolutionsbezug choice is better as selectable tags than drop down."
// Single-select, like the dropdown it replaces -- "tags" here means the
// chip-button look already used elsewhere in this app (e.g. the BK focus
// chips), not a multi-select.
export function PercentChips({
  value,
  onChange,
  percentages,
  notSpecifiedLabel,
}: {
  value: string
  onChange: (v: string) => void
  percentages: string[]
  notSpecifiedLabel: string
}) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
      <button type="button" className={`chip-btn${value === '' ? ' active' : ''}`} onClick={() => onChange('')}>
        {notSpecifiedLabel}
      </button>
      {percentages.map((p) => (
        <button key={p} type="button" className={`chip-btn${value === p ? ' active' : ''}`} onClick={() => onChange(p)}>
          {p}%
        </button>
      ))}
    </div>
  )
}
