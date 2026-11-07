import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase/database.types'
import { bkEntries } from './supabase/basiskonzepte'
import {
  JUDGMENT_CRITERIA,
  REFLECTION_PROMPTS,
  linkKey,
  type ActivityEvent,
  type WorkEntry,
} from './supabase/student-work'

type Client = SupabaseClient<Database>

export const HANDIN_SCHEMA = 'openlpm.jena-biologiedidaktik.handin'
// 1.1 (2026-11-06, feedback 51ebbcdc): the file carries the student's own name instead of a random participation code.
export const HANDIN_SCHEMA_VERSION = '1.1'

export interface LernzielRef {
  id: string
  title: string
  grade_band: string | null
  thema?: string | null
  unterthema?: string | null
  content?: unknown
}

export interface HandInInput {
  projectSlug: string
  viewTemplateId: string
  sandbox: boolean
  participantName: string
  groupNames: string[]
  entries: WorkEntry[]
  events: ActivityEvent[]
  starred: { id: string; starredAt: string | null }[]
  lernziele: Map<string, LernzielRef>
  // basiskonzept_id (the curriculum data's own code) -> readable label
  bkLabels: Record<string, string>
  now?: Date
}

export interface HandIn {
  schema: typeof HANDIN_SCHEMA
  schema_version: typeof HANDIN_SCHEMA_VERSION
  exported_at: string
  tool: { app: 'OpenLPM'; space: string; view: string; sandbox: boolean }
  task: { course: string; seminar: string }
  participant_name: string
  groups: string[]
  topic: {
    favorite_themes: string[]
    own_topic: string
    reasoning: string
    updated_at: string | null
  }
  grade_bands: { bands: string[]; note: string; updated_at: string | null }
  starred_lernziele: { id: string; title: string; grade_band: string | null; thema: string | null; unterthema: string | null; starred_at: string | null }[]
  link_judgments: {
    lernziel_id: string
    lernziel_title: string
    grade_band: string | null
    basiskonzept_id: string
    basiskonzept: string
    curriculum_relevance: number | null
    curriculum_rationale: string | null
    ratings: { correctness: number | null; own_knowledge: number | null; relevance_level: number | null; didactic_relevance: number | null }
    note: string
    updated_at: string
  }[]
  link_proposals: { id: string; lernziel_id: string | null; lernziel_title: string | null; basiskonzept: string; description: string; updated_at: string }[]
  topic_basiskonzepte: { basiskonzept: string; concrete_link: string; updated_at: string }[]
  cross_cutting: { theme: string; note: string; updated_at: string }[]
  reflections: { prompt_key: string; prompt: string; text: string; updated_at: string }[]
  activity_timeline: { t: string; event: string; details: Record<string, any> }[]
  counts: Record<string, number>
}

function byKind(entries: WorkEntry[], kind: WorkEntry['kind']) {
  return entries.filter((e) => e.kind === kind)
}

export function buildHandIn(input: HandInInput): HandIn {
  const { entries, lernziele, bkLabels } = input
  const topic = entries.find((e) => e.kind === 'topic' && e.entry_key === 'main')
  const bands = entries.find((e) => e.kind === 'grade_bands' && e.entry_key === 'main')

  const link_judgments = byKind(entries, 'link_judgment').map((e) => {
    const p = e.payload
    const lz = lernziele.get(p.lernziel_id as string)
    const bk = bkEntries(lz?.content).find((b) => b.basiskonzept_id === p.basiskonzept_id)
    return {
      lernziel_id: p.lernziel_id as string,
      lernziel_title: lz?.title ?? (p.lernziel_title as string) ?? '',
      grade_band: lz?.grade_band ?? null,
      basiskonzept_id: p.basiskonzept_id as string,
      basiskonzept: bkLabels[p.basiskonzept_id as string] ?? (p.basiskonzept_id as string),
      curriculum_relevance: bk ? bk.relevanz_beurteilung : null,
      curriculum_rationale: bk ? bk.begruendung : null,
      ratings: {
        correctness: (p.correctness as number | undefined) ?? null,
        own_knowledge: (p.own_knowledge as number | undefined) ?? null,
        relevance_level: (p.relevance_level as number | undefined) ?? null,
        didactic_relevance: (p.didactic_relevance as number | undefined) ?? null,
      },
      note: ((p.note as string | undefined) ?? '').trim(),
      updated_at: e.updated_at,
    }
  })

  const promptByKey = new Map<string, string>(REFLECTION_PROMPTS.map((p) => [p.key, p.label]))

  const out: HandIn = {
    schema: HANDIN_SCHEMA,
    schema_version: HANDIN_SCHEMA_VERSION,
    exported_at: (input.now ?? new Date()).toISOString(),
    tool: { app: 'OpenLPM', space: input.projectSlug, view: input.viewTemplateId, sandbox: input.sandbox },
    task: { course: 'Allgemeine Fachdidaktik Biologie, Universität Jena, WS 2026/27', seminar: 'S2 Themenfindung und EvoMentor (9.11.2026)' },
    participant_name: input.participantName,
    groups: input.groupNames,
    topic: {
      favorite_themes: (topic?.payload.favorite_themes as string[] | undefined) ?? [],
      own_topic: ((topic?.payload.own_topic as string | undefined) ?? '').trim(),
      reasoning: ((topic?.payload.reasoning as string | undefined) ?? '').trim(),
      updated_at: topic?.updated_at ?? null,
    },
    grade_bands: {
      bands: (bands?.payload.bands as string[] | undefined) ?? [],
      note: ((bands?.payload.note as string | undefined) ?? '').trim(),
      updated_at: bands?.updated_at ?? null,
    },
    starred_lernziele: input.starred.map((s) => {
      const lz = lernziele.get(s.id)
      return {
        id: s.id,
        title: lz?.title ?? '',
        grade_band: lz?.grade_band ?? null,
        thema: lz?.thema ?? null,
        unterthema: lz?.unterthema ?? null,
        starred_at: s.starredAt,
      }
    }),
    link_judgments,
    link_proposals: byKind(entries, 'link_proposal').map((e) => ({
      id: e.entry_key,
      lernziel_id: (e.payload.lernziel_id as string | undefined) ?? null,
      lernziel_title: e.payload.lernziel_id ? lernziele.get(e.payload.lernziel_id as string)?.title ?? null : null,
      basiskonzept: (e.payload.basiskonzept as string | undefined) ?? '',
      description: ((e.payload.description as string | undefined) ?? '').trim(),
      updated_at: e.updated_at,
    })),
    topic_basiskonzepte: byKind(entries, 'topic_basiskonzept').map((e) => ({
      basiskonzept: bkLabels[e.entry_key] ?? e.entry_key,
      concrete_link: ((e.payload.concrete_link as string | undefined) ?? '').trim(),
      updated_at: e.updated_at,
    })),
    cross_cutting: byKind(entries, 'cross_cutting')
      .filter((e) => e.payload.selected !== false)
      .map((e) => ({ theme: e.entry_key, note: ((e.payload.note as string | undefined) ?? '').trim(), updated_at: e.updated_at })),
    reflections: byKind(entries, 'reflection').filter((e) => promptByKey.has(e.entry_key)).map((e) => ({
      prompt_key: e.entry_key,
      prompt: promptByKey.get(e.entry_key) ?? e.entry_key,
      text: ((e.payload.text as string | undefined) ?? '').trim(),
      updated_at: e.updated_at,
    })),
    activity_timeline: input.events.map((ev) => ({ t: ev.created_at, event: ev.event_type, details: ev.details })),
    counts: {},
  }
  out.counts = {
    starred_lernziele: out.starred_lernziele.length,
    link_judgments: out.link_judgments.length,
    link_proposals: out.link_proposals.length,
    topic_basiskonzepte: out.topic_basiskonzepte.length,
    cross_cutting: out.cross_cutting.length,
    reflections: out.reflections.filter((r) => r.text).length,
    activity_events: out.activity_timeline.length,
  }
  return out
}

/** Participant-facing summary of what will be in the files, shown before the download. */
export function describeHandIn(h: HandIn): { label: string; value: string }[] {
  const rated = h.link_judgments.filter(
    (j) => j.ratings.correctness != null && j.ratings.own_knowledge != null && j.ratings.relevance_level != null && j.ratings.didactic_relevance != null
  ).length
  return [
    { label: 'Dein Name', value: h.participant_name || 'noch nicht eingetragen' },
    groupNumberLine(h.groups),
    ...(h.topic.own_topic || h.topic.favorite_themes.length
      ? [{ label: 'Thema', value: h.topic.own_topic || h.topic.favorite_themes.join(', ') }]
      : []),
    { label: 'Gemerkte Lernziele', value: String(h.starred_lernziele.length) },
    { label: 'Beurteilte Verknüpfungen (alle vier Kriterien)', value: `${rated} von ${h.link_judgments.length}` },
    { label: 'Eigene ergänzte Verknüpfungen', value: String(h.link_proposals.length) },
    ...(h.topic_basiskonzepte.length ? [{ label: 'Basiskonzepte zum Thema', value: String(h.topic_basiskonzepte.length) }] : []),
    ...(h.cross_cutting.length ? [{ label: 'Querschnittsaufgaben', value: String(h.cross_cutting.length) }] : []),
    { label: 'Ausgefüllte Reflexionsfragen', value: `${h.counts.reflections} von ${REFLECTION_PROMPTS.length}` },
  ]
}

export async function loadFavoriteTimes(supabase: Client): Promise<{ id: string; starredAt: string | null }[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await (supabase as any)
    .from('user_favorite_learning_goals')
    .select('data_object_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  return ((data ?? []) as { data_object_id: string; created_at: string | null }[]).map((r) => ({
    id: r.data_object_id,
    starredAt: r.created_at,
  }))
}

/**
 * The group line for the file. Groups are named "Gruppe 3" and so on, so a plain number is shown when
 * the name has that shape (Susan, 2026-11-07: the group number goes into the file automatically).
 */
export function groupNumberLine(groups: string[]): { label: string; value: string } {
  if (!groups.length) return { label: 'Gruppennummer', value: 'noch keine Gruppe gewählt' }
  const numbers = groups.map((g) => /^\s*Gruppe\s*(\d+)\s*$/i.exec(g)?.[1])
  if (numbers.every(Boolean)) return { label: groups.length > 1 ? 'Gruppennummern' : 'Gruppennummer', value: numbers.join(', ') }
  return { label: 'Gruppe', value: groups.join(', ') }
}

export function handInFileBase(h: HandIn): string {
  const date = h.exported_at.slice(0, 10)
  // Name as a safe file name part: umlauts folded, everything else but letters and digits dropped.
  const who = h.participant_name
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const groupNo = h.groups.length === 1 ? /^\s*Gruppe\s*(\d+)\s*$/i.exec(h.groups[0])?.[1] : undefined
  return `${h.tool.sandbox ? 'SANDBOX_' : ''}EvoMentor_Abgabe_${who || 'ohne_Name'}${groupNo ? `_Gruppe${groupNo}` : ''}_${date}`
}

/**
 * The name stored in the student's profile, used only to pre-fill the name field of the hand-in.
 * Many profiles hold just the sign-in address as their name (it is the default at sign-up), so an
 * address is never returned: the student types the name instead.
 */
export async function loadProfileName(supabase: Client): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return ''
  const { data } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle()
  const name = ((data as { name?: string | null } | null)?.name ?? '').trim()
  return name.includes('@') ? '' : name
}

export function handInJsonBlob(h: HandIn): Blob {
  return new Blob([JSON.stringify(h, null, 2)], { type: 'application/json;charset=utf-8' })
}

export { linkKey, JUDGMENT_CRITERIA }
