SET search_path = public, extensions;

-- Supports the Uni Jena Biologiedidaktik pilot (starting ~6 weeks out,
-- 2026-09-17 ask): a student picks curriculum-evolution connections into a
-- Notebook (portfolios, already built), generates a structured teaching
-- prompt from them, tests it on an LLM of their own choosing outside this
-- app, then comes back and records what they tried and found. This table is
-- the record of that generate -> test -> evaluate cycle -- not the prompt
-- generator's own working state (that lives in the wizard's local state
-- until saved), and not a chat/LLM-calling integration (deliberately out of
-- scope, per Dustin: students pick and run the LLM themselves).

CREATE TABLE IF NOT EXISTS prompt_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Nullable: today's wizard always builds from a Notebook's items, but a
  -- future direct-from-Browse scope shouldn't need a schema change.
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Same 3-value enum as portfolios.visibility for schema consistency, even
  -- though only 'private'/'project' have real UI for now -- 'shared' is
  -- reserved so a future explicit-grant feature (mirroring portfolio_shares)
  -- doesn't need another migration to widen this column.
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'project')),
  -- The wizard's full configuration (grade/hours, which Basiskonzepte were
  -- in focus and at what prior-knowledge level, methods, differentiation,
  -- assessment, societal context, output preferences) -- kept so a saved
  -- experiment can be reopened and re-edited, not just replayed as text.
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Snapshotted at generation time, not regenerated live from config -- if
  -- the underlying curriculum items change later, this stays what was
  -- actually tested, which is the point of a research record.
  prompt_text TEXT NOT NULL,
  llm_name TEXT,
  llm_output TEXT,
  evaluation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_experiments_project ON prompt_experiments(project_id);
CREATE INDEX IF NOT EXISTS idx_prompt_experiments_portfolio ON prompt_experiments(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_prompt_experiments_created_by ON prompt_experiments(created_by);

ALTER TABLE prompt_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can create their own prompt experiments" ON prompt_experiments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND is_project_member(project_id)
  );

CREATE POLICY "Creators see their own; project members see project-visible ones" ON prompt_experiments
  FOR SELECT USING (
    created_by = auth.uid()
    OR (visibility = 'project' AND is_project_member(project_id))
  );

CREATE POLICY "Creators can update their own prompt experiments" ON prompt_experiments
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can delete their own prompt experiments" ON prompt_experiments
  FOR DELETE USING (created_by = auth.uid());
