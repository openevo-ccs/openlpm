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

export const STUDENT_VIEW_TEMPLATES: StudentViewTemplate[] = [
  {
    id: 'jena-biologiedidaktik-de',
    label: 'Jena Biologiedidaktik (Deutsch)',
    description:
      'German-language Lernziele/Basiskonzepte/KI-Prompt-Generator view modeled on EvoMentor DE v1.2, built for the Uni Jena Winter Semester 2026 pilot.',
  },
  {
    id: 'bio-core-sachsen-thueringen-de',
    label: 'Sachsen/Thüringen (Deutsch)',
    description:
      'German-language view connecting Bio-Core LPM (Synthetic)’s strands to real Sachsen/Thüringen curriculum-policy content, with room to comment on each connection.',
  },
  {
    id: 'bio-core-us-ny-ca-en',
    label: 'New York / California (US)',
    description:
      'English-language view connecting Bio-Core LPM (Synthetic)’s strands to real New York/California curriculum-policy content, with room to comment on each connection.',
  },
  {
    id: 'interdisciplinary-sachsen-thueringen-de',
    label: 'Sachsen/Thüringen (Deutsch)',
    description:
      'German-language view connecting Interdisciplinary LPM (Synthetic)’s strands to real Sachsen/Thüringen curriculum-policy content, with room to comment on each connection.',
  },
  {
    id: 'interdisciplinary-us-ny-ca-en',
    label: 'New York / California (US)',
    description:
      'English-language view connecting Interdisciplinary LPM (Synthetic)’s strands to real New York/California curriculum-policy content, with room to comment on each connection.',
  },
]

export function getStudentViewTemplate(id: string | null): StudentViewTemplate | null {
  if (!id) return null
  return STUDENT_VIEW_TEMPLATES.find((t) => t.id === id) ?? null
}

// The 4 new 2026-10-20 templates above are all the same kind of thing --
// a Learning Goals explorer plus a Curriculum Connections workspace for
// one project, scoped to one language and one set of real-world Curriculum
// Repository projects -- so they share one config lookup rather than four
// hand-forked page sets. The Jena template predates this and keeps its own
// bespoke nav/pages (student-nav.tsx, student-lernziele-page.tsx etc).
export interface CurriculumConnectionsViewConfig {
  language: 'de' | 'en'
  // Curriculum Repository project slugs this view's "Add connection"
  // picker searches, in display order.
  regionSlugs: string[]
  regionLabel: string
}

export const CURRICULUM_CONNECTIONS_VIEWS: Record<string, CurriculumConnectionsViewConfig> = {
  'bio-core-sachsen-thueringen-de': {
    language: 'de',
    regionSlugs: ['germany-curriculum-repository', 'saxony-curriculum-repository', 'thuringia-curriculum-repository'],
    regionLabel: 'Sachsen/Thüringen',
  },
  'interdisciplinary-sachsen-thueringen-de': {
    language: 'de',
    regionSlugs: ['germany-curriculum-repository', 'saxony-curriculum-repository', 'thuringia-curriculum-repository'],
    regionLabel: 'Sachsen/Thüringen',
  },
  'bio-core-us-ny-ca-en': {
    language: 'en',
    regionSlugs: ['united-states-curriculum-repository', 'new-york-curriculum-repository', 'california-curriculum-repository'],
    regionLabel: 'New York / California',
  },
  'interdisciplinary-us-ny-ca-en': {
    language: 'en',
    regionSlugs: ['united-states-curriculum-repository', 'new-york-curriculum-repository', 'california-curriculum-repository'],
    regionLabel: 'New York / California',
  },
}

export function getCurriculumConnectionsViewConfig(templateId: string | null): CurriculumConnectionsViewConfig | null {
  if (!templateId) return null
  return CURRICULUM_CONNECTIONS_VIEWS[templateId] ?? null
}
