// Loading the snapshot and the suggestions board for the Schema Studio.
// Both live in tables from migration 253. Until that migration is applied the Studio still opens: in development it falls back to
// a local snapshot file (src/lib/schema-studio/dev-snapshot.json, never committed), and suggestions are kept in the browser basket.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Snapshot } from './types'

type Client = SupabaseClient<any>

export interface SnapshotInfo { id: number | null; generatedAt: string; syncedAt: string | null; contentHash: string }
export interface LoadedSnapshot { snapshot: Snapshot; info: SnapshotInfo; source: 'live' | 'local-file'; history: SnapshotInfo[] }

const devFiles = import.meta.glob('./dev-snapshot.json', { import: 'default' }) as Record<string, () => Promise<Snapshot>>

export async function loadSnapshot(supabase: Client): Promise<LoadedSnapshot | { error: string }> {
  const { data, error } = await (supabase as any).from('schema_studio_snapshot').select('id, content_hash, generated_at, synced_at, data').order('id', { ascending: false }).limit(1)
  if (!error && data?.length) {
    const row = data[0]
    const { data: hist } = await (supabase as any).from('schema_studio_snapshot').select('id, content_hash, generated_at, synced_at').order('id', { ascending: false }).limit(40)
    return {
      snapshot: row.data as Snapshot, source: 'live',
      info: { id: row.id, generatedAt: row.generated_at, syncedAt: row.synced_at, contentHash: row.content_hash },
      history: (hist ?? []).map((h: any) => ({ id: h.id, generatedAt: h.generated_at, syncedAt: h.synced_at, contentHash: h.content_hash })),
    }
  }
  const loader = devFiles['./dev-snapshot.json']
  if (loader) {
    const snapshot = await loader()
    return { snapshot, source: 'local-file', info: { id: null, generatedAt: snapshot.generatedAt, syncedAt: null, contentHash: snapshot.contentHash }, history: [] }
  }
  return { error: error?.message ?? 'No snapshot has been written yet.' }
}

export async function loadSnapshotById(supabase: Client, id: number): Promise<Snapshot | null> {
  const { data } = await (supabase as any).from('schema_studio_snapshot').select('data').eq('id', id).maybeSingle()
  return (data?.data as Snapshot) ?? null
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------------------------------------------------------------
export const KINDS = [
  { key: 'clarify', label: 'Explain it better', help: 'The name or description is unclear.' },
  { key: 'rename', label: 'Rename it', help: 'The name is confusing, inconsistent or misleading.' },
  { key: 'add-field', label: 'Add a missing field', help: 'Something people need to record has no place.' },
  { key: 'remove-field', label: 'Remove it', help: 'Nobody uses it, or it duplicates something else.' },
  { key: 'change-type', label: 'Change what it holds', help: 'For example a single value should be a list.' },
  { key: 'change-values', label: 'Change the allowed values', help: 'Add, remove or rename items in a fixed list.' },
  { key: 'new-link', label: 'Link it to another repository', help: 'A connection is missing.' },
  { key: 'new-record-type', label: 'Add a new record type', help: 'A kind of record has no home yet.' },
  { key: 'merge', label: 'Merge two things', help: 'Two fields or types mean the same.' },
  { key: 'split', label: 'Split one thing in two', help: 'One field or type holds two different ideas.' },
  { key: 'other', label: 'Something else', help: '' },
] as const
export type Kind = (typeof KINDS)[number]['key']
export const kindLabel = (k: string) => KINDS.find((x) => x.key === k)?.label ?? k

export const STATUSES = [
  { key: 'open', label: 'Open' }, { key: 'discussing', label: 'Under discussion' }, { key: 'accepted', label: 'Accepted' }, { key: 'declined', label: 'Declined' }, { key: 'applied', label: 'Applied in the repository' },
] as const

export interface DraftSuggestion {
  localId: string
  target_repo: string
  target_type: string | null
  target_field: string | null
  kind: Kind
  summary: string
  current_value: string
  proposed_value: string
  rationale: string
  priority: 'low' | 'normal' | 'high'
  snapshot_hash: string | null
  created_at: string
}

export interface Suggestion {
  id: string
  target_repo: string
  target_type: string | null
  target_field: string | null
  kind: Kind
  summary: string
  current_value: string | null
  proposed_value: string | null
  rationale: string | null
  priority: 'low' | 'normal' | 'high'
  status: 'open' | 'discussing' | 'accepted' | 'declined' | 'applied'
  snapshot_hash: string | null
  created_at: string
  updated_at: string
  decision_note: string | null
  exported_at: string | null
  export_batch: string | null
  author: { name: string | null; email: string | null } | null
  agrees: number
  agreedByMe: boolean
  comments: { id: string; body: string; created_at: string; author: { name: string | null } | null }[]
}

export async function listSuggestions(supabase: Client, myId: string | null): Promise<{ items: Suggestion[]; available: boolean }> {
  const { data, error } = await (supabase as any)
    .from('schema_suggestions')
    .select('*, author:users!schema_suggestions_created_by_fkey(name, email), schema_suggestion_agrees(user_id), schema_suggestion_comments(id, body, created_at, author:users!schema_suggestion_comments_created_by_fkey(name))')
    .order('created_at', { ascending: false })
  if (error) return { items: [], available: false }
  const items = (data ?? []).map((r: any): Suggestion => ({
    ...r, author: r.author ?? null,
    agrees: (r.schema_suggestion_agrees ?? []).length, agreedByMe: !!myId && (r.schema_suggestion_agrees ?? []).some((a: any) => a.user_id === myId),
    comments: [...(r.schema_suggestion_comments ?? [])].sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)),
  }))
  return { items, available: true }
}

export async function addSuggestion(supabase: Client, userId: string, d: DraftSuggestion): Promise<string | null> {
  const { error } = await (supabase as any).from('schema_suggestions').insert({
    target_repo: d.target_repo, target_type: d.target_type, target_field: d.target_field, kind: d.kind, summary: d.summary,
    current_value: d.current_value || null, proposed_value: d.proposed_value || null, rationale: d.rationale || null, priority: d.priority, snapshot_hash: d.snapshot_hash, created_by: userId,
  })
  return error?.message ?? null
}

export async function setSuggestionStatus(supabase: Client, id: string, status: Suggestion['status'], note?: string, userId?: string): Promise<string | null> {
  const { error } = await (supabase as any).from('schema_suggestions').update({ status, decision_note: note ?? null, decided_by: userId ?? null, updated_at: new Date().toISOString() }).eq('id', id)
  return error?.message ?? null
}

export async function addComment(supabase: Client, userId: string, suggestionId: string, body: string): Promise<string | null> {
  const { error } = await (supabase as any).from('schema_suggestion_comments').insert({ suggestion_id: suggestionId, body, created_by: userId })
  return error?.message ?? null
}

export async function toggleAgree(supabase: Client, userId: string, suggestionId: string, on: boolean): Promise<string | null> {
  const q = (supabase as any).from('schema_suggestion_agrees')
  const { error } = on ? await q.insert({ suggestion_id: suggestionId, user_id: userId }) : await q.delete().eq('suggestion_id', suggestionId).eq('user_id', userId)
  return error?.message ?? null
}

export async function markExported(supabase: Client, ids: string[], batch: string): Promise<string | null> {
  const { error } = await (supabase as any).from('schema_suggestions').update({ exported_at: new Date().toISOString(), export_batch: batch, updated_at: new Date().toISOString() }).in('id', ids)
  return error?.message ?? null
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The browser basket: drafts a person is collecting before sending them. Kept per signed-in user, in this browser only.
// ---------------------------------------------------------------------------------------------------------------------------------
const basketKey = (uid: string) => `openlpm:schema-studio-basket:${uid}`
export function readBasket(uid: string): DraftSuggestion[] {
  try { return JSON.parse(localStorage.getItem(basketKey(uid)) ?? '[]') } catch { return [] }
}
export function writeBasket(uid: string, items: DraftSuggestion[]) {
  try { localStorage.setItem(basketKey(uid), JSON.stringify(items)) } catch { /* private window */ }
}

export function suggestionMarkdown(items: (DraftSuggestion | Suggestion)[], repoName: (k: string) => string, snapshotDate: string): string {
  const byRepo = new Map<string, (DraftSuggestion | Suggestion)[]>()
  for (const s of items) byRepo.set(s.target_repo, [...(byRepo.get(s.target_repo) ?? []), s])
  const lines: string[] = [`# Suggested schema changes`, '', `Written in the OpenLPM Schema Studio against the structure of ${snapshotDate}.`, '']
  for (const [repo, list] of [...byRepo.entries()].sort()) {
    lines.push(`## ${repoName(repo)}`, '')
    for (const s of list) {
      const where = [s.target_type, s.target_field].filter(Boolean).join(' > ') || 'whole repository'
      lines.push(`### ${s.summary}`, '', `- **Where:** ${where}`, `- **Kind:** ${kindLabel(s.kind)}`, `- **Priority:** ${s.priority}`)
      if (s.current_value) lines.push(`- **Now:** ${s.current_value.replace(/\n+/g, ' ')}`)
      if (s.proposed_value) lines.push(`- **Proposed:** ${s.proposed_value.replace(/\n+/g, ' ')}`)
      if (s.rationale) lines.push(`- **Why:** ${s.rationale.replace(/\n+/g, ' ')}`)
      lines.push('')
    }
  }
  return lines.join('\n')
}
