// Mirrors the RLS-side check in supabase/migrations/033_feedback_admin_read.sql
// (users.role = 'admin', backfilled for this address). Client-side use here
// is UI convenience only -- RLS is the real boundary, this just decides
// what renders.
//
// Checked directly against the live auth.users table (2026-10-01): Dustin's
// real OpenLPM sign-in is GitHub OAuth as dustin.eirdosh@eva.mpg.de, last
// used today -- there is no account at all for dustin@globalesd.org (the
// address this constant used to hardcode). That mismatch is why neither this
// page nor admin-feedback-page.tsx, which gates on the same constant, ever
// showed up for him.
export const ADMIN_EMAIL = 'dustin.eirdosh@eva.mpg.de'
