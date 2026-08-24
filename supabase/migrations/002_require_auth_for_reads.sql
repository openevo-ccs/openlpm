-- Tighten RLS: require an authenticated session to read content, not just to write.
-- The app itself is now gated behind Supabase OAuth (see middleware.ts), but that
-- only protects the Next.js routes -- anyone with the anon key could otherwise
-- query these tables directly over the Supabase REST/JS API. These policies close
-- that gap by requiring auth.uid() IS NOT NULL for SELECT as well.

DROP POLICY IF EXISTS "Literature references are viewable by everyone" ON literature_references;
CREATE POLICY "Authenticated users can view literature references" ON literature_references
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Annotations are viewable by everyone" ON literature_annotations;
CREATE POLICY "Authenticated users can view annotations" ON literature_annotations
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Schema elements are viewable by everyone" ON lpm_schema_elements;
CREATE POLICY "Authenticated users can view schema elements" ON lpm_schema_elements
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Data objects are viewable by everyone" ON lpm_data_objects;
CREATE POLICY "Authenticated users can view data objects" ON lpm_data_objects
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Evidence links are viewable by everyone" ON evidence_links;
CREATE POLICY "Authenticated users can view evidence links" ON evidence_links
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Topics are viewable by everyone" ON discussion_topics;
CREATE POLICY "Authenticated users can view topics" ON discussion_topics
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Posts are viewable by everyone" ON discussion_posts;
CREATE POLICY "Authenticated users can view posts" ON discussion_posts
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Activity log is viewable by everyone" ON activity_log;
CREATE POLICY "Authenticated users can view activity log" ON activity_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- users: keep readable by everyone-authenticated (needed to resolve author
-- names/avatars across the app), but no longer to fully anonymous callers.
DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
CREATE POLICY "Authenticated users can view user profiles" ON users
  FOR SELECT USING (auth.uid() IS NOT NULL);
