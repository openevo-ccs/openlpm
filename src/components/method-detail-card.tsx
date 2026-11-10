import type { MethodsBaseRecord } from '@/lib/supabase/methodsbase'
import { languageName, languagesOf, otherLanguages, pickLocalized, tagLabel, type TagField } from '@/lib/method-text'

// Small two-letter language tag shown next to a piece of text, so a reader can tell which language that text is in.
export function LangChip({ lang, uiLang }: { lang: string; uiLang: string }) {
  if (!lang) return null
  return (
    <span className="chip" style={{ fontSize: 10, marginLeft: 6, verticalAlign: 'middle' }} title={languageName(lang, uiLang)}>
      {lang.toUpperCase()}
    </span>
  )
}

function strings(uiLang: string) {
  return uiLang === 'de'
    ? {
        whenToUse: 'Wann einsetzen',
        missing: (name: string) => `Diese Angabe gibt es bisher nur auf ${name}.`,
        source: (id: string, status: string) => `Quelle: MethodsBase-Eintrag ${id}. Prüfstatus: ${status}.`,
        draft: ' Noch von niemandem mit biologiedidaktischer Fachkenntnis geprüft. Bitte als Entwurf lesen.',
        unknown: 'unbekannt',
      }
    : {
        whenToUse: 'When to use it',
        missing: (name: string) => `This text exists only in ${name} so far.`,
        source: (id: string, status: string) => `Source: MethodsBase record ${id}. Review status: ${status}.`,
        draft: ' No one with Biologiedidaktik expertise has reviewed it yet. Treat it as a draft.',
        unknown: 'unknown',
      }
}

function TagChips({ field, terms, uiLang }: { field: TagField; terms: unknown; uiLang: string }) {
  if (!Array.isArray(terms) || terms.length === 0) return null
  return (
    <>
      {terms.map((t) => (
        <span key={String(t)} className="chip" style={{ fontSize: 11 }}>{tagLabel(field, String(t), uiLang)}</span>
      ))}
    </>
  )
}

/**
 * One method as a card, in the project's language. Names in both languages, then discipline and tags, then the description and
 * the "when to use" text, each with a tag for the language it is written in. When the reader's language is missing from a
 * text, the card says so.
 */
export function MethodDetailCard({ record, uiLang }: { record: MethodsBaseRecord; uiLang: string }) {
  const t = strings(uiLang)
  const data = record.data ?? {}
  const name = pickLocalized(data.label, uiLang) ?? { text: record.id, lang: '' }
  const otherNames = otherLanguages(data.label, name.lang)
  const description = pickLocalized(data.description, uiLang)
  const whenToUse = pickLocalized(data.whenToUse, uiLang)
  const discipline = typeof data.discipline === 'string' && data.discipline ? data.discipline : null
  const missingIn = [description, whenToUse].some((x) => x && x.lang && x.lang !== uiLang)
  const hasTags = (Array.isArray(data.lessonPhases) && data.lessonPhases.length > 0) || (Array.isArray(data.learningApproaches) && data.learningApproaches.length > 0)
  const textLanguages = Array.from(new Set([...languagesOf(data.description), ...languagesOf(data.whenToUse)]))

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>
        {name.text}
        <LangChip lang={name.lang} uiLang={uiLang} />
      </h3>
      {otherNames.map((o) => (
        <p key={o.lang} className="muted" style={{ margin: '0 0 4px 0' }}>
          {o.text}
          <LangChip lang={o.lang} uiLang={uiLang} />
        </p>
      ))}
      {discipline && <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{discipline}</p>}
      {hasTags && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <TagChips field="lessonPhases" terms={data.lessonPhases} uiLang={uiLang} />
          <TagChips field="learningApproaches" terms={data.learningApproaches} uiLang={uiLang} />
        </div>
      )}
      {description && (
        <p>
          {description.text}
          <LangChip lang={description.lang} uiLang={uiLang} />
        </p>
      )}
      {whenToUse && (
        <>
          <p style={{ fontWeight: 600, marginBottom: 2 }}>{t.whenToUse}</p>
          <p className="muted">
            {whenToUse.text}
            <LangChip lang={whenToUse.lang} uiLang={uiLang} />
          </p>
        </>
      )}
      {missingIn && textLanguages.length > 0 && (
        <p className="muted" style={{ fontSize: 12 }}>{t.missing(textLanguages.map((l) => languageName(l, uiLang)).join(' / '))}</p>
      )}
      <p className="muted" style={{ fontSize: 11 }}>
        {t.source(record.id, record.review_status ?? t.unknown)}
        {record.review_status === 'author-draft' && t.draft}
      </p>
    </div>
  )
}
