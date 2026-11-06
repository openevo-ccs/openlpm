-- Phase 0 repair (Dustin, 2026-10-20), item 2: evidence_links has no way to
-- tell an AI-written citation from a human-curated one, or to record
-- whether anyone has checked it. Reuses the source/status shape migration
-- 123 (method_lernziel_links) just established for the same "something an
-- LLM proposed vs. something a person entered, pending review either way"
-- distinction, rather than inventing a one-off created_by_ai boolean.
--
-- Defaults preserve exactly today's behavior for every existing and future
-- row added through the one real insert path that exists right now
-- (addToProject() in src/pages/dashboard/literature-page.tsx, 100%
-- human-driven): source defaults to 'manual', status defaults to
-- 'confirmed', so nothing already visible anywhere changes and no backfill
-- is needed. Nothing writes 'llm_suggested' yet. This is additive schema
-- prep for whenever an AI-assisted evidence-linking feature gets built. No
-- workflow is being turned on today.

SET search_path = public, extensions;

ALTER TABLE evidence_links ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'llm_suggested'));
ALTER TABLE evidence_links ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed'
  CHECK (status IN ('confirmed', 'suggested', 'rejected'));
ALTER TABLE evidence_links ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE evidence_links ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_evidence_links_status ON evidence_links(status);

COMMENT ON COLUMN evidence_links.source IS
  'manual: a project member entered this citation directly (today''s only real path). llm_suggested: proposed by an AI-assisted workflow that has not been reviewed yet.';
COMMENT ON COLUMN evidence_links.status IS
  'confirmed: trusted, same as every evidence link today. suggested: an llm_suggested link nobody has reviewed yet. rejected: reviewed and declined. No UI/RLS gate reads this yet -- see migration 136''s header.';

-- Note: evidence_links has no UPDATE policy at all today (confirmed by
-- reading 001/004/012 -- only SELECT/INSERT/DELETE exist), so status can't
-- actually be changed by a project member through the app yet. Adding that
-- policy is a real product decision (which role(s) get to confirm/reject a
-- suggested link -- 'reviewer' is the obvious candidate, unlike for the
-- content-authoring policies migration 135 just locked down). That decision
-- belongs with whenever an actual review UI gets built on top of these
-- columns. It is out of scope for this additive, no-behavior-change
-- migration.

-- Data API grants extend automatically via migration 006's ALTER DEFAULT
-- PRIVILEGES.
