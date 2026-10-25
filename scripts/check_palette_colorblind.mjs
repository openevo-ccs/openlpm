// Color-blind check for a 6-color categorical palette.
// Simulates protanopia / deuteranopia / tritanopia (Machado et al. 2009, severity 1.0),
// then reports the smallest CIEDE2000 distance between any two of the six colors,
// plus each color's contrast ratio against the page background (WCAG, 3:1 is the
// minimum for non-text graphics).
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
const MACHADO = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}
const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2])
const clamp = (x) => Math.min(1, Math.max(0, x))
function sim(h, kind) {
  const lin = hex(h).map(toLin)
  return mul(MACHADO[kind], lin).map(clamp)
}
function lab(lin) {
  const [r, g, b] = lin
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
function de2000(l1, l2) {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2)
  const h1p = (Math.atan2(b1, a1p) / rad + 360) % 360, h2p = (Math.atan2(b2, a2p) / rad + 360) % 360
  const dLp = L2 - L1, dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; if (dhp < -180) dhp += 360 }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2)
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2
  let hbp = h1p + h2p
  if (C1p * C2p !== 0) { hbp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2 }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad)
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2)
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T
  const Rt = -Math.sin(2 * dTh * rad) * Rc
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))
}
const lumin = (h) => { const [r, g, b] = hex(h).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a, b) => { const [x, y] = [lumin(a), lumin(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

/** Prints one summary line and returns the single worst pair across all four vision types. */
export function check(name, palette, bg) {
  const out = { name }
  let worst = { d: 999 }
  for (const kind of Object.keys(MACHADO)) {
    const labs = palette.map((h) => lab(sim(h, kind)))
    let min = 999, pair = ''
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
      const d = de2000(labs[i], labs[j])
      if (d < min) { min = d; pair = `${i + 1}-${j + 1}` }
    }
    out[kind] = `${min.toFixed(1)} (pair ${pair})`
    if (min < worst.d) worst = { d: min, kind, pair }
  }
  out.minContrastVsBg = Math.min(...palette.map((h) => contrast(h, bg))).toFixed(2)
  console.log(JSON.stringify(out))
  return worst
}

// CLI: reads the six --map-N colors straight out of src/globals.css (light block,
// then the dark block) and fails if any pair is too close for a color-blind viewer
// or any color is too faint against its background.
//   node scripts/check_palette_colorblind.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const MIN_DISTANCE = 10 // CIEDE2000; under about 10 two colors read as the same
const MIN_CONTRAST = 3 // WCAG minimum for non-text graphics

function palettes() {
  const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'globals.css'), 'utf8')
  const grab = (block) => [1, 2, 3, 4, 5, 6].map((n) => block.match(new RegExp('--map-' + n + ':\\s*(#[0-9a-fA-F]{6})'))?.[1])
  const light = grab(css.slice(css.indexOf('--map-1:') - 40, css.indexOf('--map-1:') + 400))
  const darkStart = css.indexOf(':root[data-theme="dark"]')
  const dark = grab(css.slice(darkStart, darkStart + 700))
  return { light, dark }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { light, dark } = palettes()
  let failed = false
  for (const [name, colors, bg] of [['light', light, '#ffffff'], ['dark', dark, '#0d0d0d']]) {
    if (colors.some((c) => !c)) { console.error(`Could not read all six --map colors for ${name}`); process.exit(2) }
    const worst = check(name, colors, bg)
    const faintest = Math.min(...colors.map((c) => contrast(c, bg)))
    if (faintest < MIN_CONTRAST - 0.005) { failed = true; console.error(`FAIL ${name}: faintest color has contrast ${faintest.toFixed(2)} against ${bg} (needs ${MIN_CONTRAST})`) }
    if (worst.d < MIN_DISTANCE) { failed = true; console.error(`FAIL ${name}: ${worst.kind} distance ${worst.d.toFixed(1)} for colors ${worst.pair} (needs ${MIN_DISTANCE})`) }
  }
  process.exit(failed ? 1 : 0)
}
