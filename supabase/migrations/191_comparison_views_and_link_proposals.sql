-- Rebuilt comparison views: a Germany view, a United States view and a cross-national view for each of the four synthetic spaces,
-- a place for reviewers to question a link, and AI-drafted link proposals for Social-Core and Computational-Core.
--
-- 1. curriculum_link_reviews. A verdict and a comment on one link. Anyone who can review or edit may add one; the author or an
--    editor may remove it. The verdict is open vocabulary: supports, questions, too_broad or wrong_place.
-- 2. Dashboard views. Bio-Core and Interdisciplinary keep their Sachsen/Thüringen and New York/California views, now under the
--    new template ids, and lose the separate Florida/Pennsylvania/Tennessee view (the United States view covers every state).
--    Social-Core and Computational-Core get all three. Every view is offered to the editor, contributor, reviewer and viewer roles.
-- 3. Link proposals. Relation types start with proposed_, which the views show as "AI-drafted, unconfirmed". Nobody has reviewed
--    them. A person confirms (the relation type loses the prefix), edits or removes each one.
--
-- To undo: DELETE FROM curriculum_repository_links WHERE relation_type LIKE 'proposed\_%'; DROP TABLE curriculum_link_reviews;
-- and delete the three template views per space that this file added.

SET search_path = public, extensions;

-- ============================================================================
-- 1. Reviewer verdicts on links
-- ============================================================================

CREATE TABLE IF NOT EXISTS curriculum_link_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  link_id UUID NOT NULL REFERENCES curriculum_repository_links(id) ON DELETE CASCADE,
  -- Open vocabulary (supports, questions, too_broad, wrong_place). A text column, so a new verdict needs no schema change.
  verdict TEXT NOT NULL,
  comment TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_link_reviews_link ON curriculum_link_reviews(link_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_link_reviews_project ON curriculum_link_reviews(project_id);

ALTER TABLE curriculum_link_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view link reviews" ON curriculum_link_reviews;
CREATE POLICY "Project members can view link reviews" ON curriculum_link_reviews
  FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "Reviewers and editors can add link reviews" ON curriculum_link_reviews;
CREATE POLICY "Reviewers and editors can add link reviews" ON curriculum_link_reviews
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer', 'editor', 'contributor', 'reviewer']::project_member_role[]) AND reviewed_by = auth.uid());
DROP POLICY IF EXISTS "Authors and editors can remove link reviews" ON curriculum_link_reviews;
CREATE POLICY "Authors and editors can remove link reviews" ON curriculum_link_reviews
  FOR DELETE USING (reviewed_by = auth.uid() OR is_project_editor(project_id));

-- ============================================================================
-- 2. Dashboard views
-- ============================================================================

DO $MIGRATION$
DECLARE
  v_project UUID;
  v_view UUID;
  v_role TEXT;
BEGIN
  -- bio-core
  SELECT id INTO v_project FROM projects WHERE slug = 'bio-core-lpm-synth';
  IF v_project IS NOT NULL THEN
    DELETE FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'bio-core-us-fl-pa-tn-en';
    UPDATE project_dashboard_views SET template_id = 'bio-core-germany-de', name = 'Deutschland (Deutsch)' WHERE project_id = v_project AND template_id = 'bio-core-sachsen-thueringen-de';
    UPDATE project_dashboard_views SET template_id = 'bio-core-united-states-en', name = 'United States (English)' WHERE project_id = v_project AND template_id = 'bio-core-us-ny-ca-en';
    UPDATE projects SET student_view_template = 'bio-core-germany-de' WHERE id = v_project AND student_view_template = 'bio-core-sachsen-thueringen-de';
    UPDATE projects SET student_view_template = 'bio-core-united-states-en' WHERE id = v_project AND student_view_template IN ('bio-core-us-ny-ca-en', 'bio-core-us-fl-pa-tn-en');
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'Deutschland (Deutsch)', 'template', 'bio-core-germany-de'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'bio-core-germany-de');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'bio-core-germany-de' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'United States (English)', 'template', 'bio-core-united-states-en'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'bio-core-united-states-en');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'bio-core-united-states-en' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'Cross-national comparison (English)', 'template', 'bio-core-cross-national-en'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'bio-core-cross-national-en');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'bio-core-cross-national-en' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- social-core
  SELECT id INTO v_project FROM projects WHERE slug = 'social-core-lpm-synth';
  IF v_project IS NOT NULL THEN
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'Deutschland (Deutsch)', 'template', 'social-core-germany-de'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'social-core-germany-de');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'social-core-germany-de' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'United States (English)', 'template', 'social-core-united-states-en'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'social-core-united-states-en');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'social-core-united-states-en' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'Cross-national comparison (English)', 'template', 'social-core-cross-national-en'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'social-core-cross-national-en');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'social-core-cross-national-en' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- computational-core
  SELECT id INTO v_project FROM projects WHERE slug = 'computational-core-lpm-synth';
  IF v_project IS NOT NULL THEN
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'Deutschland (Deutsch)', 'template', 'computational-core-germany-de'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'computational-core-germany-de');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'computational-core-germany-de' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'United States (English)', 'template', 'computational-core-united-states-en'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'computational-core-united-states-en');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'computational-core-united-states-en' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'Cross-national comparison (English)', 'template', 'computational-core-cross-national-en'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'computational-core-cross-national-en');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'computational-core-cross-national-en' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- interdisciplinary
  SELECT id INTO v_project FROM projects WHERE slug = 'interdisciplinary-lpm-synth';
  IF v_project IS NOT NULL THEN
    DELETE FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'interdisciplinary-us-fl-pa-tn-en';
    UPDATE project_dashboard_views SET template_id = 'interdisciplinary-germany-de', name = 'Deutschland (Deutsch)' WHERE project_id = v_project AND template_id = 'interdisciplinary-sachsen-thueringen-de';
    UPDATE project_dashboard_views SET template_id = 'interdisciplinary-united-states-en', name = 'United States (English)' WHERE project_id = v_project AND template_id = 'interdisciplinary-us-ny-ca-en';
    UPDATE projects SET student_view_template = 'interdisciplinary-germany-de' WHERE id = v_project AND student_view_template = 'interdisciplinary-sachsen-thueringen-de';
    UPDATE projects SET student_view_template = 'interdisciplinary-united-states-en' WHERE id = v_project AND student_view_template IN ('interdisciplinary-us-ny-ca-en', 'interdisciplinary-us-fl-pa-tn-en');
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'Deutschland (Deutsch)', 'template', 'interdisciplinary-germany-de'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'interdisciplinary-germany-de');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'interdisciplinary-germany-de' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'United States (English)', 'template', 'interdisciplinary-united-states-en'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'interdisciplinary-united-states-en');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'interdisciplinary-united-states-en' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
    SELECT v_project, 'Cross-national comparison (English)', 'template', 'interdisciplinary-cross-national-en'
    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'interdisciplinary-cross-national-en');
    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = 'interdisciplinary-cross-national-en' ORDER BY created_at LIMIT 1;
    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

END $MIGRATION$;

-- ============================================================================
-- 3. AI-drafted link proposals (Social-Core, Computational-Core)
-- ============================================================================
-- Each row ties one part of the progression to one record of the real-world corpus, with a written reason. Rows are skipped when
-- the part or the record is missing, or when the pair is already linked in any way.

-- social: 23 proposals, 4 parts left without one. Gaps in the corpus: The corpus has no records on early-grade social learning in either country, such as Sachunterricht in Germany or K-2 social studies in the US, so the K-2 items and the Shared-Resource Problems item have nothing to attach to. It also lacks any record on commons governance, public goods or collective-action cases taught in schools. Records from social-studies, civics and Gesellschaftslehre curricula are scarce: the usable German ones are a few Saxon G/R/W and Sozialkunde findings plus title-only timeline entries, and the only US civics-adjacent material is a set of New York graduate-profile briefs. Cross-curricular principle records, such as the Leitperspektiven in Baden-Württemberg and Hamburg, the Medienkompetenz supplement in Schleswig-Holstein and the Demokratiebildung entry, are mostly timeline events with empty text, so their fit cannot be judged. Nearly all US records concern evolution and climate education, and the few linked here are governance cases (courts, school boards, legislatures) that a curator should treat as bridge cases. Full-text records of German state Lehrpläne for Gesellschaftslehre, Politik, Sozialkunde and Geschichte, and of US state social-studies and civics standards, would let most of these items be linked on content.
INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
SELECT o.project_id, o.id, r.id, v.relation_type, v.rationale
FROM (VALUES
  ('067d4563-07b7-5c5c-8e9c-1dba9b610402', '5c82c34f-fb3c-434d-9252-5e90464f416d', 'proposed_relates_to', 'The KMK names cross-subject teaching as one of three pillars of democracy education, under a goal of tolerant and democratic living together. It gives the national frame in which a strand on groups, rules and institutions would sit in Germany.'),
  ('067d4563-07b7-5c5c-8e9c-1dba9b610402', '805134c3-5583-4f3f-aee8-7a45d3132f0c', 'proposed_relates_to', 'Describes Sozialkunde and G/R/W outside the Gymnasium in Sachsen, Sachsen-Anhalt and Thüringen as covering civics, law, economics and international relations. It points to where rules and institutions are taught in these states.'),
  ('c4836b7e-c2ac-5eda-9368-08e410453278', 'a272b254-13dd-461b-b85e-3d8188baa02e', 'proposed_relates_to', 'Lower Saxony put a Kerncurriculum for Werte und Normen in grades 1 to 4 out for consultation in February 2026. The subject name points to values and rules in early schooling. Only the title is available, so the fit is untested.'),
  ('f21b382b-ed4a-5e4e-b69b-d603834fbbe9', 'a272b254-13dd-461b-b85e-3d8188baa02e', 'proposed_relates_to', 'The same Lower Saxony consultation covers Werte und Normen for grades 1 to 4, which overlaps this grades 3 to 5 band. The title gives no detail on roles or on why rules differ, so the fit is a candidate for checking.'),
  ('9ef944f3-b11a-5327-9082-b53ba736a834', 'c65a2182-5b01-4a40-a9ab-083acea6524b', 'proposed_relates_to', 'Eight Dover biology teachers refused to read a school-board disclaimer, citing their profession''s ethics code, and administrators read it instead. A case where a professional norm and an authority''s rule pull apart, usable for sorting peer-held norms from enforced rules.'),
  ('9ef944f3-b11a-5327-9082-b53ba736a834', 'cc06207e-12a5-4c17-8e89-44145d0a39e3', 'proposed_relates_to', 'Notes that the Butler Act was enforced exactly once in 42 years and the 2012 Teacher Protection Act apparently never. It treats both as mandates teachers must still account for, which suits the question of what a rarely enforced rule still does.'),
  ('56eb4828-57c2-589b-92ba-180f901b2443', '5074bf81-5e69-43b6-ba0e-618a5a00b45c', 'proposed_relates_to', 'Saxony''s Gymnasium G/R/W plan builds the subject on analytic categories such as Macht and Institutionen, together with law and negotiated order. This matches the item''s focus on formal institutions and power.'),
  ('56eb4828-57c2-589b-92ba-180f901b2443', 'bdc9d32c-1eb3-4982-9ca1-ec5b617e2632', 'proposed_relates_to', 'Traces how Supreme Court rulings in 1968 and 1987 ended certain teaching bans and mandates, after which new laws appeared in forms built to avoid the defect the Court named. It shows an institution reshaping the options people face.'),
  ('56eb4828-57c2-589b-92ba-180f901b2443', '364a3071-4279-4feb-aef5-9b447c8a1c9f', 'proposed_relates_to', 'Sets Florida''s negotiated 2008 wording on evolution beside Pennsylvania''s Dover case, which a federal court decided on the constitutional question. A board vote and a court settle the same kind of dispute in different ways, which suits the item''s comparison of institutions.'),
  ('56eb4828-57c2-589b-92ba-180f901b2443', 'dcdf6f52-6ea1-4192-9098-a259e0a91b21', 'proposed_relates_to', 'Records eight Dover teachers'' collective refusal to read a district disclaimer, citing their profession''s ethics code, as a check on curriculum governance. It gives a case for sorting a formal board policy from an informal professional norm.'),
  ('1d8ecb11-c3b4-57b0-9a0f-b32667147fea', 'ecfff55e-af26-4d46-9cf1-da297382a7c7', 'proposed_relates_to', 'An OpenEvo brief proposes that Cooperation Games and Governing the Commons content can supply evidence for New York''s Global Citizen attribute. It points to where cooperation teaching could sit in a US state framework.'),
  ('3d964122-338c-548e-882b-d833d2ec4209', 'c524b7e5-4bbd-4510-abbc-ac42c661cb34', 'proposed_contrasts_with', 'Saxony''s grade 10 economics goals teach an idealized rational-actor model, which the record sets against cross-cultural ultimatum-game findings on fairness. It is a later-grade treatment of this item''s question of why people give or keep.'),
  ('e0e725b5-1716-5f38-95d7-bdaa1297f892', '5074bf81-5e69-43b6-ba0e-618a5a00b45c', 'proposed_relates_to', 'Saxony''s Gymnasium G/R/W plan puts Macht and Konflikt among its central analytic categories, alongside institutions and negotiated rules. These are the ideas this item uses to compare governance designs and judge the part power plays.'),
  ('e0e725b5-1716-5f38-95d7-bdaa1297f892', '92fc5a61-e765-4928-8cdf-1894662fbb8f', 'proposed_contrasts_with', 'Argues that global citizenship teaching needs an account of why cooperation at scale is hard, built on evolved cooperation mechanisms and the psychology of institutions. This item builds its account from power, conflict and institutions, so the two can be compared.'),
  ('e0e725b5-1716-5f38-95d7-bdaa1297f892', 'ecfff55e-af26-4d46-9cf1-da297382a7c7', 'proposed_relates_to', 'An OpenEvo brief maps the Governing the Commons content anchor onto New York''s Global Citizen attribute. It shows one US state framework in which content on governing shared resources could be placed.'),
  ('e0e725b5-1716-5f38-95d7-bdaa1297f892', '1cb2950b-0d4b-415c-a2a2-ad3a9bfca2e7', 'proposed_relates_to', 'Saxony''s grade 11 plan asks students to learn theories of international relations and to analyze international conflicts. It extends this item''s questions about power and conflict to the international scale.'),
  ('925d0b84-162d-5a26-a26c-c15db8863af1', '5bf82c77-725d-4cab-94ee-7992d51621a0', 'proposed_relates_to', 'The title says North Rhine-Westphalia revised its Kernlehrplan for Gesellschaftslehre in the Hauptschule. That plan is a candidate source on how a German state teaches about societies. No text is available, so the fit is untested.'),
  ('925d0b84-162d-5a26-a26c-c15db8863af1', 'b835dc33-a53f-409d-bb1e-d9b95a3280d2', 'proposed_relates_to', 'The title says Saarland published new Gemeinschaftsschule curricula for 2025/26, among them one for Gesellschaftswissenschaften. It is a candidate source for how a German state frames social studies. No text is available, so the fit is untested.'),
  ('fd772a6a-0dd8-5410-96c5-79f75443183c', '9a2cd62a-9e6c-4a8d-ba82-b7637f3b8bbf', 'proposed_relates_to', 'Sachsen-Anhalt''s Sekundarschule Geographie covers population development in regions of Asia at grades 7/8. A regional comparison of this kind could supply evidence when students explain why societies differ.'),
  ('fd772a6a-0dd8-5410-96c5-79f75443183c', '1cdfa96f-3c92-42aa-ba38-69211c312c44', 'proposed_relates_to', 'Compares Florida, Pennsylvania and Tennessee, which currently take three different postures on evolution education, each with its own history of standards, litigation or statute. It is a cross-state comparison of the kind this item asks students to make.'),
  ('504c7645-bc71-5a81-a114-cd2d598d1621', 'afa254d5-36cb-4f50-8969-44b4e1511e5f', 'proposed_relates_to', 'Follows one question in Tennessee over a century, from a 1925 prohibition to a 1973 equal-emphasis mandate and a later law in secular language. A worked case of courts and legislators shaping each other over generations.'),
  ('504c7645-bc71-5a81-a114-cd2d598d1621', 'f6c75e6e-d735-4a66-9cb1-a4e5dd49111a', 'proposed_relates_to', 'Describes how one question about teaching human origins recurred across US states and decades, from Tennessee''s 1925 law to the Arkansas and Mississippi bans and later cases. It gives a long-run case for evaluating explanations of change.'),
  ('504c7645-bc71-5a81-a114-cd2d598d1621', '44c8c6ff-2d37-49cc-ba0d-3be44384bd23', 'proposed_relates_to', 'Reports that a model Academic Freedom Act template from the Discovery Institute was enacted in Louisiana in 2008 and Tennessee in 2012, and used for Florida bills. A documented case of a policy spreading between states.')
) AS v(object_id, record_id, relation_type, rationale)
JOIN lpm_data_objects o ON o.id = v.object_id::uuid
JOIN curriculum_repository_records r ON r.id = v.record_id::uuid
WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);

-- computational: 12 proposals, 9 parts left without one. Gaps in the corpus: The corpus has no US record on computing, computer science, data science or digital literacy, because the US records cover evolution-education disputes and graduation frameworks. A curator would need to add state computer-science and technology standards for the states already tracked (New York, Florida, Pennsylvania, Tennessee, California). On the German side, Informatik appears mostly as dated timeline events with no text (Bremen, Mecklenburg-Vorpommern, Baden-Württemberg, Thüringen), so each needs a written summary of grade placement, compulsory status and competency areas. The only content-level Informatik records are the Modellieren findings for Sachsen, Sachsen-Anhalt and Thüringen secondary schools. Nothing covers primary-school computing, data and representation, algorithm correctness and efficiency, or the national digital-education strategy, and the media-education and AI items exist as titles only.
INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
SELECT o.project_id, o.id, r.id, v.relation_type, v.rationale
FROM (VALUES
  ('7d846794-560b-58b9-a9f0-267a680c308d', 'ec7c0238-5ac5-4a8c-8620-46fe947eff59', 'proposed_contrasts_with', 'Baden-Württemberg makes Informatik und Medienbildung a compulsory subject from grade 5, with its own Bildungsplan planned for 2027/28. This strand starts in K-2, so the record shows a later entry point for the same question of when computing begins. Title only.'),
  ('7d846794-560b-58b9-a9f0-267a680c308d', 'f71a6610-a989-4524-9988-8b9d0683b179', 'proposed_relates_to', 'Bremen makes Informatik a compulsory subject at all its secondary schools from August 2026. It shows one state giving computing its own required place in the timetable, which is a point of comparison for this K-12 strand. Only the title is available.'),
  ('7d846794-560b-58b9-a9f0-267a680c308d', 'f0a1c369-5165-456e-bbbe-d9de5b54fac9', 'proposed_relates_to', 'Mecklenburg-Vorpommern gives Informatik und Medienbildung a standalone place in its 2025/26 timetable changes. It is a second example of a state placing computing in its own subject, useful for comparison with this strand. The record has a title only.'),
  ('7d846794-560b-58b9-a9f0-267a680c308d', '35845e3d-239f-4f48-8049-8680c23e9d22', 'proposed_relates_to', 'Thüringen introduced Medienbildung und Informatik (MBI) in August 2024. The title gives no grade or content, so the link to this strand rests on the subject name alone.'),
  ('7d846794-560b-58b9-a9f0-267a680c308d', '34658a80-bb0f-46a2-bbfc-7750a2d17deb', 'proposed_contrasts_with', 'Sachsen makes Informatik compulsory in grades 7-10, while Sachsen-Anhalt offers it as an elective from grade 9 and Thüringen from grade 9/10. This is a different treatment from a strand that runs from K through grade 12.'),
  ('71bc5265-fbcd-5e5a-b093-399a24bce44d', '34658a80-bb0f-46a2-bbfc-7750a2d17deb', 'proposed_contrasts_with', 'The three states center Informatik on ''Modellieren'', yet the subject begins in grade 7 at the earliest. This substrand has students build models of everyday systems in grades 3-5. The German term may cover more than simulation, which needs checking.'),
  ('45c484c9-e753-5bb3-86af-086bc28fce31', '34658a80-bb0f-46a2-bbfc-7750a2d17deb', 'proposed_relates_to', 'Sachsen, Sachsen-Anhalt and Thüringen each build Informatik around informatische Modellierung, with Sachsen teaching it in grades 7-10. That is the closest German counterpart to the model-building focus of this grades 6-8 substrand, although the German term may cover more than simulation.'),
  ('45c484c9-e753-5bb3-86af-086bc28fce31', 'e86b117f-3ddd-4a69-9b9e-3ea41c14a95b', 'proposed_relates_to', 'Sachsen''s 2022 Oberschule Informatik and Sachsen-Anhalt''s new Sekundarschule Informatik also center on Modellieren, and the latter lists ''Modellieren und Implementieren'' among five core competency areas. This adds a second school type to the evidence for this substrand''s focus.'),
  ('31f4c2e2-f909-5cf1-ae61-ca82e22bda0e', 'e86b117f-3ddd-4a69-9b9e-3ea41c14a95b', 'proposed_relates_to', 'Sachsen-Anhalt''s Sekundarschule Informatik pairs ''Modellieren'' with ''Implementieren'' as one of five core competency areas. That sits next to this substrand''s work on splitting problems into functions. The match is loose, so check how the source describes ''Implementieren''.'),
  ('45c484c9-e753-5bb3-86af-086bc28fce31', '8f4334ac-d29c-4aa4-a2ce-b3bd7ba02918', 'proposed_relates_to', 'KMK names systemic thinking and handling complexity among five criteria for sustainability-oriented teaching (June 2024). That gives a national policy hook for the feedback models in this substrand, although the record concerns sustainability education in general.'),
  ('e6374470-9533-570e-8d98-0e5b24060f4d', 'd67cfe5a-60fa-4921-84fb-98af728a15fd', 'proposed_relates_to', 'The national ministers'' conference adopted a recommendation for action on AI in school education in October 2024. It gives the policy background for this machine learning substrand. The record has a title only, so what it asks of schools needs checking.'),
  ('22e68923-d1f7-54a7-9cb5-6a3591c04a02', '8aef6424-d486-45f5-a437-b688ebeb81b7', 'proposed_relates_to', 'This synthetic redesign proposal for Thüringen frames the hormone system as an information-processing system, a Biologie and Informatik bridge. It touches the idea of information, though the sense may differ from bits and compression. Title only.')
) AS v(object_id, record_id, relation_type, rationale)
JOIN lpm_data_objects o ON o.id = v.object_id::uuid
JOIN curriculum_repository_records r ON r.id = v.record_id::uuid
WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);
