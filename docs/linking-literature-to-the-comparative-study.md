# Linking a paper to the Bio-Core / Interdisciplinary comparative study

Status: real, working process, used twice (migration 149, 2026-10-20; migration 163,
2026-10-23). Written so a future session doesn't have to re-derive it from migration
archaeology each time. If a third use finds this doc no longer matches reality, fix the doc
in the same PR rather than silently diverging from it.

## What this is for

`bio-core-lpm-synth` and `interdisciplinary-lpm-synth` are the two synthetic LPMs this lab
uses to study a real, documented disagreement in evolution-education research — a
decentralized-causation framing (DCR) versus an agency-inclusive one (ICR), formalized in
`lpm_comparative_links`, `lpm_divergence_reviews` and the `lpm_project_comparison_profile`
view (migration 143). This doc covers a narrower, simpler thing: adding a paper from
LiteratureBase to one or both projects' `literature_references`, with a real, specific note
explaining *why it matters to this comparative study*. A bare citation isn't enough. "Concise,
rigorous and accessible" is the bar for that note — it should make sense to someone who
hasn't read the paper, in 3-5 sentences, without hand-waving.

## The mechanism, and when to use it versus the alternatives

- **`literature_references.notes`** (this doc's mechanism): a free-text field on a
  project-scoped literature row. Use this for a paper whose relevance is explanatory —
  it illuminates why a project's framing is what it is, or why the comparison matters — even
  when it isn't the primary source that defines the project's own theoretical position.
- **`theory_literature_links`**: reserved for a theory's own primary/supporting sources —
  the paper(s) that actually state or empirically ground a specific `theories` row (see
  migration 140's use for DCR and ICR's own defining papers). Use this when the paper
  genuinely is a primary source for an existing theory, beyond merely being related to it.
- **`lpm_comparative_links`**: reserved for a specific strand-to-strand connection tied to a
  named TheoryBase `Divergence` record (migration 143). Not for a literature reference at
  all — use it when the new content is a structural link between two `lpm_data_objects`.

A paper can ground an existing theory (write the note as "Grounds this project's '<theory
label>' theory: <why>", migration 149's own convention) **or** relate to the comparative
study more generally without fitting any one existing theory (write the note plainly as
what it actually is — migration 163's Bio-Core note did this, since the paper isn't a DCR
primary source). Don't force a theory-grounding frame onto a paper that doesn't actually fit
one; an honest, differently-worded note is better than a misleading one that reuses the
convention phrase just for consistency.

## Known ids (re-verify live before trusting — these can go stale)

- `bio-core-lpm-synth`: `28997544-0d87-4b05-9ee2-7c474513c108`
- `interdisciplinary-lpm-synth`: `371fce26-d1f3-439b-95df-0a0e38b8a824`
- Re-derive any time with `GET /rest/v1/projects?slug=in.(bio-core-lpm-synth,interdisciplinary-lpm-synth)&select=id,slug,name`
- List a project's existing `theories` (to check for a real grounding fit before writing a
  generic note) with `GET /rest/v1/theories?project_id=eq.<id>&select=id,label`

## Step by step

1. **Confirm the paper already has a canonical LiteratureBase record** (`OE-LITERATURE-*`
   id). If it doesn't yet, that's a separate job — see the `literaturebase-curation` skill
   — and has to happen first; this process only links an *existing* record.
2. **Check for a duplicate live**, on each project you're about to touch:
   `GET /rest/v1/literature_references?literaturebase_id=eq.<id>&select=id,project_id`.
3. **Sync `literaturebase_snapshot`** so the UI resolves the new record's title/authors
   immediately, rather than showing a blank reference until the next unrelated sync:
   `node scripts/sync_literaturebase_snapshot.mjs` (dry run; prints a count), then
   `--yes` with `SUPABASE_SERVICE_ROLE_KEY` set.
4. **Write the note(s)** — the real work. For each project you're linking to: does this
   paper ground one of that project's existing theories (check step above), or is it
   relevant to the comparison itself? State the actual mechanism or finding connecting the
   paper to this project's real content, specifically — not a generic "this is relevant"
   sentence. Read migrations 149 and 163 for the register this repo expects.
5. **Write the next-numbered migration** (`supabase/migrations/<next>_<slug>.sql`),
   following 140/149/163 as direct templates: `INSERT INTO literature_references
   (project_id, literaturebase_id, title, authors, year, doi, venue, status, notes) SELECT
   ... WHERE NOT EXISTS (...)` — idempotent, re-runnable without erroring or duplicating.
   Leave `type` NULL if the paper's real type (preprint, dataset, website...) isn't in
   `literature_references.type`'s CHECK (`article, chapter, book, report, thesis`) — don't
   guess a close-enough value (149's own documented convention).
6. **Work in an isolated worktree.** This checkout is shared across concurrent sessions
   (`git worktree add ../openlpm-wt-<description>-<date> origin/main -b <branch>`, copy
   `.supabase-secrets/` into it, `npm install`, `supabase link --project-ref
   tfynvjjxyluzorigyfsp` with `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD` set from the
   copied secrets). Check `supabase migration list` first — if it shows a remote migration
   number with no local file, the main checkout is behind `origin/main`; branch from
   `origin/main` directly rather than from a stale local branch.
7. **Push**: `SUPABASE_DB_PASSWORD=... supabase db push`.
8. **Verify live**: read both new rows back via the REST API and confirm the content
   matches what you wrote. A successful push report alone isn't enough confirmation.
9. **Commit, push the branch, open a PR** — the migration is already live in production at
   this point. The PR serves as the durable record and review step rather than a deploy trigger.

## Honest gaps

- No automated check that a `notes` field's claim is actually accurate — this is read by a
  researcher later, same trust model as every other hand-written note in this schema.
- No script does steps 2-9 end to end. That's deliberate: writing a good note is the actual
  work, and a generator would make it too easy to skip doing it well. If this pattern gets
  used often enough that the mechanical steps (not the note) become the real bottleneck,
  that's worth revisiting.
