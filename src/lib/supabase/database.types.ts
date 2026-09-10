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
          target_type: 'schema_element' | 'data_object' | 'connection' | 'thread'
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
          target_type: 'schema_element' | 'data_object' | 'connection' | 'thread'
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
          target_type?: 'schema_element' | 'data_object' | 'connection' | 'thread'
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
          reviewable_type: 'literature_reference' | 'lpm_data_object' | 'lpm_connection' | 'lpm_thread'
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
          reviewable_type: 'literature_reference' | 'lpm_data_object' | 'lpm_connection' | 'lpm_thread'
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
          reviewable_type?: 'literature_reference' | 'lpm_data_object' | 'lpm_connection' | 'lpm_thread'
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
          project_id: string
          user_id: string | null
          action_type: string
          target_type: string | null
          target_id: string | null
          details: any
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id?: string | null
          action_type: string
          target_type?: string | null
          target_id?: string | null
          details?: any
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string | null
          action_type?: string
          target_type?: string | null
          target_id?: string | null
          details?: any
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey",
            columns: ["user_id"],
            isOneToOne: false,
            referencedRelation: "users",
            referencedColumns: ["id"]
          }
        ]
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
          parent_project_id: string | null
          focus_type: 'regional' | 'thematic' | 'general'
          region_tags: string[]
          theme_tags: string[]
          working_languages: string[]
          // Draft vs. established -- migration 016. Distinct from
          // epistemic_status (is this content real vs. a thought
          // experiment): maturity is "how far along is this Project," not
          // "how real is its content." Folds the old branch-then-promote
          // mechanism into a plain status flip on a Project already nested
          // where it belongs (parent_project_id).
          maturity: 'draft' | 'established'
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
          parent_project_id?: string | null
          focus_type?: 'regional' | 'thematic' | 'general'
          region_tags?: string[]
          theme_tags?: string[]
          working_languages?: string[]
          maturity?: 'draft' | 'established'
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
          parent_project_id?: string | null
          focus_type?: 'regional' | 'thematic' | 'general'
          region_tags?: string[]
          theme_tags?: string[]
          working_languages?: string[]
          maturity?: 'draft' | 'established'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_parent_project_id_fkey",
            columns: ["parent_project_id"],
            isOneToOne: false,
            referencedRelation: "projects",
            referencedColumns: ["id"]
          }
        ]
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
      project_invites: {
        Row: {
          id: string
          project_id: string
          email: string
          role: 'owner' | 'maintainer' | 'editor' | 'reviewer' | 'contributor' | 'viewer'
          invited_by: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          email: string
          role?: 'owner' | 'maintainer' | 'editor' | 'reviewer' | 'contributor' | 'viewer'
          invited_by?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          email?: string
          role?: 'owner' | 'maintainer' | 'editor' | 'reviewer' | 'contributor' | 'viewer'
          invited_by?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invites_project_id_fkey",
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
        Relationships: [
          {
            foreignKeyName: "portfolio_shares_user_id_fkey",
            columns: ["user_id"],
            isOneToOne: false,
            referencedRelation: "users",
            referencedColumns: ["id"]
          }
        ]
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
      lpm_connections: {
        Row: {
          id: string
          project_id: string
          branch_id: string | null
          from_object_id: string
          to_object_id: string
          relation_type: string
          kind: 'asserted' | 'suggested'
          rationale: string | null
          status: 'proposed' | 'under_review' | 'accepted' | 'rejected'
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          branch_id?: string | null
          from_object_id: string
          to_object_id: string
          relation_type?: string
          kind: 'asserted' | 'suggested'
          rationale?: string | null
          status?: 'proposed' | 'under_review' | 'accepted' | 'rejected'
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          branch_id?: string | null
          from_object_id?: string
          to_object_id?: string
          relation_type?: string
          kind?: 'asserted' | 'suggested'
          rationale?: string | null
          status?: 'proposed' | 'under_review' | 'accepted' | 'rejected'
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lpm_connections_from_object_id_fkey",
            columns: ["from_object_id"],
            isOneToOne: false,
            referencedRelation: "lpm_data_objects",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lpm_connections_to_object_id_fkey",
            columns: ["to_object_id"],
            isOneToOne: false,
            referencedRelation: "lpm_data_objects",
            referencedColumns: ["id"]
          }
        ]
      }
      lpm_threads: {
        Row: {
          id: string
          project_id: string
          branch_id: string | null
          slug: string
          title: string
          thread_type: 'vertical' | 'horizontal' | 'vertical_horizontal'
          explained_by_element_id: string | null
          connecting_idea: string
          narrative: string
          teaching_prompt: string | null
          evidence_note: string | null
          gaps: string[]
          status: 'proposed' | 'under_review' | 'accepted' | 'rejected'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          branch_id?: string | null
          slug: string
          title: string
          thread_type: 'vertical' | 'horizontal' | 'vertical_horizontal'
          explained_by_element_id?: string | null
          connecting_idea: string
          narrative: string
          teaching_prompt?: string | null
          evidence_note?: string | null
          gaps?: string[]
          status?: 'proposed' | 'under_review' | 'accepted' | 'rejected'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          branch_id?: string | null
          slug?: string
          title?: string
          thread_type?: 'vertical' | 'horizontal' | 'vertical_horizontal'
          explained_by_element_id?: string | null
          connecting_idea?: string
          narrative?: string
          teaching_prompt?: string | null
          evidence_note?: string | null
          gaps?: string[]
          status?: 'proposed' | 'under_review' | 'accepted' | 'rejected'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lpm_threads_explained_by_element_id_fkey",
            columns: ["explained_by_element_id"],
            isOneToOne: false,
            referencedRelation: "lpm_schema_elements",
            referencedColumns: ["id"]
          }
        ]
      }
      lpm_thread_stations: {
        Row: {
          id: string
          thread_id: string
          data_object_id: string
          sequence: number
          role_note: string
          via_element_id: string | null
          relation_to_next: string | null
        }
        Insert: {
          id?: string
          thread_id: string
          data_object_id: string
          sequence: number
          role_note: string
          via_element_id?: string | null
          relation_to_next?: string | null
        }
        Update: {
          id?: string
          thread_id?: string
          data_object_id?: string
          sequence?: number
          role_note?: string
          via_element_id?: string | null
          relation_to_next?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lpm_thread_stations_thread_id_fkey",
            columns: ["thread_id"],
            isOneToOne: false,
            referencedRelation: "lpm_threads",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lpm_thread_stations_data_object_id_fkey",
            columns: ["data_object_id"],
            isOneToOne: false,
            referencedRelation: "lpm_data_objects",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lpm_thread_stations_via_element_id_fkey",
            columns: ["via_element_id"],
            isOneToOne: false,
            referencedRelation: "lpm_schema_elements",
            referencedColumns: ["id"]
          }
        ]
      }
      lpm_object_tags: {
        Row: {
          id: string
          project_id: string
          data_object_id: string
          schema_element_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          data_object_id: string
          schema_element_id: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          data_object_id?: string
          schema_element_id?: string
          role?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lpm_object_tags_data_object_id_fkey",
            columns: ["data_object_id"],
            isOneToOne: false,
            referencedRelation: "lpm_data_objects",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lpm_object_tags_schema_element_id_fkey",
            columns: ["schema_element_id"],
            isOneToOne: false,
            referencedRelation: "lpm_schema_elements",
            referencedColumns: ["id"]
          }
        ]
      }
      lpm_coherence_reviews: {
        Row: {
          id: string
          project_id: string
          branch_id: string | null
          axis: string
          scope_a: any
          scope_b: any
          note: string
          reviewed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          branch_id?: string | null
          axis: string
          scope_a: any
          scope_b: any
          note: string
          reviewed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          branch_id?: string | null
          axis?: string
          scope_a?: any
          scope_b?: any
          note?: string
          reviewed_by?: string | null
          created_at?: string
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
