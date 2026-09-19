SET search_path = public, extensions;

-- Corrects 3 real wording problems in the pilot tutorial seeded by migration
-- 030, all flagged by the 2026-09-18 UI/UX audit's dedicated walk of the
-- Thuringia pilot journey:
--
-- 1. Step 1 promised a "table showing how strongly each curriculum item
--    relates to each concept" as if it always appears -- it's the
--    Concepts Explore tab's state-comparison table, which only renders once
--    more than one regional sub-project exists under the same hub (see
--    concepts-page.tsx's `children.length > 1` gate). Thuringia is
--    currently the only regional project under EvoMentor, so a student
--    following this tutorial today would never see it.
-- 2. Step 2 told a reader to add items to a Notebook "from Learning Goals or
--    Concepts" -- neither page has an "add to notebook" button. The real
--    mechanism is the Notebook's own "Reference project content" search box
--    (portfolio-explorer.tsx).
-- 3. Step 3 said there's a place "right below the generator" to record an
--    AI's output, as if it's always there -- that section (a
--    "Saved prompts & evaluations" list of cards, one per saved prompt)
--    only appears after clicking "Save this prompt & start an evaluation"
--    first.
--
-- An UPDATE, not a re-edit of migration 030's own INSERT, since 030 already
-- ran in production -- editing an already-applied migration file in place
-- wouldn't reach a database that already has the old steps.

UPDATE tutorials
SET steps = jsonb_build_array(
  jsonb_build_object(
    'title', '1. Explore how the Biology curriculum connects to evolution',
    'body', 'Open Concepts from the sidebar and switch to the Explore tab. You''ll see the full concept hierarchy behind Thuringia''s curriculum -- the six core Basiskonzepte, and every sub-concept underneath them.

This is the actual organizing structure the pilot is about: evolution isn''t just one topic among six, it''s meant to work as a connecting thread across all of them. Spend some time here first, before picking anything -- click into a concept to see exactly which real lessons cite it and why, and click through to open any of them. (Once other German states'' curricula join Thuringia''s here, you''ll also see a table comparing how much weight each state gives each concept -- Thuringia is the only one live so far, so that comparison isn''t there yet.)'
  ),
  jsonb_build_object(
    'title', '2. Select the connections you want to focus on',
    'body', 'Once you''ve found Lehrplan-evolution connections worth working with, open Notebooks from the sidebar and create a new one (or open an existing one). Inside the Notebook, click the "+" button and choose "Reference project content," then search for and add the specific curriculum items you care about -- a Notebook is your own workspace, so add as many or as few as you want, and add your own private notes on why each one matters to you.

You don''t need to decide everything at once. A Notebook stays yours to keep editing.'
  ),
  jsonb_build_object(
    'title', '3. Generate a teaching prompt, test it, and record what happened',
    'body', 'From inside your Notebook, click "Generate teaching prompt." Fill in the grade level, which concepts to focus on, teaching methods, and the kind of output you want -- the tool builds a complete, ready-to-use prompt from the real curriculum items in your Notebook as you go.

Click "Save this prompt & start an evaluation." A new card appears below, under "Saved prompts & evaluations" -- that''s where you record which AI you used and paste in what it produced. Copy the finished prompt first and try it on any AI tool you like (ChatGPT, Claude, Gemini, or anything else) outside of OpenLPM, then come back and fill in that card with the result and your own evaluation of whether it was actually useful. That record stays saved and tied to the exact prompt that made it, so you can compare different attempts later.'
  )
)
WHERE title = 'Getting started with the EvoMentor Thuringia pilot';
