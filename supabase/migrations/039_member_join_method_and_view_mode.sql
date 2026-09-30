SET search_path = public, extensions;

-- Distinguishes a real student who self-joined via a domain/email rule
-- (migration 035) from a collaborator an owner added directly or invited
-- by name (migration 013) -- needed so the app can automatically show a
-- simplified, German, student-facing view to the first group and the full
-- researcher view to the second, without any manual per-person setup.
-- Nullable, open vocabulary (matches activity_log's own action_type
-- convention) rather than a boolean, so a future join mechanism doesn't
-- need its own schema change -- 'self_join_rule' is the only value written
-- today.

ALTER TABLE project_members ADD COLUMN IF NOT EXISTS joined_via TEXT;

-- No new RLS policy needed: migration 004's existing "project members can
-- view their project's membership" SELECT policy already lets any member
-- read the whole team's rows (that's what the Members page relies on), so
-- a member can already read their own joined_via value through it.
