import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CheckCircle2, FileText, Plus, Star, Trash2 } from 'lucide-react'
import type { ProjectOutletContext } from '../project-layout'
import { listTopics, listTopicContents, type TopicListItem } from '@/lib/supabase/curriculum'
import { bkEntries, buildBkLabelMap, getRootConcepts } from '@/lib/supabase/basiskonzepte'
import { listGroupsWithMyMembership } from '@/lib/supabase/groups'
import {
  JUDGMENT_CRITERIA,
  JUDGMENT_SCALE,
  REFLECTION_PROMPTS,
  deleteWorkEntry,
  getOrCreateParticipantCode,
  linkKey,
  listMyActivityEvents,
  listMyWorkEntries,
  logStudentEvent,
  saveWorkEntry,
  type ActivityEvent,
  type CriterionKey,
  type WorkEntry,
  type WorkKind,
} from '@/lib/supabase/student-work'
import { buildHandIn, describeHandIn, handInFileBase, loadFavoriteTimes, type HandIn } from '@/lib/student-handin'
import { downloadBlob } from '@/lib/export-import'

// "Meine Arbeit": where a student keeps the answers to the seminar 2 task
// (Themenfindung, Lernziele im Thüringer Lehrplan, Basiskonzepte,
// Querschnittsaufgaben) and the homework (judge the Basiskonzept links the
// tool suggests on three criteria). Everything saves as the student goes.
// The last tab builds the Word file that gets uploaded to Moodle. The JSON
// process file was dropped from the page on 2026-10-30 at Susan's request.

// The Thema step and the Basiskonzepte/Querschnitt step were removed on
// 2026-10-29 at Susan's request: the course handles them outside EvoMentor.
// Their tab components are in git history (commit before this one).
type Tab = 'beurteilen' | 'reflexion' | 'abgabe'

const TABS: { key: Tab; label: string }[] = [
  { key: 'beurteilen', label: 'Basiskonzept-Verknüpfungen beurteilen' },
  { key: 'reflexion', label: 'Reflexion' },
  { key: 'abgabe', label: 'Abgabe' },
]

const RELEVANCE_WORD: Record<number, string> = { 0: 'keine', 1: 'niedrig', 2: 'mittel', 3: 'hoch' }

function uuid(): string {
  return crypto.randomUUID()
}

export default function StudentWorkPage() {
  const { project, supabase, defaultBranchId } = useOutletContext<ProjectOutletContext>()
  const projectId = project.id

  const [tab, setTab] = useState<Tab>('beurteilen')
  const [entries, setEntries] = useState<WorkEntry[] | null>(null)
  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [contentById, setContentById] = useState<Map<string, unknown>>(new Map())
  const [starred, setStarred] = useState<{ id: string; starredAt: string | null }[]>([])
  const [rootConcepts, setRootConcepts] = useState<{ id: string; label: string }[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    listMyWorkEntries(supabase, projectId).then(setEntries)
    listTopics(supabase, projectId, defaultBranchId).then(setTopics)
    listTopicContents(supabase, projectId).then(setContentById)
    loadFavoriteTimes(supabase).then(setStarred)
    getRootConcepts(supabase, project).then(setRootConcepts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, projectId, defaultBranchId])

  const entryOf = useCallback(
    (kind: WorkKind, key: string) => entries?.find((e) => e.kind === kind && e.entry_key === key) ?? null,
    [entries]
  )

  const save = useCallback(
    async (kind: WorkKind, key: string, payload: Record<string, any>) => {
      const now = new Date().toISOString()
      setEntries((prev) => {
        const list = prev ?? []
        const i = list.findIndex((e) => e.kind === kind && e.entry_key === key)
        if (i >= 0) return list.map((e, j) => (j === i ? { ...e, payload, updated_at: now } : e))
        return [...list, { id: uuid(), project_id: projectId, user_id: '', kind, entry_key: key, payload, created_at: now, updated_at: now }]
      })
      setSaveState('saving')
      const { error } = await saveWorkEntry(supabase, projectId, kind, key, payload)
      setSaveState(error ? 'error' : 'saved')
    },
    [supabase, projectId]
  )

  const remove = useCallback(
    async (kind: WorkKind, key: string) => {
      setEntries((prev) => (prev ?? []).filter((e) => !(e.kind === kind && e.entry_key === key)))
      setSaveState('saving')
      const { error } = await deleteWorkEntry(supabase, projectId, kind, key)
      setSaveState(error ? 'error' : 'saved')
    },
    [supabase, projectId]
  )

  const topicById = useMemo(() => new Map((topics ?? []).map((t) => [t.id, t])), [topics])
  const starredTopics = useMemo(
    () => starred.map((s) => topicById.get(s.id)).filter((t): t is TopicListItem => !!t),
    [starred, topicById]
  )

  const bkLabels = useMemo(() => {
    const ids = new Set<string>()
    for (const t of starredTopics) for (const e of bkEntries(contentById.get(t.id))) ids.add(e.basiskonzept_id)
    for (const e of entries ?? []) if (e.kind === 'link_judgment' && e.payload.basiskonzept_id) ids.add(e.payload.basiskonzept_id as string)
    return buildBkLabelMap(Array.from(ids), rootConcepts)
  }, [starredTopics, contentById, entries, rootConcepts])

  if (entries === null || topics === null) return <p className="muted">Lädt…</p>

  const judgedCount = entries.filter((e) => e.kind === 'link_judgment').length

  return (
    <div className="student-page">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Aufgabe 1: Basiskonzepte</h1>
          <p className="muted" style={{ marginTop: 0, maxWidth: 680 }}>
            Hier hältst du fest, was du für die erste Aufgabe im Seminar erarbeitest. Alles wird beim Schreiben automatisch gespeichert.
            Am Ende lädst du eine Word-Datei herunter und gibst sie in Moodle ab.
          </p>
        </div>
        <span className="muted" style={{ fontSize: 12 }} aria-live="polite">
          {saveState === 'saving' && 'Speichert…'}
          {saveState === 'saved' && 'Gespeichert'}
          {saveState === 'error' && 'Speichern fehlgeschlagen. Bitte Seite neu laden und noch einmal versuchen.'}
        </span>
      </div>

      <div className="row" style={{ gap: 8, margin: '12px 0 16px', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`chip-btn${tab === t.key ? ' active' : ''}`} onClick={() => { setTab(t.key); void logStudentEvent(supabase, projectId, 'work_tab', { tab: t.key }) }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'beurteilen' && (
        <BeurteilenTab
          starredTopics={starredTopics}
          contentById={contentById}
          bkLabels={bkLabels}
          rootConcepts={rootConcepts}
          entries={entries}
          entryOf={entryOf}
          save={save}
          remove={remove}
          slug={project.slug}
        />
      )}
      {tab === 'reflexion' && <ReflexionTab entryOf={entryOf} save={save} />}
      {tab === 'abgabe' && (
        <AbgabeTab
          supabase={supabase}
          project={project}
          entries={entries}
          starred={starred}
          topics={topics}
          contentById={contentById}
          bkLabels={bkLabels}
          judgedCount={judgedCount}
        />
      )}
    </div>
  )
}

type EntryOf = (kind: WorkKind, key: string) => WorkEntry | null
type Save = (kind: WorkKind, key: string, payload: Record<string, any>) => Promise<void>
type Remove = (kind: WorkKind, key: string) => Promise<void>

// ---------------------------------------------------------- Beurteilen

function BeurteilenTab({
  starredTopics,
  contentById,
  bkLabels,
  rootConcepts,
  entries,
  entryOf,
  save,
  remove,
  slug,
}: {
  starredTopics: TopicListItem[]
  contentById: Map<string, unknown>
  bkLabels: Record<string, string>
  rootConcepts: { id: string; label: string }[]
  entries: WorkEntry[]
  entryOf: EntryOf
  save: Save
  remove: Remove
  slug: string
}) {
  if (starredTopics.length === 0) {
    return (
      <div className="card empty">
        <Star size={28} />
        <p>Du hast noch keine Lernziele gemerkt.</p>
        <p className="muted">
          Suche zuerst unter <Link to={`/dashboard/${slug}`}>Lernziele</Link> passende Lernziele für dein Thema und markiere sie mit dem Stern.
          Sie erscheinen dann hier, und du kannst die vorgeschlagenen Verknüpfungen zu den Basiskonzepten beurteilen.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="muted" style={{ maxWidth: 720 }}>
        Zu jedem gemerkten Lernziel schlägt EvoMentor Verknüpfungen zu Basiskonzepten vor. Beurteile jede Verknüpfung, die du dir ansiehst,
        nach drei Kriterien. Du musst nicht alle beurteilen. Beurteile die, für die du eine begründete Meinung hast.
      </p>
      {starredTopics.map((t) => (
        <LernzielCard
          key={t.id}
          topic={t}
          content={contentById.get(t.id)}
          bkLabels={bkLabels}
          rootConcepts={rootConcepts}
          entries={entries}
          entryOf={entryOf}
          save={save}
          remove={remove}
        />
      ))}
    </div>
  )
}

function LernzielCard({
  topic,
  content,
  bkLabels,
  rootConcepts,
  entries,
  entryOf,
  save,
  remove,
}: {
  topic: TopicListItem
  content: unknown
  bkLabels: Record<string, string>
  rootConcepts: { id: string; label: string }[]
  entries: WorkEntry[]
  entryOf: EntryOf
  save: Save
  remove: Remove
}) {
  // The curriculum data rates all six Basiskonzepte for most Lernziele. The
  // clear suggestions (medium and high) are shown first; the weak ones (low)
  // sit behind a toggle, still judgeable, and stay visible once judged.
  const [showLow, setShowLow] = useState(false)
  const all = bkEntries(content)
    .filter((e) => e.relevanz_beurteilung >= 1)
    .sort((a, b) => b.relevanz_beurteilung - a.relevanz_beurteilung)
  const isJudged = (id: string) => !!entryOf('link_judgment', linkKey(topic.id, id))
  const low = all.filter((e) => e.relevanz_beurteilung < 2)
  const suggested = all.filter((e) => e.relevanz_beurteilung >= 2 || showLow || isJudged(e.basiskonzept_id))
  const hiddenLow = low.filter((e) => !suggested.includes(e)).length
  const proposals = entries.filter((e) => e.kind === 'link_proposal' && e.payload.lernziel_id === topic.id)
  const judged = all.filter((s) => isJudged(s.basiskonzept_id)).length

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Klasse {topic.grade_band ?? '?'}
            {topic.thema ? ` · ${topic.thema}` : ''}
          </p>
          <h3 style={{ margin: '2px 0 4px' }}>{topic.title}</h3>
        </div>
        <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{judged} von {all.length} beurteilt</span>
      </div>
      {topic.description && <p className="muted" style={{ marginTop: 0 }}>{topic.description}</p>}

      {suggested.length === 0 && <p className="muted">Für dieses Lernziel schlägt EvoMentor keine Verknüpfung vor.</p>}
      {suggested.map((s) => (
        <LinkJudgmentRow
          key={s.basiskonzept_id}
          lernzielId={topic.id}
          lernzielTitle={topic.title}
          basiskonzeptId={s.basiskonzept_id}
          label={bkLabels[s.basiskonzept_id] ?? s.basiskonzept_id}
          relevance={s.relevanz_beurteilung}
          rationale={s.begruendung}
          entry={entryOf('link_judgment', linkKey(topic.id, s.basiskonzept_id))}
          save={save}
        />
      ))}

      {hiddenLow > 0 && (
        <button className="btn btn-mini" style={{ marginTop: 8 }} onClick={() => setShowLow(true)}>
          {hiddenLow} Verknüpfung{hiddenLow === 1 ? '' : 'en'} mit niedriger Relevanz anzeigen
        </button>
      )}
      {showLow && low.length > 0 && (
        <button className="btn btn-mini" style={{ marginTop: 8 }} onClick={() => setShowLow(false)}>
          Verknüpfungen mit niedriger Relevanz wieder ausblenden
        </button>
      )}

      {proposals.map((p) => (
        <div key={p.id} className="notice" style={{ marginTop: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Ergänzt: {p.payload.basiskonzept}</strong>
            <button className="btn btn-mini" onClick={() => remove('link_proposal', p.entry_key)} title="Entfernen"><Trash2 size={12} /></button>
          </div>
          <p style={{ margin: '4px 0 0' }}>{p.payload.description}</p>
        </div>
      ))}
      <ProposalForm lernzielId={topic.id} rootConcepts={rootConcepts} save={save} />
    </div>
  )
}

function LinkJudgmentRow({
  lernzielId,
  lernzielTitle,
  basiskonzeptId,
  label,
  relevance,
  rationale,
  entry,
  save,
}: {
  lernzielId: string
  lernzielTitle: string
  basiskonzeptId: string
  label: string
  relevance: number
  rationale: string
  entry: WorkEntry | null
  save: Save
}) {
  const [open, setOpen] = useState(false)
  const p = entry?.payload ?? {}
  const [note, setNote] = useState<string>(p.note ?? '')
  const noteRef = useRef(note)
  noteRef.current = note
  const complete = JUDGMENT_CRITERIA.every((c) => typeof p[c.key] === 'number')

  const write = (patch: Record<string, any>) =>
    save('link_judgment', linkKey(lernzielId, basiskonzeptId), {
      lernziel_id: lernzielId,
      lernziel_title: lernzielTitle,
      basiskonzept_id: basiskonzeptId,
      correctness: p.correctness ?? null,
      own_knowledge: p.own_knowledge ?? null,
      didactic_relevance: p.didactic_relevance ?? null,
      note: noteRef.current,
      ...patch,
    })

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <strong>{label}</strong>
          <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>Vorschlag: Relevanz {RELEVANCE_WORD[relevance] ?? relevance} ({relevance}/3)</span>
        </div>
        <button className={`chip-btn${open ? ' active' : ''}`} onClick={() => setOpen(!open)}>
          {complete ? <><CheckCircle2 size={12} /> beurteilt</> : entry ? 'weiter beurteilen' : 'beurteilen'}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
          {rationale && <p className="muted" style={{ fontSize: 13, marginTop: 0 }}><em>Begründung im Tool:</em> {rationale}</p>}
          {JUDGMENT_CRITERIA.map((c) => (
            <div key={c.key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13 }}><strong>{c.label}</strong> <span className="muted">{c.hint}</span></div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }} role="radiogroup" aria-label={c.label}>
                {JUDGMENT_SCALE.map((s) => (
                  <button
                    key={s.value}
                    role="radio"
                    aria-checked={p[c.key as CriterionKey] === s.value}
                    className={`chip-btn${p[c.key as CriterionKey] === s.value ? ' active' : ''}`}
                    onClick={() => write({ [c.key]: s.value })}
                    title={s.label}
                  >
                    {s.value} {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Begründung oder Anmerkung (optional, ein bis zwei Sätze)</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => write({ note })} />
          </div>
        </div>
      )}
    </div>
  )
}

function ProposalForm({ lernzielId, rootConcepts, save }: { lernzielId: string; rootConcepts: { id: string; label: string }[]; save: Save }) {
  const [open, setOpen] = useState(false)
  const [bk, setBk] = useState('')
  const [text, setText] = useState('')

  if (!open) {
    return (
      <button className="btn btn-mini" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>
        <Plus size={12} /> Eine fehlende Verknüpfung ergänzen
      </button>
    )
  }
  return (
    <div className="notice" style={{ marginTop: 8 }}>
      <div className="field">
        <label>Basiskonzept</label>
        <select value={bk} onChange={(e) => setBk(e.target.value)}>
          <option value="">Bitte wählen</option>
          {rootConcepts.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Warum passt dieses Basiskonzept zum Lernziel?</label>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn btn-primary btn-mini"
          disabled={!bk || !text.trim()}
          onClick={async () => {
            await save('link_proposal', uuid(), { lernziel_id: lernzielId, basiskonzept: bk, description: text.trim() })
            setBk(''); setText(''); setOpen(false)
          }}
        >
          Speichern
        </button>
        <button className="btn btn-mini" onClick={() => setOpen(false)}>Abbrechen</button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------- Reflexion

function ReflexionTab({ entryOf, save }: { entryOf: EntryOf; save: Save }) {
  return (
    <div className="card">
      <h3>Reflexion</h3>
      <p className="muted">Kurze Antworten genügen. Diese Texte gehören dir. Deine Gruppe sieht sie nicht, auch wenn du deine Arbeit mit ihr teilst.</p>
      {REFLECTION_PROMPTS.map((r) => (
        <ReflectionField key={r.key} label={r.label} initial={(entryOf('reflection', r.key)?.payload.text as string) ?? ''} onSave={(v) => save('reflection', r.key, { text: v })} />
      ))}
    </div>
  )
}

function ReflectionField({ label, initial, onSave }: { label: string; initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial)
  return (
    <div className="field">
      <label>{label}</label>
      <textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v)} />
    </div>
  )
}

// -------------------------------------------------------------- Abgabe

function AbgabeTab({
  supabase,
  project,
  entries,
  starred,
  topics,
  contentById,
  bkLabels,
  judgedCount,
}: {
  supabase: ProjectOutletContext['supabase']
  project: ProjectOutletContext['project']
  entries: WorkEntry[]
  starred: { id: string; starredAt: string | null }[]
  topics: TopicListItem[]
  contentById: Map<string, unknown>
  bkLabels: Record<string, string>
  judgedCount: number
}) {
  const [handIn, setHandIn] = useState<HandIn | null>(null)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const template = (project as any).student_view_template as string | undefined

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [evs, groups, code] = await Promise.all([
        listMyActivityEvents(supabase, project.id),
        listGroupsWithMyMembership(supabase, project.id),
        getOrCreateParticipantCode(supabase, project.id, entries),
      ])
      if (cancelled) return
      setEvents(evs)
      const topicRefs = new Map(
        topics.map((t) => [t.id, { id: t.id, title: t.title, grade_band: t.grade_band, thema: t.thema, unterthema: t.unterthema, content: contentById.get(t.id) }])
      )
      setHandIn(
        buildHandIn({
          projectSlug: project.slug,
          viewTemplateId: template ?? 'jena-biologiedidaktik-de',
          sandbox: /sandbox/.test(project.slug),
          participantCode: code,
          groupNames: groups.filter((g) => g.membership).map((g) => g.group.name),
          entries,
          events: evs,
          starred,
          lernziele: topicRefs,
          bkLabels,
        })
      )
    })()
    return () => { cancelled = true }
  }, [supabase, project.id, project.slug, entries, starred, topics, contentById, bkLabels, template])

  if (!handIn) return <p className="muted">Bereitet deine Datei vor…</p>
  const base = handInFileBase(handIn)

  const downloadWord = async () => {
    setBusy(true); setError(null)
    try {
      const { buildHandInDocx } = await import('@/lib/student-handin-docx')
      downloadBlob(await buildHandInDocx(handIn), `${base}.docx`)
      void logStudentEvent(supabase, project.id, 'handin_downloaded', { format: 'docx' })
    } catch (e) {
      const msg = (e as Error).message ?? ''
      // After an update, a page that was already open still points at program
      // files that no longer exist. Reloading fetches the new ones.
      setError(
        /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(msg)
          ? STALE_PAGE_MESSAGE
          : `Die Word-Datei konnte nicht erstellt werden: ${msg}`
      )
    }
    setBusy(false)
  }

  return (
    <div className="card">
      <h3>Abgabe</h3>
      <p className="muted" style={{ maxWidth: 720 }}>
        Du lädst eine Word-Datei herunter und gibst sie in Moodle ab. Sie ist zum Lesen, für dich, die Gruppe und die Dozentin.
        Die Datei enthält weder deinen Namen noch deine E-Mail-Adresse, nur deinen Teilnahme-Code.
      </p>
      {handIn.tool.sandbox && <div className="notice notice-bad">Sandbox: Dies ist ein Testkonto mit synthetischen Daten.</div>}

      <h4>Das steht in deiner Datei</h4>
      <table style={{ width: '100%', maxWidth: 720, marginBottom: 12 }}>
        <tbody>
          {describeHandIn(handIn).map((r) => (
            <tr key={r.label}>
              <td className="muted" style={{ padding: '3px 12px 3px 0' }}>{r.label}</td>
              <td><strong>{r.value}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      <details style={{ marginBottom: 14 }}>
        <summary>Verlauf ansehen (die letzten {Math.min(events.length, 25)} Einträge)</summary>
        <ul style={{ fontSize: 13, marginTop: 6 }}>
          {events.slice(-25).map((ev) => (
            <li key={ev.id}>{new Date(ev.created_at).toLocaleString('de-DE')}: {describeEvent(ev)}</li>
          ))}
        </ul>
      </details>

      {error && (
        <div className="notice notice-bad">
          {error}
          {error === STALE_PAGE_MESSAGE && (
            <div style={{ marginTop: 6 }}>
              <button className="btn btn-mini" onClick={() => window.location.reload()}>Seite jetzt neu laden</button>
            </div>
          )}
        </div>
      )}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={downloadWord} disabled={busy}>
          <FileText size={14} /> Word-Datei herunterladen
        </button>
      </div>
      {judgedCount === 0 && (
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Du hast noch keine Verknüpfung beurteilt. Du kannst trotzdem schon herunterladen und später eine neue Fassung erstellen.
        </p>
      )}
    </div>
  )
}

const STALE_PAGE_MESSAGE =
  'EvoMentor wurde gerade aktualisiert, und diese Seite ist noch die alte Fassung. Deine Antworten sind gespeichert. Bitte lade die Seite neu und klicke dann noch einmal auf „Word-Datei herunterladen“.'

const EVENT_TEXT: Record<string, string> = {
  page_view: 'Seite geöffnet',
  work_saved: 'Eintrag gespeichert',
  work_removed: 'Eintrag entfernt',
  work_tab: 'Bereich in „Meine Arbeit“ gewechselt',
  favorite_toggled: 'Lernziel gemerkt oder Merkung entfernt',
  handin_downloaded: 'Abgabedatei heruntergeladen',
}

function describeEvent(ev: ActivityEvent): string {
  const base = EVENT_TEXT[ev.event_type] ?? ev.event_type
  const d = ev.details ?? {}
  const extra = d.path ?? d.tab ?? d.kind ?? d.format
  return extra ? `${base} (${extra})` : base
}
