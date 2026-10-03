// The small, open registry a Curriculum Repository owner picks from when
// naming a new Custom View's audience/language (migration 094) -- same
// spirit as student-view-templates.ts: a real new audience or language is a
// new entry here, never a migration, since view_audience/view_language are
// plain open-vocabulary text columns rather than enums.

export const CUSTOM_VIEW_AUDIENCES: { value: string; label: string }[] = [
  { value: 'teachers', label: 'Teachers' },
  { value: 'researchers', label: 'Researchers' },
  { value: 'students', label: 'Students' },
  { value: 'policy-makers', label: 'Policy makers' },
  { value: 'partners', label: 'External partners' },
]

// Same language codes as new-project-wizard.tsx's COMMON_LANGUAGES, kept in
// sync deliberately -- a view's language tag should mean the same thing as
// a project's own working_languages entry.
export const CUSTOM_VIEW_LANGUAGES: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ar', label: 'Arabic' },
]
