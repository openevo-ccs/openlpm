import { useEffect, useState } from 'react'
import { BadgeCheck, AlertTriangle } from 'lucide-react'
import type { ProjectOutletContext } from '@/pages/dashboard/project-layout'

// "Which Lehrplan is this project built on, and does it match?" (Dustin, 2026-11-01).
// A project declares the curriculum documents it follows (project_source_declarations, each one pointing at a record of the state's
// Curriculum Repository and naming the grade bands it covers). This card compares that declaration with the project's own goals:
// how many goals of each grade band are linked to the declared edition, and whether the project uses grade bands the Lehrplan
// does not have (or leaves out ones it has). It shows nothing for a project without a declaration.

type Supabase = ProjectOutletContext['supabase']
type Lang = 'de' | 'en'

interface Declaration {
  id: string
  source_name: string
  url: string | null
  grade_bands: string[] | null
  repository_record_id: string
}

interface BandCheck {
  band: string
  goals: number
  linked: number
  tagged: number
}

interface SourceCheck {
  declaration: Declaration
  bands: BandCheck[]
}

interface Loaded {
  sources: SourceCheck[]
  projectBands: string[]
  lehrplanBands: string[]
}

const T = {
  de: {
    title: 'Grundlage: Lehrplan',
    intro: 'Dieses Projekt folgt diesen Lehrplänen. Die Prüfung vergleicht die Lernziele mit dem Lehrplan-Eintrag im Curriculum-Verzeichnis des Landes.',
    band: 'Klassenstufe',
    of: 'von',
    linked: 'verknüpft',
    ok: 'Alles passt',
    openIssues: 'Prüfen',
    bandsLine: 'Klassenstufen im Lehrplan',
    inProject: 'im Projekt',
    extra: 'Im Projekt, aber nicht im Lehrplan',
    missing: 'Im Lehrplan, aber ohne Lernziele im Projekt',
    source: 'Quelle',
  },
  en: {
    title: 'Curriculum basis',
    intro: 'This project follows these curriculum documents. The check compares its learning goals with the state\'s Curriculum Repository record.',
    band: 'Grade',
    of: 'of',
    linked: 'linked',
    ok: 'Everything matches',
    openIssues: 'Check',
    bandsLine: 'Grade bands in the Lehrplan',
    inProject: 'in the project',
    extra: 'In the project but not in the Lehrplan',
    missing: 'In the Lehrplan but no goals in the project',
    source: 'Source',
  },
} as const

const bandOrder = (b: string) => parseInt(b, 10) || 0

async function load(supabase: Supabase, projectId: string): Promise<Loaded | null> {
  const { data: decls } = await (supabase as any)
    .from('project_source_declarations')
    .select('id, source_name, url, grade_bands, repository_record_id')
    .eq('project_id', projectId)
    .not('repository_record_id', 'is', null)
    .order('created_at')
  const declarations = (decls ?? []) as Declaration[]
  if (declarations.length === 0) return null

  const recordIds = declarations.map((d) => d.repository_record_id)
  const [{ data: goals }, { data: links }, { data: records }] = await Promise.all([
    (supabase as any).from('lpm_data_objects').select('id, grade_band, ed:content->>curriculum_version').eq('project_id', projectId).eq('status', 'accepted').limit(5000),
    (supabase as any).from('curriculum_repository_links').select('data_object_id, repository_record_id').eq('project_id', projectId).in('repository_record_id', recordIds).limit(5000),
    (supabase as any).from('curriculum_repository_records').select('id, content').in('id', recordIds),
  ])
  const goalRows = (goals ?? []) as { id: string; grade_band: string | null; ed: string | null }[]
  const linkSets = new Map<string, Set<string>>()
  for (const l of (links ?? []) as { data_object_id: string; repository_record_id: string }[]) {
    if (!linkSets.has(l.repository_record_id)) linkSets.set(l.repository_record_id, new Set())
    linkSets.get(l.repository_record_id)!.add(l.data_object_id)
  }
  const lehrplanBands = new Set<string>()
  for (const r of (records ?? []) as { id: string; content: { gradeBands?: string[] } | null }[]) {
    for (const b of r.content?.gradeBands ?? []) lehrplanBands.add(b)
  }

  const sources: SourceCheck[] = declarations.map((d) => {
    const linked = linkSets.get(d.repository_record_id) ?? new Set<string>()
    const bands = (d.grade_bands ?? []).map((band) => {
      const inBand = goalRows.filter((g) => g.grade_band === band)
      return { band, goals: inBand.length, linked: inBand.filter((g) => linked.has(g.id)).length, tagged: inBand.filter((g) => !!g.ed).length }
    })
    return { declaration: d, bands }
  })
  const projectBands = Array.from(new Set(goalRows.map((g) => g.grade_band).filter(Boolean) as string[]))
  return { sources, projectBands, lehrplanBands: Array.from(lehrplanBands) }
}

export function CurriculumSourceCard({ supabase, projectId, lang }: { supabase: Supabase; projectId: string; lang: Lang }) {
  const t = T[lang]
  const [data, setData] = useState<Loaded | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    load(supabase, projectId).then((d) => alive && setData(d)).catch(() => alive && setData(null))
    return () => { alive = false }
  }, [supabase, projectId])

  if (!data) return null

  const bandsDeclared = new Set(data.sources.flatMap((s) => s.declaration.grade_bands ?? []))
  const extra = data.projectBands.filter((b) => !bandsDeclared.has(b) && !data.lehrplanBands.includes(b)).sort((a, b) => bandOrder(a) - bandOrder(b))
  const missing = data.lehrplanBands.filter((b) => !data.projectBands.includes(b)).sort((a, b) => bandOrder(a) - bandOrder(b))
  const unlinked = data.sources.reduce((n, s) => n + s.bands.reduce((m, b) => m + (b.goals - b.linked), 0), 0)
  const allGood = extra.length === 0 && missing.length === 0 && unlinked === 0
  const sortBands = (a: string[]) => [...a].sort((x, y) => bandOrder(x) - bandOrder(y))

  return (
    <details className="card" style={{ marginBottom: 12 }}>
      <summary className="row" style={{ cursor: 'pointer', gap: 8, alignItems: 'center' }}>
        {allGood ? <BadgeCheck size={15} style={{ color: 'var(--good)' }} /> : <AlertTriangle size={15} style={{ color: 'var(--warn, #b7791f)' }} />}
        <strong>{t.title}</strong>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {data.sources.map((s) => s.declaration.source_name.split(',')[0]).join(' · ')} — {allGood ? t.ok : t.openIssues}
        </span>
      </summary>
      <p className="muted" style={{ fontSize: 12.5, margin: '8px 0' }}>{t.intro}</p>
      {data.sources.map((s) => (
        <div key={s.declaration.id} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {s.declaration.source_name}
            {s.declaration.url && (
              <>
                {' '}
                <a href={s.declaration.url} target="_blank" rel="noreferrer" style={{ fontWeight: 400, fontSize: 12 }}>{t.source}</a>
              </>
            )}
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {s.bands.map((b) => (
              <span key={b.band} className="chip" style={b.goals === 0 || b.linked < b.goals ? { borderColor: 'var(--warn, #b7791f)' } : undefined}>
                {t.band} {b.band}: {b.linked} {t.of} {b.goals} {t.linked}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="muted" style={{ fontSize: 12.5 }}>
        {t.bandsLine}: {sortBands(data.lehrplanBands).join(', ') || '—'} · {t.inProject}: {sortBands(data.projectBands).join(', ') || '—'}
      </div>
      {extra.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--warn, #b7791f)' }}>{t.extra}: {extra.join(', ')}</div>}
      {missing.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--warn, #b7791f)' }}>{t.missing}: {missing.join(', ')}</div>}
    </details>
  )
}
