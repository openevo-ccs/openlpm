// Plain-language names, not raw ISO codes -- teacher-facing UI, per this
// project's own standing plain-language directive. Add to this map as new
// working languages show up rather than falling back to the raw code.
const LANGUAGE_NAMES: Record<string, string> = {
  de: 'German',
  en: 'English',
}

// Real feedback 2026-09-30: this used to join every code into one chip
// ("German + English"), reading as if the project were somehow ONE mixed
// language rather than a project that genuinely works in two (or more)
// separate ones. A project space's own set of working languages is a set of
// individual tags, not a combined label -- one chip per language, same as
// every other multi-value tag in this app (EpistemicStatusBadge, MaturityBadge
// never combine either).
export function WorkingLanguagesTag({ languages }: { languages: string[] | null | undefined }) {
  if (!languages || languages.length === 0) return null
  return (
    <>
      {languages.map((code) => (
        <span key={code} className="chip" title="Working language">
          {LANGUAGE_NAMES[code] ?? code}
        </span>
      ))}
    </>
  )
}
