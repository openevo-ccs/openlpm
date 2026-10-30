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
export const HANDIN_SCHEMA_VERSION = '1.0'

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
  participantCode: string
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
  participant_code: string
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
    ratings: { correctness: number | null; own_knowledge: number | null; didactic_relevance: number | null }
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
    participant_code: input.participantCode,
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
    (j) => j.ratings.correctness != null && j.ratings.own_knowledge != null && j.ratings.didactic_relevance != null
  ).length
  return [
    { label: 'Dein Teilnahme-Code (ersetzt deinen Namen)', value: h.participant_code },
    { label: 'Gruppe', value: h.groups.length ? h.groups.join(', ') : 'noch keine Gruppe gewählt' },
    ...(h.topic.own_topic || h.topic.favorite_themes.length
      ? [{ label: 'Thema', value: h.topic.own_topic || h.topic.favorite_themes.join(', ') }]
      : []),
    { label: 'Gemerkte Lernziele', value: String(h.starred_lernziele.length) },
    { label: 'Beurteilte Verknüpfungen (alle drei Kriterien)', value: `${rated} von ${h.link_judgments.length}` },
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

export function handInFileBase(h: HandIn): string {
  const date = h.exported_at.slice(0, 10)
  return `${h.tool.sandbox ? 'SANDBOX_' : ''}EvoMentor_Abgabe_${h.participant_code}_${date}`
}

export function handInJsonBlob(h: HandIn): Blob {
  return new Blob([JSON.stringify(h, null, 2)], { type: 'application/json;charset=utf-8' })
}

export { linkKey, JUDGMENT_CRITERIA }
