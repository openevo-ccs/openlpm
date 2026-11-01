import { useEffect, useState } from 'react'
import { AlertTriangle, BadgeCheck } from 'lucide-react'
import type { ProjectOutletContext } from '@/pages/dashboard/project-layout'

// "Which Lehrplan is this project built on, and does it match?" (Dustin, 2026-11-01).
// Built on what already exists: a project is linked to its state's Curriculum Repository (project_repository_links, 2026-10-04), each
// goal can be linked to the edition record it was built from (curriculum_repository_links, relation built_from), and the repository's
// grade-band record names the grade bands the Lehrplan itself uses (content.gradeBands). This card compares the three: per edition,
// how many goals of each grade band are linked to it, whether the project uses grade bands the Lehrplan does not have or leaves out
// ones it has, and which goals have no link at all. It shows nothing for a project without a project-level link.

type Supabase = ProjectOutletContext['supabase']
type Lang = 'de' | 'en'

interface BandCount {
  band: string
  goals: number
  linked: number
}

interface Edition {
  id: string
  title: string
  url: string | null
  bands: BandCount[]
}

interface Loaded {
  editions: Edition[]
  unlinkedBands: BandCount[]
  projectBands: string[]
  lehrplanBands: string[]
}

const T = {
  de: {
    title: 'Grundlage: Lehrplan',
    intro: 'Dieses Projekt ist mit dem Curriculum-Verzeichnis des Landes verbunden. Die Prüfung zeigt, wie viele Lernziele je Klassenstufe mit der Lehrplan-Ausgabe verknüpft sind, aus der sie stammen.',
    band: 'Klassenstufe',
    of: 'von',
    linked: 'verknüpft',
    ok: 'Alles passt',
    check: 'Bitte prüfen',
    bandsLine: 'Klassenstufen im Lehrplan',
    inProject: 'im Projekt',
    extra: 'Im Projekt, aber nicht im Lehrplan',
    missing: 'Im Lehrplan, aber ohne Lernziele im Projekt',
    noLink: 'Ohne Verknüpfung',
    goals: 'Lernziele',
    source: 'Quelle',
  },
  en: {
    title: 'Curriculum basis',
    intro: "This project is connected to the state's Curriculum Repository. The check shows how many goals of each grade band are linked to the Lehrplan edition they come from.",
    band: 'Grade',
    of: 'of',
    linked: 'linked',
    ok: 'Everything matches',
    check: 'Please check',
    bandsLine: 'Grade bands in the Lehrplan',
    inProject: 'in the project',
    extra: 'In the project but not in the Lehrplan',
    missing: 'In the Lehrplan but no goals in the project',
    noLink: 'Without a link',
    goals: 'goals',
    source: 'Source',
  },
} as const

const bandOrder = (b: string) => parseInt(b, 10) || 0
const sortBands = (a: string[]) => [...a].sort((x, y) => bandOrder(x) - bandOrder(y))

async function load(supabase: Supabase, projectId: string): Promise<Loaded | null> {
  const db = supabase as any
  const { data: projectLinks } = await db.from('project_repository_links').select('repository_project_id').eq('project_id', projectId)
  const repoIds = ((projectLinks ?? []) as { repository_project_id: string }[]).map((l) => l.repository_project_id)
  if (repoIds.length === 0) return null

  const [{ data: goals }, { data: links }, { data: bandRecords }] = await Promise.all([
    db.from('lpm_data_objects').select('id, grade_band').eq('project_id', projectId).eq('status', 'accepted').limit(5000),
    db.from('curriculum_repository_links').select('data_object_id, repository_record_id').eq('project_id', projectId).eq('relation_type', 'built_from').limit(5000),
    db.from('curriculum_repository_records').select('id, gb:content->gradeBands').in('project_id', repoIds).limit(2000),
  ])
  const goalRows = ((goals ?? []) as { id: string; grade_band: string | null }[]).filter((g) => g.grade_band)
  const goalIds = new Set(goalRows.map((g) => g.id))
  const byRecord = new Map<string, Set<string>>()
  const linkedAny = new Set<string>()
  for (const l of (links ?? []) as { data_object_id: string; repository_record_id: string }[]) {
    if (!goalIds.has(l.data_object_id)) continue
    linkedAny.add(l.data_object_id)
    if (!byRecord.has(l.repository_record_id)) byRecord.set(l.repository_record_id, new Set())
    byRecord.get(l.repository_record_id)!.add(l.data_object_id)
  }
  const lehrplanBands = new Set<string>()
  for (const r of (bandRecords ?? []) as { gb: string[] | null }[]) for (const b of r.gb ?? []) lehrplanBands.add(b)

  const recordIds = Array.from(byRecord.keys())
  const { data: recs } = recordIds.length
    ? await db.from('curriculum_repository_records').select('id, title, url:content->>sourceUrl').in('id', recordIds)
    : { data: [] }
  const allBands = sortBands(Array.from(new Set(goalRows.map((g) => g.grade_band as string))))
  const editions: Edition[] = ((recs ?? []) as { id: string; title: string; url: string | null }[]).map((r) => {
    const linked = byRecord.get(r.id) ?? new Set<string>()
    const bands = allBands
      .map((band) => {
        const inBand = goalRows.filter((g) => g.grade_band === band)
        return { band, goals: inBand.length, linked: inBand.filter((g) => linked.has(g.id)).length }
      })
      .filter((b) => b.linked > 0)
    return { id: r.id, title: r.title, url: r.url, bands }
  })
  const unlinkedBands = allBands
    .map((band) => {
      const inBand = goalRows.filter((g) => g.grade_band === band)
      return { band, goals: inBand.length, linked: inBand.filter((g) => linkedAny.has(g.id)).length }
    })
    .filter((b) => b.linked < b.goals)
  return { editions, unlinkedBands, projectBands: allBands, lehrplanBands: sortBands(Array.from(lehrplanBands)) }
}

export function CurriculumSourceCard({ supabase, projectId, lang }: { supabase: Supabase; projectId: string; lang: Lang }) {
  const t = T[lang]
  const [data, setData] = useState<Loaded | null>(null)

  useEffect(() => {
    let alive = true
    load(supabase, projectId).then((d) => alive && setData(d)).catch(() => alive && setData(null))
    return () => { alive = false }
  }, [supabase, projectId])

  if (!data) return null

  const haveBands = data.lehrplanBands.length > 0
  const extra = haveBands ? data.projectBands.filter((b) => !data.lehrplanBands.includes(b)) : []
  const missing = haveBands ? data.lehrplanBands.filter((b) => !data.projectBands.includes(b)) : []
  const allGood = extra.length === 0 && missing.length === 0 && data.unlinkedBands.length === 0 && data.editions.length > 0
  const warn = { color: 'var(--warn, #b7791f)', fontSize: 12.5 } as const

  return (
    <details className="card" style={{ marginBottom: 12 }}>
      <summary className="row" style={{ cursor: 'pointer', gap: 8, alignItems: 'center' }}>
        {allGood ? <BadgeCheck size={15} style={{ color: 'var(--good)' }} /> : <AlertTriangle size={15} style={{ color: 'var(--warn, #b7791f)' }} />}
        <strong>{t.title}</strong>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {data.editions.map((e) => e.title.split(' published')[0]).join(' · ') || '—'} — {allGood ? t.ok : t.check}
        </span>
      </summary>
      <p className="muted" style={{ fontSize: 12.5, margin: '8px 0' }}>{t.intro}</p>
      {data.editions.map((e) => (
        <div key={e.id} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {e.title.split(' published')[0]}
            {e.url && (
              <>
                {' '}
                <a href={e.url} target="_blank" rel="noreferrer" style={{ fontWeight: 400, fontSize: 12 }}>{t.source}</a>
              </>
            )}
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {e.bands.map((b) => (
              <span key={b.band} className="chip" style={b.linked < b.goals ? { borderColor: 'var(--warn, #b7791f)' } : undefined}>
                {t.band} {b.band}: {b.linked} {t.of} {b.goals} {t.linked}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="muted" style={{ fontSize: 12.5 }}>
        {t.bandsLine}: {data.lehrplanBands.join(', ') || '—'} · {t.inProject}: {data.projectBands.join(', ') || '—'}
      </div>
      {extra.length > 0 && <div style={warn}>{t.extra}: {extra.join(', ')}</div>}
      {missing.length > 0 && <div style={warn}>{t.missing}: {missing.join(', ')}</div>}
      {data.unlinkedBands.length > 0 && (
        <div style={warn}>
          {t.noLink}: {data.unlinkedBands.map((b) => `${t.band} ${b.band}: ${b.goals - b.linked} ${t.of} ${b.goals} ${t.goals}`).join(' · ')}
        </div>
      )}
    </details>
  )
}
