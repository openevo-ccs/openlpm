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
