SET search_path = public, extensions;

-- TeachingBase tab (Base Repo Explorer): admins can name other people as reviewers (Dustin, 2026-11-11). A named reviewer who is not an admin can
-- open the TeachingBase tab at /dashboard/teaching-base and record verdicts, and has no access to any other admin page.
-- Builds on migration 240 (teachingbase_snapshot, teachingbase_link_verdicts).
-- Design note: lab_manager/docs/design-notes/openlpm-teaching-lessons-review-2026-11-11.md

CREATE TABLE IF NOT EXISTS teachingbase_reviewers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE teachingbase_reviewers ENABLE ROW LEVEL SECURITY;

-- Who can read the list: admins see every row (they manage it). Anyone else sees only their own row, which is all the page needs to
-- know whether the signed-in person may review. This keeps the list of reviewers from being readable by every account.
DROP POLICY IF EXISTS "Admins see all reviewers, others only themselves" ON teachingbase_reviewers;
CREATE POLICY "Admins see all reviewers, others only themselves" ON teachingbase_reviewers
  FOR SELECT USING (is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can add reviewers" ON teachingbase_reviewers;
CREATE POLICY "Admins can add reviewers" ON teachingbase_reviewers
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can remove reviewers" ON teachingbase_reviewers;
CREATE POLICY "Admins can remove reviewers" ON teachingbase_reviewers
  FOR DELETE USING (is_admin());

-- No UPDATE policy: adding and removing is all there is. The grant is removed as well.
REVOKE UPDATE ON teachingbase_reviewers FROM authenticated, anon;

-- Policy swap on the verdict table (migration 240 allowed admins only): drop the old rule, create the wider one. The check that a row
-- is written as the signed-in person stays. Verdicts stay append-only: there is still no UPDATE or DELETE policy and the grants stay removed.
DROP POLICY IF EXISTS "Admins can add TeachingBase verdicts as themselves" ON teachingbase_link_verdicts;
DROP POLICY IF EXISTS "Admins and named reviewers can add TeachingBase verdicts as themselves" ON teachingbase_link_verdicts;
CREATE POLICY "Admins and named reviewers can add TeachingBase verdicts as themselves" ON teachingbase_link_verdicts
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND (is_admin() OR EXISTS (SELECT 1 FROM teachingbase_reviewers r WHERE r.user_id = auth.uid()))
  );
