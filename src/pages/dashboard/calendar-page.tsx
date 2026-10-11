import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CalendarRange, Library } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { Chip } from '@/components/chip'

// Real feedback 492d1986 (Dustin, 2026-10-10, Biologiedidaktik I / EvoMentor
// Thuringia): the existing Dashboard/Learning Goals/Strands pages are built
// around formally reviewed standards and competencies, grouped by grade band
// or concept -- not around a week-by-week university course schedule. "We
// need a calendar view... to have weeks... reference to the PowerPoints."
//
// Originally shipped (commit 9d985e1) as a German-only page named
// "Wochenplan," wired directly into the global standard sidebar -- which
// leaked a Biologiedidaktik-specific, German-language feature into every
// other project's nav regardless of language, while the actual German
// context (the jena-biologiedidaktik-de template view, student-nav.tsx)
// never got it at all, since that view renders a completely separate,
// hardcoded nav untouched by the standard one. Fixed 2026-10-11 (Dustin):
// this is now a real global page -- "Calendar," English by default -- and
// student-nav.tsx separately links to this same route/component labeled
// "Wochenplan" for the German template view. Language of THIS page's own
// copy follows the project's working_languages (isGermanOnly below), the
// same convention learning-goals-page.tsx already uses to decide whether to
// show the US-specific import panels -- not a new mechanism.
//
// Deliberately does NOT filter by status==='accepted' the way Browse does
// (curriculum.ts's listTopics): every real Biologiedidaktik I entry is
// still 'draft' (nothing has been expert-reviewed yet), and the whole point
// of this page is to let someone work with that draft content, not hide it.

type DataObjectRow = {
  id: string
  title: string
  description: string | null
  object_type: string
  status: string
  content: unknown
  curriculum_sequence: number | null
}

type SourceRow = {
  id: string
  source_name: string
  format: string | null
  license_or_rights_note: string | null
  access_tier: string | null
  url: string | null
}

interface EntryContent {
  datum: string | null
  veranstaltungsformat: string | null
  quelle: string | null
}

function readContent(content: unknown): EntryContent {
  const c = (content ?? {}) as Record<string, unknown>
  return {
    datum: typeof c.datum === 'string' ? c.datum : null,
    veranstaltungsformat: typeof c.veranstaltungsformat === 'string' ? c.veranstaltungsformat : null,
    quelle: typeof c.quelle === 'string' ? c.quelle : null,
  }
}

// The real stored data values (content.veranstaltungsformat) are German --
// this is a real German university course's actual format vocabulary, not
// UI chrome, so the VALUE filtered against stays German in both languages.
// Only the visible label changes, same "translate the chrome, not the data"
// principle as the rest of this page.
const FORMAT_OPTIONS: { value: string; labelEn: string }[] = [
  { value: 'Vorlesung', labelEn: 'Lecture' },
  { value: 'Seminar', labelEn: 'Seminar' },
  { value: 'Selbststudium', labelEn: 'Self-study' },
  { value: 'Selbststudium/Gruppenarbeit', labelEn: 'Self-study / group work' },
  { value: 'Gruppenarbeit', labelEn: 'Group work' },
  { value: 'Prüfung', labelEn: 'Exam' },
  { value: 'Prüfung/Abgabe', labelEn: 'Exam / submission' },
]

function formatDate(iso: string, isGerman: boolean): string {
  const d = new Date(iso + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(isGerman ? 'de-DE' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

const T = {
  en: {
    title: 'Calendar',
    intro: 'The semester schedule by calendar date, with lectures, seminars, self-study, group work and exam dates. Draft stage -- not yet expert-reviewed unless marked otherwise.',
    aiDraft: 'AI draft',
    filterLabel: 'Filter by format',
    allFormats: 'All formats',
    noEntries: 'No dated entries for this project yet.',
    source: 'Source',
    sourceListTitle: 'Sources',
    sourceListIntro: "References to the underlying original files -- not file copies, since OpenLPM doesn't store document uploads.",
  },
  de: {
    title: 'Wochenplan',
    intro: 'Der Semesterablauf nach Kalenderdatum, mit Vorlesung, Seminar, Selbststudium, Gruppenarbeit und Prüfungsterminen. Entwurfsstand — fachlich noch nicht geprüft, sofern nicht anders markiert.',
    aiDraft: 'KI-Entwurf',
    filterLabel: 'Nach Format filtern',
    allFormats: 'Alle Formate',
    noEntries: 'Keine datierten Einträge für dieses Projekt.',
    source: 'Quelle',
    sourceListTitle: 'Quellenverzeichnis',
    sourceListIntro: 'Verweise auf die zugrunde liegenden Originaldateien — keine Dateikopien, da OpenLPM keine Dokumenten-Uploads speichert.',
  },
}

export default function CalendarPage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const [objects, setObjects] = useState<DataObjectRow[] | null>(null)
  const [sources, setSources] = useState<SourceRow[] | null>(null)
  const [formatFilter, setFormatFilter] = useState<string>('')

  const isGerman = project.working_languages?.length === 1 && project.working_languages[0] === 'de'
  const t = isGerman ? T.de : T.en

  useEffect(() => {
    setObjects(null); setSources(null)
    supabase
      .from('lpm_data_objects')
      .select('id, title, description, object_type, status, content, curriculum_sequence')
      .eq('project_id', project.id)
      .then(({ data }) => setObjects((data as DataObjectRow[] | null) ?? []))
    supabase
      .from('project_source_declarations')
      .select('id, source_name, format, license_or_rights_note, access_tier, url')
      .eq('project_id', project.id)
      .then(({ data }) => setSources((data as SourceRow[] | null) ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  if (objects === null || sources === null) return <p className="muted">{isGerman ? 'Lädt…' : 'Loading…'}</p>

  const overview = objects.filter((o) => o.object_type === 'strand' && readContent(o.content).datum === null)
  const dated = objects
    .filter((o) => readContent(o.content).datum !== null)
    .filter((o) => !formatFilter || readContent(o.content).veranstaltungsformat === formatFilter)
    .slice()
    .sort((a, b) => (a.curriculum_sequence ?? 0) - (b.curriculum_sequence ?? 0))

  const weeks = new Map<string, DataObjectRow[]>()
  for (const row of dated) {
    const datum = readContent(row.content).datum as string
    if (!weeks.has(datum)) weeks.set(datum, [])
    weeks.get(datum)!.push(row)
  }

  return (
    <div>
      <h1 className="row"><CalendarRange size={18} style={{ color: 'var(--text-muted)' }} />{t.title}</h1>
      <p className="muted" style={{ marginBottom: 12 }}>{t.intro}</p>

      {overview.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          {overview.map((row) => (
            <div key={row.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{row.title}</strong>
                <Chip status={row.status}>{row.status === 'draft' ? t.aiDraft : row.status}</Chip>
              </div>
              <p className="muted" style={{ marginTop: 4 }}>{row.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="field" style={{ maxWidth: 320, marginBottom: 16 }}>
        <label>{t.filterLabel}</label>
        <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
          <option value="">{t.allFormats}</option>
          {FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{isGerman ? f.value : f.labelEn}</option>)}
        </select>
      </div>

      {weeks.size === 0 ? (
        <div className="card empty">
          <CalendarRange size={32} />
          <p>{t.noEntries}</p>
        </div>
      ) : (
        Array.from(weeks.entries()).map(([datum, rows]) => (
          <div key={datum} className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>{formatDate(datum, isGerman)}</h3>
            {rows.map((row) => {
              const c = readContent(row.content)
              const formatLabel = isGerman ? c.veranstaltungsformat : FORMAT_OPTIONS.find((f) => f.value === c.veranstaltungsformat)?.labelEn ?? c.veranstaltungsformat
              return (
                <div key={row.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <strong>{row.title}</strong>
                    <div className="row" style={{ gap: 6 }}>
                      {formatLabel && <Chip status="pending">{formatLabel}</Chip>}
                      <Chip status={row.status}>{row.status === 'draft' ? t.aiDraft : row.status}</Chip>
                    </div>
                  </div>
                  <p style={{ marginTop: 4, marginBottom: 4 }}>{row.description}</p>
                  {c.quelle && <p className="muted" style={{ fontSize: 12 }}>{t.source}: {c.quelle}</p>}
                </div>
              )
            })}
          </div>
        ))
      )}

      {sources.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="row" style={{ marginTop: 0 }}><Library size={16} />{t.sourceListTitle}</h3>
          <p className="muted" style={{ marginBottom: 8 }}>{t.sourceListIntro}</p>
          {sources.map((s) => (
            <div key={s.id} style={{ marginBottom: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span><strong>{s.source_name}</strong>{s.format ? ` (${s.format})` : ''}</span>
                {s.access_tier && <Chip status={s.access_tier === 'citation-only' ? 'citation_only' : 'pending'}>{s.access_tier}</Chip>}
              </div>
              {s.license_or_rights_note && <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>{s.license_or_rights_note}</p>}
              {s.url && <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>{s.url}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
