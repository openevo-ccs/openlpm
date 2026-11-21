import type { CSSProperties, ReactNode } from 'react'
import { GROUPS, type FlatField, type Model } from '@/lib/schema-studio/model'

export const REPO_CODE: Record<string, string> = {
  concept: 'CON', competency: 'COM', teaching: 'TEA', project: 'PRO', theory: 'THE', question: 'QUE', methods: 'MET', literature: 'LIT', quote: 'QUO', species: 'SPE', ccsgraph: 'CCS', deutschelp: 'DLP', humanbase: 'HUM', core: 'COR',
}

export function groupOfRepo(model: Model, repoKey: string | null) {
  if (!repoKey) return GROUPS.retired
  if (repoKey === 'humanbase') return GROUPS.retired
  const r = model.repoByKey.get(repoKey)
  return GROUPS[r?.group ?? 'graph'] ?? GROUPS.graph
}

export function gvars(g: { dark: string; mid: string; light: string; tint: string }): CSSProperties {
  return { ['--g-dark' as string]: g.dark, ['--g-mid' as string]: g.mid, ['--g-light' as string]: g.light, ['--g-tint' as string]: g.tint }
}

export function TargetChip({ model, repo, onClick, title }: { model: Model; repo: string | null; onClick?: () => void; title?: string }) {
  const g = groupOfRepo(model, repo)
  const code = repo ? REPO_CODE[repo] ?? repo.slice(0, 3).toUpperCase() : '?'
  const cls = `ss-chip ss-chip-link${onClick ? ' clickable' : ''}`
  const props = { className: cls, style: gvars(g), title: title ?? (repo ? model.repoByKey.get(repo)?.name ?? repo : 'unknown') }
  return onClick ? <button type="button" {...props} onClick={(e) => { e.stopPropagation(); onClick() }}>{code}</button> : <span {...props}>{code}</span>
}

export function KeyBadge({ f, model }: { f: FlatField; model: Model }) {
  if (f.path === 'id') return <span className="ss-key pk" title="Permanent id">PK</span>
  if (f.links.length) {
    const g = groupOfRepo(model, f.links[0].to.repo)
    return <span className="ss-key fk" style={gvars(g)} title="Link to another record">FK</span>
  }
  return <span className="ss-key dot" aria-hidden="true" />
}

/** Wraps matches of the search words in <mark>. */
export function Hi({ text, words }: { text: string; words: string[] }): ReactNode {
  if (!words.length || !text) return text
  const esc = words.filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!esc.length) return text
  const re = new RegExp(`(${esc.join('|')})`, 'ig')
  const parts = text.split(re)
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))
}

export function Count({ n, label }: { n: number; label: string }) {
  return <span className="ss-count"><b>{n.toLocaleString()}</b> {label}{n === 1 ? '' : 's'}</span>
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="ss-section">
      <div className="ss-section-head"><h4>{title}</h4>{aside}</div>
      {children}
    </section>
  )
}
