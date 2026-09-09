# RFC 0006 — Commons spaces: opt-in collaborative curation (cross-app pattern with Eva KGDJ)

**Status:** Accepted — Dustin Eirdosh, 2026-09-06, live session. Not designed in isolation — converged with the Eva KGDJ session (`eva-graph-dc`) on a shared cross-app pattern first, per Dustin's 2026-09-06 instruction to pause and align before either app implemented anything. See `eva-graph/docs/kgdj/04-commons-design.md` for KGDJ's own version of this same skeleton.
**Date:** 2026-09-06
**Supersedes:** RFC 0004 §3's `portfolio_shares.can_edit` extension — a plain edit-grant boolean turned out to be the wrong shape for what Dustin actually asked for (see Motivation). RFC 0004 §4 (`project_commons_links`/`commons_item_references`, project-to-project federation) is **unaffected** — that solves a different problem this RFC doesn't touch.

## Motivation

RFC 0004 §3 proposed extending `portfolio_shares` with a `can_edit` boolean so a department could jointly maintain one portfolio by direct write access. Dustin's actual requirement, surfaced when the same question came up for KGDJ (individual student subgraphs feeding into a shared "commons project" like the CCP MSc module — opt-in, role-gated, peer-reviewed, with per-contributor provenance, and improvements optionally pulled back into a contributor's own portfolio) is richer than direct write access: real collaborative curation needs propose → review → decide workflow with provenance, not just "anyone with a flag can edit directly."

That's a third entity — not a project, not a portfolio — and it's the same shape in both apps: many individual contributors feed into one opt-in, role-gated space; content there is proposed, reviewed, and decided on by people holding the right role; approved content is durable and queryable, not just a decision log; and a contributor can pull an approved item back into their own portfolio afterward. KGDJ's canonical-graph pipeline (`proposed_changes → reviews → editorial_decisions → apply_editorial_decision()`) already proved this shape works, including surviving real RLS-recursion debugging — this RFC reuses that shape rather than inventing a different one for OpenLPM.

## What's shared vs. what isn't

**Shared** (this RFC and KGDJ's §4 are the same design, adapted to each schema): `commons_spaces`/`commons_participants`/`commons_items`/`commons_links`/`commons_proposals`/`commons_reviews`/`commons_decisions`. Not shared *tables* — two Postgres databases — one shared template. Once settled, this pattern should live as its own design note (likely in `lab_manager`) with each app's schema referencing it instead of restating it.

**Not shared, unaffected by this RFC**: RFC 0004 §4's project-to-project Commons (`project_commons_links`/`commons_item_references`) has no KGDJ analog — KGDJ is single-tenant, one canonical graph, nothing to federate against. That mechanism (e.g. `sachsen-biologie` ⇄ `EvoMentor`) stays exactly as designed.

**A real asymmetry worth being explicit about**: KGDJ satisfies "every edit must carry per-contributor provenance" by attaching its existing generic `audit_row()` trigger to the new tables — zero new logging code. **OpenLPM has no equivalent mechanism today.** This RFC has to build generic audit infrastructure from scratch (§3 below) to satisfy the same requirement — this is real, foundational new work for OpenLPM, not a reuse story the way it is for KGDJ. The two apps' remaining effort here is not equal.

## Decisions

### 1. The shared skeleton, adapted to OpenLPM's schema

```
commons_spaces        (id, project_id nullable, label, description, join_policy, created_by, created_at)
  -- project_id nullable: null = a free-standing space not tied to one project (e.g. a cross-project
  -- researcher initiative). Single nullable parent, not multi-parent -- no stated need for a space
  -- spanning several projects; additive join-table migration later if that ever becomes real (same
  -- YAGNI call KGDJ made for module_id).
  -- join_policy: 'invite_only' | 'request_approval' | 'open_to_project_members'

commons_participants   (commons_space_id, user_id, role, status, joined_at, invited_by)
  -- role: 'viewer' | 'contributor' | 'reviewer' | 'steward' -- independently settable, not
  -- auto-derived from project_members.role, though space-creation UX can default-suggest 'steward'
  -- for the project's existing owner/maintainer (see §2, open question).
  -- status: 'invited' | 'requested' | 'active' -- only 'active' grants real access.

commons_items          (id, commons_space_id, kind, label, description, content jsonb, status,
                         created_by, updated_by, created_at, updated_at, provenance jsonb,
                         promoted_to_project_id nullable, promoted_to_data_object_id nullable)
  -- Durable current-state content -- what a commons-space UI actually renders, not a replay of
  -- commons_decisions history. Mirrors lpm_data_objects one level down.
  -- kind: open TEXT discriminator (not a rigid enum -- same call RFC 0005 made for record_type,
  -- for the same forward-compatibility reason), e.g. 'annotation' | 'resource' |
  -- 'proposed_framework_tag' | 'coherence_thread_candidate' | 'note'. OpenLPM's commons content is
  -- more heterogeneous than KGDJ's 5-kind subgraph_private_node vocabulary -- typed columns per kind
  -- would be premature; content is validated per-kind at the application layer (a JSON Schema per
  -- kind, same discipline as EvoMentor's importers), not by a DB constraint.
  -- promoted_to_*: set once a steward promotes this item into a real lpm_data_objects row (see §2.4).

commons_links          (id, commons_space_id, source_item_id, target_item_id, label, lens,
                         created_by, created_at)
  -- "connecting X to Y because..." at the commons-space level -- e.g. a Fachschaft noting two
  -- shared annotations address the same Basiskonzept from different angles.

commons_proposals      (id, commons_space_id, proposed_by, change_type, target_item_id nullable,
                         payload jsonb, rationale, status, review_restricted_to_role nullable, created_at)
  -- change_type (new enum, see below): add_item | edit_item | archive_item | add_link | edit_link |
  -- archive_link. target_item_id nullable: null for a new contribution, set when editing/archiving
  -- an existing commons_item.
  -- review_restricted_to_role: NULL (default) = any active participant may review this proposal;
  -- a role value ('reviewer'|'steward') = only participants holding at least that role may. Per
  -- Dustin's answer: "any active user can review unless the user selects 'only users with [role]
  -- can review this work.'" Chosen by the proposer per-proposal at submission time -- not a
  -- space-wide default, and not a fixed role gate the way the first joint draft assumed.

commons_reviews        (id, proposal_id, reviewer_id, rating, commentary_md, created_at)
  -- rating: 1-5 integer (CHECK constraint, not an enum -- OpenLPM has no existing 5-level rating
  -- enum to reuse the way KGDJ does; a plain checked integer is the honest equivalent, not a guess
  -- at KGDJ's exact label wording).
  -- reviewer must be an active commons_space participant, and additionally satisfy
  -- review_restricted_to_role if the proposal set one (see above).

commons_decisions      (id, proposal_id, decided_by, outcome, decided_at, rationale)
  -- decided_by must hold role 'steward'. outcome: 'approve' | 'reject' | 'request_revision' | 'archive'.
  -- A security-definer trigger on insert (outcome='approve') performs the actual write into
  -- commons_items/commons_links, stamps provenance, and writes to the new audit_log (see §3) in the
  -- same transaction.
```

**Reimport into portfolio**: `portfolio_items.target_type` (currently `'schema_element' | 'data_object'`) gains a third value, `'commons_item'`, with `target_id` pointing at a `commons_items` row — the exact reference-not-copy pattern already in migration 004, no new mechanism.

### 2. Decisions (resolved 2026-09-06)

1. **Skeleton: approved.**
2. **`commons_items.content` shape: open `kind` discriminator + universal columns + jsonb**, not loose-opaque and not fully typed-per-kind. See §1 above for the reasoning (OpenLPM's commons content is more heterogeneous than KGDJ's 5-kind vocabulary; per-kind validation lives at the application layer, not the DB).
3. **Review is open by default, restrictable per-proposal**: any active commons-space participant may review a proposal, unless its proposer set `review_restricted_to_role`, in which case only participants holding at least that role may. Not a space-wide role gate — a per-proposal choice made by whoever submitted it. This is a real, deliberate design (not just "no role gate at all") — see §1's `commons_proposals.review_restricted_to_role`.
4. **Promotion is real and deliberately not limited to "this project's canonical content."** Dustin's answer: "anything from any ecosystem can be submitted for review for promotion." Concretely: promotion materializes a `commons_item` into a real `lpm_data_objects` row — in the commons space's own project by default, or another project the promoting steward has rights in. This is deliberately the *only* promotion mechanism this RFC builds, not one of several: once a commons item becomes an ordinary `lpm_data_objects` row, everything that already exists — RFC 0002 §5's propose-a-PR-to-a-base-repo flow, RFC 0004 §4's project-to-project Commons reference — already lets it travel anywhere in the ecosystem Dustin means, without inventing bespoke promotion targets for each destination. `commons_items.promoted_to_project_id`/`promoted_to_data_object_id` (§1) record where it landed.
5. **Citations: optional for v1** (recommended, not yet explicitly confirmed) — no existing OpenLPM citation-rigor culture to match or diverge from.
6. **Leaderboard/consent: not applicable** — no leaderboard/gamification exists or is planned for OpenLPM.

### 3. New generic audit infrastructure (OpenLPM-specific — no KGDJ equivalent needed here, but this table is real new work, not a reuse story)

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  before_row JSONB,
  after_row JSONB
);

CREATE FUNCTION audit_row() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, row_id, action, changed_by, before_row, after_row)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    lower(TG_OP),
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

Every `commons_*` table gets `AFTER INSERT OR UPDATE OR DELETE ... FOR EACH ROW EXECUTE FUNCTION audit_row()`. This is what actually satisfies "every edit carries per-contributor provenance" — per-row `created_by`/`updated_by` give the current-state answer, `audit_log` gives the full history, same fidelity KGDJ already has for `nodes`/`edges`. Worth deciding separately (not blocking this RFC) whether to retrofit this onto OpenLPM's *existing* tables too, now that the mechanism exists — flagged, not resolved here.

## Explicitly out of scope for v1

Same list as KGDJ's, for the same reasons: real-time co-editing/conflict resolution (last-editor-wins + full `audit_log` history is enough for this pace of collaboration), a dedicated version-history UI (the data exists from day one; a browsing UI is separate later work), multi-parent commons spaces (YAGNI, additive later if real).

## Implementation plan

1. Confirm §2's open decisions with Dustin (same round as KGDJ's own §6, ideally — side-by-side answers keep the two apps' patterns from drifting on the details even though the skeleton is shared).
2. Migration: the tables in §1 plus §3's audit infrastructure, RLS helpers (`is_commons_participant()`, `commons_role_at_least()`) mirroring RFC 0002's `is_project_member()`/`has_project_role()` pattern, RLS policies, the promotion trigger, the `portfolio_items.target_type` addition.
3. UI: a commons-space page (list spaces, join-request flow, propose/review/decide), and the "reimport to portfolio" action from a commons item.
