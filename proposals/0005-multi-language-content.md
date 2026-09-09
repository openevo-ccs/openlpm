# RFC 0005 — Project working languages and content translations

**Status:** Accepted — Dustin Eirdosh, 2026-09-06, live session.
**Date:** 2026-09-06

## Motivation

Every project so far (`EvoMentor`, `sachsen-biologie`, a future `thuringia-biologie`) is implicitly monolingual in its content even where its audience isn't — Thuringia's own Lehrplan has explicit "Bilinguale Module" (English-medium instruction blocks within a German curriculum), and EvoMentor already spans a US-VA (English) jurisdiction alongside German ones. A project needs to declare what languages it actually works in, and any given content record needs a way to carry more than one language without pretending a translation is a second independent source of truth.

Explicitly out of scope for this RFC, per 2026-09-06 discussion: **app UI chrome language** (English/German for OpenLPM's own interface) is deliberately deferred until the UI is closer to stable — noted here so it isn't lost, not designed now.

## Decisions

### 1. `projects.working_languages` — declarative, not enforced

`projects` gains `working_languages TEXT[] NOT NULL DEFAULT '{de}'` (BCP-47-ish tags, mirroring the pattern already established in `EvoMentor`'s `canonical-curriculum-item.schema.json`'s own `language` field). For this first pass it's informational/UI-hint only — surfaced in the project header, usable to default a view's language — and does **not** yet validate that content actually exists in every declared language, or block a record from being entered in a language outside the declared set. Enforcement is a real future option once there's actual multi-language content to learn from.

### 2. One translation mechanism, not two

Considered and rejected: separate mechanisms for "source-fidelity" content (a Lernziel's verbatim wording, where the source language is authoritative and a translation is just a rendering — the pattern `deutsche_lp`'s own `statementText`/`statementTextEn` mandate records already use) versus "authored" content (a framework tag's own definition, written fresh in each language). Collapsed into one mechanism for both, per 2026-09-06 decision: simpler to implement and explain system-wide outweighs letting a non-source-language version be independently authored/reviewed on its own timeline. If that independence is ever needed for a specific content type, it's a targeted follow-up, not a system-wide default.

### 3. `content_translations` — one polymorphic table, reusing an existing pattern

New table, deliberately generic rather than a bespoke `_translations` sibling per content table:

```
content_translations (
  id UUID PRIMARY KEY,
  record_type TEXT NOT NULL,   -- e.g. 'standards_item', 'framework_tag', 'lpm_schema_element', 'portfolio_item'
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,    -- which column on that record this translates, e.g. 'full_statement', 'definition'
  language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  is_machine_translated BOOLEAN NOT NULL DEFAULT FALSE,
  translated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (record_type, record_id, field_name, language)
)
```

`record_type`/`record_id` mirrors the polymorphic-reference shape `portfolio_items.target_type`/`target_id` already established in migration 004 — this isn't a new idiom for this codebase. Deliberately a plain `record_type TEXT`, not a CHECK-constrained enum: several of the content tables this needs to cover (`standards_items`, `framework_tags`) don't exist yet (pending RFC 0003), and new ones will keep appearing — an enum would need editing every time, a documented convention doesn't. The source record's own field (e.g. `standards_items.full_statement`) stays the single authoritative value in its own `language`; every row here is explicitly a translation of it, never a second source of truth, and `is_machine_translated` keeps a raw MT pass visibly distinct from a human-reviewed one rather than silently indistinguishable.

## New data model (summary; migration TBD pending review, and pending RFC 0003 for two of the record types it's meant to cover)

`projects` gains `working_languages`. New table: `content_translations`.

## Explicitly not yet decided

- App UI chrome language (English/German) — noted per the motivation above, deferred until the UI is closer to stable.
- Whether/when `working_languages` moves from declarative to enforced.
- Whether any specific content type later needs the rejected "independently-authored peer version" model after all, once real multi-language content exists to learn from.

## Implementation plan

1. Review of this proposal (alongside RFC 0003, which two of `content_translations`' intended `record_type` values depend on).
2. Migration: `projects.working_languages`, `content_translations` table + RLS (readable by project members of whatever project `record_id` resolves into; a full FK isn't possible given the polymorphic shape, so this needs an app-level or trigger-based check rather than a plain foreign key — flagged for the actual migration, not resolved here).
3. UI: a language-switcher on any record that has `content_translations` rows, defaulting to the project's first `working_languages` entry.
