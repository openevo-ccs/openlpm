export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          avatar_url: string | null
          role: 'admin' | 'editor' | 'reviewer' | 'contributor'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          avatar_url?: string | null
          role?: 'admin' | 'editor' | 'reviewer' | 'contributor'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          avatar_url?: string | null
          role?: 'admin' | 'editor' | 'reviewer' | 'contributor'
          created_at?: string
          updated_at?: string
        }
      }
      literature_references: {
        Row: {
          id: string
          doi: string | null
          title: string
          authors: any[]
          year: number | null
          venue: string | null
          abstract: string | null
          type: 'article' | 'book' | 'chapter' | 'report' | 'thesis'
          crossref_verified: boolean
          openalex_id: string | null
          semantic_scholar_id: string | null
          submitted_by: string | null
          status: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          doi?: string | null
          title: string
          authors?: any[]
          year?: number | null
          venue?: string | null
          abstract?: string | null
          type?: 'article' | 'book' | 'chapter' | 'report' | 'thesis'
          crossref_verified?: boolean
          openalex_id?: string | null
          semantic_scholar_id?: string | null
          submitted_by?: string | null
          status?: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          doi?: string | null
          title?: string
          authors?: any[]
          year?: number | null
          venue?: string | null
          abstract?: string | null
          type?: 'article' | 'book' | 'chapter' | 'report' | 'thesis'
          crossref_verified?: boolean
          openalex_id?: string | null
          semantic_scholar_id?: string | null
          submitted_by?: string | null
          status?: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
          created_at?: string
          updated_at?: string
        }
      }
      lpm_schema_elements: {
        Row: {
          id: string
          element_type: 'concept' | 'competency' | 'grade_band' | 'assessment'
          label: string
          definition: string | null
          parent_id: string | null
          metadata: any
          status: 'proposed' | 'discussed' | 'accepted' | 'deprecated'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          element_type: 'concept' | 'competency' | 'grade_band' | 'assessment'
          label: string
          definition?: string | null
          parent_id?: string | null
          metadata?: any
          status?: 'proposed' | 'discussed' | 'accepted' | 'deprecated'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          element_type?: 'concept' | 'competency' | 'grade_band' | 'assessment'
          label?: string
          definition?: string | null
          parent_id?: string | null
          metadata?: any
          status?: 'proposed' | 'discussed' | 'accepted' | 'deprecated'
          created_at?: string
          updated_at?: string
        }
      }
      lpm_data_objects: {
        Row: {
          id: string
          object_type: 'strand' | 'substrand' | 'performance_indicator' | 'assessment_item'
          title: string
          description: string | null
          grade_band: string | null
          subject_area: string | null
          content: any
          schema_version: string | null
          status: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
          submitted_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          object_type: 'strand' | 'substrand' | 'performance_indicator' | 'assessment_item'
          title: string
          description?: string | null
          grade_band?: string | null
          subject_area?: string | null
          content: any
          schema_version?: string | null
          status?: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
          submitted_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          object_type?: 'strand' | 'substrand' | 'performance_indicator' | 'assessment_item'
          title?: string
          description?: string | null
          grade_band?: string | null
          subject_area?: string | null
          content?: any
          schema_version?: string | null
          status?: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
          submitted_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      evidence_links: {
        Row: {
          id: string
          target_type: 'schema_element' | 'data_object'
          target_id: string
          reference_id: string | null
          evidence_type: 'supports' | 'challenges' | 'contextualizes'
          relevance_score: number | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          target_type: 'schema_element' | 'data_object'
          target_id: string
          reference_id?: string | null
          evidence_type?: 'supports' | 'challenges' | 'contextualizes'
          relevance_score?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          target_type?: 'schema_element' | 'data_object'
          target_id?: string
          reference_id?: string | null
          evidence_type?: 'supports' | 'challenges' | 'contextualizes'
          relevance_score?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      peer_review_assignments: {
        Row: {
          id: string
          reviewable_type: 'literature_reference' | 'lpm_data_object'
          reviewable_id: string
          reviewer_id: string | null
          status: 'pending' | 'in_progress' | 'completed'
          recommendation: 'accept' | 'reject' | 'revise' | 'major_revision' | null
          review_text: string | null
          submitted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reviewable_type: 'literature_reference' | 'lpm_data_object'
          reviewable_id: string
          reviewer_id?: string | null
          status?: 'pending' | 'in_progress' | 'completed'
          recommendation?: 'accept' | 'reject' | 'revise' | 'major_revision' | null
          review_text?: string | null
          submitted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          reviewable_type?: 'literature_reference' | 'lpm_data_object'
          reviewable_id?: string
          reviewer_id?: string | null
          status?: 'pending' | 'in_progress' | 'completed'
          recommendation?: 'accept' | 'reject' | 'revise' | 'major_revision' | null
          review_text?: string | null
          submitted_at?: string | null
          created_at?: string
        }
      }
      discussion_topics: {
        Row: {
          id: string
          title: string
          description: string | null
          category: string | null
          linked_type: 'schema_element' | 'data_object' | 'literature_reference' | null
          linked_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          category?: string | null
          linked_type?: 'schema_element' | 'data_object' | 'literature_reference' | null
          linked_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          category?: string | null
          linked_type?: 'schema_element' | 'data_object' | 'literature_reference' | null
          linked_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      discussion_posts: {
        Row: {
          id: string
          topic_id: string
          parent_id: string | null
          user_id: string | null
          content: string
          post_type: 'comment' | 'revision' | 'elaboration' | 'annotation'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          topic_id: string
          parent_id?: string | null
          user_id?: string | null
          content: string
          post_type?: 'comment' | 'revision' | 'elaboration' | 'annotation'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          topic_id?: string
          parent_id?: string | null
          user_id?: string | null
          content?: string
          post_type?: 'comment' | 'revision' | 'elaboration' | 'annotation'
          created_at?: string
          updated_at?: string
        }
      }
      activity_log: {
        Row: {
          id: string
          user_id: string | null
          action_type: string
          target_type: string | null
          target_id: string | null
          details: any
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action_type: string
          target_type?: string | null
          target_id?: string | null
          details?: any
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action_type?: string
          target_type?: string | null
          target_id?: string | null
          details?: any
          created_at?: string
        }
      }
    }
  }
}
