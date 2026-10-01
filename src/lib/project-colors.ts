// Real feedback 2371cbf7 (2026-10-01): a small fixed palette, not a free
// color picker -- Dustin's own framing was "subtle... though not
// necessarily project unique," so a handful of good, distinct options is
// the actual ask, not infinite choice. Keys are stored in projects.color
// (migration 064); values are real hex, chosen for contrast against both
// light and dark surfaces at the subtle border weight this is used at.
export const PROJECT_COLORS: { key: string; label: string; hex: string }[] = [
  { key: 'teal', label: 'Teal', hex: '#0f8a7a' },
  { key: 'blue', label: 'Blue', hex: '#2a78d6' },
  { key: 'violet', label: 'Violet', hex: '#7c5cd6' },
  { key: 'rose', label: 'Rose', hex: '#d6487a' },
  { key: 'orange', label: 'Orange', hex: '#d6782a' },
  { key: 'amber', label: 'Amber', hex: '#c9a227' },
  { key: 'green', label: 'Green', hex: '#3f9142' },
  { key: 'slate', label: 'Slate', hex: '#5b6b7a' },
]

export function projectColorHex(key: string | null | undefined): string | null {
  if (!key) return null
  return PROJECT_COLORS.find((c) => c.key === key)?.hex ?? null
}

// Real feedback 95a618c0 (2026-10-01): "make the distinction between
// project and sub-project a little more clear... using the project space
// color selection, subtly." A very low-alpha fill behind a sub-project
// group, using that same project's own color -- distinct from the fuller-
// strength left border the color already draws elsewhere.
export function projectColorTint(key: string | null | undefined, alpha = 0.06): string | null {
  const hex = projectColorHex(key)
  if (!hex) return null
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
