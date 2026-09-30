SET search_path = public, extensions;

-- The real, field-tested didactic content behind each Basiskonzept
-- (definition, common misconceptions paired with the correct idea,
-- everyday-life anchors, core KMK principles) lives only in EvoMentor DE's
-- own source file (data/basiskonzepte.json) -- it was never imported into
-- OpenLPM's lpm_schema_elements, which only ever carried label/hierarchy.
-- The student-facing Basiskonzept detail page needs this to be genuinely
-- useful, not just a nicer-looking empty page. Generic columns (any
-- project's schema elements can use them, not just Thuringia's), populated
-- for real by a companion data migration using the verbatim source text.

ALTER TABLE lpm_schema_elements ADD COLUMN IF NOT EXISTS didactic_definition TEXT;
ALTER TABLE lpm_schema_elements ADD COLUMN IF NOT EXISTS common_misconceptions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE lpm_schema_elements ADD COLUMN IF NOT EXISTS everyday_anchors TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE lpm_schema_elements ADD COLUMN IF NOT EXISTS core_principles TEXT[] NOT NULL DEFAULT '{}';
