type MarkProps = {
  size?: number
  className?: string
}

// The real OpenEvo CCS Lab logo, hosted on the lab's own site -- a
// node-graph wordmark in navy + teal. This used to be a small original
// stand-in mark (a hub-and-three-satellites SVG) because no logo asset
// lived in any of the lab's git repos; swapped for the real file on
// Dustin's ask, 2026-09-14.
export function OpenEvoMark({ size = 16, className }: MarkProps) {
  return (
    <img
      src="https://openevo.eva.mpg.de/wp-content/uploads/OpenEvo-Logo-new-2023.png"
      alt="OpenEvo Computational Curriculum Studies Lab"
      height={size}
      style={{ height: size, width: 'auto', maxHeight: size }}
      className={className}
    />
  )
}

// "A Project from the OpenEvo Computational Curriculum Studies Lab" --
// small attribution, not a nav element. Links out to the lab's own site.
export function OpenEvoAttribution() {
  return (
    <a
      href="http://openevo.eva.mpg.de"
      target="_blank"
      rel="noreferrer"
      className="row"
      style={{
        justifyContent: 'center',
        gap: 6,
        fontSize: 11.5,
        color: 'var(--text-muted)',
        textDecoration: 'none',
      }}
    >
      <OpenEvoMark size={14} />
      A Project from the OpenEvo Computational Curriculum Studies Lab
    </a>
  )
}
