// Remembers which project spaces this browser has opened. The "New here? Start here" card on the project list
// uses it to step aside once someone works in more than one space (feedback 15385d44, Dustin 2026-11-07).
// Storage is a convenience: private windows and blocked site data can make it throw, so every access is wrapped
// and the card simply stays visible (collapsed) when nothing can be read.

const KEY = 'openlpm.visitedSpaces'

// Two or more different spaces opened counts as "using multiple spaces".
export const MULTI_SPACE_THRESHOLD = 2

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

export function recordSpaceVisit(slug: string) {
  if (!slug) return
  try {
    const seen = read()
    if (seen.includes(slug)) return
    window.localStorage.setItem(KEY, JSON.stringify([...seen, slug]))
  } catch {
    /* nothing to do without storage */
  }
}

export function usesMultipleSpaces(): boolean {
  return read().length >= MULTI_SPACE_THRESHOLD
}
