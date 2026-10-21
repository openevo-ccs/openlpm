import { useEffect, useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useCurriculumConnectionsData } from './use-curriculum-connections-data'
import { STRINGS } from './curriculum-connections-strings'
import { RECORD_TYPE_LABEL } from '@/lib/supabase/curriculum-repository'
import { RecordKindIcon } from '@/lib/record-type-display'

// The "By State" / "Nach Bundesland" page -- real feedback: the German and
// US custom views pool a region's real curriculum documents together
// (Sachsen + Thüringen, or New York + California), so a strand's grounding
// in one specific state was never shown on its own, only blended into "this
// region." This page keeps the same underlying data (curriculum_repository_links
// already carries each record's own jurisdiction) but organizes it by
// state. A Sachsen-vs-Thüringen (or NY-vs-CA, or FL-vs-PA-vs-TN) comparison
// used to only be possible one state at a time via tabs; upgraded
// 2026-10-21 (Dustin's own choice of 3 real options) to a real multi-select,
// side-by-side-columns comparison, once the US side grew past 3 states to
// up to 6. A Bio-Core-vs-Interdisciplinary comparison is a different
// question, already covered by the Comparison page for the two synthetic
// LPMs themselves.
const JURISDICTION_NAMES: Record<string, string> = {
  'DE-SN': 'Sachsen',
  'DE-TH': 'Thüringen',
  'DE-ST': 'Sachsen-Anhalt',
  'DE': 'Deutschland',
  'US-NY': 'New York',
  'US-CA': 'California',
  'US-FL': 'Florida',
  'US-PA': 'Pennsylvania',
  'US-TN': 'Tennessee',
  'US': 'USA',
}

const jurisdictionLabel = (j: string) => JURISDICTION_NAMES[j] ?? j

export default function CurriculumRegionsPage() {
  const { config, topics, linksByObject } = useCurriculumConnectionsData()
  const t = STRINGS[config?.language ?? 'en']

  const jurisdictions = useMemo(() => {
    // A project's topics can carry real-world links from several countries
    // at once (bio-core-lpm-synth's own topics link to both German and US
    // curriculum records, across all custom views) -- this one view only
    // shows the states its own region actually covers, by the same
    // country-code prefix the other region config already keys on.
    const prefix = config?.language === 'de' ? 'DE' : 'US'
    const set = new Set<string>()
    for (const links of Object.values(linksByObject)) {
      for (const l of links) if (l.record.jurisdiction && l.record.jurisdiction.startsWith(prefix)) set.add(l.record.jurisdiction)
    }
    // States before anything national/cross-state, alphabetical within each group.
    return Array.from(set).sort((a, b) => {
      const an = !a.includes('-'), bn = !b.includes('-')
      if (an !== bn) return an ? 1 : -1
      return a.localeCompare(b)
    })
  }, [linksByObject, config?.language])

  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Default to "all" -- the comparison is the point of this page -- but
  // only re-seed the default when the available set of jurisdictions
  // actually changes shape, so a user's own deselection survives a
  // same-jurisdictions re-render.
  useEffect(() => {
    setSelected(new Set(jurisdictions))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jurisdictions.join('|')])

  const toggle = (j: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(j)) next.delete(j)
      else next.add(j)
      return next
    })
  }

  const activeJurisdictions = jurisdictions.filter((j) => selected.has(j))

  const rows = useMemo(() => {
    if (!topics) return []
    return topics
      .map((tp) => {
        const links = linksByObject[tp.id] ?? []
        const byJurisdiction = new Map<string, typeof links>()
        for (const j of activeJurisdictions) byJurisdiction.set(j, links.filter((l) => l.record.jurisdiction === j))
        const anyGrounded = activeJurisdictions.some((j) => (byJurisdiction.get(j)?.length ?? 0) > 0)
        return { topic: tp, byJurisdiction, anyGrounded }
      })
      .filter((r) => r.anyGrounded)
  }, [topics, linksByObject, activeJurisdictions])

  const coverageByJurisdiction = useMemo(() => {
    if (!topics) return new Map<string, number>()
    const m = new Map<string, number>()
    for (const j of activeJurisdictions) {
      m.set(j, topics.filter((tp) => (linksByObject[tp.id] ?? []).some((l) => l.record.jurisdiction === j)).length)
    }
    return m
  }, [topics, linksByObject, activeJurisdictions])

  if (!config) return <p className="muted">Unknown view configuration.</p>

  return (
    <div>
      <h1 className="row"><MapPin size={18} style={{ color: 'var(--text-muted)' }} />{t.regionsTitle}</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 680 }}>{t.regionsHelp}</p>

      {jurisdictions.length === 0 ? (
        <p className="muted">{t.regionsNoLinks}</p>
      ) : (
        <>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <div className="tabs" role="group" aria-label={t.regionsTitle}>
              {jurisdictions.map((j) => (
                <button
                  key={j}
                  className={selected.has(j) ? 'active' : ''}
                  aria-pressed={selected.has(j)}
                  onClick={() => toggle(j)}
                >
                  {jurisdictionLabel(j)}
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setSelected(new Set(jurisdictions))}>{t.regionsSelectAll}</button>
              <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setSelected(new Set())}>{t.regionsClearAll}</button>
            </div>
          </div>

          {activeJurisdictions.length === 0 ? (
            <p className="muted">{t.regionsSelectPrompt}</p>
          ) : (
            <>
              <div
                className="row"
                style={{ gap: 10, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}
              >
                {activeJurisdictions.map((j) => (
                  <div key={j} className="card" style={{ textAlign: 'center', padding: '12px 14px', minWidth: 150, flex: '0 0 auto' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--series-a)' }}>{coverageByJurisdiction.get(j) ?? 0}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{jurisdictionLabel(j)}</div>
                  </div>
                ))}
              </div>

              {rows.length === 0 ? (
                <p className="muted">{t.regionsNoStrandLinks}</p>
              ) : (
                rows.map(({ topic, byJurisdiction }) => (
                  <div key={topic.id} className="card" style={{ marginBottom: 14 }}>
                    <strong>{topic.title}</strong>
                    <div
                      className="row"
                      style={{ gap: 10, marginTop: 10, overflowX: 'auto', alignItems: 'stretch', paddingBottom: 2 }}
                    >
                      {activeJurisdictions.map((j) => {
                        const links = byJurisdiction.get(j) ?? []
                        return (
                          <div
                            key={j}
                            style={{
                              flex: '0 0 auto',
                              minWidth: 220,
                              maxWidth: 260,
                              borderLeft: '2px solid var(--border)',
                              paddingLeft: 10,
                            }}
                          >
                            <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>
                              {jurisdictionLabel(j)}
                            </div>
                            {links.length === 0 ? (
                              <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t.regionsNoStrandLinks}</p>
                            ) : (
                              links.map((link) => (
                                <div key={link.id} className="card" style={{ marginBottom: 6, padding: 8 }}>
                                  <span className="row" style={{ gap: 5 }}>
                                    <RecordKindIcon type={link.record.record_type} size={13} />
                                    <strong style={{ fontSize: 13 }}>{link.record.title}</strong>
                                  </span>
                                  <div className="muted" style={{ fontSize: 11, margin: '2px 0 0' }}>{RECORD_TYPE_LABEL[link.record.record_type]}</div>
                                  {link.rationale && <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>{link.rationale}</p>}
                                </div>
                              ))
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
