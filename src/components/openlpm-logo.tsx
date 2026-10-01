import type { CSSProperties } from 'react'

type Props = {
  size?: number
  className?: string
  style?: CSSProperties
}

// OpenLPM's mark: a small hub-and-spoke network -- three connected nodes
// around a center, reading as "networked knowledge" rather than a single
// trend line standing in for the name. Picked 2026-10-01 (feedback
// 198b0304) from three real concepts, same coordinates as public/
// favicon.svg so the in-app mark and the browser-tab icon match. Same
// 24x24 viewBox and stroke conventions (round caps/joins, currentColor) as
// the lucide icon set used everywhere else in the app, so it drops into
// the existing ".brand" slot without a visual seam.
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
      <g stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <line x1="12" y1="12.5" x2="12" y2="5.5" />
        <line x1="12" y1="12.5" x2="6" y2="17.5" />
        <line x1="12" y1="12.5" x2="18" y2="17.5" />
        <line x1="6" y1="17.5" x2="18" y2="17.5" />
      </g>
      <circle cx="12" cy="5.5" r="1.9" fill="currentColor" />
      <circle cx="6" cy="17.5" r="1.9" fill="currentColor" />
      <circle cx="18" cy="17.5" r="1.9" fill="currentColor" />
      <circle cx="12" cy="12.5" r="2.4" fill="currentColor" />
    </svg>
  )
}
