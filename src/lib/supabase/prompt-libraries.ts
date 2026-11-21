import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type PromptTemplateLibraryRow = Database['public']['Tables']['prompt_template_libraries']['Row']

// The exact set of template "chrome" strings a prompt needs, in whatever
// language/subject the library is written for. Every key here must be
// present in a real library's section_labels JSONB for the generator to
// render correctly -- see FALLBACK_LABELS below for what a caller gets if
// a library is missing one (never a blank/undefined string in the output).
export interface SectionLabels {
  title: string
  grade_label: string
  hours_label: string
  concepts_section: string
  extra_focus_label: string
  items_section: string
  statement_label: string
  relevance_label: string
  subconcepts_label: string
  evoconcepts_label: string
  methods_section: string
  differentiation_section: string
  didactic_notes_label: string
  assessment_section: string
  eval_notes_label: string
  context_section: string
  context_notes_label: string
  output_section: string
  tone_label: string
  length_label: string
  other_notes_label: string
  // Optional: only a library that lists lesson phases needs it.
  lesson_phases_section?: string
  lesson_plan_template_section?: string
  // Optional: the line that says how detailed the answer should be. Only a library with detail_levels needs it.
  detail_label?: string
}

export interface PromptOptionLists {
  methods: string[]
  differentiation: string[]
  assessment: string[]
  societal_context: string[]
  output_types: string[]
  // Optional list of lesson phases (didactic functions) the AI should structure its plan by. Specific to the library's region.
  lesson_phases?: string[]
  // Optional text: the shape the lesson plan should come back in (a form of the region's own, e.g. the Jena Verlaufsordnung).
  lesson_plan_template?: string
  default_output_types: string[]
  default_assessment: string[]
  tones: [string, string][]
  lengths: [string, string][]
  // Optional: how detailed the answer should be (key, plain label that also goes into the prompt). A library without it shows no
  // detail control and the prompt has no detail line, exactly as before.
  detail_levels?: [string, string][]
  default_detail?: string
  // key, label, then two optional texts: what the level means (shown on hover) and a note that goes into the prompt after the label.
  prior_knowledge_levels: [string, string, string?, string?][]
  // Stored explicitly. Taking "whichever option happens to be listed first"
  // was a real bug caught in review: the seeded German library lists
  // 'kurz' (short) before 'ausführlich' (detailed) in `lengths` for
  // alphabetical/display reasons, but the tool's actual intended default
  // has always been the detailed option. Picking index 0 as a silent
  // default would have quietly flipped that the moment anyone reordered
  // the list for an unrelated reason.
  default_tone: string
  default_length: string
}

// English fallbacks -- used only for a key a library's own JSONB happens to
// omit (a curator adding a new library by hand shouldn't have the whole
// page break over one missing field). A complete library never touches this.
const FALLBACK_LABELS: SectionLabels = {
  title: 'LESSON PREPARATION',
  grade_label: 'Grade level(s):',
  hours_label: 'Lesson hours:',
  concepts_section: 'CONCEPT FOCUS & PRIOR KNOWLEDGE:',
  extra_focus_label: 'Additional subject-matter focus:',
  items_section: 'LEARNING OBJECTIVES',
  statement_label: 'Statement:',
  relevance_label: 'Relevance',
  subconcepts_label: 'Sub-concepts:',
  evoconcepts_label: 'Evolution concepts:',
  methods_section: 'ADDITIONAL METHODS:',
  differentiation_section: 'DIFFERENTIATION:',
  didactic_notes_label: 'Teaching notes:',
  assessment_section: 'ASSESSMENT:',
  eval_notes_label: 'Assessment notes:',
  context_section: 'SOCIETAL CONTEXT:',
  context_notes_label: 'Further notes:',
  output_section: 'DESIRED OUTPUT:',
  tone_label: 'Tone:',
  length_label: 'Length:',
  other_notes_label: 'Other notes:',
}

const FALLBACK_OPTIONS: PromptOptionLists = {
  methods: [], differentiation: [], assessment: [], societal_context: [], output_types: [],
  default_output_types: [], default_assessment: [],
  tones: [['professional', 'Professional'], ['casual', 'Casual'], ['academic', 'Academic']],
  lengths: [['short', 'Short'], ['detailed', 'Detailed']],
  prior_knowledge_levels: [['none', 'No prior knowledge'], ['basic', 'Basic concepts known'], ['solid', 'Solid foundation']],
  default_tone: 'professional',
  default_length: 'detailed',
}

export function resolveSectionLabels(raw: any): SectionLabels {
  return { ...FALLBACK_LABELS, ...(raw ?? {}) }
}

export function resolveOptionLists(raw: any): PromptOptionLists {
  return { ...FALLBACK_OPTIONS, ...(raw ?? {}) }
}

/**
 * Resolves which prompt_template_libraries row a project should use: its
 * own explicit prompt_template_library_id if set, otherwise the library
 * marked is_default for the project's first working_language. Returns null
 * (not a thrown error) if neither resolves to a real row -- the generator
 * page renders a plain "no library configured for this project yet"
 * message rather than crashing, since not every project needs one.
 */
export async function getLibraryForProject(
  supabase: Client,
  project: { prompt_template_library_id: string | null; working_languages: string[] }
): Promise<PromptTemplateLibraryRow | null> {
  if (project.prompt_template_library_id) {
    const { data } = await supabase
      .from('prompt_template_libraries')
      .select('*')
      .eq('id', project.prompt_template_library_id)
      .maybeSingle()
    if (data) return data
  }

  const lang = project.working_languages?.[0]
  if (!lang) return null
  const { data } = await supabase
    .from('prompt_template_libraries')
    .select('*')
    .eq('language', lang)
    .eq('is_default', true)
    .maybeSingle()
  return data ?? null
}

export async function listPromptTemplateLibraries(supabase: Client) {
  const { data } = await supabase.from('prompt_template_libraries').select('*').order('label')
  return data ?? []
}
