-- Adds a per-source "how much of this are we actually allowed to keep"
-- tier to the two places OpenLPM already tracks an external policy/
-- curriculum document's rights status: standards_documents (migration 019)
-- and the "Sources & rights" wizard step's project_source_declarations
-- (same migration). This is the real design gap named in
-- lab_manager/docs/design-notes/2026-09-30-regional-curriculum-source-
-- storage-tiers.md: standards_documents already has license_or_rights_note,
-- a free-text explanation, but nothing machine-readable saying whether the
-- actual source content behind a row is the full document, a bounded
-- excerpt, a paraphrase-only summary, or a citation with no stored text at
-- all. A single all-or-nothing rule doesn't fit -- what's safe to keep
-- varies by country and by document, not just by project.
--
-- Same four-value vocabulary as the accessTier field added the same day to
-- deutsche_lp/nys_lp's own JSON-Schema record types, so a source's tier
-- means the same thing whether it's tracked as a YAML record in a regional
-- repo or a row here.
--
-- Also closes a second gap named in the same design note: standards_
-- documents had only one adopted_at DATE, no way to record how long a
-- specific document version actually stayed in force. effective_from/
-- effective_until are additive and optional -- existing rows and the
-- supersedes_document_id chain are untouched.
--
-- Both new columns are nullable additions to existing tables -- no data
-- migration, no RLS change needed (existing policies already cover all
-- columns on these tables), no interaction with project_base_links or the
-- Thuringia/EvoMentor import rows (migrations 028/034/036) at all.
SET search_path = public, extensions;

ALTER TABLE standards_documents
  ADD COLUMN IF NOT EXISTS access_tier TEXT
    CHECK (access_tier IN ('full-text-stored', 'excerpt-only', 'summary-only', 'citation-only')),
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS effective_until DATE;

COMMENT ON COLUMN standards_documents.access_tier IS
  'How much of this document OpenLPM actually stores (source_file / the '
  'text embedded in ingested lpm_data_objects rows), chosen per-source '
  'based on what''s legally safe to redistribute for this jurisdiction -- '
  'not one all-or-nothing rule applied to every project. Nullable: '
  'existing rows predate this field (added 2026-09-30) and should be '
  'treated as unknown, not assumed full-text-stored, until reviewed.';

COMMENT ON COLUMN standards_documents.effective_from IS
  'When this document version actually took effect, if known and '
  'different from adopted_at (adoption and effective dates can genuinely '
  'differ -- e.g. a trial/Erprobungsfassung version takes effect before '
  'its formal adoption). Nullable.';

COMMENT ON COLUMN standards_documents.effective_until IS
  'When this document version stopped being in force, if known -- e.g. '
  'the date a superseding version (linked via the newer row''s '
  'supersedes_document_id) took over. Nullable; leave null for a document '
  'version still in force.';

ALTER TABLE project_source_declarations
  ADD COLUMN IF NOT EXISTS access_tier TEXT
    CHECK (access_tier IN ('full-text-stored', 'excerpt-only', 'summary-only', 'citation-only'));

COMMENT ON COLUMN project_source_declarations.access_tier IS
  'Same vocabulary and purpose as standards_documents.access_tier, set at '
  'project-creation time in the "Sources & rights" wizard step -- before '
  'any actual document content has necessarily been ingested yet, so this '
  'is the source owner''s stated intent, not yet a fact about what was '
  'actually stored (standards_documents.access_tier is the latter, once a '
  'real ingest happens).';

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
