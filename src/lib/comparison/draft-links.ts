import type { CmpLink } from './model'

// Links to parts that nobody has accepted yet.
//
// The comparison pages read accepted parts only, so a link from a draft part (for example a part of an
// extension strand that was drafted by an AI session) never shows on them. This groups those links by
// strand and part so a reviewer can read and question them on one page. It changes no count anywhere else.

export interface CmpDraftPart {
  id: string
  title: string
  gradeBand: string | null
  /** draft, submitted or under_review. */
  status: string
  strandId: string | null
  strandTitle: string | null
  /** Position in the order the parts were created, to keep strands in a stable order. */
  order: number
}

export interface DraftPartGroup { part: CmpDraftPart; links: CmpLink[] }
export interface DraftStrandGroup { strandId: string | null; strandTitle: string | null; parts: DraftPartGroup[]; linkCount: number }
export interface DraftLinkGroups { strands: DraftStrandGroup[]; withoutLinks: CmpDraftPart[]; linkCount: number }

const BAND_ORDER = ['K-2', '3-5', '6-8', '9-12']
const bandRank = (b: string | null): number => { const i = BAND_ORDER.indexOf(b ?? ''); return i === -1 ? BAND_ORDER.length : i }

/** Groups links to draft parts by strand, then by part. Parts without a link are returned apart. */
export function groupDraftLinks(parts: CmpDraftPart[], links: CmpLink[]): DraftLinkGroups {
  const byPart = new Map<string, CmpLink[]>()
  const partIds = new Set(parts.map((p) => p.id))
  for (const l of links) {
    if (!partIds.has(l.objectId)) continue
    const arr = byPart.get(l.objectId)
    if (arr) arr.push(l)
    else byPart.set(l.objectId, [l])
  }
  const withLinks = parts.filter((p) => byPart.has(p.id))
  const withoutLinks = parts.filter((p) => !byPart.has(p.id)).sort((a, b) => a.order - b.order)
  const strands = new Map<string, DraftStrandGroup & { firstOrder: number }>()
  for (const part of withLinks) {
    const key = part.strandId ?? '__none__'
    let g = strands.get(key)
    if (!g) { g = { strandId: part.strandId, strandTitle: part.strandTitle, parts: [], linkCount: 0, firstOrder: part.order }; strands.set(key, g) }
    const own = (byPart.get(part.id) ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    g.parts.push({ part, links: own })
    g.linkCount += own.length
    g.firstOrder = Math.min(g.firstOrder, part.order)
  }
  const out = [...strands.values()].sort((a, b) => (a.strandId === null ? 1 : 0) - (b.strandId === null ? 1 : 0) || a.firstOrder - b.firstOrder)
  for (const g of out) g.parts.sort((a, b) => bandRank(a.part.gradeBand) - bandRank(b.part.gradeBand) || a.part.order - b.part.order)
  return {
    strands: out.map(({ firstOrder: _f, ...g }) => g),
    withoutLinks,
    linkCount: out.reduce((n, g) => n + g.linkCount, 0),
  }
}
