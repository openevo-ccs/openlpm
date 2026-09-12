// Plain-language names, not raw ISO codes -- teacher-facing UI, per this
// project's own standing plain-language directive. Add to this map as new
// working languages show up rather than falling back to the raw code.
const LANGUAGE_NAMES: Record<string, string> = {
  de: 'German',
  en: 'English',
}

export function WorkingLanguagesTag({ languages }: { languages: string[] | null | undefined }) {
  if (!languages || languages.length === 0) return null
  return (
    <span className="chip" title="Working language">
      {languages.map((code) => LANGUAGE_NAMES[code] ?? code).join(' + ')}
    </span>
  )
}
