-- 224: Every structure node carries its own rights provenance (Dustin, 2026-11-02: "the licence of a source covers the source, imported data carries its
-- own rights provenance; there must be a way to track this").
--
-- Four columns on curriculum_repository_structure_nodes:
--   content_license          the licence the SOURCE of this node declares for it, if any (for example CC BY-SA 4.0 for the FWU Lehrplan ontology)
--   rights_holder            who holds the rights in the underlying text (for example the state ministry, or the ontology's creators)
--   license_or_rights_note   what we know and what we do not, in plain words; the same idea as the column of the same name on the records
--   rights_status            open vocabulary: not-assessed (default), cleared, restricted
-- The rule for every import from now on: the importer must set content_license, rights_holder and a note from the source's own statement, and must
-- say in the note whether that statement covers the node's content or only the container (the data model). Anything else stays not-assessed.
-- Existing nodes: all not-assessed, with one honest note. Guarded and safe to run twice.
SET search_path = public, extensions;

ALTER TABLE curriculum_repository_structure_nodes
  ADD COLUMN IF NOT EXISTS content_license TEXT,
  ADD COLUMN IF NOT EXISTS rights_holder TEXT,
  ADD COLUMN IF NOT EXISTS license_or_rights_note TEXT,
  ADD COLUMN IF NOT EXISTS rights_status TEXT NOT NULL DEFAULT 'not-assessed';

COMMENT ON COLUMN curriculum_repository_structure_nodes.rights_status IS
  'not-assessed, cleared or restricted (open vocabulary). A person qualified for the state sets cleared or restricted; imports leave not-assessed.';

UPDATE curriculum_repository_structure_nodes
SET license_or_rights_note = 'Summary in our own words. Titles are short labels taken from the official curriculum document. No person has assessed whether the titles may be reused outside the lab, so the space stays invite-only.',
    rights_holder = COALESCE(rights_holder, 'The state ministry that issued the curriculum document'),
    updated_at = now()
WHERE license_or_rights_note IS NULL;
