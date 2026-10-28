import { useState, type ReactNode } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Info, Sparkles, type LucideIcon } from 'lucide-react'
import { COUNTRIES, RECORD_FAMILIES, countryName, placeVar, unitHex, type RecordFamily, type Unit } from '@/lib/comparison'
import { useComparison } from './context'
import type { StringKey } from './strings'

export const FAMILY_KEY: Record<RecordFamily, StringKey> = {
  mandate: 'familyMandate',
  unit: 'familyUnit',
  event: 'familyEvent',
  actor: 'familyActor',
  principle: 'familyPrinciple',
  finding: 'familyFinding',
  controversy: 'familyControversy',
  other: 'familyOther',
}

/** Shown on every page while data loads, and instead of the page when loading fails. */
export function LoadGate({ children }: { children: ReactNode }) {
  const { loading, error, t } = useComparison()
  if (error) return <div className="notice notice-bad">{t('loadError', { msg: error })}</div>
  if (loading) return <p className="muted">{t('loading')}</p>
  return <>{children}</>
}

export function PageHeader({ icon: Icon, title, help }: { icon: LucideIcon; title: string; help?: string }) {
  const { project, config, t } = useComparison()
  return (
    <div className="cmp-header">
      <h1 className="row" style={{ marginBottom: 2 }}>
        <Icon size={18} style={{ color: 'var(--text-muted)' }} />
        {title}
      </h1>
      <p className="muted" style={{ margin: '0 0 2px' }}>
        {project.name} · {config.scope === 'cross-national' ? config.regionLabel : config.regionLabel}
        <span className="cmp-draft-badge" title={t('draftBadge')}><Sparkles size={10} />{t('draftBadge')}</span>
      </p>
      {help && <p className="muted cmp-help">{help}</p>}
    </div>
  )
}

/** Controls that decide what every number on the page is computed from. */
export function ScopeBar({ show = {} }: { show?: { countries?: boolean; level?: boolean; dim?: boolean; kinds?: boolean; proposed?: boolean } }) {
  const c = useComparison()
  const { t, config, level, setLevel, countries, toggleCountry, dim, setDim, families, toggleFamily, resetFamilies, includeProposed, setIncludeProposed, proposedShare, allRecords } = c
  const showCountries = (show.countries ?? true) && config.scope === 'cross-national'
  const showLevel = (show.level ?? true) && config.scope === 'cross-national'
  const showDim = show.dim ?? false
  const showKinds = show.kinds ?? true
  const showProposed = (show.proposed ?? true) && (c.source?.links.some((l) => l.proposed) ?? false)
  const familyCounts = new Map<RecordFamily, number>()
  for (const r of allRecords) if (r.jurisdictions.some((j) => countries.includes(j.split('-')[0]))) familyCounts.set(r.family, (familyCounts.get(r.family) ?? 0) + 1)
  const allKinds = families.size === RECORD_FAMILIES.length

  return (
    <div className="cmp-scope">
      {showCountries && (
        <div className="cmp-scope-group">
          <span className="cmp-scope-label">{t('scopeCountries')}</span>
          {config.availableCountries.map((code) => {
            const on = countries.includes(code)
            const recs = allRecords.filter((r) => r.jurisdictions.some((j) => j.startsWith(code))).length
            return (
              <button key={code} type="button" className={`cmp-chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleCountry(code)}
                title={recs === 0 ? '' : `${recs} ${t('records')}`}>
                <span className="cmp-dot" style={{ background: placeVar(code) }} />
                {countryName(code, c.lang)}
                {recs > 0 && <span className="cmp-count">{recs}</span>}
              </button>
            )
          })}
        </div>
      )}
      {showLevel && (
        <div className="cmp-scope-group">
          <span className="cmp-scope-label">{t('scopeLevel')}</span>
          <div className="cmp-seg" role="group" aria-label={t('scopeLevel')}>
            <button type="button" className={level === 'country' ? 'on' : ''} aria-pressed={level === 'country'} onClick={() => setLevel('country')}>{t('levelCountry')}</button>
            <button type="button" className={level === 'state' ? 'on' : ''} aria-pressed={level === 'state'} onClick={() => setLevel('state')}>{t('levelState')}</button>
          </div>
        </div>
      )}
      {showDim && (
        <div className="cmp-scope-group">
          <span className="cmp-scope-label">{t('scopeRows')}</span>
          <div className="cmp-seg" role="group" aria-label={t('scopeRows')}>
            {(['strand', 'item', 'band'] as const).map((d) => (
              <button key={d} type="button" className={dim === d ? 'on' : ''} aria-pressed={dim === d} onClick={() => setDim(d)}>
                {t(d === 'strand' ? 'dimStrand' : d === 'item' ? 'dimItem' : 'dimBand')}
              </button>
            ))}
          </div>
        </div>
      )}
      {showKinds && (
        <details className="cmp-scope-group cmp-kinds">
          <summary>
            <span className="cmp-scope-label">{t('scopeKinds')}</span>
            <span className="cmp-chip on" style={{ pointerEvents: 'none' }}>{allKinds ? t('scopeAllKinds') : `${families.size}/${RECORD_FAMILIES.length}`}</span>
          </summary>
          <div className="cmp-kinds-pop">
            {RECORD_FAMILIES.filter((f) => (familyCounts.get(f) ?? 0) > 0).map((f) => (
              <label key={f} className="cmp-check">
                <input type="checkbox" checked={families.has(f)} onChange={() => toggleFamily(f)} />
                {t(FAMILY_KEY[f])} <span className="cmp-count">{familyCounts.get(f)}</span>
              </label>
            ))}
            {!allKinds && <button type="button" className="btn-linklike" onClick={resetFamilies}>{t('scopeAllKinds')}</button>}
          </div>
        </details>
      )}
      {showProposed && (
        <label className="cmp-check cmp-scope-group" title={t('proposedNote', { p: Math.round(proposedShare * 100) })}>
          <input type="checkbox" checked={includeProposed} onChange={(e) => setIncludeProposed(e.target.checked)} />
          {t('scopeProposed')}
        </label>
      )}
    </div>
  )
}

/** Plain-language statement of how much data stands behind a number. */
export function ReliabilityNote() {
  const { measures, t, proposedShare } = useComparison()
  const n = measures.nLinks
  const u = measures.unitIds.length
  const text = measures.reliability === 'none' ? t('relNone') : measures.reliability === 'small' ? t('relSmall', { n, u }) : t('relFair', { n, u })
  return (
    <p className={`cmp-reliability ${measures.reliability}`}>
      {measures.reliability !== 'fair' ? <AlertTriangle size={13} /> : <Info size={13} />}
      <span>{text}{proposedShare > 0 ? ` ${t('proposedNote', { p: Math.round(proposedShare * 100) })}` : ''}</span>
    </p>
  )
}

/** A short "what this shows" with the working behind it one click away. */
export function Explain({ what, how }: { what: ReactNode; how?: ReactNode }) {
  const { t } = useComparison()
  const [open, setOpen] = useState(false)
  return (
    <div className="cmp-explain">
      <p style={{ margin: 0 }}>{what}</p>
      {how && (
        <>
          <button type="button" className="btn-linklike cmp-how" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{t('howCalculated')}
          </button>
          {open && <div className="cmp-how-body">{how}</div>}
        </>
      )}
    </div>
  )
}

export function UnitLabel({ unit, units, short }: { unit: Unit; units: Unit[]; short?: boolean }) {
  return (
    <span className="cmp-unit-label" title={unit.label}>
      <span className="cmp-dot" style={{ background: unitHex(unit, units) }} />
      {short ? shortUnit(unit) : unit.label}
    </span>
  )
}

export function shortUnit(u: Unit): string {
  if (u.kind === 'state') return u.id.split('-')[1]
  return u.country
}

export function CountryDot({ code }: { code: string }) {
  return <span className="cmp-dot" style={{ background: placeVar(code) }} title={COUNTRIES[code]?.en ?? code} />
}

export function Stat({ value, label, sub }: { value: ReactNode; label: string; sub?: string }) {
  return (
    <div className="cmp-stat">
      <div className="cmp-stat-value">{value}</div>
      <div className="cmp-stat-label">{label}</div>
      {sub && <div className="cmp-stat-sub">{sub}</div>}
    </div>
  )
}

/** Small bars, one per row of a dimension, for a place's profile. */
export function Sparkbars({ values, color, width = 120, height = 24 }: { values: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(1, ...values)
  const bw = width / Math.max(1, values.length)
  return (
    <svg width={width} height={height} role="img" aria-label={values.join(', ')} style={{ display: 'block' }}>
      {values.map((v, i) => {
        const h = v === 0 ? 1 : Math.max(2, (v / max) * (height - 2))
        return <rect key={i} x={i * bw + 1} y={height - h} width={Math.max(1, bw - 2)} height={h} rx={1} fill={color} opacity={v === 0 ? 0.25 : 0.9} />
      })}
    </svg>
  )
}

export function formatNumber(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '–'
  return x.toFixed(digits)
}

export function formatPct(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '–'
  return `${Math.round(x * 100)}%`
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
