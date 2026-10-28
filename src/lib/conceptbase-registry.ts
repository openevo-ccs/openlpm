// The ids ConceptBase holds a concept record for, read once per page load from the registry folder of the ConceptBase repository.
// One request lists the folder. A concept entry counts as registered when its id is in this set. When the registry cannot be reached
// (offline, rate limit) the result is null and the caller falls back to each concept's own flag.

const CONCEPTBASE_REPO = 'openevo-ccs/conceptbase'

let cached: Promise<Set<string> | null> | null = null

export function loadRegisteredConceptIds(): Promise<Set<string> | null> {
  if (!cached) {
    cached = fetch(`https://api.github.com/repos/${CONCEPTBASE_REPO}/git/trees/main?recursive=1`, { headers: { Accept: 'application/vnd.github+json' } })
      .then(async (res) => {
        if (!res.ok) return null
        const body = (await res.json()) as { tree?: { path: string; type: string }[] }
        const ids = (body.tree ?? [])
          .filter((e) => e.type === 'blob' && e.path.startsWith('registry/concept/') && e.path.endsWith('.json'))
          .map((e) => e.path.slice('registry/concept/'.length, -'.json'.length))
        return ids.length > 0 ? new Set(ids) : null
      })
      .catch(() => null)
  }
  return cached
}
