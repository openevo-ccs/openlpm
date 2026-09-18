SET search_path = public, extensions;

-- A simple in-app Help system, 2026-09-18 ask: a Help button in the topbar
-- (next to Profile) that lets a user pick from whatever tutorials are
-- available to them -- general ones, plus one per project space they're
-- actually a member of -- and a real first tutorial for evomentor-thuringia
-- covering the actual 3-task pilot workflow (explore -> select -> generate/
-- test/evaluate a prompt), not a placeholder.

CREATE TABLE IF NOT EXISTS tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = general/ecosystem-wide, visible to any signed-in user regardless
  -- of project membership. A real project_id scopes it to that project's
  -- own members, same access model as everything else in the app.
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  -- One line shown in the picker list, before a user opens the tutorial.
  description TEXT,
  -- Ordered steps: [{title, body}], body is plain text (paragraph breaks
  -- via literal blank lines, rendered with white-space:pre-wrap the same
  -- way the prompt-generator's own preview already does) -- deliberately
  -- not markdown, no new rendering dependency for a "simple tutorial" ask.
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutorials_project ON tutorials(project_id);

ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "General tutorials are visible to all; project ones to members" ON tutorials
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (project_id IS NULL OR is_project_member(project_id))
  );

-- No INSERT/UPDATE policy yet -- authoring a tutorial is a migration/
-- curator job for now, same deliberate v1 scope line already drawn for
-- prompt_template_libraries. A real "write your own tutorial" UI for
-- project owners is future work, not an oversight.

-- The real first tutorial: the actual 3-task pilot workflow Dustin
-- described (2026-09-17/18), covering only features that genuinely exist
-- in this app today -- the Concepts page's Explore tab, Notebooks, and the
-- AI Prompt Generator (migrations 027/028) -- nothing aspirational.
INSERT INTO tutorials (project_id, title, description, sort_order, steps)
SELECT
  p.id,
  'Getting started with the EvoMentor Thuringia pilot',
  'How to explore Lehrplan-evolution connections, pick the ones you want to work with, and generate a real teaching prompt from them.',
  0,
  jsonb_build_array(
    jsonb_build_object(
      'title', '1. Explore how the Biology curriculum connects to evolution',
      'body', 'Open Concepts from the sidebar and switch to the Explore tab. You''ll see the full concept hierarchy behind Thuringia''s curriculum -- the six core Basiskonzepte, and every sub-concept underneath them -- plus a table showing how strongly each curriculum item relates to each concept.

This is the actual organizing structure the pilot is about: evolution isn''t just one topic among six, it''s meant to work as a connecting thread across all of them. Spend some time here first, before picking anything -- click into a concept to see exactly which real lessons cite it and why.'
    ),
    jsonb_build_object(
      'title', '2. Select the connections you want to focus on',
      'body', 'Once you''ve found Lehrplan-evolution connections worth working with, open Notebooks from the sidebar and create a new one (or open an existing one). Add the specific curriculum items you care about from Learning Goals or Concepts -- a Notebook is your own workspace, so add as many or as few as you want, and add your own notes on why each one matters to you.

You don''t need to decide everything at once. A Notebook stays yours to keep editing.'
    ),
    jsonb_build_object(
      'title', '3. Generate a teaching prompt, test it, and record what happened',
      'body', 'From inside your Notebook, click "Generate teaching prompt." Fill in the grade level, which concepts to focus on, teaching methods, and the kind of output you want -- the tool builds a complete, ready-to-use prompt from the real curriculum items in your Notebook as you go.

Copy the finished prompt and try it on any AI tool you like (ChatGPT, Claude, Gemini, or anything else) -- outside of OpenLPM. Then come back to the same page: there''s a place right below the generator to note which AI you used, paste in what it produced, and write your own evaluation of whether it was actually useful. That record stays saved and tied to the exact prompt that made it, so you can compare different attempts later.'
    )
  )
FROM projects p
WHERE p.slug = 'evomentor-thuringia'
AND NOT EXISTS (
  SELECT 1 FROM tutorials t WHERE t.project_id = p.id AND t.title = 'Getting started with the EvoMentor Thuringia pilot'
);
