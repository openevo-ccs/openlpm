type MarkProps = {
  size?: number
  className?: string
}

// The OpenEvo CCS Lab's git repos carry no logo/wordmark asset of their own
// (checked across openevo-core, conceptbase, lab_manager) -- but a real one
// exists on the lab's own site (openevo.eva.mpg.de/wp-content/uploads/
// OpenEvo-Logo-new-2023.png): a node-graph wordmark in navy + teal. This is
// a small original mark for attribution use here, not a copy of that
// logo -- a hub connected to three satellites, echoing both the lab's real
// architecture (one lab coordinating many linked base repos/projects) and
// the real logo's own two-tone navy/teal network motif.
export function OpenEvoMark({ size = 16, className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 12L12 4M12 12L5 19M12 12L19 19"
        stroke="var(--brand-navy)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2" fill="var(--brand-navy)" />
      <circle cx="12" cy="4" r="1.5" fill="var(--brand-teal)" />
      <circle cx="5" cy="19" r="1.5" fill="var(--brand-teal)" />
      <circle cx="19" cy="19" r="1.5" fill="var(--brand-teal)" />
    </svg>
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
