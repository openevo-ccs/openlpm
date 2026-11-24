// Theories of Schooling (migration 256): the plain-language context text that a chat assistant would get about the theories of a space.
// Pure string assembly, in the same spirit as src/lib/prompt-builder.tsx. The Prompt context page shows the text and lets a person copy it.
//
// The rules come from the lab's reference code (lab_manager, tools/literature-engine/tos_context.py), so a chat agent and this page
// produce the same kind of text:
//   - Domains are named in everyday words. A record code appears only in square brackets at the end of a line, so an answer can cite it.
//   - The review state of every theory is always named, and a note says that the sorting into domains is a first reading until someone has checked it.
//   - Who may see the text decides what it holds. For people outside the lab, a statement that is kept inside the lab shows only its short
//     name, or a placeholder when it has none. Its full wording never appears.
//
// Which profiles may be offered at all is decided before this code runs: a profile whose creator opted out of AI processing is left out
// by the page (see supabase/migrations/256 and CLAUDE.md). This builder trusts the list it is given.

import { firmIds, placedIds, elementVisibility, holderKindPlain, plural, reviewStatusPlain, type TosElement, type TosModel, type TosProfile } from './tos-profile'

export type Audience = 'lab' | 'public'

export const KIND_ORDER = ['design', 'aim', 'proposition', 'observation', 'practice', 'question', 'concept']

/** What each kind of statement is called in the text. */
export const KIND_PLAIN: Record<string, string> = {
  design: 'proposal',
  aim: 'aim',
  proposition: 'claim',
  observation: 'observation',
  practice: 'teaching practice',
  question: 'open question',
  concept: 'key idea',
}

export const PLACEHOLDER_KEPT_INSIDE = 'A statement whose wording is kept inside the lab'
export const SORTING_NOTE = 'Which domain each statement sits in is a first reading. It has not been checked by the authors or by an expert.'
export const NOT_PLACED = '_none'

export interface StatementRef {
  profile: TosProfile
  element: TosElement
  /** The code used to cite the statement: the profile code, a hash sign and the statement id. */
  code: string
}

export function statementCode(profile: Pick<TosProfile, 'id'>, element: Pick<TosElement, 'id'>): string {
  return `${profile.id}#${element.id}`
}

/** Every statement of the given profiles, with its citation code. */
export function listStatements(profiles: TosProfile[]): StatementRef[] {
  const out: StatementRef[] = []
  for (const profile of profiles) for (const element of profile.elements) out.push({ profile, element, code: statementCode(profile, element) })
  return out
}

export interface ContextOptions {
  audience: Audience
  /** Domain ids (broad ideas and aspects of schooling) to cover. Empty means every domain, plus the statements not placed anywhere. */
  domainIds: string[]
  /** Codes of the statements to include. null means every statement. */
  statementCodes: string[] | null
  /** Only list a statement under the domains it clearly fits. */
  firmOnly: boolean
  /** Optional text the person wants the assistant to answer. Added at the end exactly as written. */
  question?: string
}

export interface ContextResult {
  text: string
  /** Statements written out in full or by short name. */
  included: number
  /** Statements whose full wording was held back because it is kept inside the lab. */
  withheld: number
  /** Chosen statements that fit none of the chosen domains. */
  skipped: number
}

function domainName(model: TosModel, id: string): string {
  if (id === NOT_PLACED) return 'Not placed in a domain yet'
  return [...model.supers, ...model.subs].find((d) => d.id === id)?.name ?? id
}

function domainMeans(model: TosModel, id: string): string {
  if (id === NOT_PLACED) return 'Statements that nobody has sorted into a domain yet.'
  return [...model.supers, ...model.subs].find((d) => d.id === id)?.means ?? ''
}

function shortName(model: TosModel, id: string): string {
  return [...model.supers, ...model.subs].find((d) => d.id === id)?.short ?? id
}

function inDomain(e: TosElement, domainId: string, firmOnly: boolean): boolean {
  if (domainId === NOT_PLACED) return placedIds(e.placement?.super).length + placedIds(e.placement?.sub).length === 0
  const all = firmOnly ? [...firmIds(e.placement?.super), ...firmIds(e.placement?.sub)] : [...placedIds(e.placement?.super), ...placedIds(e.placement?.sub)]
  return all.includes(domainId)
}

/** The sentence that names how far a theory has been checked. Always written. */
export function reviewLine(profile: TosProfile, model: TosModel): string {
  const holder = `${profile.holder.label} (${holderKindPlain(model, profile.holder.kind).toLowerCase()})`
  return `${profile.title}. Held by ${holder}. Review state: ${reviewStatusPlain(profile.provenance?.reviewStatus)}. [${profile.id}]`
}

/** The text of one statement for the audience. Returns the line and whether its wording was held back. */
function statementLine(model: TosModel, ref: StatementRef, audience: Audience): { line: string; withheld: boolean } {
  const { profile, element, code } = ref
  const open = audience === 'lab' || elementVisibility(profile, element) === 'public'
  const wording = open ? element.statement.trim() : element.label?.trim() || PLACEHOLDER_KEPT_INSIDE
  const kind = KIND_PLAIN[element.type] ?? element.type
  const where = [...firmIds(element.placement?.super), ...firmIds(element.placement?.sub)].map((id) => shortName(model, id))
  const quote = element.stance === 'attributed' ? ' (a claim the source reports from someone else)' : ''
  const kept = open ? '' : ' (full wording kept inside the lab)'
  const line = `- ${kind.charAt(0).toUpperCase()}${kind.slice(1)}: ${wording}${kept}${quote}${where.length ? ` (sits under: ${where.join(', ')})` : ''} [${code}]`
  return { line, withheld: !open }
}

/** Builds the context text. */
export function buildTosContext(profiles: TosProfile[], model: TosModel, opts: ContextOptions): ContextResult {
  const chosen = opts.statementCodes ? new Set(opts.statementCodes) : null
  const all = listStatements(profiles).filter((s) => !chosen || chosen.has(s.code))
  const domains = opts.domainIds.length > 0 ? opts.domainIds : [...model.supers.map((d) => d.id), ...model.subs.map((d) => d.id), NOT_PLACED]
  const rank = (e: TosElement, domainId: string): number[] => [
    firmIds(e.placement?.super).includes(domainId) || firmIds(e.placement?.sub).includes(domainId) ? 0 : 1,
    KIND_ORDER.includes(e.type) ? KIND_ORDER.indexOf(e.type) : KIND_ORDER.length,
  ]

  const used = new Set<string>()
  const sections: string[] = []
  let included = 0
  let withheld = 0
  for (const domainId of domains) {
    const rows = all.filter((s) => !used.has(s.code) && inDomain(s.element, domainId, opts.firmOnly))
    if (rows.length === 0) continue
    rows.sort((a, b) => {
      const ra = rank(a.element, domainId)
      const rb = rank(b.element, domainId)
      return ra[0] - rb[0] || ra[1] - rb[1] || a.element.statement.localeCompare(b.element.statement)
    })
    const lines: string[] = []
    for (const r of rows) {
      const { line, withheld: held } = statementLine(model, r, opts.audience)
      lines.push(line)
      used.add(r.code)
      included++
      if (held) withheld++
    }
    sections.push([`${domainName(model, domainId)}. ${domainMeans(model, domainId)} ${plural(rows.length, 'statement')} listed here.`, ...lines].join('\n'))
  }
  const skipped = all.filter((s) => !used.has(s.code)).length

  const heading = [
    'Background: ideas about schooling that people in this space have written down',
    'These are the holders\' own ideas. They are not established facts. Say whose idea each one is, and give the code in square brackets when you rely on a statement.',
  ].join('\n')
  const theories = ['Theories used:', ...profiles.map((p) => `- ${reviewLine(p, model)}`)].join('\n')
  const needsSortingNote = profiles.some((p) => p.provenance?.reviewStatus !== 'expert-reviewed')
  const body = sections.length > 0 ? sections.join('\n\n') : 'No statement matches the chosen theories, statements and domains.'
  const closing: string[] = []
  if (needsSortingNote) closing.push(SORTING_NOTE)
  if (withheld > 0) closing.push(`${plural(withheld, 'statement')} ${withheld === 1 ? 'is' : 'are'} shown by short name only because the wording is kept inside the lab. Do not guess the missing wording.`)
  const q = opts.question?.trim()
  const parts = [heading, theories, body, ...closing]
  if (q) parts.push(`My question: ${q}`)
  return { text: parts.join('\n\n'), included, withheld, skipped }
}
