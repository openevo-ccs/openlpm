import type { ProjectComparisonProfile } from '@/lib/supabase/comparative-analysis'

// Shared by coherence-page.tsx's "Across curricula" tab (English, researcher
// view) and the German/US custom views' own "Vergleich"/"Comparison" tab
// (curriculum-connections-page.tsx) -- one real component instead of two
// near-duplicates. Depth and breadth are kept as two separate fields,
// never combined into one score -- Dustin's own explicit 2026-10-20
// decision. Bio-Core's narrower scope is a deliberate feature of what DCR
// tests; Interdisciplinary's wider scope is a deliberate feature of what
// ICR tests. Two real design choices, each on its own terms.
const STRINGS = {
  en: {
    note: 'Depth and breadth are kept separate on purpose — neither axis implies the other model is "more finished."',
    breadth: 'Breadth of scope',
    depth: 'Depth within that scope',
    grounding: 'Ecosystem grounding',
    strands: (n: number) => `${n} strand${n === 1 ? '' : 's'}`,
    domains: (n: number) => `${n} subject domain${n === 1 ? '' : 's'}`,
    grades: (n: number) => `${n} grade bands`,
    perItem: (a: number, b: number) => `avg. ${a} performance indicators/item · avg. ${b} real-world links/item`,
    groundingLine: (t: number, l: number, c: number) => `${t} theories · ${l} literature refs · ${c} real-world curriculum links`,
  },
  de: {
    note: 'Tiefe und Breite werden bewusst getrennt gezeigt — keine der beiden Achsen bedeutet, dass das andere Modell „weiter entwickelt" ist.',
    breadth: 'Fachliche Breite',
    depth: 'Tiefe innerhalb dieses Umfangs',
    grounding: 'Verankerung im Ökosystem',
    strands: (n: number) => `${n} Strang${n === 1 ? '' : 'e'}`,
    domains: (n: number) => `${n} Fachbereich${n === 1 ? '' : 'e'}`,
    grades: (n: number) => `${n} Klassenstufen-Bänder`,
    perItem: (a: number, b: number) => `Ø ${a} Lernindikatoren/Einheit · Ø ${b} Praxis-Verknüpfungen/Einheit`,
    groundingLine: (t: number, l: number, c: number) => `${t} Theorien · ${l} Literaturverweise · ${c} reale Lehrplan-Verknüpfungen`,
  },
} as const

export function LpmComparisonProfileCard({
  profile,
  label,
  language = 'en',
}: {
  profile: ProjectComparisonProfile
  label: string
  language?: 'en' | 'de'
}) {
  const t = STRINGS[language]
  return (
    <div className="card">
      <strong>{label}</strong>
      <p className="muted" style={{ fontSize: 11, marginTop: 2, marginBottom: 8 }}>{t.note}</p>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
        <span>{t.breadth}</span>
      </div>
      <p style={{ fontSize: 12, margin: '2px 0 8px' }}>
        {t.strands(profile.strand_count)} · {t.domains(profile.subject_domain_count)} · {t.grades(profile.grade_bands_covered)}
      </p>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
        <span>{t.depth}</span>
      </div>
      <p style={{ fontSize: 12, margin: '2px 0 8px' }}>
        {t.perItem(profile.avg_performance_indicators ?? 0, profile.avg_real_world_links ?? 0)}
      </p>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
        <span>{t.grounding}</span>
      </div>
      <p style={{ fontSize: 12, margin: '2px 0 0' }}>
        {t.groundingLine(profile.theory_count, profile.literature_count, profile.curriculum_repository_link_count)}
      </p>
    </div>
  )
}
