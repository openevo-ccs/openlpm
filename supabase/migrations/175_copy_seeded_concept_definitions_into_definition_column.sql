-- Concepts seeded from ConceptBase by earlier migrations (092 for Bio-Core and
-- Interdisciplinary and their capstones, plus a few others) carry their
-- definition inside metadata ('definition') but left the definition column
-- empty. The in-app "Import from ConceptBase" tool fills the column, so the
-- same concept looked defined or undefined depending on how it arrived. Pages
-- that read the column (search, review panels, exports, Me-Mo) showed no
-- definition for these.
--
-- Found from Dustin's feedback 001dca81 (2026-10-25, Interdisciplinary LPM
-- concepts page: "No definition yet"). On the live data this fills 67 concepts:
-- 29 in interdisciplinary-lpm-synth, 17 in bio-core-lpm-synth, 13 in eva-lpm
-- and 2 each in four capstone and lineage spaces.
--
-- Only touches a concept whose definition column is empty and whose metadata
-- holds non-empty text. Never overwrites an existing definition. Safe to run
-- again: a second run finds nothing left to fill.
UPDATE lpm_schema_elements
SET definition = btrim(metadata ->> 'definition')
WHERE element_type = 'concept'
  AND (definition IS NULL OR btrim(definition) = '')
  AND coalesce(btrim(metadata ->> 'definition'), '') <> '';
