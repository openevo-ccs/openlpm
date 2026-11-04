import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { isJenaTemplate } from '@/lib/student-view-templates'

type Client = SupabaseClient<Database>

// None of this (guided_tours, guided_tour_spaces, migration 227) is in the
// generated types yet -- cast at the query boundary, same convention as
// dashboard-views.ts.

export interface TourStep {
  title: string
  body: string
  // Key of a marked part of a screen (tour-anchors.ts). Without one, the step
  // shows as a centered card.
  anchor?: string
  // Path inside the space this step happens on. Leave out to stay where the
  // reader is.
  page?: string
  // The "Probiere es aus" box.
  tryIt?: string
  // Shown instead of the pointer when the marked part is not on screen.
  hint?: string
  // Anchor to click once when the marked part is not on screen yet (opens a card).
  openFirst?: string
}

export interface GuidedTour {
  id: string
  project_id: string
  title: string
  description: string | null
  language: string
  view_id: string | null
  template_id: string | null
  steps: TourStep[]
  is_published: boolean
  offer_on_first_visit: boolean
  sort_order: number
  updated_at: string
  // Other spaces this tour is also shown in.
  space_ids: string[]
}

// What Help needs to know about where the reader currently is.
export interface TourContext {
  projectId: string
  slug: string
  projectName: string
  // The active view's own id and template (null = the full, unrestricted view).
  viewId: string | null
  templateId: string | null
  language: 'de' | 'en'
  canManage: boolean
}

export interface TourDraft {
  title: string
  description: string
  language: string
  view_id: string | null
  template_id: string | null
  steps: TourStep[]
  is_published: boolean
  offer_on_first_visit: boolean
  space_ids: string[]
}

const COLUMNS = 'id, project_id, title, description, language, view_id, template_id, steps, is_published, offer_on_first_visit, sort_order, updated_at, spaces:guided_tour_spaces(project_id)'

function fromRow(row: any): GuidedTour {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    description: row.description,
    language: row.language,
    view_id: row.view_id,
    template_id: row.template_id,
    steps: Array.isArray(row.steps) ? row.steps : [],
    is_published: row.is_published,
    offer_on_first_visit: row.offer_on_first_visit,
    sort_order: row.sort_order,
    updated_at: row.updated_at,
    space_ids: ((row.spaces as { project_id: string }[] | null) ?? []).map((s) => s.project_id),
  }
}

// The two Jena views (semester and sandbox twin) have identical pages, so a
// tour written for one fits the other.
function sameTemplate(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  return a === b || (isJenaTemplate(a) && isJenaTemplate(b))
}

export function tourAppliesHere(tour: GuidedTour, ctx: TourContext): boolean {
  const inSpace = tour.project_id === ctx.projectId || tour.space_ids.includes(ctx.projectId)
  if (!inSpace) return false
  if (tour.view_id) return tour.view_id === ctx.viewId
  if (tour.template_id) return sameTemplate(tour.template_id, ctx.templateId)
  return true
}

// RLS already limits this to tours the reader may see, so a plain select is enough.
export async function listToursForContext(supabase: Client, ctx: TourContext): Promise<GuidedTour[]> {
  const { data } = await (supabase as any).from('guided_tours').select(COLUMNS).order('sort_order').order('created_at')
  return ((data as any[]) ?? []).map(fromRow).filter((t) => tourAppliesHere(t, ctx))
}

// Every tour that belongs to one space, for its owners' editor.
export async function listToursOfSpace(supabase: Client, projectId: string): Promise<GuidedTour[]> {
  const { data } = await (supabase as any)
    .from('guided_tours')
    .select(COLUMNS)
    .eq('project_id', projectId)
    .order('sort_order')
    .order('created_at')
  return ((data as any[]) ?? []).map(fromRow)
}

export function emptyDraft(language: 'de' | 'en' = 'de'): TourDraft {
  return {
    title: '',
    description: '',
    language,
    view_id: null,
    template_id: null,
    steps: [{ title: '', body: '' }],
    is_published: false,
    offer_on_first_visit: false,
    space_ids: [],
  }
}

export function draftFromTour(t: GuidedTour): TourDraft {
  return {
    title: t.title,
    description: t.description ?? '',
    language: t.language,
    view_id: t.view_id,
    template_id: t.template_id,
    steps: t.steps.map((s) => ({ ...s })),
    is_published: t.is_published,
    offer_on_first_visit: t.offer_on_first_visit,
    space_ids: [...t.space_ids],
  }
}

// Empty optional fields are dropped so the stored steps stay short.
function cleanSteps(steps: TourStep[]): TourStep[] {
  return steps.map((s) => {
    const out: TourStep = { title: s.title.trim(), body: s.body.trim() }
    if (s.anchor) out.anchor = s.anchor
    if (s.page !== undefined && s.page !== null) out.page = s.page
    if (s.tryIt?.trim()) out.tryIt = s.tryIt.trim()
    if (s.hint?.trim()) out.hint = s.hint.trim()
    if (s.openFirst) out.openFirst = s.openFirst
    return out
  })
}

async function replaceSpaces(supabase: Client, tourId: string, spaceIds: string[]): Promise<string | null> {
  const del = await (supabase as any).from('guided_tour_spaces').delete().eq('tour_id', tourId)
  if (del.error) return del.error.message
  if (spaceIds.length === 0) return null
  const ins = await (supabase as any)
    .from('guided_tour_spaces')
    .insert(spaceIds.map((project_id) => ({ tour_id: tourId, project_id })))
  return ins.error ? ins.error.message : null
}

export async function saveTour(
  supabase: Client,
  projectId: string,
  tourId: string | null,
  draft: TourDraft,
  sortOrder: number,
): Promise<{ id: string | null; error: string | null }> {
  const fields = {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    language: draft.language,
    view_id: draft.view_id,
    template_id: draft.template_id,
    steps: cleanSteps(draft.steps),
    is_published: draft.is_published,
    offer_on_first_visit: draft.offer_on_first_visit,
    updated_at: new Date().toISOString(),
  }
  let id = tourId
  if (tourId) {
    const { error } = await (supabase as any).from('guided_tours').update(fields).eq('id', tourId)
    if (error) return { id: null, error: error.message }
  } else {
    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await (supabase as any)
      .from('guided_tours')
      .insert({ ...fields, project_id: projectId, sort_order: sortOrder, created_by: userData.user?.id ?? null })
      .select('id')
      .single()
    if (error || !data) return { id: null, error: error?.message ?? 'Could not save the tour.' }
    id = data.id as string
  }
  const spaceError = await replaceSpaces(supabase, id as string, draft.space_ids)
  return { id, error: spaceError }
}

export async function deleteTour(supabase: Client, tourId: string): Promise<string | null> {
  const { error } = await (supabase as any).from('guided_tours').delete().eq('id', tourId)
  return error ? error.message : null
}

// "Offer on first visit" remembers, per browser, which tours were already
// offered. A display convenience like the sidebar state, so it lives in
// localStorage and may be missing.
const SEEN_PREFIX = 'openlpm:tour_offered:'

export function wasTourOffered(tourId: string): boolean {
  try {
    return localStorage.getItem(SEEN_PREFIX + tourId) === '1'
  } catch {
    return true
  }
}

export function markTourOffered(tourId: string): void {
  try {
    localStorage.setItem(SEEN_PREFIX + tourId, '1')
  } catch {
    /* private window */
  }
}

export const TOUR_STRINGS = {
  de: {
    help: 'Hilfe',
    tours: 'Geführte Touren',
    noTours: 'Für diese Ansicht gibt es noch keine Tour.',
    start: 'Tour starten',
    steps: (n: number) => `${n} Schritte`,
    draft: 'Entwurf',
    step: (i: number, n: number) => `Schritt ${i} von ${n}`,
    back: 'Zurück',
    next: 'Weiter',
    done: 'Fertig',
    end: 'Tour beenden',
    tryIt: 'Probiere es aus',
    notVisible: 'Dieser Bereich ist gerade nicht zu sehen.',
    goToPage: 'Zur passenden Seite',
    offer: 'Möchtest du eine kurze Tour durch diese Ansicht machen?',
    offerYes: 'Tour starten',
    offerNo: 'Später',
    manage: 'Touren bearbeiten',
    close: 'Schließen',
    moreHelp: 'Weitere Anleitungen',
  },
  en: {
    help: 'Help',
    tours: 'Guided tours',
    noTours: 'There is no tour for this view yet.',
    start: 'Start tour',
    steps: (n: number) => `${n} steps`,
    draft: 'Draft',
    step: (i: number, n: number) => `Step ${i} of ${n}`,
    back: 'Back',
    next: 'Next',
    done: 'Done',
    end: 'End tour',
    tryIt: 'Try it out',
    notVisible: 'This part of the screen is not visible right now.',
    goToPage: 'Go to the right page',
    offer: 'Would you like a short tour of this view?',
    offerYes: 'Start tour',
    offerNo: 'Later',
    manage: 'Edit tours',
    close: 'Close',
    moreHelp: 'More guides',
  },
} as const

export function tourStrings(language: string) {
  return language === 'en' ? TOUR_STRINGS.en : TOUR_STRINGS.de
}
