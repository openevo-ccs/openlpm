export type Database = {
  public: {
    // @supabase/postgrest-js's GenericSchema requires all three keys (even
    // empty) -- without Views/Functions the whole Database type fails its
    // generic constraint and every query resolves to `never`.
    Views: Record<string, never>
    Functions: Record<string, never>
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
        Relationships: []
      }
      literature_references: {
        Row: {
          id: string
          project_id: string
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
          project_id: string
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
          project_id?: string
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
        Relationships: []
      }
      lpm_schema_elements: {
        Row: {
          id: string
          project_id: string
          branch_id: string | null
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
          project_id: string
          branch_id?: string | null
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
          project_id?: string
          branch_id?: string | null
          element_type?: 'concept' | 'competency' | 'grade_band' | 'assessment'
          label?: string
          definition?: string | null
          parent_id?: string | null
          metadata?: any
          status?: 'proposed' | 'discussed' | 'accepted' | 'deprecated'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lpm_data_objects: {
        Row: {
          id: string
          project_id: string
          branch_id: string | null
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
          project_id: string
          branch_id?: string | null
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
          project_id?: string
          branch_id?: string | null
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
        Relationships: []
      }
      evidence_links: {
        Row: {
          id: string
          project_id: string
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
          project_id: string
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
          project_id?: string
          target_type?: 'schema_element' | 'data_object'
          target_id?: string
          reference_id?: string | null
          evidence_type?: 'supports' | 'challenges' | 'contextualizes'
          relevance_score?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      peer_review_assignments: {
        Row: {
          id: string
          project_id: string
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
          project_id: string
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
          project_id?: string
          reviewable_type?: 'literature_reference' | 'lpm_data_object'
          reviewable_id?: string
          reviewer_id?: string | null
          status?: 'pending' | 'in_progress' | 'completed'
          recommendation?: 'accept' | 'reject' | 'revise' | 'major_revision' | null
          review_text?: string | null
          submitted_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      discussion_topics: {
        Row: {
          id: string
          project_id: string
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
          project_id: string
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
          project_id?: string
          title?: string
          description?: string | null
          category?: string | null
          linked_type?: 'schema_element' | 'data_object' | 'literature_reference' | null
          linked_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          slug: string
          name: string
          description: string | null
          status: 'planning' | 'active' | 'paused' | 'completed' | 'discontinued'
          epistemic_status: 'designed-thought-experiment' | 'field-validated-curriculum' | 'in-development'
          epistemic_status_note: string | null
          projectbase_ref: string | null
          hosting_mode: 'hosted' | 'self-hosted'
          promoted_from_branch_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          description?: string | null
          status?: 'planning' | 'active' | 'paused' | 'completed' | 'discontinued'
          epistemic_status: 'designed-thought-experiment' | 'field-validated-curriculum' | 'in-development'
          epistemic_status_note?: string | null
          projectbase_ref?: string | null
          hosting_mode?: 'hosted' | 'self-hosted'
          promoted_from_branch_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          description?: string | null
          status?: 'planning' | 'active' | 'paused' | 'completed' | 'discontinued'
          epistemic_status?: 'designed-thought-experiment' | 'field-validated-curriculum' | 'in-development'
          epistemic_status_note?: string | null
          projectbase_ref?: string | null
          hosting_mode?: 'hosted' | 'self-hosted'
          promoted_from_branch_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: 'owner' | 'maintainer' | 'editor' | 'reviewer' | 'contributor' | 'viewer'
          invited_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role?: 'owner' | 'maintainer' | 'editor' | 'reviewer' | 'contributor' | 'viewer'
          invited_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: 'owner' | 'maintainer' | 'editor' | 'reviewer' | 'contributor' | 'viewer'
          invited_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey",
            columns: ["project_id"],
            isOneToOne: false,
            referencedRelation: "projects",
            referencedColumns: ["id"]
          }
        ]
      }
      branches: {
        Row: {
          id: string
          project_id: string
          slug: string
          label: string
          description: string | null
          is_trunk: boolean
          forked_from_branch_id: string | null
          fork_rationale: string | null
          status: 'active' | 'promoted' | 'merged' | 'archived'
          promoted_to_project_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          slug: string
          label: string
          description?: string | null
          is_trunk?: boolean
          forked_from_branch_id?: string | null
          fork_rationale?: string | null
          status?: 'active' | 'promoted' | 'merged' | 'archived'
          promoted_to_project_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          slug?: string
          label?: string
          description?: string | null
          is_trunk?: boolean
          forked_from_branch_id?: string | null
          fork_rationale?: string | null
          status?: 'active' | 'promoted' | 'merged' | 'archived'
          promoted_to_project_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_base_links: {
        Row: {
          id: string
          project_id: string
          base_repo: 'conceptbase' | 'theorybase' | 'questionbase' | 'literaturebase' | 'competencybase' | 'methodsbase' | 'quotebase' | 'humanbase' | 'projectbase' | 'teachingbase'
          can_import: boolean
          can_propose_pr: boolean
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          base_repo: 'conceptbase' | 'theorybase' | 'questionbase' | 'literaturebase' | 'competencybase' | 'methodsbase' | 'quotebase' | 'humanbase' | 'projectbase' | 'teachingbase'
          can_import?: boolean
          can_propose_pr?: boolean
          added_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          base_repo?: 'conceptbase' | 'theorybase' | 'questionbase' | 'literaturebase' | 'competencybase' | 'methodsbase' | 'quotebase' | 'humanbase' | 'projectbase' | 'teachingbase'
          can_import?: boolean
          can_propose_pr?: boolean
          added_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          id: string
          project_id: string
          owner_id: string
          name: string
          description: string | null
          visibility: 'private' | 'shared' | 'project'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          owner_id: string
          name: string
          description?: string | null
          visibility?: 'private' | 'shared' | 'project'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          owner_id?: string
          name?: string
          description?: string | null
          visibility?: 'private' | 'shared' | 'project'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_shares: {
        Row: {
          id: string
          portfolio_id: string
          user_id: string
          can_review: boolean
          created_at: string
        }
        Insert: {
          id?: string
          portfolio_id: string
          user_id: string
          can_review?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          portfolio_id?: string
          user_id?: string
          can_review?: boolean
          created_at?: string
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          id: string
          portfolio_id: string
          target_type: 'schema_element' | 'data_object'
          target_id: string
          custom_annotation: string | null
          pos_x: number | null
          pos_y: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          portfolio_id: string
          target_type: 'schema_element' | 'data_object'
          target_id: string
          custom_annotation?: string | null
          pos_x?: number | null
          pos_y?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          portfolio_id?: string
          target_type?: 'schema_element' | 'data_object'
          target_id?: string
          custom_annotation?: string | null
          pos_x?: number | null
          pos_y?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_private_nodes: {
        Row: {
          id: string
          portfolio_id: string
          node_type: 'note' | 'question' | 'draft_concept' | 'draft_lesson'
          label: string
          content: string | null
          pos_x: number | null
          pos_y: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          portfolio_id: string
          node_type: 'note' | 'question' | 'draft_concept' | 'draft_lesson'
          label: string
          content?: string | null
          pos_x?: number | null
          pos_y?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          portfolio_id?: string
          node_type?: 'note' | 'question' | 'draft_concept' | 'draft_lesson'
          label?: string
          content?: string | null
          pos_x?: number | null
          pos_y?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_links: {
        Row: {
          id: string
          portfolio_id: string
          from_item_id: string | null
          from_private_id: string | null
          to_item_id: string | null
          to_private_id: string | null
          label: string | null
          rationale: string | null
          created_at: string
        }
        Insert: {
          id?: string
          portfolio_id: string
          from_item_id?: string | null
          from_private_id?: string | null
          to_item_id?: string | null
          to_private_id?: string | null
          label?: string | null
          rationale?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          portfolio_id?: string
          from_item_id?: string | null
          from_private_id?: string | null
          to_item_id?: string | null
          to_private_id?: string | null
          label?: string | null
          rationale?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
  }
}
