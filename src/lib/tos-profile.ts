// Theories of Schooling (migration 256): the profile format, the checks a profile must pass before it is saved in a space, and the
// flattening of its statements into rows. Everything here is pure (no database, no browser), so scripts/test_tos_profile.mjs can run it
// and scripts/import_tos_profile.mjs can use the same code.
//
// The format is the one of the Theory of Schooling Atlas widget (public/vendor/openevo-atlas/README.md). The checks follow what the widget
// reads (the schema string, the list of statements, the domain ids, unique ids) and add the required fields of the profile schema, so a
// profile that passes here also draws in the Atlas and fits the database columns of migration 256.

export const PROFILE_SCHEMA = 'openevo-schooling-theory-profile/1'
export const MAX_STATEMENTS = 5000
export const MAX_STATEMENT_LENGTH = 600
export const MAX_FILE_BYTES = 3_000_000

export type TosVisibility = 'public' | 'lab-only' | 'local'
export type ReviewStatus = 'ai-draft' | 'author-reviewed' | 'expert-reviewed' | 'illustrative-example'

export interface TosDomain {
  id: string
  name: string
  short: string
  means: string
  ask?: string
  color?: string
  umbrella?: boolean
}

export interface TosModel {
  id: string
  supers: TosDomain[]
  subs: TosDomain[]
  elementTypes: { id: string; name: string; short: string; means: string }[]
  holderKinds: { id: string; name: string }[]
  superHint?: string
  subHint?: string
}

export interface Placed {
  id: string
  strength?: 'firm' | 'single'
}

export interface TosElement {
  id: string
  type: string
  statement: string
  stance?: 'own' | 'attributed'
  placement: { super: (Placed | string)[]; sub: (Placed | string)[] }
  links?: { ref: string; relation?: string; score?: number; note?: string }[]
  source?: string
  becomes?: string
  label?: string
  ref?: string
  visibility?: 'public' | 'lab-only'
  url?: string
}

export interface TosWarrant {
  id: string
  design: string
  basis: string[]
  basisKind?: string
  link?: 'explicit' | 'implied'
  note?: string
  review?: { status?: string; verdict?: string }
}

export interface TosDomainLink {
  scope: 'super' | 'sub'
  from: string
  to: string
  relation?: string
  directed?: boolean
  means?: string
}

export interface TosProfile {
  schema: string
  id: string
  title: string
  summary?: string
  theoryRef?: string
  holder: { kind: string; label: string; ref?: string }
  model: string
  visibility: TosVisibility
  license: string
  version: string
  date?: string
  characterizationStatus?: string
  provenance: { extractedBy: string; addedBy?: string; reviewStatus: string; sources?: { label: string; literatureRef?: string }[]; note?: string }
  elements: TosElement[]
  domainLinks?: TosDomainLink[]
  warrants?: TosWarrant[]
  [key: string]: unknown
}

export interface ValidationResult {
  ok: boolean
  /** Problems that stop the profile from being saved. Plain sentences. */
  errors: string[]
  /** Things worth knowing that do not stop it. */
  warnings: string[]
  profile: TosProfile | null
}

const PROFILE_ID = /^OE-SCHOOLINGPROFILE-[a-z0-9-]+$/
const ELEMENT_ID = /^[A-Za-z0-9_.-]+$/
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/
const THEORY_REF = /^OE-THEORY-[a-z0-9-]+$/
const LINK_REF = /^(OE-[A-Z]+(-[A-Z]+)?-[A-Za-z0-9._-]+|claim:[A-Za-z0-9._-]+)$/
const VISIBILITIES = ['public', 'lab-only', 'local']
const REVIEW_STATUSES = ['ai-draft', 'author-reviewed', 'expert-reviewed', 'illustrative-example']
const EXTRACTED_BY = ['human', 'llm', 'human-and-llm']

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown) => (typeof v === 'string' ? v : '')

/** The ids of a list of placements. The widget also accepts a bare id, so both forms are read. */
export function placedIds(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const out: string[] = []
  for (const p of list) {
    const id = typeof p === 'string' ? p : isObject(p) && typeof p.id === 'string' ? p.id : ''
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

/** The ids of the placements that are a clear fit (not marked as a weaker fit). */
export function firmIds(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const out: string[] = []
  for (const p of list) {
    const id = typeof p === 'string' ? p : isObject(p) && typeof p.id === 'string' ? p.id : ''
    const weak = isObject(p) && p.strength === 'single'
    if (id && !weak && !out.includes(id)) out.push(id)
  }
  return out
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Checks a parsed profile against the format and the domain model. Never throws. */
export function validateProfile(raw: unknown, model: TosModel): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const fail = (): ValidationResult => ({ ok: false, errors, warnings, profile: null })

  if (!isObject(raw)) {
    errors.push('This file is not a theory of schooling profile. A profile is one JSON object.')
    return fail()
  }
  const schema = text(raw.schema)
  if (!schema.startsWith('openevo-schooling-theory-profile')) {
    errors.push('This file does not say it is a theory of schooling profile (its "schema" line is missing or different).')
    return fail()
  }
  if (schema !== PROFILE_SCHEMA) errors.push(`This profile is written in format "${schema}". Only "${PROFILE_SCHEMA}" can be saved here.`)

  const id = text(raw.id)
  if (!PROFILE_ID.test(id)) errors.push('The profile needs a code that looks like OE-SCHOOLINGPROFILE-my-theory (capital letters at the start, then small letters, digits and hyphens).')
  if (text(raw.title).trim().length < 3) errors.push('The profile needs a title of at least 3 letters.')
  const holder = raw.holder
  if (!isObject(holder) || !text(holder.label).trim() || !text(holder.kind)) {
    errors.push('The profile needs to say whose theory it is: a kind (one person, a community, a group, a book, a research tradition) and a name.')
  } else if (!model.holderKinds.some((k) => k.id === holder.kind)) {
    errors.push(`The kind of holder "${text(holder.kind)}" is not one of: ${model.holderKinds.map((k) => k.id).join(', ')}.`)
  }
  if (!text(raw.model)) errors.push('The profile needs to name the domain model it is sorted by.')
  else if (raw.model !== model.id) warnings.push(`The profile names the domain model "${text(raw.model)}". This page knows "${model.id}", so the sorting below is checked against that one.`)
  if (!VISIBILITIES.includes(text(raw.visibility))) errors.push('The profile needs a visibility: public, lab-only or local.')
  else if (raw.visibility === 'local') warnings.push('This profile is marked "local" (meant to stay in one browser). Saving it here shares it with every member of the space.')
  if (!text(raw.license).trim()) errors.push('The profile needs a licence, or the word private.')
  if (!VERSION.test(text(raw.version))) errors.push('The version needs three numbers separated by dots, for example 0.1.0.')
  if (raw.theoryRef !== undefined && !THEORY_REF.test(text(raw.theoryRef))) errors.push('The theory reference has to look like OE-THEORY-my-theory.')
  const prov = raw.provenance
  if (!isObject(prov)) errors.push('The profile needs a provenance section that says who wrote it and whether anyone has checked it.')
  else {
    if (!EXTRACTED_BY.includes(text(prov.extractedBy))) errors.push('The provenance needs "extractedBy": human, llm or human-and-llm.')
    if (!REVIEW_STATUSES.includes(text(prov.reviewStatus))) errors.push(`The provenance needs a review state: ${REVIEW_STATUSES.join(', ')}.`)
  }

  if (!Array.isArray(raw.elements)) {
    errors.push('The profile needs a list of statements ("elements").')
    return fail()
  }
  if (raw.elements.length === 0) warnings.push('The profile has no statements yet.')
  if (raw.elements.length > MAX_STATEMENTS) errors.push(`The profile has ${raw.elements.length} statements. The limit is ${MAX_STATEMENTS}.`)

  const superIds = new Set(model.supers.map((d) => d.id))
  const subIds = new Set(model.subs.map((d) => d.id))
  const typeIds = new Set(model.elementTypes.map((t) => t.id))
  const seen = new Set<string>()
  let unplaced = 0

  raw.elements.forEach((e: unknown, i: number) => {
    const where = `Statement ${i + 1}`
    if (!isObject(e)) {
      errors.push(`${where} is not an object.`)
      return
    }
    const eid = text(e.id)
    const name = eid ? `Statement ${eid}` : where
    if (!eid) errors.push(`${where} has no id.`)
    else if (!ELEMENT_ID.test(eid)) errors.push(`${name} has an id with characters that are not allowed. Use letters, digits, dots, hyphens and underscores.`)
    else if (seen.has(eid)) errors.push(`Two statements share the id ${eid}. Each id can be used once.`)
    else seen.add(eid)

    const statement = text(e.statement).trim()
    if (statement.length < 3) errors.push(`${name} has no wording (at least 3 letters).`)
    else if (statement.length > MAX_STATEMENT_LENGTH) errors.push(`${name} is ${statement.length} characters long. The limit is ${MAX_STATEMENT_LENGTH}. Split it into two statements.`)

    if (!typeIds.has(text(e.type))) errors.push(`${name} has the kind "${text(e.type)}", which is not one of: ${[...typeIds].join(', ')}.`)
    if (e.visibility !== undefined && e.visibility !== 'public' && e.visibility !== 'lab-only') errors.push(`${name} has the visibility "${text(e.visibility)}". Use public or lab-only.`)
    if (e.label !== undefined && text(e.label).length > 200) errors.push(`${name} has a short name longer than 200 characters.`)

    const pl = e.placement
    if (!isObject(pl) || !Array.isArray(pl.super) || !Array.isArray(pl.sub)) {
      errors.push(`${name} needs a "placement" with two lists, "super" and "sub" (either can be empty).`)
    } else {
      const check = (list: unknown[], known: Set<string>, label: string) => {
        list.forEach((p) => {
          const pid = typeof p === 'string' ? p : isObject(p) ? text(p.id) : ''
          if (!pid) errors.push(`${name} has an empty entry in its ${label} placement.`)
          else if (!known.has(pid)) errors.push(`${name} sits in a domain this page does not know: "${pid}" (${label}). Known: ${[...known].join(', ')}.`)
          if (isObject(p) && p.strength !== undefined && p.strength !== 'firm' && p.strength !== 'single') errors.push(`${name}: the strength of "${pid}" has to be firm or single.`)
        })
      }
      check(pl.super, superIds, 'broad idea')
      check(pl.sub, subIds, 'aspect of schooling')
      if (pl.super.length === 0 && pl.sub.length === 0) unplaced++
    }

    if (e.links !== undefined) {
      if (!Array.isArray(e.links)) errors.push(`${name}: "links" has to be a list.`)
      else
        e.links.forEach((l: unknown) => {
          if (!isObject(l) || !text(l.ref)) errors.push(`${name} has a link without a "ref".`)
          else if (!LINK_REF.test(text(l.ref))) warnings.push(`${name} links to "${text(l.ref)}", which does not look like a record code of the OpenEvo bases.`)
        })
    }
  })
  if (unplaced > 0) warnings.push(`${plural(unplaced, 'statement')} ${unplaced === 1 ? 'is' : 'are'} not placed in any domain yet. ${unplaced === 1 ? 'It' : 'They'} will show as "Not placed yet" in the Atlas.`)

  const warrantIds = new Set<string>()
  if (raw.warrants !== undefined) {
    if (!Array.isArray(raw.warrants)) errors.push('"warrants" has to be a list.')
    else
      raw.warrants.forEach((w: unknown, i: number) => {
        if (!isObject(w)) {
          errors.push(`Reason ${i + 1} is not an object.`)
          return
        }
        const wid = text(w.id) || `${i + 1}`
        if (!text(w.id)) errors.push(`Reason ${i + 1} has no id.`)
        else if (warrantIds.has(wid)) errors.push(`Two reasons share the id ${wid}.`)
        warrantIds.add(wid)
        if (!seen.has(text(w.design))) errors.push(`Reason ${wid} is a reason for statement "${text(w.design)}", which does not exist.`)
        if (!Array.isArray(w.basis) || w.basis.length === 0) errors.push(`Reason ${wid} names no statements it rests on.`)
        else
          w.basis.forEach((b: unknown) => {
            if (!seen.has(text(b))) errors.push(`Reason ${wid} rests on statement "${text(b)}", which does not exist.`)
          })
      })
  }

  if (raw.domainLinks !== undefined) {
    if (!Array.isArray(raw.domainLinks)) errors.push('"domainLinks" has to be a list.')
    else
      raw.domainLinks.forEach((l: unknown, i: number) => {
        if (!isObject(l)) {
          errors.push(`Domain link ${i + 1} is not an object.`)
          return
        }
        const known = l.scope === 'super' ? superIds : l.scope === 'sub' ? subIds : null
        if (!known) errors.push(`Domain link ${i + 1} needs a scope of super or sub.`)
        else {
          if (!known.has(text(l.from))) errors.push(`Domain link ${i + 1} starts at "${text(l.from)}", which is not a known domain.`)
          if (!known.has(text(l.to))) errors.push(`Domain link ${i + 1} ends at "${text(l.to)}", which is not a known domain.`)
          if (l.from === l.to) errors.push(`Domain link ${i + 1} joins a domain to itself.`)
        }
      })
  }

  const ok = errors.length === 0
  return { ok, errors, warnings, profile: ok ? (raw as TosProfile) : null }
}

/** The visibility one statement has: its own when it names one, else the profile's. Only "public" lets it be shown to people outside the lab. */
export function elementVisibility(profile: Pick<TosProfile, 'visibility'>, e: Pick<TosElement, 'visibility'>): 'public' | 'lab-only' {
  const v = e.visibility ?? profile.visibility
  return v === 'public' ? 'public' : 'lab-only'
}

export interface TosElementRow {
  element_id: string
  type: string
  label: string | null
  statement: string
  supers: string[]
  subs: string[]
  ref: string | null
  visibility: 'public' | 'lab-only'
}

/** One row per statement, for the table tos_elements. */
export function flattenProfile(profile: TosProfile): TosElementRow[] {
  return profile.elements.map((e) => ({
    element_id: e.id,
    type: e.type,
    label: e.label ? e.label : null,
    statement: e.statement,
    supers: placedIds(e.placement?.super),
    subs: placedIds(e.placement?.sub),
    ref: e.ref ? e.ref : null,
    visibility: elementVisibility(profile, e),
  }))
}

export interface TosProfileRowFields {
  profile_id: string
  title: string
  holder_kind: string
  visibility: TosVisibility
  theory_ref: string | null
  version: string
  license: string
  review_status: string
  data: TosProfile
}

/** The columns of tos_profiles that are copies of fields of the profile. */
export function profileRowFields(profile: TosProfile): TosProfileRowFields {
  return {
    profile_id: profile.id,
    title: profile.title,
    holder_kind: profile.holder.kind,
    visibility: profile.visibility,
    theory_ref: profile.theoryRef ? profile.theoryRef : null,
    version: profile.version,
    license: profile.license,
    review_status: profile.provenance.reviewStatus,
    data: profile,
  }
}

/** What each review state means for a reader, in plain words. */
export const REVIEW_STATUS_PLAIN: Record<string, string> = {
  'ai-draft': 'Draft written with AI help and not yet checked by an expert',
  'author-reviewed': 'Checked by the author, awaiting an outside expert',
  'expert-reviewed': 'Checked by an expert',
  'illustrative-example': 'An invented example',
}

export function reviewStatusPlain(status: string | undefined): string {
  return (status && REVIEW_STATUS_PLAIN[status]) || 'Review state not known'
}

export function holderKindPlain(model: Pick<TosModel, 'holderKinds'>, kind: string): string {
  return model.holderKinds.find((k) => k.id === kind)?.name ?? kind
}

/** A safe file name for downloading a profile. */
export function profileFileName(profile: Pick<TosProfile, 'id' | 'version'>): string {
  return `${profile.id.replace(/[^A-Za-z0-9_.-]/g, '-')}-v${profile.version}.json`
}

/** Reads text as a profile. Returns the parsed value or a plain-language error. */
export function parseProfileText(source: string): { value: unknown; error: string | null } {
  if (source.length > MAX_FILE_BYTES) return { value: null, error: 'This file is larger than 3 MB. A profile is much smaller than that.' }
  const trimmed = source.replace(/^﻿/, '').trim()
  if (!trimmed) return { value: null, error: 'There is nothing to read yet. Paste a profile or choose a file.' }
  try {
    return { value: JSON.parse(trimmed), error: null }
  } catch {
    return { value: null, error: 'This text is not valid JSON, so it cannot be read as a profile. Check for a missing comma, quote or bracket.' }
  }
}
