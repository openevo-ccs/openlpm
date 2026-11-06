import { useMemo } from 'react'
import { MEASURE_KEYS, dropLinks, measureStructure, subsampleParts, type MeasureKey, type PartTags, type Range, type StructureMeasures } from '@/lib/comparison/structure'
import { useComparison } from './context'
import { Explain } from './ui'
import type { StringKey } from './strings'

const LABEL: Record<MeasureKey, StringKey> = {
  conceptsUsed: 'structConceptsUsed',
  conceptsPerPart: 'structConceptsPerPart',
  mainShare: 'structMainShare',
  conceptSpread: 'structSpread',
  partOverlap: 'structOverlap',
  joinedPairs: 'structJoined',
  largestGroup: 'structGroup',
}
const DIGITS: Record<MeasureKey, number> = { conceptsUsed: 1, conceptsPerPart: 1, mainShare: 2, conceptSpread: 2, partOverlap: 2, joinedPairs: 2, largestGroup: 2 }

const fmt = (v: number | null | undefined, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '–')
const fmtRange = (r: Range | null, d: number) => (r ? `${fmt(r.mean, d)} (${fmt(r.lo, d)}–${fmt(r.hi, d)})` : '–')

type Capped = Record<MeasureKey, Range | null> | null

/** Two spaces side by side with the larger one drawn down to the size of the smaller, plus how steady each measure is. */
export function StructurePanel({ own, other, ownName, otherName }: { own: PartTags[]; other: PartTags[]; ownName: string; otherName: string }) {
  const { t } = useComparison()
  const calc = useMemo(() => {
    const k = Math.min(own.length, other.length)
    const ownLarger = own.length > other.length
    const otherLarger = other.length > own.length
    return {
      k,
      ownLarger,
      otherLarger,
      ownActual: measureStructure(own),
      otherActual: measureStructure(other),
      ownCapped: ownLarger ? subsampleParts(own, k) : null,
      otherCapped: otherLarger ? subsampleParts(other, k) : null,
      ownStable: dropLinks(own),
      otherStable: dropLinks(other),
    }
  }, [own, other])

  if (own.length === 0 || other.length === 0) {
    return (
      <div className="cmp-panel">
        <h2>{t('structTitle')}</h2>
        <p className="muted">{t('structNoData')}</p>
      </div>
    )
  }
  const larger = calc.ownLarger ? ownName : calc.otherLarger ? otherName : null
  const largerActual = calc.ownLarger ? calc.ownActual : calc.otherActual

  const cell = (actual: StructureMeasures, capped: Capped, key: MeasureKey) => (capped ? fmtRange(capped[key], DIGITS[key]) : fmt(actual[key], DIGITS[key]))

  return (
    <div className="cmp-panel">
      <h2>{t('structTitle')}</h2>
      <Explain what={t('structHint')} how={t('structHow', { n: calc.k })} />
      {larger && <p className="muted" style={{ fontSize: 12 }}>{t('structEqualSize', { n: calc.k, name: larger })}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table className="cmp-table">
          <thead>
            <tr>
              <th>{t('structMeasure')}</th>
              <th className="num">{t('structCol', { name: ownName, n: calc.k })}</th>
              <th className="num">{t('structCol', { name: otherName, n: calc.k })}</th>
              {larger && <th className="num">{t('structActual', { name: larger })}</th>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t('structParts')}</td>
              <td className="num">{calc.k}</td>
              <td className="num">{calc.k}</td>
              {larger && <td className="num">{largerActual.parts}</td>}
            </tr>
            {MEASURE_KEYS.map((key) => (
              <tr key={key}>
                <td>{t(LABEL[key])}</td>
                <td className="num">{cell(calc.ownActual, calc.ownCapped, key)}</td>
                <td className="num">{cell(calc.otherActual, calc.otherCapped, key)}</td>
                {larger && <td className="num">{fmt(largerActual[key], DIGITS[key])}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 style={{ fontSize: 12.5, margin: '14px 0 4px' }}>{t('structStableTitle')}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="cmp-table">
          <thead>
            <tr>
              <th>{t('structMeasure')}</th>
              <th className="num">{t('structStable', { name: ownName })}</th>
              <th className="num">{t('structStable', { name: otherName })}</th>
            </tr>
          </thead>
          <tbody>
            {MEASURE_KEYS.map((key) => (
              <tr key={key}>
                <td>{t(LABEL[key])}</td>
                <td className="num">{fmtRange(calc.ownStable[key], DIGITS[key])}</td>
                <td className="num">{fmtRange(calc.otherStable[key], DIGITS[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
