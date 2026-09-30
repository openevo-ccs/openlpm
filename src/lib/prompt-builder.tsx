import type { Database } from './supabase/database.types'
import type { PromptOptionLists, PromptTemplateLibraryRow, SectionLabels } from './supabase/prompt-libraries'
import { bkEntries } from './supabase/basiskonzepte'

type DataObject = Database['public']['Tables']['lpm_data_objects']['Row']

export interface Config {
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

export function defaultConfig(options: PromptOptionLists): Config {
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
  bkIds: string[],
  library: PromptTemplateLibraryRow,
  labels: SectionLabels,
  options: PromptOptionLists,
  bkLabels: Record<string, string>
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
    lines.push(`- ${bkLabels[bkId] ?? bkId}: ${vw ? vw[1] : '—'}`)
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
      if (!bkIds.includes(entry.basiskonzept_id)) continue
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

export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function CheckGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
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
