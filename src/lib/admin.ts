// Mirrors the RLS-side check in supabase/migrations/033_feedback_admin_read.sql
// (users.role = 'admin', backfilled for this address). Client-side use here
// is UI convenience only -- RLS is the real boundary, this just decides
// what renders.
export const ADMIN_EMAIL = 'dustin@globalesd.org'
