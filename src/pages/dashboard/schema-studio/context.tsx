import { createContext, useContext } from 'react'
import type { Finding, Model, ParsedQuery, Target } from '@/lib/schema-studio/model'
import type { Lens, StudioView } from '@/lib/schema-studio/types'
import type { DraftSuggestion, Suggestion } from '@/lib/schema-studio/data'

export type Selection =
  | { kind: 'repo'; repo: string }
  | { kind: 'type'; typeId: string }
  | { kind: 'field'; fieldId: string }
  | { kind: 'core' }
  | null

export interface StudioCtx {
  model: Model
  selection: Selection
  select: (s: Selection) => void
  view: StudioView
  setView: (v: StudioView) => void
  lens: Lens
  query: string
  parsed: ParsedQuery
  setQuery: (q: string) => void
  openSuggest: (target: Target, kind?: string, prefill?: Partial<DraftSuggestion>) => void
  suggestions: Suggestion[]
  basket: DraftSuggestion[]
  suggestionsFor: (t: Target) => Suggestion[]
  basketFor: (t: Target) => DraftSuggestion[]
  openFinding: (f: Finding) => void
  now: number
  history: { id: number | null; generatedAt: string }[]
}

export const StudioContext = createContext<StudioCtx | null>(null)
export const useStudio = () => {
  const c = useContext(StudioContext)
  if (!c) throw new Error('useStudio outside StudioContext')
  return c
}

export function selectionKey(s: Selection): string {
  if (!s) return ''
  if (s.kind === 'repo') return `r:${s.repo}`
  if (s.kind === 'type') return `t:${s.typeId}`
  if (s.kind === 'field') return `f:${s.fieldId}`
  return 'core'
}
export function parseSelection(v: string | null): Selection {
  if (!v) return null
  if (v === 'core') return { kind: 'core' }
  if (v.startsWith('r:')) return { kind: 'repo', repo: v.slice(2) }
  if (v.startsWith('t:')) return { kind: 'type', typeId: v.slice(2) }
  if (v.startsWith('f:')) return { kind: 'field', fieldId: v.slice(2) }
  return null
}

export function agoText(iso: string | null | undefined, now: number): string {
  if (!iso) return 'unknown'
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (s < 90) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  const d = Math.round(s / 86400)
  if (d < 45) return `${d} day${d === 1 ? '' : 's'} ago`
  if (d < 600) return `${Math.round(d / 30)} months ago`
  return `${(d / 365).toFixed(1)} years ago`
}
