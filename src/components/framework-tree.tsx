// Renders any framework's tags[] (framework_key/label/parentTagId shape --
// see data/frameworks/*.json and RFC 0003) as an arbitrary-depth hierarchy.
// Deliberately generic: the same component renders a 3-tier Basiskonzepte
// taxonomy today and any other project's cross-cutting framework later,
// since the underlying shape (flat list + parentTagId) is the same one
// EvoMentor's own kmk-basiskonzepte-biologie.json already established.

export type FrameworkTag = { id: string; label: string; parentTagId: string | null }

export function FrameworkTree({ tags }: { tags: FrameworkTag[] }) {
  const byParent = new Map<string | null, FrameworkTag[]>()
  for (const tag of tags) {
    const siblings = byParent.get(tag.parentTagId) ?? []
    siblings.push(tag)
    byParent.set(tag.parentTagId, siblings)
  }

  function renderLevel(parentId: string | null, depth: number): React.ReactNode {
    const children = byParent.get(parentId)
    if (!children) return null
    return (
      <ul className="tree-level">
        {children.map((tag) => (
          <li key={tag.id} className="tree-node">
            <span className={depth === 0 ? 'tree-label-root' : 'tree-label'}>{tag.label}</span>
            {renderLevel(tag.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }

  return <>{renderLevel(null, 0)}</>
}
