SET search_path = public, extensions;

-- Real feedback 0d75cc1a (2026-10-01): "'Help' is currently not helpful,
-- we need a real help page with some basic very simple concise orientation
-- or frequently asked questions that we can develop." The Help button
-- (migration 030) already supports exactly this -- a tutorial row with
-- project_id = NULL is general/ecosystem-wide, visible to any signed-in
-- user regardless of project membership -- but nobody had ever seeded one,
-- so anyone not already a member of evomentor-thuringia (the only project
-- with a tutorial) saw an empty "No tutorials available yet" list. These
-- two general entries fix that gap with real orientation + FAQ content,
-- not placeholders. Same steps JSONB shape as every other tutorial row, so
-- no frontend change is needed -- they just show up in the existing list.

INSERT INTO tutorials (project_id, title, description, sort_order, steps)
VALUES (
  NULL,
  'Welcome to OpenLPM',
  'What OpenLPM is and how to find your way around',
  0,
  jsonb_build_array(
    jsonb_build_object(
      'title', '1. What OpenLPM is for',
      'body', 'OpenLPM is a shared place to build and explore curriculum content together with your research or teaching group. Everything lives inside a "project space" -- the Learning Goals, Concepts, Literature and Notebooks you see all belong to that one space, and nothing crosses over between spaces unless someone explicitly connects them.'
    ),
    jsonb_build_object(
      'title', '2. Finding or joining your group',
      'body', 'Open Profile from the top bar. If your account''s email is already eligible to join a group, it''ll be listed there with a one-click "Join" button -- no code needed. If someone gave you a join link or a short code instead, paste it into the box below that list.'
    ),
    jsonb_build_object(
      'title', '3. Two kinds of view',
      'body', 'Most projects show the full researcher view -- Learning Goals, Concepts, Notebooks and more, for building and reviewing curriculum content in detail. Some projects also have a simpler view built specifically for that project''s own students or teachers, often in that group''s own language. Which one you see depends on your role and how you joined -- it isn''t something you pick yourself.'
    ),
    jsonb_build_object(
      'title', '4. Something confusing or broken?',
      'body', 'Click the speech-bubble "Feedback" button in the bottom-right corner of any page. You can describe what happened and attach a marked-up screenshot -- it goes straight to whoever maintains OpenLPM.'
    )
  )
),
(
  NULL,
  'Frequently asked questions',
  'Quick answers to the most common questions',
  1,
  jsonb_build_array(
    jsonb_build_object(
      'title', 'I don''t see any projects, or nothing shows up to join',
      'body', 'You need to either already be a member of a project, or your account''s sign-in email has to match that project''s own allow-list. Check Profile to confirm which email you''re signed in with, and ask whoever invited you to confirm it matches what they added.'
    ),
    jsonb_build_object(
      'title', 'What''s the difference between the Researcher view and a Student/Teacher view?',
      'body', 'The Researcher view is the full working detail: Learning Goals, Concepts, Literature, Notebooks and more. A small number of projects also have a simplified, often translated view built for that specific group''s students or teachers. You don''t choose which one you get -- it follows from your role and how you joined that project.'
    ),
    jsonb_build_object(
      'title', 'Can anyone else see my project?',
      'body', 'A project marked private is visible only to its own members. If you''re not sure whether a project you own is private, or who else can see it, check that project''s own Dashboard page, or ask its owner.'
    ),
    jsonb_build_object(
      'title', 'How do I report a problem or suggest something?',
      'body', 'Click the speech-bubble "Feedback" button in the bottom-right corner of any page -- it works from anywhere in the app. You can attach a screenshot and draw directly on it to point at exactly what you mean.'
    ),
    jsonb_build_object(
      'title', 'Can I delete a project?',
      'body', 'Only that project''s own owner can, from a "Danger zone" card on the project''s own Dashboard page. It asks you to type the project''s slug to confirm, since deleting it can''t be undone, and it refuses while the project still has sub-projects inside it.'
    )
  )
);
