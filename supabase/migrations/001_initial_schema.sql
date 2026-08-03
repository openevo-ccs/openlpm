-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'contributor' CHECK (role IN ('admin', 'editor', 'reviewer', 'contributor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Literature References table
CREATE TABLE IF NOT EXISTS literature_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doi TEXT UNIQUE,
  title TEXT NOT NULL,
  authors JSONB DEFAULT '[]'::jsonb,
  year INTEGER,
  venue TEXT,
  abstract TEXT,
  type TEXT CHECK (type IN ('article', 'book', 'chapter', 'report', 'thesis')),
  crossref_verified BOOLEAN DEFAULT FALSE,
  openalex_id TEXT,
  semantic_scholar_id TEXT,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Literature Annotations table
CREATE TABLE IF NOT EXISTS literature_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_id UUID REFERENCES literature_references(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  annotation_text TEXT NOT NULL,
  annotation_type TEXT CHECK (annotation_type IN ('note', 'question', 'insight', 'critique')),
  page_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LPM Schema Elements table
CREATE TABLE IF NOT EXISTS lpm_schema_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  element_type TEXT NOT NULL CHECK (element_type IN ('concept', 'competency', 'grade_band', 'assessment')),
  label TEXT NOT NULL,
  definition TEXT,
  parent_id UUID REFERENCES lpm_schema_elements(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed', 'discussed', 'accepted', 'deprecated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LPM Data Objects table
CREATE TABLE IF NOT EXISTS lpm_data_objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_type TEXT NOT NULL CHECK (object_type IN ('strand', 'substrand', 'performance_indicator', 'assessment_item')),
  title TEXT NOT NULL,
  description TEXT,
  grade_band TEXT,
  subject_area TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'accepted', 'rejected')),
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidence Links table
CREATE TABLE IF NOT EXISTS evidence_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type TEXT NOT NULL CHECK (target_type IN ('schema_element', 'data_object')),
  target_id UUID NOT NULL,
  reference_id UUID REFERENCES literature_references(id) ON DELETE SET NULL,
  evidence_type TEXT CHECK (evidence_type IN ('supports', 'challenges', 'contextualizes')),
  relevance_score INTEGER CHECK (relevance_score >= 1 AND relevance_score <= 5),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Peer Review Assignments table
CREATE TABLE IF NOT EXISTS peer_review_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reviewable_type TEXT NOT NULL CHECK (reviewable_type IN ('literature_reference', 'lpm_data_object')),
  reviewable_id UUID NOT NULL,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  recommendation TEXT CHECK (recommendation IN ('accept', 'reject', 'revise', 'major_revision')),
  review_text TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discussion Topics table
CREATE TABLE IF NOT EXISTS discussion_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  linked_type TEXT CHECK (linked_type IN ('schema_element', 'data_object', 'literature_reference')),
  linked_id UUID,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discussion Posts table
CREATE TABLE IF NOT EXISTS discussion_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID REFERENCES discussion_topics(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES discussion_posts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  post_type TEXT DEFAULT 'comment' CHECK (post_type IN ('comment', 'revision', 'elaboration', 'annotation')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Log table
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_literature_references_status ON literature_references(status);
CREATE INDEX IF NOT EXISTS idx_literature_references_doi ON literature_references(doi);
CREATE INDEX IF NOT EXISTS idx_literature_references_submitted_by ON literature_references(submitted_by);

CREATE INDEX IF NOT EXISTS idx_lpm_schema_elements_type ON lpm_schema_elements(element_type);
CREATE INDEX IF NOT EXISTS idx_lpm_schema_elements_status ON lpm_schema_elements(status);
CREATE INDEX IF NOT EXISTS idx_lpm_schema_elements_parent ON lpm_schema_elements(parent_id);

CREATE INDEX IF NOT EXISTS idx_lpm_data_objects_type ON lpm_data_objects(object_type);
CREATE INDEX IF NOT EXISTS idx_lpm_data_objects_status ON lpm_data_objects(status);
CREATE INDEX IF NOT EXISTS idx_lpm_data_objects_submitted_by ON lpm_data_objects(submitted_by);

CREATE INDEX IF NOT EXISTS idx_evidence_links_target ON evidence_links(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_reference ON evidence_links(reference_id);

CREATE INDEX IF NOT EXISTS idx_peer_review_assignments_reviewable ON peer_review_assignments(reviewable_type, reviewable_id);
CREATE INDEX IF NOT EXISTS idx_peer_review_assignments_reviewer ON peer_review_assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_peer_review_assignments_status ON peer_review_assignments(status);

CREATE INDEX IF NOT EXISTS idx_discussion_topics_category ON discussion_topics(category);
CREATE INDEX IF NOT EXISTS idx_discussion_topics_linked ON discussion_topics(linked_type, linked_id);

CREATE INDEX IF NOT EXISTS idx_discussion_posts_topic ON discussion_posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_parent ON discussion_posts(parent_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_target ON activity_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE literature_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE literature_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lpm_schema_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE lpm_data_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic - customize based on your needs)

-- Users: Everyone can read, only admins can write
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Literature References: Everyone can read, authenticated users can create
CREATE POLICY "Literature references are viewable by everyone" ON literature_references FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create literature references" ON literature_references FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own literature references" ON literature_references FOR UPDATE USING (submitted_by = auth.uid());

-- Literature Annotations: Everyone can read, authenticated users can create
CREATE POLICY "Annotations are viewable by everyone" ON literature_annotations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create annotations" ON literature_annotations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own annotations" ON literature_annotations FOR UPDATE USING (user_id = auth.uid());

-- LPM Schema Elements: Everyone can read, authenticated users can create
CREATE POLICY "Schema elements are viewable by everyone" ON lpm_schema_elements FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create schema elements" ON lpm_schema_elements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Editors can update schema elements" ON lpm_schema_elements FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);

-- LPM Data Objects: Everyone can read, authenticated users can create
CREATE POLICY "Data objects are viewable by everyone" ON lpm_data_objects FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create data objects" ON lpm_data_objects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own data objects" ON lpm_data_objects FOR UPDATE USING (submitted_by = auth.uid());

-- Evidence Links: Everyone can read, authenticated users can create
CREATE POLICY "Evidence links are viewable by everyone" ON evidence_links FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create evidence links" ON evidence_links FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Peer Review Assignments: Reviewers can see their assignments
CREATE POLICY "Reviewers can see their assignments" ON peer_review_assignments FOR SELECT USING (reviewer_id = auth.uid());
CREATE POLICY "Reviewers can update their assignments" ON peer_review_assignments FOR UPDATE USING (reviewer_id = auth.uid());

-- Discussion Topics: Everyone can read, authenticated users can create
CREATE POLICY "Topics are viewable by everyone" ON discussion_topics FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create topics" ON discussion_topics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Discussion Posts: Everyone can read, authenticated users can create
CREATE POLICY "Posts are viewable by everyone" ON discussion_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON discussion_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own posts" ON discussion_posts FOR UPDATE USING (user_id = auth.uid());

-- Activity Log: Everyone can read, system creates entries
CREATE POLICY "Activity log is viewable by everyone" ON activity_log FOR SELECT USING (true);
CREATE POLICY "System can create activity log entries" ON activity_log FOR INSERT WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_literature_references_updated_at BEFORE UPDATE ON literature_references FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lpm_schema_elements_updated_at BEFORE UPDATE ON lpm_schema_elements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lpm_data_objects_updated_at BEFORE UPDATE ON lpm_data_objects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discussion_topics_updated_at BEFORE UPDATE ON discussion_topics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discussion_posts_updated_at BEFORE UPDATE ON discussion_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();