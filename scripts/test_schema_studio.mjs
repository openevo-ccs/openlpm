// Checks the Schema Studio snapshot builder against a small made-up schema folder (no private repos needed).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseSchemaFile, REPO_DEFS, TOKEN_OWNER } from './lib/schema-studio-build.mjs'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-test-'))
const file = path.join(dir, 'thing.schema.json')
fs.writeFileSync(file, JSON.stringify({
  title: 'Thing record',
  description: 'A test record.',
  type: 'object',
  required: ['id', 'status'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', pattern: '^OE-THING-[a-z0-9-]+$', description: 'Permanent name.' },
    status: { type: 'string', enum: ['proposed', 'accepted'] },
    relatedLiterature: { type: 'array', items: { type: 'string', pattern: '^OE-LITERATURE-[a-z0-9-]+$' } },
    nested: { type: 'object', properties: { note: { type: 'string' } } },
  },
}))

test('parses fields, required flags, enums and the id pattern', () => {
  const t = parseSchemaFile(file, dir)
  assert.equal(t.kind, 'type')
  assert.equal(t.title, 'Thing')
  assert.equal(t.fields.length, 4)
  assert.deepEqual(t.required.sort(), ['id', 'status'])
  assert.equal(t.closed, true)
  assert.equal(t.idToken, 'THING')
  const status = t.fields.find((f) => f.name === 'status')
  assert.deepEqual(status.enum, ['proposed', 'accepted'])
})

test('a schema with only definitions is reported as definitions', () => {
  const f = path.join(dir, 'common.defs.json')
  fs.writeFileSync(f, JSON.stringify({ $defs: { slug: { type: 'string', pattern: '^[a-z]+$' } } }))
  const t = parseSchemaFile(f, dir)
  assert.equal(t.kind, 'defs')
  assert.equal(t.defs[0].name, 'slug')
})

test('repository list excludes retired HumanBase and names the owners of the main id tokens', () => {
  assert.ok(!REPO_DEFS.some((r) => /human/i.test(r.key)))
  assert.equal(TOKEN_OWNER.LITERATURE, 'literature')
  assert.equal(TOKEN_OWNER.COMPETINGPROPOSITION, 'theory')
})
