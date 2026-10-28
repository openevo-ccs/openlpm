import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import {
  familyOf, splitJurisdictions,
  type CmpConcept, type CmpLink, type CmpObject, type CmpRecord, type CmpReview, type CmpThread,
} from '@/lib/comparison'

type Client = SupabaseClient<Database>

// Loaders and writers for the country and cross-national comparison views.
// One load per view session (see the comparison provider), so every page of the
// view reads the same snapshot. Cast to `any` at the query boundary where the
// generated types lag behind the schema, the same convention dashboard-views.ts
// and comparative-analysis.ts use.

export interface ComparisonSource {
  objects: CmpObject[]
  concepts: CmpConcept[]
  threads: CmpThread[]
  records: CmpRecord[]
  links: CmpLink[]
  reviews: CmpReview[]
  /** "Checked, nothing fits" decisions from the coherence log, keyed by `${objectId}|${unitId}`. */
  checkedNoMatch: Set<string>
  /** True when the link-review table exists on this database. */
  reviewsAvailable: boolean
  projectColor: string | null
}

const SKIP_TITLE = /diagnostic test row/i

function recordFromRow(r: any, fallbackJurisdiction: string | null): CmpRecord | null {
  if (!r.title || SKIP_TITLE.test(r.title)) return null
  const jurisdictions = splitJurisdictions(r.jurisdiction)
  if (jurisdictions.length === 0 && fallbackJurisdiction) jurisdictions.push(fallbackJurisdiction)
  if (jurisdictions.length === 0) return null
  const date = r.event_date ?? r.dateStart ?? r.adoptionDate ?? r.effective_from ?? null
  const dateEnd = r.dateEnd ?? r.targetDate ?? r.effective_until ?? null
  const text = [r.sum1, r.sum2, r.sum3].find((x: unknown) => typeof x === 'string' && x.trim()) ?? ''
  const gf = Number(r.gradeFrom)
  const unit = r.mandateType === 'curriculum-unit' && Number.isFinite(gf) && r.unitSubject
    ? {
        subject: String(r.unitSubject),
        schoolType: r.unitSchool ?? null,
        gradeFrom: gf,
        gradeTo: Number.isFinite(Number(r.gradeTo)) && r.gradeTo !== null ? Number(r.gradeTo) : gf,
        hours: r.unitHours !== null && r.unitHours !== undefined && Number.isFinite(Number(r.unitHours)) ? Number(r.unitHours) : null,
        courseLevel: r.unitCourse ?? null,
        tags: Array.isArray(r.unitTags) ? r.unitTags.map(String) : [],
        titleDe: r.unitTitleDe ?? null,
      }
    : undefined
  return {
    id: r.id,
    title: r.title,
    type: r.record_type,
    family: familyOf(r.record_type, r.mandateType),
    ...(unit ? { unit } : {}),
    ...(typeof r.sourceUrl === 'string' && /^https?:\/\//.test(r.sourceUrl) ? { sourceUrl: r.sourceUrl } : {}),
    jurisdictions,
    date: typeof date === 'string' ? date : null,
    dateEnd: typeof dateEnd === 'string' ? dateEnd : null,
    summary: String(text).replace(/\s+/g, ' ').trim().slice(0, 600),
  }
}

/** Splits a long id list into PostgREST-friendly chunks. */
function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

export async function loadComparisonSource(
  supabase: Client,
  projectId: string,
  branchId: string,
  /** Curriculum Repository project slugs, each with the country they stand for. */
  repositories: { slug: string; country: string }[],
): Promise<ComparisonSource> {
  const db = supabase as any

  // The progression itself.
  const [{ data: objRows }, { data: conRows }, { data: elRows }, { data: tagRows }, { data: thrRows }, { data: proj }] = await Promise.all([
    db.from('lpm_data_objects').select('id,title,description,object_type,grade_band,created_at').eq('project_id', projectId).eq('branch_id', branchId).eq('status', 'accepted').order('created_at', { ascending: true }),
    db.from('lpm_connections').select('from_object_id,to_object_id,relation_type').eq('project_id', projectId).eq('relation_type', 'isChildOf'),
    db.from('lpm_schema_elements').select('id,label,parent_id,element_type').eq('project_id', projectId).eq('element_type', 'concept'),
    db.from('lpm_object_tags').select('data_object_id,schema_element_id').eq('project_id', projectId),
    db.from('lpm_threads').select('id,title').eq('project_id', projectId),
    db.from('projects').select('color').eq('id', projectId).maybeSingle(),
  ])
  const parentOf = new Map<string, string>((conRows ?? []).map((c: any) => [c.from_object_id, c.to_object_id]))
  const conceptsByObject = new Map<string, string[]>()
  for (const t of tagRows ?? []) {
    const arr = conceptsByObject.get(t.data_object_id)
    if (arr) arr.push(t.schema_element_id)
    else conceptsByObject.set(t.data_object_id, [t.schema_element_id])
  }
  const threadIds = (thrRows ?? []).map((t: any) => t.id)
  let stations: any[] = []
  if (threadIds.length) {
    const { data } = await db.from('lpm_thread_stations').select('thread_id,data_object_id,sequence').in('thread_id', threadIds)
    stations = data ?? []
  }
  const threadsByObject = new Map<string, string[]>()
  const threads: CmpThread[] = (thrRows ?? []).map((t: any) => ({ id: t.id, title: t.title, objectIds: [] }))
  const threadById = new Map(threads.map((t) => [t.id, t]))
  for (const s of stations) {
    threadById.get(s.thread_id)?.objectIds.push(s.data_object_id)
    const arr = threadsByObject.get(s.data_object_id)
    if (arr) arr.push(s.thread_id)
    else threadsByObject.set(s.data_object_id, [s.thread_id])
  }
  const objects: CmpObject[] = (objRows ?? []).map((o: any, i: number) => ({
    id: o.id,
    title: o.title,
    description: o.description ?? '',
    type: o.object_type,
    gradeBand: o.grade_band ?? null,
    parentId: parentOf.get(o.id) ?? null,
    conceptIds: conceptsByObject.get(o.id) ?? [],
    threadIds: threadsByObject.get(o.id) ?? [],
    order: i,
  }))
  const concepts: CmpConcept[] = (elRows ?? []).map((e: any) => ({ id: e.id, label: e.label, parentId: e.parent_id ?? null }))

  // The real-world records, from every repository this view can reach.
  const slugs = repositories.map((r) => r.slug)
  const countryBySlug = new Map(repositories.map((r) => [r.slug, r.country]))
  const { data: repoProjects } = slugs.length ? await db.from('projects').select('id,slug').in('slug', slugs) : { data: [] }
  const countryByProject = new Map<string, string>((repoProjects ?? []).map((p: any) => [p.id, countryBySlug.get(p.slug) ?? '']))
  const repoIds = (repoProjects ?? []).map((p: any) => p.id)
  const records: CmpRecord[] = []
  if (repoIds.length) {
    const { data } = await db
      .from('curriculum_repository_records')
      .select('id,project_id,title,record_type,jurisdiction,event_date,effective_from,effective_until,dateStart:content->>dateStart,dateEnd:content->>dateEnd,adoptionDate:content->>adoptionDate,targetDate:content->>targetDate,sum1:content->>summary,sum2:content->>description,sum3:content->>statementTextEn,sourceUrl:content->>sourceUrl,mandateType:content->>mandateType,unitSubject:content->>subject,unitSchool:content->>schoolType,gradeFrom:content->>gradeFrom,gradeTo:content->>gradeTo,unitHours:content->>hours,unitCourse:content->>courseLevel,unitTags:content->topicTags,unitTitleDe:content->>labelDe')
      .in('project_id', repoIds)
      .limit(5000)
    for (const row of data ?? []) {
      const rec = recordFromRow(row, countryByProject.get(row.project_id) || null)
      if (rec) records.push(rec)
    }
  }

  // The links this progression already has.
  const { data: linkRows } = await db
    .from('curriculum_repository_links')
    .select('id,data_object_id,repository_record_id,relation_type,rationale,created_at,created_by')
    .eq('project_id', projectId)
  const links: CmpLink[] = (linkRows ?? []).map((l: any) => ({
    id: l.id,
    objectId: l.data_object_id,
    recordId: l.repository_record_id,
    relationType: l.relation_type,
    rationale: l.rationale ?? null,
    createdAt: l.created_at,
    createdBy: l.created_by ?? null,
    proposed: typeof l.relation_type === 'string' && l.relation_type.startsWith('proposed_'),
  }))

  // Critiques of links. The table arrives with a later migration, so a missing table is normal.
  let reviews: CmpReview[] = []
  let reviewsAvailable = true
  const linkIds = links.map((l) => l.id)
  if (linkIds.length) {
    for (const part of chunk(linkIds, 150)) {
      const { data, error } = await db.from('curriculum_link_reviews').select('id,link_id,verdict,comment,reviewed_by,created_at').in('link_id', part)
      if (error) { reviewsAvailable = false; break }
      reviews.push(...(data ?? []).map((v: any) => ({ id: v.id, linkId: v.link_id, verdict: v.verdict, comment: v.comment ?? null, reviewedBy: v.reviewed_by ?? null, createdAt: v.created_at })))
    }
  } else {
    const { error } = await db.from('curriculum_link_reviews').select('id').limit(1)
    if (error) reviewsAvailable = false
  }

  // "Checked, nothing fits" decisions, kept in the coherence log.
  const checkedNoMatch = new Set<string>()
  const { data: coh } = await db.from('lpm_coherence_reviews').select('scope_a,scope_b').eq('project_id', projectId).eq('axis', 'real-world-link')
  for (const c of coh ?? []) {
    const o = c.scope_a?.data_object_id
    const u = c.scope_b?.unit
    if (o && u) checkedNoMatch.add(`${o}|${u}`)
  }

  return { objects, concepts, threads, records, links, reviews, checkedNoMatch, reviewsAvailable, projectColor: proj?.color ?? null }
}

// ---- Writers ---------------------------------------------------------------------

export type LinkVerdict = 'supports' | 'questions' | 'too_broad' | 'wrong_place'

export async function addLinkReview(
  supabase: Client, params: { projectId: string; linkId: string; verdict: LinkVerdict; comment: string },
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await (supabase as any).from('curriculum_link_reviews').insert({
    project_id: params.projectId, link_id: params.linkId, verdict: params.verdict, comment: params.comment.trim() || null, reviewed_by: user?.id ?? null,
  })
  return { error: error?.message ?? null }
}

export async function deleteLinkReview(supabase: Client, reviewId: string): Promise<{ error: string | null }> {
  const { error } = await (supabase as any).from('curriculum_link_reviews').delete().eq('id', reviewId)
  return { error: error?.message ?? null }
}

/** Turns an AI-drafted proposal into an ordinary link. Needs the editor update policy from migration 142. */
export async function confirmProposedLink(supabase: Client, link: { id: string; relationType: string }): Promise<{ error: string | null }> {
  const plain = link.relationType.replace(/^proposed_/, '')
  const { error } = await supabase.from('curriculum_repository_links').update({ relation_type: plain }).eq('id', link.id)
  return { error: error?.message ?? null }
}

export async function markCheckedNoMatch(
  supabase: Client, params: { projectId: string; branchId: string; objectId: string; unitId: string; note: string },
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await (supabase as any).from('lpm_coherence_reviews').insert({
    project_id: params.projectId,
    branch_id: params.branchId,
    axis: 'real-world-link',
    scope_a: { data_object_id: params.objectId },
    scope_b: { unit: params.unitId },
    note: params.note.trim() || 'Checked, nothing in this place fits.',
    reviewed_by: user?.id ?? null,
  })
  return { error: error?.message ?? null }
}
