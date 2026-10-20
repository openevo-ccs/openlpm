-- Phase 0 repair (Dustin, 2026-10-20), item 5: same source/status
-- provenance fields as evidence_links (migration 136), added to
-- lpm_concept_relations for the same future-proofing reason -- so an
-- AI-suggested concept relation can eventually be told apart from one a
-- project member asserted directly.
--
-- Migration 087's own comment deliberately chose no review-gate workflow
-- for this table: "a project member who can already edit this project's
-- own curriculum content can assert a relation directly, same trust level
-- as everything else a member can already do on this schema." This does
-- NOT reopen that decision -- status defaults to 'confirmed' for every
-- existing and future manually-created row, so a relation is still visible
-- and trusted immediately on creation, exactly as today. These columns
-- only add vocabulary to record provenance if an AI-assisted suggestion
-- feature is ever built for this table; they don't gate anything on it.

SET search_path = public, extensions;

ALTER TABLE lpm_concept_relations ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'llm_suggested'));
ALTER TABLE lpm_concept_relations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed'
  CHECK (status IN ('confirmed', 'suggested', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_lpm_concept_relations_status ON lpm_concept_relations(status);

COMMENT ON COLUMN lpm_concept_relations.source IS
  'manual: a project member asserted this relation directly (today''s only path). llm_suggested: proposed by an AI-assisted workflow that has not been reviewed yet.';
COMMENT ON COLUMN lpm_concept_relations.status IS
  'confirmed: trusted and visible, same as every relation today. suggested: an llm_suggested relation nobody has reviewed yet. rejected: reviewed and declined. Does not gate visibility anywhere in the app -- see migration 087''s own no-review-workflow decision, preserved here.';

-- Data API grants extend automatically via migration 006's ALTER DEFAULT
-- PRIVILEGES.
