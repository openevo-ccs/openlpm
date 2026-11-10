import { languageName } from '@/lib/method-text'

/** Two small buttons that switch the language a text is shown in. */
export function LanguageSwitch({ value, onChange, uiLang, languages = ['de', 'en'] }: { value: string; onChange: (lang: string) => void; uiLang: string; languages?: string[] }) {
  return (
    <div className="row" style={{ gap: 4 }} role="group" aria-label={uiLang === 'de' ? 'Sprache der Texte' : 'Language of the texts'}>
      {languages.map((l) => (
        <button key={l} type="button" className={`chip-btn${value === l ? ' active' : ''}`} onClick={() => onChange(l)}>
          {languageName(l, uiLang)}
        </button>
      ))}
    </div>
  )
}
