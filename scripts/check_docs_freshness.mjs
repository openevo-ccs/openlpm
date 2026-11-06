#!/usr/bin/env node
// Checks whether docs/architecture/*.md still describes the real codebase.
// Pure local-file comparison -- no database connection, no credentials.
//
// What it does: recomputes a small set of facts straight from the source of
// truth (the migration SQL files, src/App.tsx) and compares them against a
// fingerprint recorded the last time a human actually re-read the docs
// against the code (docs/architecture/doc-fingerprint.json). It does NOT
// understand prose -- it can't tell you the docs are wrong, only that the
// shape of the schema/routes has moved since the docs were last checked.
//
// Usage:
//   node scripts/check_docs_freshness.mjs            report drift, exit 1 if any found
//   node scripts/check_docs_freshness.mjs --update    after reviewing the docs by hand,
//                                                      record the current state as the new baseline

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase/migrations')
const APP_TSX = path.join(ROOT, 'src/App.tsx')
const TYPES_FILE = path.join(ROOT, 'src/lib/supabase/database.types.ts')
const FINGERPRINT_FILE = path.join(ROOT, 'docs/architecture/doc-fingerprint.json')

function currentState() {
  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()
  const allSql = migrationFiles
    .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n')

  const tables = [...new Set([...allSql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]))].sort()
  const permissionFunctions = [
    ...new Set(
      [...allSql.matchAll(/CREATE OR REPLACE FUNCTION (is_\w+|has_\w+|can_\w+)/g)].map((m) => m[1])
    ),
  ].sort()

  const appSrc = readFileSync(APP_TSX, 'utf8')
  const routeCount = [...appSrc.matchAll(/<Route\b/g)].length

  const typesSrc = readFileSync(TYPES_FILE, 'utf8')
  const tablesMissingFromTypes = tables.filter((t) => !new RegExp(`\\b${t}:\\s*\\{`).test(typesSrc))

  return {
    highestMigration: migrationFiles[migrationFiles.length - 1],
    migrationCount: migrationFiles.length,
    tables,
    permissionFunctions,
    routeCount,
    tablesMissingFromTypes,
  }
}

function loadFingerprint() {
  try {
    return JSON.parse(readFileSync(FINGERPRINT_FILE, 'utf8'))
  } catch {
    return null
  }
}

function diffList(label, before, after) {
  const added = after.filter((x) => !before.includes(x))
  const removed = before.filter((x) => !after.includes(x))
  const lines = []
  if (added.length) lines.push(`  + ${label} added since docs were last checked: ${added.join(', ')}`)
  if (removed.length) lines.push(`  - ${label} the docs mention but no longer exist: ${removed.join(', ')}`)
  return lines
}

const state = currentState()

if (process.argv.includes('--update')) {
  const fingerprint = {
    lastVerified: new Date().toISOString().slice(0, 10),
    highestMigration: state.highestMigration,
    migrationCount: state.migrationCount,
    tables: state.tables,
    permissionFunctions: state.permissionFunctions,
    routeCount: state.routeCount,
  }
  writeFileSync(FINGERPRINT_FILE, JSON.stringify(fingerprint, null, 2) + '\n')
  console.log(
    `Fingerprint updated: ${state.migrationCount} migrations through ${state.highestMigration}, ` +
      `${state.tables.length} tables, ${state.permissionFunctions.length} permission functions, ` +
      `${state.routeCount} routes.`
  )
  process.exit(0)
}

const fingerprint = loadFingerprint()
if (!fingerprint) {
  console.error(
    `No fingerprint found at ${path.relative(ROOT, FINGERPRINT_FILE)}.\n` +
      'Run with --update once the docs have been written/reviewed to record a baseline.'
  )
  process.exit(1)
}

const report = []

if (state.migrationCount !== fingerprint.migrationCount) {
  report.push(
    `  ~ migration count: docs say ${fingerprint.migrationCount} (through ${fingerprint.highestMigration}), ` +
      `repo now has ${state.migrationCount} (through ${state.highestMigration})`
  )
}
report.push(...diffList('tables', fingerprint.tables, state.tables))
report.push(...diffList('permission functions', fingerprint.permissionFunctions, state.permissionFunctions))
if (state.routeCount !== fingerprint.routeCount) {
  report.push(`  ~ route count: docs say ${fingerprint.routeCount}, src/App.tsx now has ${state.routeCount}`)
}
if (state.tablesMissingFromTypes.length) {
  report.push(
    `  ! database.types.ts is missing ${state.tablesMissingFromTypes.length} table(s) that migrations define: ` +
      state.tablesMissingFromTypes.join(', ')
  )
}

if (report.length === 0) {
  console.log(`docs/architecture/ still matches the code (last checked ${fingerprint.lastVerified}).`)
  process.exit(0)
}

console.log(`docs/architecture/ may be out of date (last checked ${fingerprint.lastVerified}):\n`)
console.log(report.join('\n'))
console.log(
  '\nIf these are real, update docs/architecture/*.md by hand, then run with --update to record the new baseline.'
)
process.exit(1)
