import type { CSSProperties } from 'react'

type Props = {
  size?: number
  className?: string
  style?: CSSProperties
}

// OpenLPM's mark: four nodes on a single path, trending up with one honest
// dip along the way -- a learning progression rendered literally rather
// than a generic icon standing in for the name. Same 24x24 viewBox and
// stroke conventions (round caps/joins, currentColor) as the lucide icon
// set used everywhere else in the app, so it drops into the existing
// ".brand" slot without a visual seam.
export function OpenLpmLogo({ size = 20, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M4 19L9.5 14L14 16L20 5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="19" r="1.9" fill="currentColor" />
      <circle cx="9.5" cy="14" r="1.9" fill="currentColor" />
      <circle cx="14" cy="16" r="1.9" fill="currentColor" />
      <circle cx="20" cy="5" r="1.9" fill="currentColor" />
    </svg>
  )
}
