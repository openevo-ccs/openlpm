// The registry of available student-view templates -- what an owner picks
// from when turning this on for a project (dashboard-page.tsx's settings
// card) and what project-layout.tsx checks before ever rendering a student
// shell at all. One real entry today (the Jena pilot's German, EvoMentor
// DE-modeled view); a second language or subject area is a new entry here,
// not a rewrite of the gating logic in project-layout.tsx.
export interface StudentViewTemplate {
  id: string
  label: string
  description: string
}

// The Jena pilot's own view plus, for each of the four synthetic spaces, three
// comparison views: one per country (all of that country's states in one place)
// and one cross-national view. Rebuilt 2026-10-28; before that the US was split
// over two views (New York / California and Florida / Pennsylvania / Tennessee)
// and Germany covered only Sachsen and Thüringen.
export const COMPARISON_SPACES = [
  { key: 'bio-core', label: 'Bio-Core' },
  { key: 'social-core', label: 'Social-Core' },
  { key: 'computational-core', label: 'Computational-Core' },
  { key: 'interdisciplinary', label: 'Interdisciplinary' },
] as const

export type ComparisonSpaceKey = (typeof COMPARISON_SPACES)[number]['key']

export const STUDENT_VIEW_TEMPLATES: StudentViewTemplate[] = [
  {
    id: 'jena-biologiedidaktik-de',
    label: 'Jena Biologiedidaktik (Deutsch)',
    description:
      'German-language Lernziele/Basiskonzepte/KI-Prompt-Generator view modeled on EvoMentor DE v1.2, built for the Uni Jena Winter Semester 2026 pilot.',
  },
  ...COMPARISON_SPACES.flatMap(({ key, label }): StudentViewTemplate[] => [
    {
      id: `${key}-germany-de`,
      label: 'Deutschland (Deutsch)',
      description: `German-language view comparing ${label} LPM (Synthetic) with the curriculum policy of the German states: coverage map, network, timeline, flows, measures, side-by-side comparison and curation tools.`,
    },
    {
      id: `${key}-united-states-en`,
      label: 'United States (English)',
      description: `English-language view comparing ${label} LPM (Synthetic) with the curriculum policy of the US states in one place: coverage map, network, timeline, flows, measures, side-by-side comparison and curation tools.`,
    },
    {
      id: `${key}-cross-national-en`,
      label: 'Cross-national comparison (English)',
      description: `English-language view comparing ${label} LPM (Synthetic) across countries, Germany and the United States to start. More countries can be switched on once their records exist.`,
    },
  ]),
]

// Older template ids that may still be stored on a view row or a project. They open the matching new view.
const LEGACY_TEMPLATE_ALIASES: Record<string, string> = {
  'bio-core-sachsen-thueringen-de': 'bio-core-germany-de',
  'bio-core-us-ny-ca-en': 'bio-core-united-states-en',
  'bio-core-us-fl-pa-tn-en': 'bio-core-united-states-en',
  'interdisciplinary-sachsen-thueringen-de': 'interdisciplinary-germany-de',
  'interdisciplinary-us-ny-ca-en': 'interdisciplinary-united-states-en',
  'interdisciplinary-us-fl-pa-tn-en': 'interdisciplinary-united-states-en',
}

export function getStudentViewTemplate(id: string | null): StudentViewTemplate | null {
  if (!id) return null
  return STUDENT_VIEW_TEMPLATES.find((t) => t.id === (LEGACY_TEMPLATE_ALIASES[id] ?? id)) ?? null
}

// ---- Comparison views: countries and their repositories ---------------------------

/** Curriculum Repository project slugs per country. Adding a country is one line here and its records. */
export const COUNTRY_REPOSITORIES: Record<string, string[]> = {
  DE: [
    'germany-curriculum-repository',
    'saxony-curriculum-repository',
    'thuringia-curriculum-repository',
    'saxony-anhalt-curriculum-repository',
  ],
  US: [
    'united-states-curriculum-repository',
    'new-york-curriculum-repository',
    'california-curriculum-repository',
    'florida-curriculum-repository',
    'pennsylvania-curriculum-repository',
    'tennessee-curriculum-repository',
    'us-evolution-education-curriculum-repository',
  ],
  IN: [
    'india-curriculum-repository',
    'kerala-curriculum-repository',
    'karnataka-curriculum-repository',
    'maharashtra-curriculum-repository',
  ],
}

export interface CurriculumConnectionsViewConfig {
  language: 'de' | 'en'
  /** One country (all its states side by side) or several (country against country, states on request). */
  scope: 'country' | 'cross-national'
  /** The countries switched on when the view opens. */
  countries: string[]
  /** Every country the view can offer. Extra ones appear as switches in the cross-national view. */
  availableCountries: string[]
  /** All repository slugs the view reads from. */
  regionSlugs: string[]
  regionLabel: string
  space: ComparisonSpaceKey
}

function configFor(space: ComparisonSpaceKey, scope: CurriculumConnectionsViewConfig['scope'], country?: string): CurriculumConnectionsViewConfig {
  const available = scope === 'country' ? [country!] : ['DE', 'US', 'IN']
  return {
    language: scope === 'country' && country === 'DE' ? 'de' : 'en',
    scope,
    countries: scope === 'country' ? [country!] : ['DE', 'US'],
    availableCountries: available,
    regionSlugs: available.flatMap((c) => COUNTRY_REPOSITORIES[c] ?? []),
    regionLabel: scope === 'country' ? (country === 'DE' ? 'Deutschland' : 'United States') : 'Germany and the United States',
    space,
  }
}

export const CURRICULUM_CONNECTIONS_VIEWS: Record<string, CurriculumConnectionsViewConfig> = Object.fromEntries(
  COMPARISON_SPACES.flatMap(({ key }) => [
    [`${key}-germany-de`, configFor(key, 'country', 'DE')],
    [`${key}-united-states-en`, configFor(key, 'country', 'US')],
    [`${key}-cross-national-en`, configFor(key, 'cross-national')],
  ])
)

export function getCurriculumConnectionsViewConfig(templateId: string | null): CurriculumConnectionsViewConfig | null {
  if (!templateId) return null
  return CURRICULUM_CONNECTIONS_VIEWS[LEGACY_TEMPLATE_ALIASES[templateId] ?? templateId] ?? null
}
