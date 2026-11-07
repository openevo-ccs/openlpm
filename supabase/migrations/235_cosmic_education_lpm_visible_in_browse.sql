-- 235: Cosmic Education LPM rows did not show in Browse (Dustin, 2026-11-07: "why don't I see any strands or much content").
--
-- Same bug as migration 093 fixed for the synthetic spaces. Browse (listTopics in src/lib/supabase/curriculum.ts) only shows rows that sit on the
-- project's main branch AND have status 'accepted'. Migration 233 inserted the rows with no branch and status 'draft', so they were stored but hidden.
--
-- Fix, limited to the two language spaces: put every strand, stage and indicator row, and every concept, on the space's main branch, and set the
-- rows' status to 'accepted' so Browse lists them. 'accepted' only makes a row visible here. It does not say a person reviewed it: each row's
-- content.review.state stays 'unreviewed', and the review state chip follows recorded reviews.
-- The parent space stays empty on purpose (it is only the container).
-- Running this twice changes nothing.
SET search_path = public, extensions;

DO $MIGRATION$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id AS project_id, b.id AS branch_id
    FROM projects p
    JOIN branches b ON b.project_id = p.id AND b.is_trunk
    WHERE p.slug IN ('cosmic-education-lpm-en', 'cosmic-education-lpm-de')
  LOOP
    UPDATE lpm_data_objects SET branch_id = r.branch_id, status = 'accepted'
      WHERE project_id = r.project_id AND (branch_id IS NULL OR status <> 'accepted');
    UPDATE lpm_schema_elements SET branch_id = r.branch_id
      WHERE project_id = r.project_id AND branch_id IS NULL;
  END LOOP;
END $MIGRATION$;
