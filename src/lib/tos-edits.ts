// Checking and correcting a theory of schooling (migration 257). Pure functions, no network: they read what the Atlas widget announces when a person
// changes something, turn it into rows for tos_element_edits, and word the progress badge. The widget side is described in the data format note of the
// openevo.net repository ("Editing from a host page").

export type TosReviewStatus = 'checked' | 'unsure' | 'excluded'
export const REVIEW_STATUSES: TosReviewStatus[] = ['checked', 'unsure', 'excluded']

export interface PlacedItem {
  id: string
  strength: 'firm' | 'single'
}
export interface PlacementValue {
  super: PlacedItem[]
  sub: PlacedItem[]
}
export interface ReviewValue {
  status: TosReviewStatus
  note?: string
}
export interface AtlasEdit {
  field: 'placement' | 'review'
  before: PlacementValue | ReviewValue | null
  after: PlacementValue | ReviewValue | null
}
export interface AtlasEditDetail {
  theory: string
  element: string
  note: string
  edits: AtlasEdit[]
}
export interface TosEditRow {
  project_id: string
  profile_code: string
  element_id: string
  field_path: 'placement' | 'review'
  before_value: PlacementValue | ReviewValue | null
  after_value: PlacementValue | ReviewValue | null
  note: string | null
  edited_by: string
}

const PROFILE_CODE = /^OE-SCHOOLINGPROFILE-[a-z0-9-]+$/
const ID = /^[A-Za-z0-9_.-]+$/
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function placed(list: unknown): PlacedItem[] | null {
  if (!Array.isArray(list)) return null
  const out: PlacedItem[] = []
  for (const p of list) {
    if (!isObject(p) || typeof p.id !== 'string' || !ID.test(p.id)) return null
    if (out.some((x) => x.id === p.id)) continue
    out.push({ id: p.id, strength: p.strength === 'single' ? 'single' : 'firm' })
  }
  return out
}

function placement(v: unknown): PlacementValue | null {
  if (!isObject(v)) return null
  const sup = placed(v.super)
  const sub = placed(v.sub)
  return sup && sub ? { super: sup, sub } : null
}

/** A review value. The name and the time are left out on purpose: the database writes them (migration 257). Null means "no mark". */
function review(v: unknown): ReviewValue | null | undefined {
  if (v === null) return null
  if (!isObject(v) || !REVIEW_STATUSES.includes(v.status as TosReviewStatus)) return undefined
  const out: ReviewValue = { status: v.status as TosReviewStatus }
  if (typeof v.note === 'string' && v.note.trim()) out.note = v.note.trim().slice(0, 400)
  return out
}

/** Reads what the widget announced. Anything out of shape is refused with a plain reason, so nothing odd reaches the database. */
export function parseAtlasEdit(detail: unknown): { ok: true; detail: AtlasEditDetail } | { ok: false; problem: string } {
  if (!isObject(detail)) return { ok: false, problem: 'The change was not understood.' }
  if (typeof detail.theory !== 'string' || !PROFILE_CODE.test(detail.theory)) return { ok: false, problem: 'The change names no theory of this space.' }
  if (typeof detail.element !== 'string' || !ID.test(detail.element)) return { ok: false, problem: 'The change names no statement.' }
  if (!Array.isArray(detail.edits) || detail.edits.length < 1 || detail.edits.length > 2) return { ok: false, problem: 'The change holds nothing to save.' }
  const edits: AtlasEdit[] = []
  for (const raw of detail.edits) {
    if (!isObject(raw)) return { ok: false, problem: 'The change was not understood.' }
    if (raw.field === 'placement') {
      const before = placement(raw.before)
      const after = placement(raw.after)
      if (!after) return { ok: false, problem: 'The new placement was not understood.' }
      edits.push({ field: 'placement', before, after })
    } else if (raw.field === 'review') {
      const after = review(raw.after)
      if (after === undefined) return { ok: false, problem: 'The new mark was not understood.' }
      const before = raw.before === null || raw.before === undefined ? null : review(raw.before) ?? null
      edits.push({ field: 'review', before, after })
    } else return { ok: false, problem: 'The change touches something that cannot be changed here.' }
  }
  const note = typeof detail.note === 'string' ? detail.note.trim().slice(0, 400) : ''
  return { ok: true, detail: { theory: detail.theory, element: detail.element, note, edits } }
}

/** The rows to insert for one change. The same note is kept on each row. */
export function editRows(detail: AtlasEditDetail, projectId: string, userId: string): TosEditRow[] {
  return detail.edits.map((e) => ({
    project_id: projectId,
    profile_code: detail.theory,
    element_id: detail.element,
    field_path: e.field,
    before_value: e.before,
    after_value: e.after,
    note: detail.note || null,
    edited_by: userId,
  }))
}

export interface ReviewProgress {
  total: number
  checked: number
  unsure: number
  excluded: number
}

export interface ProgressBadge {
  text: string
  /** The chip colour classes of the app: draft (amber), progress (blue), good (green). */
  bucket: 'draft' | 'progress' | 'good'
  /** A plain sentence for the hover text. */
  title: string
}

/** The wording of the badge in the space header. It says how far people have looked at what a language model sorted. */
export function progressBadge(p: ReviewProgress | null): ProgressBadge {
  if (!p || p.total === 0) return { text: 'AI draft, unchecked', bucket: 'draft', title: 'A language model sorted these statements. No person has checked them yet.' }
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
  const extra = (p.unsure ? ` ${plural(p.unsure, 'statement')} are marked unsure.` : '') + (p.excluded ? ` ${plural(p.excluded, 'statement')} were left out as not about schooling.` : '')
  if (p.checked === 0) return { text: 'AI draft, unchecked', bucket: 'draft', title: `A language model sorted these ${plural(p.total, 'statement')}. No person has checked them yet.${extra}` }
  if (p.checked >= p.total) return { text: 'All statements checked by a person', bucket: 'good', title: `People have checked all ${plural(p.total, 'statement')}.${extra}` }
  return {
    text: `Being checked: ${p.checked} of ${p.total}`,
    bucket: 'progress',
    title: `A language model sorted these statements. People have checked ${p.checked} of ${p.total}.${extra}`,
  }
}
