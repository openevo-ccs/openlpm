SET search_path = public, extensions;

-- Tools for the admin Accounts page (2026-11-10): see who has confirmed their email and signed in,
-- confirm several emails by hand, and remove several accounts at once.
--
-- Why this needs the database: the confirmation date and the last sign-in time live in
-- Supabase's own auth.users table, which the app cannot read, and an account can only be
-- deleted from the server side. Each function below checks is_admin() first,
-- so a signed-in person who is not an admin gets an error and nothing else.
--
-- Found while checking why a Jena student could not sign in on launch day (2026-11-09): the
-- Accounts page could not say whether an account was confirmed, so there was nothing to look at
-- except the Supabase dashboard.

-- 1. Who has confirmed their email, and when they last signed in.
CREATE OR REPLACE FUNCTION admin_account_status()
RETURNS TABLE (
  account_id UUID,
  email_confirmed_at TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, auth
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can read account status' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email_confirmed_at, u.confirmation_sent_at, u.last_sign_in_at
    FROM auth.users u;
END;
$$;

-- 2. Mark emails as confirmed by hand, for people whose confirmation email never reached them.
-- Returns how many accounts were changed. Accounts that are already confirmed are left alone.
CREATE OR REPLACE FUNCTION admin_confirm_emails(account_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  changed INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can confirm emails' USING ERRCODE = '42501';
  END IF;
  UPDATE auth.users u
    SET email_confirmed_at = NOW()
    WHERE u.id = ANY(account_ids) AND u.email_confirmed_at IS NULL;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

-- 3. Remove several accounts at once. One row comes back per account asked about, saying whether
-- it was removed or skipped and why.
--
-- Skipped on purpose (the person can still be handled one at a time):
--   * your own account, and any admin account (demote first);
--   * accounts with an open deletion request, because the script that handles those also closes
--     the request and prints the address to send the confirmation to;
--   * accounts with feedback screenshots, because the image files sit in storage and only the
--     deletion script (scripts/execute_data_deletion.mjs) removes them.
--
-- For everyone else this does what the deletion script does for an ordinary account: saved
-- prompts, discussion posts and activity-log rows are deleted first (the database would only
-- clear the name on them and keep the text), page text saved with feedback is cleared, then the
-- account goes and everything keyed to it goes with it.
CREATE OR REPLACE FUNCTION admin_remove_accounts(account_ids UUID[])
RETURNS TABLE (account_id UUID, outcome TEXT, detail TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target UUID;
  target_role TEXT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can remove accounts' USING ERRCODE = '42501';
  END IF;

  FOR target IN SELECT DISTINCT x FROM unnest(account_ids) AS x LOOP
    SELECT pu.role INTO target_role FROM public.users pu WHERE pu.id = target;

    IF target = auth.uid() THEN
      RETURN QUERY SELECT target, 'skipped'::TEXT, 'This is your own account.'::TEXT;
    ELSIF NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = target) THEN
      RETURN QUERY SELECT target, 'skipped'::TEXT, 'No such account (already removed).'::TEXT;
    ELSIF target_role = 'admin' THEN
      RETURN QUERY SELECT target, 'skipped'::TEXT, 'Admin account. Remove admin first.'::TEXT;
    ELSIF EXISTS (SELECT 1 FROM public.data_deletion_requests r WHERE r.user_id = target AND r.status = 'open') THEN
      RETURN QUERY SELECT target, 'skipped'::TEXT, 'Has an open deletion request. Use scripts/execute_data_deletion.mjs so the request is closed.'::TEXT;
    ELSIF EXISTS (SELECT 1 FROM public.feedback f WHERE f.user_id = target AND f.screenshot_path IS NOT NULL) THEN
      RETURN QUERY SELECT target, 'skipped'::TEXT, 'Has feedback screenshots. Use scripts/execute_data_deletion.mjs, which also removes the image files.'::TEXT;
    ELSE
      DELETE FROM public.prompt_experiments pe WHERE pe.created_by = target;
      DELETE FROM public.discussion_posts dp WHERE dp.user_id = target;
      DELETE FROM public.activity_log al WHERE al.user_id = target;
      UPDATE public.feedback f SET context = '{}'::jsonb WHERE f.user_id = target;
      DELETE FROM auth.users au WHERE au.id = target;
      RETURN QUERY SELECT target, 'removed'::TEXT, ''::TEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION admin_account_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_confirm_emails(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_remove_accounts(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_account_status() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_confirm_emails(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_remove_accounts(UUID[]) TO authenticated;
