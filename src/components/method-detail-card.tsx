import { useState, type CSSProperties } from 'react'
import type { MethodsBaseRecord } from '@/lib/supabase/methodsbase'
import { fieldReviewed, matchesSavedText, languageName, languagesOf, otherLanguages, pickLocalized, pickLocalizedList, tagLabel, textState, type DraftField, type TagField } from '@/lib/method-text'

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
        steps: 'Ablauf',
        materials: 'Material',
        tips: 'Hinweise',
        example: 'Beispiel',
        aiPrompt: 'KI-Prompt (Vorlage)',
        copy: 'Kopieren',
        copied: 'Kopiert',
        draft: 'Entwurf von Claude, noch nicht fachlich geprüft',
        draftTitle: 'Dieser Text wurde von Claude entworfen. Noch hat ihn niemand mit biologiedidaktischer Fachkenntnis gelesen.',
        missing: (name: string) => `Diese Angabe gibt es bisher nur auf ${name}.`,
        source: (id: string, status: string) => `Quelle: MethodsBase-Eintrag ${id}. Prüfstatus: ${status}.`,
        draftNote: ' Noch von niemandem mit biologiedidaktischer Fachkenntnis geprüft. Bitte als Entwurf lesen.',
        unknown: 'unbekannt',
      }
    : {
        whenToUse: 'When to use it',
        steps: 'Steps',
        materials: 'Materials',
        tips: 'Tips',
        example: 'Example',
        aiPrompt: 'AI prompt (template)',
        copy: 'Copy',
        copied: 'Copied',
        draft: 'Claude draft, not yet reviewed by an expert',
        draftTitle: 'Claude drafted this text. No one with Biologiedidaktik expertise has read it yet.',
        missing: (name: string) => `This text exists only in ${name} so far.`,
        source: (id: string, status: string) => `Source: MethodsBase record ${id}. Review status: ${status}.`,
        draftNote: ' No one with Biologiedidaktik expertise has reviewed it yet. Treat it as a draft.',
        unknown: 'unknown',
      }
}

// Shown next to a text that Claude drafted and no expert has read yet. With `field` the tag goes away once a person has read that text:
// the record names the field as reviewed, or (in the Base Repo Explorer) the log of edits holds what a person saved in that field and the
// record shows exactly that text (`savedTexts`). A text that has changed since the person saved it keeps its tag.
export function DraftChip({ data, lang, field, savedTexts, label, title }: { data: Record<string, unknown>; lang: string; field?: DraftField; savedTexts?: Map<string, unknown>; label: string; title: string }) {
  if (!lang || textState(data, lang) !== 'claude-draft-unreviewed') return null
  if (field) {
    if (fieldReviewed(data, lang, field)) return null
    const path = `${field}.${lang}`
    if (savedTexts?.has(path) && matchesSavedText(data, field, lang, savedTexts.get(path))) return null
  }
  return (
    <span className="chip" style={{ fontSize: 10, marginLeft: 6, verticalAlign: 'middle', borderColor: 'var(--warning)', color: 'var(--warning-text)' }} title={title}>
      {label}
    </span>
  )
}

export function CopyButton({ text, label, doneLabel, style }: { text: string; label: string; doneLabel: string; style?: CSSProperties }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-mini"
      data-testid="copy-prompt"
      style={{ fontSize: 12, marginLeft: 8, ...style }}
      onClick={() => {
        try {
          void navigator.clipboard.writeText(text).then(() => {
            setDone(true)
            setTimeout(() => setDone(false), 2000)
          })
        } catch {
          // Clipboard not available: the text stays selectable on screen.
        }
      }}
    >
      {done ? doneLabel : label}
    </button>
  )
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
export function MethodDetailCard({ record, uiLang, textLang }: { record: MethodsBaseRecord; uiLang: string; textLang?: string }) {
  const t = strings(uiLang)
  const lang = textLang ?? uiLang
  const data = record.data ?? {}
  const name = pickLocalized(data.label, lang) ?? { text: record.id, lang: '' }
  const otherNames = otherLanguages(data.label, name.lang)
  const description = pickLocalized(data.description, lang)
  const whenToUse = pickLocalized(data.whenToUse, lang)
  const steps = pickLocalizedList(data.protocolSteps, lang)
  const materials = pickLocalized(data.materials, lang)
  const tips = pickLocalizedList(data.teacherTips, lang)
  const example = pickLocalized(data.workedExample, lang)
  const aiPrompt = pickLocalized(data.aiPromptTemplate, lang)
  const discipline = pickLocalized(data.discipline, lang)
  const missingIn = [description, whenToUse, steps, materials, tips, example, aiPrompt].some((x) => x && x.lang && x.lang !== lang)
  const hasTags = (Array.isArray(data.disciplineTags) && data.disciplineTags.length > 0) || (Array.isArray(data.lessonPhases) && data.lessonPhases.length > 0) || (Array.isArray(data.learningApproaches) && data.learningApproaches.length > 0)
  const textLanguages = Array.from(new Set([...languagesOf(data.description), ...languagesOf(data.whenToUse), ...languagesOf(data.protocolSteps), ...languagesOf(data.materials), ...languagesOf(data.teacherTips), ...languagesOf(data.workedExample), ...languagesOf(data.aiPromptTemplate)]))

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
      {discipline && <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{discipline.text}<LangChip lang={discipline.lang || 'en'} uiLang={uiLang} /></p>}
      {hasTags && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <TagChips field="disciplineTags" terms={data.disciplineTags} uiLang={uiLang} />
          <TagChips field="lessonPhases" terms={data.lessonPhases} uiLang={uiLang} />
          <TagChips field="learningApproaches" terms={data.learningApproaches} uiLang={uiLang} />
        </div>
      )}
      {description && (
        <p>
          {description.text}
          <LangChip lang={description.lang} uiLang={uiLang} />
          <DraftChip data={data} lang={description.lang} field="description" label={t.draft} title={t.draftTitle} />
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
      {steps && (
        <>
          <p style={{ fontWeight: 600, marginBottom: 2 }}>
            {t.steps}
            <LangChip lang={steps.lang} uiLang={uiLang} />
          </p>
          <ol className="muted" style={{ marginTop: 0, paddingLeft: 20 }}>
            {steps.items.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}
          </ol>
        </>
      )}
      {materials && (
        <>
          <p style={{ fontWeight: 600, marginBottom: 2 }}>
            {t.materials}
            <LangChip lang={materials.lang} uiLang={uiLang} />
          </p>
          <p className="muted" style={{ marginTop: 0 }}>{materials.text}</p>
        </>
      )}
      {tips && (
        <>
          <p style={{ fontWeight: 600, marginBottom: 2 }}>
            {t.tips}
            <LangChip lang={tips.lang} uiLang={uiLang} />
          </p>
          <ul className="muted" style={{ marginTop: 0, paddingLeft: 20 }}>
            {tips.items.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}
          </ul>
        </>
      )}
      {example && (
        <>
          <p style={{ fontWeight: 600, marginBottom: 2 }}>
            {t.example}
            <LangChip lang={example.lang} uiLang={uiLang} />
          </p>
          <p className="muted" style={{ marginTop: 0, whiteSpace: 'pre-line' }}>{example.text}</p>
        </>
      )}
      {aiPrompt && (
        <>
          <p style={{ fontWeight: 600, marginBottom: 2 }}>
            {t.aiPrompt}
            <LangChip lang={aiPrompt.lang} uiLang={uiLang} />
            <CopyButton text={aiPrompt.text} label={t.copy} doneLabel={t.copied} />
          </p>
          <p className="muted" style={{ marginTop: 0 }}>{aiPrompt.text}</p>
        </>
      )}
      {missingIn && textLanguages.length > 0 && (
        <p className="muted" style={{ fontSize: 12 }}>{t.missing(textLanguages.map((l) => languageName(l, uiLang)).join(' / '))}</p>
      )}
      <p className="muted" style={{ fontSize: 11 }}>
        {t.source(record.id, record.review_status ?? t.unknown)}
        {record.review_status === 'author-draft' && t.draftNote}
      </p>
    </div>
  )
}
