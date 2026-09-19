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
          reviewable_type: 'literature_reference' | 'lpm_data_object' | 'lpm_connection' | 'lpm_thread' | 'framework_tag' | 'theory' | 'portfolio_item' | 'portfolio_private_node'
          reviewable_id: string
          reviewer_id: string | null
          submitted_by: string | null
          status: 'pending' | 'in_progress' | 'completed'
          recommendation: 'accept' | 'reject' | 'revise' | 'major_revision' | null
          review_text: string | null
          submitted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          reviewable_type: 'literature_reference' | 'lpm_data_object' | 'lpm_connection' | 'lpm_thread' | 'framework_tag' | 'theory' | 'portfolio_item' | 'portfolio_private_node'
          reviewable_id: string
          reviewer_id?: string | null
          submitted_by?: string | null
          status?: 'pending' | 'in_progress' | 'completed'
          recommendation?: 'accept' | 'reject' | 'revise' | 'major_revision' | null
          review_text?: string | null
          submitted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          reviewable_type?: 'literature_reference' | 'lpm_data_object' | 'lpm_connection' | 'lpm_thread' | 'framework_tag' | 'theory' | 'portfolio_item' | 'portfolio_private_node'
          reviewable_id?: string
          reviewer_id?: string | null
          submitted_by?: string | null
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
          // Whether the project's own existence/name/description is visible
          // to any signed-in user (false, the default) or only to its
          // members and creator (true) -- migration 025. Independent of
          // hosting_mode: this is about who can see it, not where it runs.
          is_private: boolean
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
          // Which grade-band framework (the seeded ISCED reference, another
          // project's real scheme, or a custom one) this project's content
          // is sequenced against -- migration 019.
          grade_framework_id: string | null
          // Which prompt_template_libraries row the KI-Prompt-Generator
          // defaults to for this project -- migration 029. Nullable: falls
          // back to whichever library has is_default=true for the
          // project's own working_languages[0], resolved app-side.
          prompt_template_library_id: string | null
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
          is_private?: boolean
          promoted_from_branch_id?: string | null
          parent_project_id?: string | null
          focus_type?: 'regional' | 'thematic' | 'general'
          region_tags?: string[]
          theme_tags?: string[]
          working_languages?: string[]
          maturity?: 'draft' | 'established'
          grade_framework_id?: string | null
          prompt_template_library_id?: string | null
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
          is_private?: boolean
          promoted_from_branch_id?: string | null
          parent_project_id?: string | null
          focus_type?: 'regional' | 'thematic' | 'general'
          region_tags?: string[]
          theme_tags?: string[]
          working_languages?: string[]
          maturity?: 'draft' | 'established'
          grade_framework_id?: string | null
          prompt_template_library_id?: string | null
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
          },
          {
            foreignKeyName: "projects_grade_framework_id_fkey",
            columns: ["grade_framework_id"],
            isOneToOne: false,
            referencedRelation: "frameworks",
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

      // ======================================================================
      // Migrations 018-020 (2026-09-13 restructure): frameworks/crosswalks,
      // standards versioning, structured project scope, theories, strand
      // nesting, and discussion tagging. See those migration files' own
      // comments for the full rationale.
      // ======================================================================

      frameworks: {
        Row: {
          id: string
          project_id: string | null
          framework_type: 'concept-taxonomy' | 'subject-area' | 'grade-band'
          framework_key: string
          label: string
          source: string | null
          version_note: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          framework_type: 'concept-taxonomy' | 'subject-area' | 'grade-band'
          framework_key: string
          label: string
          source?: string | null
          version_note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          framework_type?: 'concept-taxonomy' | 'subject-area' | 'grade-band'
          framework_key?: string
          label?: string
          source?: string | null
          version_note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "frameworks_project_id_fkey",
            columns: ["project_id"],
            isOneToOne: false,
            referencedRelation: "projects",
            referencedColumns: ["id"]
          }
        ]
      }
      framework_tags: {
        Row: {
          id: string
          framework_id: string
          tag_key: string
          label: string
          parent_tag_id: string | null
          definition: string | null
          sort_order: number | null
          created_at: string
        }
        Insert: {
          id?: string
          framework_id: string
          tag_key: string
          label: string
          parent_tag_id?: string | null
          definition?: string | null
          sort_order?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          framework_id?: string
          tag_key?: string
          label?: string
          parent_tag_id?: string | null
          definition?: string | null
          sort_order?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_tags_framework_id_fkey",
            columns: ["framework_id"],
            isOneToOne: false,
            referencedRelation: "frameworks",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_tags_parent_tag_id_fkey",
            columns: ["parent_tag_id"],
            isOneToOne: false,
            referencedRelation: "framework_tags",
            referencedColumns: ["id"]
          }
        ]
      }
      framework_crosswalks: {
        Row: {
          id: string
          from_tag_id: string
          to_tag_id: string
          relation_type: 'exactMatch' | 'broadMatch' | 'narrowMatch' | 'relatedMatch'
          confidence: 'exact' | 'approximate' | 'structural' | 'none'
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          from_tag_id: string
          to_tag_id: string
          relation_type?: 'exactMatch' | 'broadMatch' | 'narrowMatch' | 'relatedMatch'
          confidence: 'exact' | 'approximate' | 'structural' | 'none'
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          from_tag_id?: string
          to_tag_id?: string
          relation_type?: 'exactMatch' | 'broadMatch' | 'narrowMatch' | 'relatedMatch'
          confidence?: 'exact' | 'approximate' | 'structural' | 'none'
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_crosswalks_from_tag_id_fkey",
            columns: ["from_tag_id"],
            isOneToOne: false,
            referencedRelation: "framework_tags",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_crosswalks_to_tag_id_fkey",
            columns: ["to_tag_id"],
            isOneToOne: false,
            referencedRelation: "framework_tags",
            referencedColumns: ["id"]
          }
        ]
      }
      standards_documents: {
        Row: {
          id: string
          project_id: string
          jurisdiction: string | null
          subject: string | null
          school_type: string | null
          grade_range: string | null
          version_label: string
          adoption_status: 'mandated' | 'optional'
          source_file: string | null
          format: string | null
          license_or_rights_note: string | null
          supersedes_document_id: string | null
          adopted_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          jurisdiction?: string | null
          subject?: string | null
          school_type?: string | null
          grade_range?: string | null
          version_label: string
          adoption_status?: 'mandated' | 'optional'
          source_file?: string | null
          format?: string | null
          license_or_rights_note?: string | null
          supersedes_document_id?: string | null
          adopted_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          jurisdiction?: string | null
          subject?: string | null
          school_type?: string | null
          grade_range?: string | null
          version_label?: string
          adoption_status?: 'mandated' | 'optional'
          source_file?: string | null
          format?: string | null
          license_or_rights_note?: string | null
          supersedes_document_id?: string | null
          adopted_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "standards_documents_project_id_fkey",
            columns: ["project_id"],
            isOneToOne: false,
            referencedRelation: "projects",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standards_documents_supersedes_document_id_fkey",
            columns: ["supersedes_document_id"],
            isOneToOne: false,
            referencedRelation: "standards_documents",
            referencedColumns: ["id"]
          }
        ]
      }
      standards_item_changes: {
        Row: {
          id: string
          from_item_id: string | null
          to_item_id: string | null
          change_type: 'content-added' | 'content-removed' | 'wording-refinement' | 'wording-simplification' | 'example-changed' | 'restructured' | 'grade-band-split'
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          from_item_id?: string | null
          to_item_id?: string | null
          change_type: 'content-added' | 'content-removed' | 'wording-refinement' | 'wording-simplification' | 'example-changed' | 'restructured' | 'grade-band-split'
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          from_item_id?: string | null
          to_item_id?: string | null
          change_type?: 'content-added' | 'content-removed' | 'wording-refinement' | 'wording-simplification' | 'example-changed' | 'restructured' | 'grade-band-split'
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "standards_item_changes_from_item_id_fkey",
            columns: ["from_item_id"],
            isOneToOne: false,
            referencedRelation: "lpm_data_objects",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standards_item_changes_to_item_id_fkey",
            columns: ["to_item_id"],
            isOneToOne: false,
            referencedRelation: "lpm_data_objects",
            referencedColumns: ["id"]
          }
        ]
      }
      standards_item_framework_relevance: {
        Row: {
          id: string
          item_id: string
          framework_tag_id: string
          relevance: number
          justification: string | null
          related_tag_ids: string[]
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          framework_tag_id: string
          relevance: number
          justification?: string | null
          related_tag_ids?: string[]
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          framework_tag_id?: string
          relevance?: number
          justification?: string | null
          related_tag_ids?: string[]
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "standards_item_framework_relevance_item_id_fkey",
            columns: ["item_id"],
            isOneToOne: false,
            referencedRelation: "lpm_data_objects",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standards_item_framework_relevance_framework_tag_id_fkey",
            columns: ["framework_tag_id"],
            isOneToOne: false,
            referencedRelation: "framework_tags",
            referencedColumns: ["id"]
          }
        ]
      }
      project_jurisdictions: {
        Row: {
          id: string
          project_id: string
          country_code: string
          region_code: string | null
          label: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          country_code: string
          region_code?: string | null
          label: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          country_code?: string
          region_code?: string | null
          label?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_jurisdictions_project_id_fkey",
            columns: ["project_id"],
            isOneToOne: false,
            referencedRelation: "projects",
            referencedColumns: ["id"]
          }
        ]
      }
      project_subject_area_tags: {
        Row: {
          id: string
          project_id: string
          framework_tag_id: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          framework_tag_id: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          framework_tag_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_subject_area_tags_project_id_fkey",
            columns: ["project_id"],
            isOneToOne: false,
            referencedRelation: "projects",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_subject_area_tags_framework_tag_id_fkey",
            columns: ["framework_tag_id"],
            isOneToOne: false,
            referencedRelation: "framework_tags",
            referencedColumns: ["id"]
          }
        ]
      }
      project_source_declarations: {
        Row: {
          id: string
          project_id: string
          source_name: string
          format: string | null
          license_or_rights_note: string | null
          url: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          source_name: string
          format?: string | null
          license_or_rights_note?: string | null
          url?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          source_name?: string
          format?: string | null
          license_or_rights_note?: string | null
          url?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_source_declarations_project_id_fkey",
            columns: ["project_id"],
            isOneToOne: false,
            referencedRelation: "projects",
            referencedColumns: ["id"]
          }
        ]
      }
      theories: {
        Row: {
          id: string
          project_id: string
          label: string
          description: string
          evidentiary_maturity: 'theoretically-developed' | 'empirically-recovered' | 'tested-against-alternatives' | 'efficacy-demonstrated' | null
          evidentiary_maturity_note: string | null
          base_repo: 'conceptbase' | 'theorybase' | 'questionbase' | 'literaturebase' | 'competencybase' | 'methodsbase' | 'quotebase' | 'humanbase' | 'projectbase' | 'teachingbase' | null
          base_repo_ref: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          label: string
          description: string
          evidentiary_maturity?: 'theoretically-developed' | 'empirically-recovered' | 'tested-against-alternatives' | 'efficacy-demonstrated' | null
          evidentiary_maturity_note?: string | null
          base_repo?: 'conceptbase' | 'theorybase' | 'questionbase' | 'literaturebase' | 'competencybase' | 'methodsbase' | 'quotebase' | 'humanbase' | 'projectbase' | 'teachingbase' | null
          base_repo_ref?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          label?: string
          description?: string
          evidentiary_maturity?: 'theoretically-developed' | 'empirically-recovered' | 'tested-against-alternatives' | 'efficacy-demonstrated' | null
          evidentiary_maturity_note?: string | null
          base_repo?: 'conceptbase' | 'theorybase' | 'questionbase' | 'literaturebase' | 'competencybase' | 'methodsbase' | 'quotebase' | 'humanbase' | 'projectbase' | 'teachingbase' | null
          base_repo_ref?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "theories_project_id_fkey",
            columns: ["project_id"],
            isOneToOne: false,
            referencedRelation: "projects",
            referencedColumns: ["id"]
          }
        ]
      }
      theory_literature_links: {
        Row: {
          id: string
          theory_id: string
          reference_id: string
          relation_type: 'theoretical-clarification' | 'empirical-support' | 'empirical-challenge'
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          theory_id: string
          reference_id: string
          relation_type: 'theoretical-clarification' | 'empirical-support' | 'empirical-challenge'
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          theory_id?: string
          reference_id?: string
          relation_type?: 'theoretical-clarification' | 'empirical-support' | 'empirical-challenge'
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "theory_literature_links_theory_id_fkey",
            columns: ["theory_id"],
            isOneToOne: false,
            referencedRelation: "theories",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theory_literature_links_reference_id_fkey",
            columns: ["reference_id"],
            isOneToOne: false,
            referencedRelation: "literature_references",
            referencedColumns: ["id"]
          }
        ]
      }
      theory_relations: {
        Row: {
          id: string
          theory_id: string
          target_type: 'framework_tag' | 'schema_element' | 'data_object' | 'thread'
          target_id: string
          relation_label: string
          annotation: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          theory_id: string
          target_type: 'framework_tag' | 'schema_element' | 'data_object' | 'thread'
          target_id: string
          relation_label: string
          annotation?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          theory_id?: string
          target_type?: 'framework_tag' | 'schema_element' | 'data_object' | 'thread'
          target_id?: string
          relation_label?: string
          annotation?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "theory_relations_theory_id_fkey",
            columns: ["theory_id"],
            isOneToOne: false,
            referencedRelation: "theories",
            referencedColumns: ["id"]
          }
        ]
      }
      strand_parents: {
        Row: {
          id: string
          strand_id: string
          parent_strand_id: string
          created_at: string
        }
        Insert: {
          id?: string
          strand_id: string
          parent_strand_id: string
          created_at?: string
        }
        Update: {
          id?: string
          strand_id?: string
          parent_strand_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strand_parents_strand_id_fkey",
            columns: ["strand_id"],
            isOneToOne: false,
            referencedRelation: "lpm_threads",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strand_parents_parent_strand_id_fkey",
            columns: ["parent_strand_id"],
            isOneToOne: false,
            referencedRelation: "lpm_threads",
            referencedColumns: ["id"]
          }
        ]
      }
      discussion_topic_tags: {
        Row: {
          id: string
          topic_id: string
          tag: string
          created_at: string
        }
        Insert: {
          id?: string
          topic_id: string
          tag: string
          created_at?: string
        }
        Update: {
          id?: string
          topic_id?: string
          tag?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_topic_tags_topic_id_fkey",
            columns: ["topic_id"],
            isOneToOne: false,
            referencedRelation: "discussion_topics",
            referencedColumns: ["id"]
          }
        ]
      }
      tutorials: {
        Row: {
          id: string
          project_id: string | null
          title: string
          description: string | null
          steps: any
          sort_order: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          title: string
          description?: string | null
          steps?: any
          sort_order?: number
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          title?: string
          description?: string | null
          steps?: any
          sort_order?: number
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorials_project_id_fkey",
            columns: ["project_id"],
            isOneToOne: false,
            referencedRelation: "projects",
            referencedColumns: ["id"]
          }
        ]
      }
      prompt_template_libraries: {
        Row: {
          id: string
          label: string
          language: string
          subject_area: string | null
          role_preamble: string
          instruction_preamble: string
          section_labels: any
          option_lists: any
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          language: string
          subject_area?: string | null
          role_preamble: string
          instruction_preamble: string
          section_labels?: any
          option_lists?: any
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          language?: string
          subject_area?: string | null
          role_preamble?: string
          instruction_preamble?: string
          section_labels?: any
          option_lists?: any
          is_default?: boolean
          created_at?: string
        }
        Relationships: []
      }
      prompt_experiments: {
        Row: {
          id: string
          project_id: string
          portfolio_id: string | null
          created_by: string | null
          visibility: 'private' | 'shared' | 'project'
          config: any
          prompt_text: string
          llm_name: string | null
          llm_output: string | null
          evaluation_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          portfolio_id?: string | null
          created_by?: string | null
          visibility?: 'private' | 'shared' | 'project'
          config?: any
          prompt_text: string
          llm_name?: string | null
          llm_output?: string | null
          evaluation_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          portfolio_id?: string | null
          created_by?: string | null
          visibility?: 'private' | 'shared' | 'project'
          config?: any
          prompt_text?: string
          llm_name?: string | null
          llm_output?: string | null
          evaluation_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_experiments_project_id_fkey",
            columns: ["project_id"],
            isOneToOne: false,
            referencedRelation: "projects",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_experiments_portfolio_id_fkey",
            columns: ["portfolio_id"],
            isOneToOne: false,
            referencedRelation: "portfolios",
            referencedColumns: ["id"]
          }
        ]
      }
      feedback: {
        Row: {
          id: string
          user_id: string | null
          project_id: string | null
          tag: 'Problem' | 'Request' | 'Other'
          comment: string | null
          context: any
          screenshot_path: string | null
          status: 'open' | 'resolved'
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          project_id?: string | null
          tag?: 'Problem' | 'Request' | 'Other'
          comment?: string | null
          context?: any
          screenshot_path?: string | null
          status?: 'open' | 'resolved'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          project_id?: string | null
          tag?: 'Problem' | 'Request' | 'Other'
          comment?: string | null
          context?: any
          screenshot_path?: string | null
          status?: 'open' | 'resolved'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_project_id_fkey",
            columns: ["project_id"],
            isOneToOne: false,
            referencedRelation: "projects",
            referencedColumns: ["id"]
          }
        ]
      }
    }
  }
}
