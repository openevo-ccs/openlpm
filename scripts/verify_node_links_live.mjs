#!/usr/bin/env node
// Browser check of the stage-to-topic links on the live Structure page. Run it AFTER migration 225 is pushed and the pull request is live.
//
//   node scripts/verify_node_links_live.mjs [--base https://openevo-ccs.github.io/openlpm/] [--out <dir>] [--email <member email>] [--expect 103]
//
// It signs in as the standing QA account (scripts/mint_qa_session.mjs, no password), opens the Structure page of the Thueringen repository,
// opens every "stage links" chip and checks, at desktop and at phone width:
//   * the chips exist, and the sections list --expect links in all (default 103: the QA account is a platform admin, so it sees every space);
//   * the four spaces appear with 51, 44, 7 and 1 links when --expect is 103;
//   * every link carries the draft tag, in German by default and in English after the switch, and the old wording "AI draft. No expert has
//     checked it yet." appears nowhere;
//   * no sideways scrolling and no script errors;
// and it saves screenshots. Exit code 1 when a check fails.
//
// The QA account is an admin, so this cannot show the "count only" view of someone who belongs to none of the spaces. To see that, sign in
// as a repository viewer with --email and expect the page to show chips that open to a line such as "Dazu 3 Stufen-Verknüpfungen aus Räumen,
// in denen Sie nicht Mitglied sind (nur die Anzahl)." and no space name (use --expect 0 for such an account).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { mintQaSession } from './mint_qa_session.mjs'

const TAG = { de: 'LLM-erzeugter Entwurf, Prüfung ausstehend', en: 'LLM synthesized draft, awaiting review' }
const OLD_WORDING = 'AI draft. No expert has checked it yet.'
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
}

function parseArgs(argv) {
  const args = { base: 'https://openevo-ccs.github.io/openlpm/', out: path.join(process.cwd(), 'layout_check', 'out', 'node-links'), email: undefined, expect: 103 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') args.base = argv[++i]
    else if (argv[i] === '--out') args.out = argv[++i]
    else if (argv[i] === '--email') args.email = argv[++i]
    else if (argv[i] === '--expect') args.expect = Number(argv[++i])
  }
  if (!args.base.endsWith('/')) args.base += '/'
  return args
}

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`)
  if (!ok) failures.push(name)
}

async function collectLinks(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[id^="links-"] li')).map((li) => ({
      space: li.querySelector('strong')?.textContent?.trim() ?? '',
      tag: li.querySelector('.chip-draft')?.textContent?.trim() ?? '',
      concepts: li.querySelectorAll('[aria-label] .chip').length,
    })),
  )
}

async function run(browser, args, deviceName) {
  const device = DEVICES[deviceName]
  const context = await browser.newContext(device)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  console.log(`\n== ${deviceName}`)
  await page.goto(args.base, { waitUntil: 'networkidle' })
  await mintQaSession(page, args.base, args.email)
  await page.goto(`${args.base}#/dashboard/thuringia-curriculum-repository/curriculum-structure`, { waitUntil: 'networkidle' })
  await page.waitForSelector('h1', { timeout: 20000 })
  await page.waitForTimeout(1500)

  // open the whole tree, then every stage-link chip
  const expandAll = page.getByRole('button', { name: /Alles aufklappen|Expand all/ })
  if (await expandAll.count()) await expandAll.first().click()
  await page.waitForTimeout(500)
  const chips = await page.locator('button.chip-button').count()
  check(`${deviceName}: stage-link chips are on the page`, chips > 0, `${chips} chips`)
  await page.evaluate(() => document.querySelectorAll('button.chip-button[aria-expanded="false"]').forEach((b) => b.click()))
  await page.waitForTimeout(500)

  const links = await collectLinks(page)
  check(`${deviceName}: links listed in the sections`, links.length === args.expect, `${links.length} (expected ${args.expect})`)
  const perSpace = {}
  for (const l of links) perSpace[l.space] = (perSpace[l.space] ?? 0) + 1
  console.log('     per space:', JSON.stringify(perSpace))
  if (args.expect === 103) {
    check(`${deviceName}: four spaces with 51, 44, 7 and 1 links`, JSON.stringify(Object.values(perSpace).sort((a, b) => b - a)) === '[51,44,7,1]')
  }
  check(`${deviceName}: every link carries the German draft tag`, links.length > 0 && links.every((l) => l.tag === TAG.de), `${links.filter((l) => l.tag !== TAG.de).length} without`)
  check(`${deviceName}: every link names at least one shared concept`, links.length > 0 && links.every((l) => l.concepts > 0))

  await page.screenshot({ path: path.join(args.out, `${deviceName}-de.png`), fullPage: false })
  const firstSection = page.locator('[id^="links-"]').first()
  if (await firstSection.count()) await firstSection.screenshot({ path: path.join(args.out, `${deviceName}-first-section.png`) })

  // English
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.waitForTimeout(500)
  const linksEn = await collectLinks(page)
  check(`${deviceName}: every link carries the English draft tag`, linksEn.length > 0 && linksEn.every((l) => l.tag === TAG.en), `${linksEn.filter((l) => l.tag !== TAG.en).length} without`)
  await page.screenshot({ path: path.join(args.out, `${deviceName}-en.png`), fullPage: false })

  const body = await page.evaluate(() => document.body.innerText)
  check(`${deviceName}: the old wording does not appear`, !body.includes(OLD_WORDING))
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }))
  check(`${deviceName}: no sideways scrolling`, width.scroll <= width.inner + 2, `${width.scroll} vs ${width.inner}`)
  check(`${deviceName}: no script errors`, errors.length === 0, errors.slice(0, 2).join(' | '))
  await context.close()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  mkdirSync(args.out, { recursive: true })
  const browser = await chromium.launch()
  try {
    for (const name of Object.keys(DEVICES)) await run(browser, args, name)
  } finally {
    await browser.close()
  }
  console.log(failures.length === 0 ? '\nALL CHECKS PASSED' : `\n${failures.length} CHECK(S) FAILED: ${failures.join('; ')}`)
  console.log('Screenshots:', args.out)
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
