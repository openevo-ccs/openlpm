# RFC 0001 — Founding OpenLPM and its migration plan

**Status:** Accepted (founding document)
**Date:** 2026-08-03

## Motivation

OpenLPM's application code was originally built as the technical platform for one specific K-12 evolution-education Learning Progression working group's private pilot deployment. That pilot proved the underlying idea out: a free, self-hostable, AI-ethics-aware platform for literature management, schema co-design, LPM data objects, peer review, and discussion is genuinely useful — and not something specific to that one working group's subject matter.

The platform's value is generic. Any research group developing a Learning Progression Model in any domain should be able to run it. This RFC records the decision to extract it into its own independently governed, openly licensed project — **OpenLPM** — maintained by OpenEvo (Dustin Eirdosh) and open source contributors, rather than as a byproduct of any single working group's private tooling.

## What actually moved

Convenient starting point: the application code was, from early on, already internally named and configured as "OpenLPM" (`app-config.ts`, `package.json`) even while it lived inside the pilot's private repository — the founding working group had begun thinking of it as a shared tool, not just their own. This RFC completes that separation rather than starting it from scratch.

**Copied as-is** (already generic, no changes needed beyond a User-Agent string in the CrossRef client):
- `app/` — Next.js App Router pages: home, auth login, dashboard home, dashboard layout, literature dashboard page
- `components/ui/` — button, card, input (shadcn/ui primitives)
- `lib/` — CrossRef/OpenAlex/Semantic Scholar API clients, Supabase client, app config, utils
- `supabase/migrations/001_initial_schema.sql` — the full data model (users, literature references, annotations, schema elements, LPM data objects, evidence links, peer review assignments, discussion topics/posts, activity log)
- Config: `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `tsconfig.json`, `.gitignore`, `env.example`

**Rewritten from scratch** (founding literature — deliberately independent of any single working group's identity):
- `README.md`, `GOVERNANCE.md`, `CONTRIBUTING.md`, `LICENSE`, `LICENSE-CODE`
- `ethics/ai-ethics-framework.md` — generalized from the pilot's own AI ethics draft, which was already written in domain-neutral language
- `QUICKSTART.md`, `SETUP_GUIDE.md`

**Not migrated (no live data moves):**
Each working group that adopts OpenLPM — including the founding pilot group — runs its own Supabase project and owns its own data outright. OpenLPM ships the schema as a template migration, not a live database. No literature, schema elements, LPM objects, or discussion content from any prior deployment is part of this repository.

**Not yet built** (implementation status honestly, as of this RFC): only the pages listed above exist. The schema co-design UI, LPM data object management, peer review assignment UI, and discussion forum UI described in the README and roadmap are **designed but not yet implemented** — see the phased roadmap in `README.md`.

## Why "fully migrate" means a plan, not a one-time copy

The copy performed alongside this RFC gets the *existing* code into its new, independent home. "Fully migrating" the underlying *idea* is an ongoing process:

1. **Phase 0 (this RFC):** Independent repo, founding governance, licensing, and AI ethics framework in place. Existing code copied and de-identified from its pilot origin.
2. **Phase 1:** Build the schema co-design, LPM data object, peer review, and discussion forum UIs that are currently only data-modeled (in the Supabase migration) but not yet surfaced in the app.
3. **Phase 2:** Onboard pilot partner groups beyond the founding one; let their real usage drive which Phase 1 features get finished first and what changes.
4. **Phase 3:** Revisit whether any part of the founding pilot's own deployment should migrate onto this shared codebase rather than maintaining a fork — a decision for that working group to make on its own timeline, independent of OpenLPM's public roadmap.

## Decision

Accepted. This repository is the result.
