import { useMemo, useState } from 'react'
import { GraduationCap, X } from 'lucide-react'
import {
  BANDS, bandShares, firstGrade, gradeRange, gradesOf, matchesTags, placementProfiles, profileDistance, recordUnitIds, unitHex,
  type CmpRecord, type PlacedUnit, type Unit,
} from '@/lib/comparison'
import { useComparison } from './context'
import { RecordBlock } from './drawer'
import { Explain, LoadGate, PageHeader, ScopeBar, formatNumber } from './ui'

// When is it taught? Built from the records that are one unit of an official
// Lehrplan (subject, grades, hours, topic tags). Hours are the guide values the
// Lehrplan itself gives; a unit that states none counts as a unit but adds no hours.

const SUBJECT_LABEL: Record<string, [string, string]> = { biologie: ['Biology', 'Biologie'], informatik: ['Computer science', 'Informatik'] }
const TAG_LABEL: Record<string, [string, string]> = {
  evolution: ['Evolution', 'Evolution'],
  inheritance_variation: ['Heredity and variation', 'Vererbung und Variation'],
  selection_adaptation: ['Selection and adaptation', 'Selektion und Anpassung'],
  diversity_systematics: ['Diversity and systematics', 'Vielfalt und Systematik'],
  ecology_populations: ['Ecology and populations', 'Ökologie und Populationen'],
  behavior_cognition: ['Behavior and cognition', 'Verhalten und Kognition'],
  nature_of_science: ['Nature of science', 'Wesen der Naturwissenschaft'],
  human_biology: ['Human biology', 'Humanbiologie'],
  information_data: ['Information and data', 'Information und Daten'],
  algorithms_programming: ['Algorithms and programming', 'Algorithmen und Programmieren'],
  modelling_simulation: ['Modelling and simulation', 'Modellieren und Simulation'],
  systems_networks: ['Systems and networks', 'Systeme und Netze'],
  ai_ml: ['AI and machine learning', 'KI und maschinelles Lernen'],
  media_society: ['Media and society', 'Medien und Gesellschaft'],
  other: ['Other', 'Sonstiges'],
}

export default function SchoolYearsPage() {
  return <LoadGate><Inner /></LoadGate>
}

function Inner() {
  const c = useComparison()
  const { t, lang, allRecords, units, level, countries } = c
  const li = lang === 'de' ? 1 : 0
  const tagName = (tag: string) => TAG_LABEL[tag]?.[li] ?? tag
  const subjectName = (s: string) => SUBJECT_LABEL[s.toLowerCase()]?.[li] ?? s

  const placed: PlacedUnit[] = useMemo(() => {
    const countrySet = new Set(countries)
    const out: PlacedUnit[] = []
    for (const rec of allRecords) {
      if (!rec.unit) continue
      for (const placeId of recordUnitIds(rec, level, countrySet)) out.push({ placeId, record: rec })
    }
    return out
  }, [allRecords, level, countries])

  const subjects = useMemo(() => Array.from(new Set(placed.map((p) => p.record.unit!.subject.toLowerCase()))).sort(), [placed])
  const [subjectChoice, setSubjectChoice] = useState<string | null>(null)
  const subject = subjectChoice && subjects.includes(subjectChoice) ? subjectChoice : subjects[0] ?? ''
  const inSubject = useMemo(() => placed.filter((p) => p.record.unit!.subject.toLowerCase() === subject), [placed, subject])
  const tagsPresent = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of inSubject) for (const tag of p.record.unit!.tags) m.set(tag, (m.get(tag) ?? 0) + 1)
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [inSubject])
  const [tags, setTags] = useState<Set<string>>(new Set())
  const activeTags = tags.size ? tags : null
  const toggleTag = (tag: string) => setTags((prev) => { const n = new Set(prev); if (n.has(tag)) n.delete(tag); else n.add(tag); return n })

  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units])
  const placeIds = useMemo(() => {
    const ids = Array.from(new Set(inSubject.map((p) => p.placeId)))
    return ids.sort((a, b) => units.findIndex((u) => u.id === a) - units.findIndex((u) => u.id === b))
  }, [inSubject, units])
  const grades = useMemo(() => gradeRange(inSubject), [inSubject])
  const profiles = useMemo(() => placementProfiles(inSubject, subject, activeTags, grades, placeIds).map((pr) => ({ ...pr, unit: unitById.get(pr.placeId) as Unit | undefined })), [inSubject, subject, activeTags, grades, placeIds, unitById])
  const maxCell = Math.max(1, ...profiles.flatMap((p) => (p.hours.some((h) => h > 0) ? p.hours : p.units)))

  const [open, setOpen] = useState<{ placeId: string; grade: number } | null>(null)
  const openUnits: CmpRecord[] = useMemo(() => {
    if (!open) return []
    return inSubject.filter((p) => p.placeId === open.placeId && matchesTags(p.record, activeTags) && gradesOf(p.record).includes(open.grade)).map((p) => p.record)
  }, [open, inSubject, activeTags])

  const placeLabel = (id: string) => unitById.get(id)?.label ?? id
  const tagRows = tagsPresent.map(([tag]) => tag)

  return (
    <div>
      <PageHeader icon={GraduationCap} title={t('syTitle')} help={t('syHelp')} />
      <ScopeBar show={{ dim: false, kinds: false, proposed: false }} />

      {subjects.length === 0 ? <p className="muted">{t('syNoUnits')}</p> : (
        <>
          <div className="cmp-scope" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            <div className="cmp-scope-group">
              <span className="cmp-scope-label">{t('sySubject')}</span>
              <div className="cmp-seg">
                {subjects.map((s) => <button key={s} type="button" className={subject === s ? 'on' : ''} aria-pressed={subject === s} onClick={() => { setSubjectChoice(s); setTags(new Set()) }}>{subjectName(s)}</button>)}
              </div>
            </div>
            <div className="cmp-scope-group">
              <span className="cmp-scope-label">{t('syTopics')}</span>
              <button type="button" className={`cmp-chip${tags.size === 0 ? ' on' : ''}`} aria-pressed={tags.size === 0} onClick={() => setTags(new Set())}>{t('syAllTopics')}</button>
              {tagsPresent.map(([tag, n]) => (
                <button key={tag} type="button" className={`cmp-chip${tags.has(tag) ? ' on' : ''}`} aria-pressed={tags.has(tag)} onClick={() => toggleTag(tag)}>
                  {tagName(tag)} <span className="cmp-count">{n}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ---- hours by school year ---- */}
          <div className="cmp-panel">
            <h2>{t('syHoursGrid')}</h2>
            <Explain what={t('syHoursGridWhat')} how={t('syHoursGridHow')} />
            <div className="cmp-matrix-wrap">
              <table className="cmp-matrix">
                <thead>
                  <tr>
                    <th className="rowhead">{t('places')}</th>
                    {grades.map((g) => <th key={g} className="colhead" style={{ cursor: 'default', minWidth: 46 }}>{t('syGrade')} {g}</th>)}
                    <th className="colhead" style={{ cursor: 'default', minWidth: 90 }}>{t('syTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((pr) => {
                    const hue = pr.unit ? unitHex(pr.unit, units) : 'var(--place-other)'
                    const useHours = pr.hours.some((h) => h > 0)
                    const values = useHours ? pr.hours : pr.units
                    return (
                      <tr key={pr.placeId}>
                        <th className="rowhead" scope="row"><span className="cmp-dot" style={{ background: hue, marginRight: 6 }} />{placeLabel(pr.placeId)}</th>
                        {grades.map((g, i) => {
                          const v = values[i]
                          return (
                            <td key={g}>
                              <button type="button" className={`cmp-cell${v === 0 ? ' zero' : ''}`}
                                style={{ background: v > 0 ? `color-mix(in srgb, ${hue} ${Math.round(14 + 70 * Math.sqrt(v / maxCell))}%, var(--surface-0))` : undefined }}
                                title={`${placeLabel(pr.placeId)} · ${t('syGrade')} ${g}: ${formatNumber(pr.hours[i], 1)} h, ${t('syUnitsN', { n: pr.units[i] })}`}
                                onClick={() => pr.units[i] > 0 && setOpen({ placeId: pr.placeId, grade: g })}>
                                {v > 0 ? (useHours ? Math.round(v * 10) / 10 : `(${v})`) : '·'}
                              </button>
                            </td>
                          )
                        })}
                        <td style={{ padding: '0 8px', fontSize: 11.5 }}>
                          {t('syUnitsN', { n: pr.unitCount })}
                          {pr.unitsWithoutHours > 0 && <div className="muted" style={{ fontSize: 10.5 }}>{t('syNoHoursNote', { n: pr.unitsWithoutHours })}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- first school year ---- */}
          <div className="cmp-panel">
            <h2>{t('syFirst')}</h2>
            <Explain what={t('syFirstWhat')} how={t('syFirstHow')} />
            <div style={{ overflowX: 'auto' }}>
              <table className="cmp-table">
                <thead><tr><th>{t('syTopics')}</th>{placeIds.map((id) => <th key={id} className="num">{placeLabel(id)}</th>)}</tr></thead>
                <tbody>
                  {tagRows.map((tag) => {
                    const firsts = placeIds.map((id) => firstGrade(inSubject, id, subject, tag))
                    const known = firsts.filter((x): x is number => x !== null)
                    const min = known.length ? Math.min(...known) : null
                    return (
                      <tr key={tag}>
                        <td>{tagName(tag)}</td>
                        {firsts.map((g, i) => <td key={placeIds[i]} className="num" style={{ fontWeight: g !== null && g === min && known.length > 1 ? 700 : 400, color: g === null ? 'var(--text-muted)' : undefined }}>{g === null ? '–' : g}</td>)}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- stages and distances ---- */}
          <div className="cmp-two">
            <div className="cmp-panel">
              <h2>{t('syShares')}</h2>
              <Explain what={t('sySharesWhat')} />
              {profiles.map((pr) => {
                const { shares, basis } = bandShares(pr, grades)
                const hue = pr.unit ? unitHex(pr.unit, units) : 'var(--place-other)'
                return (
                  <div key={pr.placeId} style={{ marginBottom: 8 }}>
                    <div className="row" style={{ gap: 6, fontSize: 12 }}><span className="cmp-dot" style={{ background: hue }} />{placeLabel(pr.placeId)} <span className="muted">{basis === 'hours' ? t('syBasisHours') : t('syBasisUnits')}</span></div>
                    <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', background: 'var(--surface-1)', marginTop: 3 }}>
                      {shares.map((x, i) => x > 0 && <div key={i} title={`${BANDS[i].id}: ${Math.round(x * 100)}%`} style={{ width: `${x * 100}%`, background: `var(--band-${i + 1})`, borderRight: '1px solid var(--surface-2)' }} />)}
                    </div>
                  </div>
                )
              })}
              <div className="cmp-legend">{BANDS.map((b, i) => <span key={b.id}><span className="cmp-band-chip" style={{ background: `var(--band-${i + 1})` }} />{t('syGrade')} {b.id}</span>)}</div>
            </div>
            <div className="cmp-panel">
              <h2>{t('syDistance')}</h2>
              <Explain what={t('syDistanceWhat')} how={t('syDistanceHow')} />
              {profiles.length < 2 ? <p className="muted">{t('msNeedTwo')}</p> : (
                <table className="cmp-heat">
                  <thead><tr><th />{profiles.map((p) => <th key={p.placeId} className="top">{placeLabel(p.placeId)}</th>)}</tr></thead>
                  <tbody>
                    {profiles.map((a) => (
                      <tr key={a.placeId}>
                        <th className="lbl">{placeLabel(a.placeId)}</th>
                        {profiles.map((b) => {
                          if (a.placeId === b.placeId) return <td key={b.placeId} style={{ background: 'var(--surface-1)', borderRadius: 4 }}>–</td>
                          const d = profileDistance(a, b)
                          const small = a.unitCount < 5 || b.unitCount < 5
                          return <td key={b.placeId} className="v" style={{ cursor: 'default', opacity: small ? 0.55 : 1, background: d === null ? 'transparent' : `color-mix(in srgb, var(--series-a) ${Math.round(10 + 75 * d)}%, var(--surface-0))` }}>{d === null ? '' : formatNumber(d)}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {open && (
        <>
          <div className="cmp-drawer-back" onClick={() => setOpen(null)} />
          <aside className="cmp-drawer" role="dialog" aria-label={placeLabel(open.placeId)}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <div>
                <h2>{placeLabel(open.placeId)}</h2>
                <p className="muted" style={{ margin: 0 }}>{t('syDrawerTitle', { g: open.grade, n: openUnits.length })}</p>
              </div>
              <button type="button" className="btn btn-mini" onClick={() => setOpen(null)} aria-label={t('close')}><X size={13} /></button>
            </div>
            {openUnits.map((rec) => (
              <div key={rec.id} className="cmp-link-card">
                <RecordBlock record={rec} lang={lang} />
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                  {t('syGrade')} {rec.unit!.gradeFrom === rec.unit!.gradeTo ? rec.unit!.gradeFrom : `${rec.unit!.gradeFrom}–${rec.unit!.gradeTo}`}
                  {rec.unit!.hours !== null ? ` · ${rec.unit!.hours} h` : ''}
                  {rec.unit!.courseLevel ? ` · ${rec.unit!.courseLevel}` : ''}
                  {rec.unit!.tags.length ? ` · ${rec.unit!.tags.map(tagName).join(', ')}` : ''}
                </div>
              </div>
            ))}
          </aside>
        </>
      )}
    </div>
  )
}
