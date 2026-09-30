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
]

export function getStudentViewTemplate(id: string | null): StudentViewTemplate | null {
  if (!id) return null
  return STUDENT_VIEW_TEMPLATES.find((t) => t.id === id) ?? null
}
