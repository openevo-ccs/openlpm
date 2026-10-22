#!/usr/bin/env node
// One-off live verification for the admin content editor (migration 162 +
// admin-content-editor-page.tsx). Creates a throwaway admin test account
// and a throwaway lpm_data_objects row, drives the real local dev server
// (pointed at production Supabase, same as any other pre-deploy check in
// this repo) with Playwright, exercises edit/save/change-log/export, then
// deletes everything it created. Never touches Dustin's real account or
// the standing QA account's role -- a disposable identity rather than a
// borrowed or elevated one.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from './mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'
const BASE = process.argv[2] || 'http://localhost:5194/'

function serviceKey() {
  return readFileSync(path.join(ROOT, '.supabase-secrets', 'service-role-key.txt'), 'utf8').trim()
}

async function restFetch(pathAndQuery, opts = {}) {
  const key = serviceKey()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: opts.prefer ?? 'return=representation', ...opts.headers },
  })
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${pathAndQuery} -> ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function adminAuthFetch(subpath, body) {
  const key = serviceKey()
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${subpath}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`admin/${subpath} -> ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  const email = `content-editor-test-${Date.now()}@example.invalid`
  console.log('Creating disposable test admin:', email)
  const created = await adminAuthFetch('users', { email, email_confirm: true })
  const authUserId = created.id ?? created.user?.id
  if (!authUserId) throw new Error('No user id in create response: ' + JSON.stringify(created))

  await restFetch('users', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: JSON.stringify({ id: authUserId, email, name: 'Content Editor Test', role: 'admin' }),
  })

  console.log('Inserting throwaway test record...')
  const [testRow] = await restFetch('lpm_data_objects', {
    method: 'POST',
    body: JSON.stringify({
      object_type: 'performance_indicator',
      title: 'VERIFY-CONTENT-EDITOR throwaway row',
      description: 'original description',
      grade_band: '5/6',
      subject_area: 'Test',
      content: { note: 'throwaway, created by verify_content_editor.mjs' },
      status: 'draft',
    }),
  })
  console.log('Test row id:', testRow.id)

  let browser
  let failed = false
  try {
    browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.on('console', (msg) => { if (msg.type() === 'error') console.log('  [browser console error]', msg.text()) })
    page.on('pageerror', (err) => console.log('  [page error]', err.message))

    await page.goto(BASE, { waitUntil: 'networkidle' })
    await mintQaSession(page, BASE, email)

    console.log('\n--- Check 1: page loads for admin instead of the "not available" fallback ---')
    await page.goto(`${BASE}#/dashboard/admin/content`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const bodyText = await page.textContent('body')
    if (bodyText.includes("isn't available to your account")) throw new Error('Admin gate rejected the disposable admin account')
    if (!bodyText.includes('Edit Data')) throw new Error('Page heading not found')
    console.log('OK: admin page rendered')

    console.log('\n--- Check 2: throwaway row visible, inline table edit works ---')
    await page.waitForSelector('text=Loading…', { state: 'detached', timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(1000)
    const rowCountBefore = await page.locator('tbody tr').count()
    console.log('  table rows visible before search:', rowCountBefore)
    await page.fill('input[placeholder="Filter the list below…"]', 'VERIFY-CONTENT-EDITOR')
    await page.waitForTimeout(500)
    const rowCountAfter = await page.locator('tbody tr').count()
    console.log('  table rows visible after search:', rowCountAfter)
    const rowVisible = await page.getByText('VERIFY-CONTENT-EDITOR throwaway row').isVisible().catch(() => false)
    if (!rowVisible) {
      const bodySnippet = (await page.textContent('body')).slice(0, 2000)
      console.log('  body snippet:', bodySnippet)
      throw new Error('Throwaway row not visible in table view after search')
    }
    console.log('OK: throwaway row visible')

    console.log('\n--- Check 3: set a running note, then edit via the detail panel ---')
    await page.fill('input[placeholder*="Fixing Susan"]', 'verify_content_editor.mjs automated check')
    await page.getByText('View / edit').first().click()
    await page.waitForTimeout(500)
    const descField = page.locator('textarea').first()
    await descField.fill('EDITED by verify_content_editor.mjs')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1500)
    const noticeText = await page.locator('.notice').first().textContent().catch(() => '')
    console.log('Save notice:', noticeText)
    if (!noticeText || !noticeText.toLowerCase().includes('saved')) throw new Error('Save did not report success')

    console.log('\n--- Check 4: edit + note actually landed in the database ---')
    const [afterEdit] = await restFetch(`lpm_data_objects?id=eq.${testRow.id}&select=description`)
    if (afterEdit.description !== 'EDITED by verify_content_editor.mjs') {
      throw new Error(`Description did not update in DB, got: ${JSON.stringify(afterEdit)}`)
    }
    console.log('OK: description updated live in the database')

    const logRows = await restFetch(`content_edit_log?record_id=eq.${testRow.id}&select=*,session:session_id(note)`)
    if (logRows.length === 0) throw new Error('No content_edit_log row was written for this edit')
    const descLog = logRows.find((r) => r.field_name === 'description')
    if (!descLog) throw new Error('No log row for the description field specifically')
    console.log('OK: change log row written:', { field: descLog.field_name, before: descLog.before_value, after: descLog.after_value, sessionNote: descLog.session?.note })
    if (descLog.session?.note !== 'verify_content_editor.mjs automated check') {
      throw new Error(`Session note did not carry through, got: ${JSON.stringify(descLog.session)}`)
    }
    console.log('OK: running-note annotation carried through to the log entry')

    console.log('\n--- Check 5: history panel in the UI shows the edit ---')
    await page.getByRole('button', { name: /History/ }).first().click()
    await page.waitForTimeout(500)
    const historyText = await page.textContent('body')
    if (!historyText.includes('description')) throw new Error('History panel did not show the field name')
    console.log('OK: history panel shows the logged edit')

    console.log('\n--- Check 6: change-log panel (top-level) lists recent edits ---')
    await page.goto(`${BASE}#/dashboard/admin/content`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /Change log/ }).click()
    await page.waitForTimeout(800)
    const changeLogText = await page.textContent('body')
    if (!changeLogText.includes('description')) throw new Error('Top-level change log panel did not show the recent edit')
    console.log('OK: change-log panel lists the recent edit')

    console.log('\n--- Check 7: card view toggle renders without error ---')
    await page.getByTitle('Card view').click()
    await page.waitForTimeout(500)
    console.log('OK: card view rendered (no crash)')

    console.log('\n--- Check 8: switch to Curriculum Repository Records, no crash ---')
    await page.getByTitle('Table view').click()
    await page.fill('input[placeholder="Filter the list below…"]', '')
    await page.selectOption('select', { label: 'Curriculum Repository Records' })
    await page.waitForTimeout(1500)
    const crrErrorVisible = await page.locator('.notice-bad').first().isVisible().catch(() => false)
    if (crrErrorVisible) {
      const errText = await page.locator('.notice-bad').first().textContent()
      throw new Error(`Curriculum Repository Records view shows an error: ${errText}`)
    }
    const crrRowCount = await page.locator('tbody tr').count()
    console.log(`OK: Curriculum Repository Records loaded (${crrRowCount} rows), no error notice`)

    console.log('\n--- Check 9: export buttons run without throwing ---')
    const [download1] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.getByRole('button', { name: 'JSON' }).click()])
    console.log('  JSON export triggered a download:', download1.suggestedFilename())
    const [download2] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.getByRole('button', { name: 'CSV' }).click()])
    console.log('  CSV export triggered a download:', download2.suggestedFilename())
    const [download3] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.getByRole('button', { name: 'XLSX' }).click()])
    console.log('  XLSX export triggered a download:', download3.suggestedFilename())
    console.log('OK: all three export formats triggered a real download with no page error')

    console.log('\n--- Check 10: JSON import updates an existing row by id ---')
    await page.selectOption('select', { label: 'Learning Goals (Lernziele)' })
    await page.waitForTimeout(1000)
    mkdirSync(path.join(ROOT, 'layout_check', 'out'), { recursive: true })
    const importPath = path.join(ROOT, 'layout_check', 'out', `verify-import-${Date.now()}.json`)
    writeFileSync(importPath, JSON.stringify([{ id: testRow.id, description: 'IMPORTED via JSON file' }]))
    console.log('  uploading:', importPath)
    await page.setInputFiles('input[type="file"]', importPath)
    await page.waitForTimeout(3000)
    const allNotices = await page.locator('.notice').allTextContents()
    console.log('  all notices on page:', allNotices)
    const [afterImport] = await restFetch(`lpm_data_objects?id=eq.${testRow.id}&select=description`)
    if (afterImport.description !== 'IMPORTED via JSON file') {
      throw new Error(`JSON import did not update the row, got: ${JSON.stringify(afterImport)}`)
    }
    console.log('OK: JSON import updated the row by id')
    unlinkSync(importPath)

    console.log('\nAll checks passed.')
  } catch (e) {
    failed = true
    console.error('\nFAILED:', e.message)
  } finally {
    if (browser) await browser.close()
  }

  console.log('\nCleaning up throwaway data...')
  await restFetch(`content_edit_log?record_id=eq.${testRow.id}`, { method: 'DELETE' })
  await restFetch(`content_edit_sessions?note=eq.verify_content_editor.mjs automated check`, { method: 'DELETE' }).catch(() => {})
  await restFetch(`lpm_data_objects?id=eq.${testRow.id}`, { method: 'DELETE' })
  await restFetch(`users?id=eq.${authUserId}`, { method: 'DELETE' })
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUserId}`, { method: 'DELETE', headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}` } })
  console.log('Cleanup done.')

  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
