import { useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useCurriculumConnectionsData } from './use-curriculum-connections-data'
import { STRINGS } from './curriculum-connections-strings'
import { RECORD_TYPE_LABEL } from '@/lib/supabase/curriculum-repository'
import { RecordKindIcon } from '@/lib/record-type-display'

// The "By State" / "Nach Bundesland" page -- new 2026-10-20, real feedback:
// the German and US custom views pool a region's real curriculum documents
// together (Sachsen + Thüringen, or New York + California), so a strand's
// grounding in one specific state was never shown on its own, only blended
// into "this region." This page keeps the same underlying data
// (curriculum_repository_links already carries each record's own
// jurisdiction) but organizes it by state instead: rich modeling of each
// state's own real connections to this LPM. A Sachsen-vs-Thüringen (or
// NY-vs-CA) comparison is a different question, already covered by the
// Comparison page for the two synthetic LPMs themselves.
const JURISDICTION_NAMES: Record<string, string> = {
  'DE-SN': 'Sachsen',
  'DE-TH': 'Thüringen',
  'DE-ST': 'Sachsen-Anhalt',
  'DE': 'Deutschland',
  'US-NY': 'New York',
  'US-CA': 'California',
  'US': 'USA',
}

export default function CurriculumRegionsPage() {
  const { config, topics, linksByObject } = useCurriculumConnectionsData()
  const t = STRINGS[config?.language ?? 'en']

  const jurisdictions = useMemo(() => {
    // A project's topics can carry real-world links from several countries
    // at once (bio-core-lpm-synth's own topics link to both German and US
    // curriculum records, across all 4 custom views) -- this one view only
    // shows the states its own region actually covers, by the same
    // country-code prefix the other region config already keys on.
    const prefix = config?.language === 'de' ? 'DE' : 'US'
    const set = new Set<string>()
    for (const links of Object.values(linksByObject)) {
      for (const l of links) if (l.record.jurisdiction && l.record.jurisdiction.startsWith(prefix)) set.add(l.record.jurisdiction)
    }
    // States before anything national-level, alphabetical within each group.
    return Array.from(set).sort((a, b) => {
      const an = !a.includes('-'), bn = !b.includes('-')
      if (an !== bn) return an ? 1 : -1
      return a.localeCompare(b)
    })
  }, [linksByObject, config?.language])

  const [active, setActive] = useState<string | null>(null)
  const effectiveActive = active && jurisdictions.includes(active) ? active : jurisdictions[0] ?? null

  const rows = useMemo(() => {
    if (!topics || !effectiveActive) return []
    return topics.map((tp) => ({
      topic: tp,
      links: (linksByObject[tp.id] ?? []).filter((l) => l.record.jurisdiction === effectiveActive),
    }))
  }, [topics, linksByObject, effectiveActive])

  const grounded = rows.filter((r) => r.links.length > 0)
  const totalConnected = useMemo(() => {
    if (!topics) return 0
    return topics.filter((tp) => (linksByObject[tp.id]?.length ?? 0) > 0).length
  }, [topics, linksByObject])

  if (!config) return <p className="muted">Unknown view configuration.</p>

  return (
    <div>
      <h1 className="row"><MapPin size={18} style={{ color: 'var(--text-muted)' }} />{t.regionsTitle}</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 680 }}>{t.regionsHelp}</p>

      {jurisdictions.length === 0 ? (
        <p className="muted">{t.regionsNoLinks}</p>
      ) : (
        <>
          <div className="tabs" style={{ marginBottom: 14 }}>
            {jurisdictions.map((j) => (
              <button key={j} className={j === effectiveActive ? 'active' : ''} onClick={() => setActive(j)}>
                {JURISDICTION_NAMES[j] ?? j}
              </button>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 14, textAlign: 'center', padding: '16px 10px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--series-a)' }}>{grounded.length}</div>
            <div className="muted" style={{ fontSize: 12 }}>{t.regionsCoverage(grounded.length, totalConnected)}</div>
          </div>

          {grounded.length === 0 ? (
            <p className="muted">{t.regionsNoStrandLinks}</p>
          ) : (
            grounded.map(({ topic, links }) => (
              <div key={topic.id} className="card">
                <strong>{topic.title}</strong>
                <div style={{ marginTop: 8 }}>
                  {links.map((link) => (
                    <div key={link.id} className="card" style={{ marginTop: 6, padding: 8 }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="row" style={{ gap: 5 }}>
                          <RecordKindIcon type={link.record.record_type} size={13} />
                          <strong style={{ fontSize: 13 }}>{link.record.title}</strong>
                        </span>
                        <span className="muted" style={{ fontSize: 11 }}>{RECORD_TYPE_LABEL[link.record.record_type]}</span>
                      </div>
                      {link.rationale && <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>{link.rationale}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}
