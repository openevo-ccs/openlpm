#!/usr/bin/env node
// The OpenLPM equivalent of Ask Eva's/Me-Mo's layout_check/capture.js --
// screenshots real pages at real device widths and flags the same real,
// proven problem classes: sideways overflow, tap targets under 44px, text
// under 11px, and page errors. One script, not that suite's whole 25 --
// OpenLPM doesn't have Ask Eva's years of accumulated feature-specific
// checks yet; this is the first one, sized to what's actually here today,
// built to grow the same way theirs did (one new script per real feature
// once there's a real feature-specific thing to check).
//
// Usage:
//   node layout_check/capture.mjs [--base <url>] [--devices phone,tablet,desktop] [--out <dir>]
//
// Needs a real signed-in session to reach anything past the login page --
// pass credentials via env (never hardcode a real password into a
// committed script): OPENLPM_TEST_EMAIL / OPENLPM_TEST_PASSWORD.

import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const DEVICES = {
  phone: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true, label: 'Phone (390x844)' },
  'phone-landscape': { width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true, label: 'Phone landscape (844x390)' },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true, label: 'Tablet portrait (768x1024)' },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false, label: 'Desktop (1440x900)' },
}

// Every page a signed-in member can reach without needing to be an owner
// of anything specific -- the project-scoped ones use evomentor-thuringia
// since it's the one real project with real content to render.
const PAGES = [
  { path: '#/dashboard', name: 'project-switcher' },
  { path: '#/dashboard/profile', name: 'profile' },
  { path: '#/dashboard/evomentor-thuringia', name: 'student-lernziele' },
  { path: '#/dashboard/evomentor-thuringia/basiskonzepte', name: 'student-basiskonzepte-dashboard' },
  { path: '#/dashboard/evomentor-thuringia/basiskonzepte/netz', name: 'student-basiskonzepte-netz' },
  { path: '#/dashboard/evomentor-thuringia/basiskonzepte/detail', name: 'student-basiskonzepte-detail' },
  { path: '#/dashboard/evomentor-thuringia/planen', name: 'student-planen' },
]

function parseArgs(argv) {
  const args = { base: 'https://openevo-ccs.github.io/openlpm/', devices: Object.keys(DEVICES), out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--base') args.base = argv[++i]
    if (a === '--devices') args.devices = argv[++i].split(',')
    if (a === '--out') args.out = argv[++i]
  }
  return args
}

async function auditPage(page) {
  return page.evaluate(() => {
    const issues = []
    const innerWidth = window.innerWidth
    const scrollWidth = document.documentElement.scrollWidth
    if (scrollWidth > innerWidth + 2) {
      issues.push({ type: 'sideways-overflow', detail: `scrollWidth ${scrollWidth} > innerWidth ${innerWidth}` })
    }
    const clickable = Array.from(document.querySelectorAll('button, a, input, select, [role="button"]'))
    for (const el of clickable) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue // hidden, not a real tap target
      if ((r.width > 0 && r.width < 44) || (r.height > 0 && r.height < 44)) {
        issues.push({
          type: 'small-tap-target',
          detail: `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} is ${Math.round(r.width)}x${Math.round(r.height)}px`,
        })
      }
    }
    const textEls = Array.from(document.querySelectorAll('body *')).filter((el) => el.children.length === 0 && el.textContent.trim())
    const smallText = new Set()
    for (const el of textEls) {
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size > 0 && size < 11) smallText.add(Math.round(size))
    }
    if (smallText.size) issues.push({ type: 'small-text', detail: `font sizes found: ${Array.from(smallText).join(', ')}px` })
    return { innerWidth, scrollWidth, issueCount: issues.length, issues: issues.slice(0, 20) }
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const email = process.env.OPENLPM_TEST_EMAIL
  const password = process.env.OPENLPM_TEST_PASSWORD
  if (!email || !password) {
    console.error('Set OPENLPM_TEST_EMAIL and OPENLPM_TEST_PASSWORD (a real, already-confirmed account) before running this.')
    process.exit(1)
  }
  const outDir = args.out || path.join(process.cwd(), 'layout_check', 'out', new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch()
  const report = { base: args.base, at: new Date().toISOString(), devices: {} }
  let totalIssues = 0

  for (const deviceKey of args.devices) {
    const device = DEVICES[deviceKey]
    if (!device) { console.error(`Unknown device "${deviceKey}" -- one of ${Object.keys(DEVICES).join(', ')}`); continue }
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
    })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(e.message))

    await page.goto(args.base + '#/auth/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1200)

    report.devices[deviceKey] = { label: device.label, pages: {} }
    for (const p of PAGES) {
      pageErrors.length = 0
      await page.goto(args.base + p.path, { waitUntil: 'networkidle' }).catch(() => {})
      await page.waitForTimeout(900)
      const shotPath = path.join(outDir, `${deviceKey}--${p.name}.png`)
      await page.screenshot({ path: shotPath })
      const audit = await auditPage(page)
      if (pageErrors.length) audit.issues.push(...pageErrors.map((m) => ({ type: 'page-error', detail: m })))
      audit.issueCount = audit.issues.length
      totalIssues += audit.issueCount
      report.devices[deviceKey].pages[p.name] = { screenshot: path.basename(shotPath), ...audit }
      const flag = audit.issueCount ? `${audit.issueCount} issue(s)` : 'clean'
      console.log(`${deviceKey.padEnd(16)} ${p.name.padEnd(34)} ${flag}`)
    }
    await context.close()
  }
  await browser.close()

  writeFileSync(path.join(outDir, 'audit.json'), JSON.stringify(report, null, 2))
  console.log(`\n${totalIssues} total issue(s) across ${args.devices.length} device(s) x ${PAGES.length} page(s).`)
  console.log(`Screenshots + audit.json: ${outDir}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
