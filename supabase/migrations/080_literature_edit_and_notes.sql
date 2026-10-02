SET search_path = public, extensions;

-- Real feedback c327878b (Dustin Eirdosh, 2026-10-02): "Project space
-- owners and other selected roles must be able to easily and intuitively
-- edit and annotate the literature collection." Today nothing can be
-- edited once added -- this table never had an UPDATE policy at all.
--
-- `notes` is the project's own commentary on why a reference matters,
-- distinct from `abstract` (the paper's own abstract, pulled from
-- whichever search engine it was added from).
ALTER TABLE literature_references ADD COLUMN IF NOT EXISTS notes TEXT;

-- Same non-viewer-can-manage convention as coherence-page.tsx and
-- method_basiskonzept_links (migration 079) -- every role except 'viewer'.
CREATE POLICY "Non-viewer project members can update literature references" ON literature_references
  FOR UPDATE
  USING (has_project_role(project_id, ARRAY['owner','maintainer','editor','reviewer','contributor']::project_member_role[]))
  WITH CHECK (has_project_role(project_id, ARRAY['owner','maintainer','editor','reviewer','contributor']::project_member_role[]));
