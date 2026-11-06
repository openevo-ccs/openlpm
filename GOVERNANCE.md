# OpenLPM — Governance

**Status:** Normative for this repository — the OpenLPM application, its data model, and the AI-use rules that apply to content created inside it. Sized for what this project actually is today (one active maintainer, pre-launch), while naming the seats explicitly so growth doesn't silently recentralize onto whoever holds the most context. This mirrors the same choice made in [`openevo-core/GOVERNANCE.md`](https://github.com/openevo-ccs/openevo-core/blob/main/GOVERNANCE.md) and every other OpenEvo CCS Lab repo — don't build multi-person process for a committee that doesn't exist yet.

## What this repo owns

- The OpenLPM application itself (Vite/React app, Supabase schema, API integrations).
- The [AI Ethics Framework](ethics/ai-ethics-framework.md) governing how generative AI may be used inside an OpenLPM-hosted project.
- The [Data Rights & Licensing Framework](ethics/data-rights-and-licensing-framework.md) ([RFC-0007](proposals/0007-data-rights-and-licensing-framework.md)) governing who owns what's stored here, how it may be reused, and what citation and liability terms apply.
- The data model for literature references, schema elements, LPM data objects, peer review, and discussion threads.

## What this repo does not own

OpenLPM is application infrastructure. It is not a curriculum authority and does not adjudicate what any specific working group's Learning Progression Model should say — that decision belongs entirely to the group using the tool. Groups that want their finished LPM content interoperable with the wider OpenEvo Computational Curriculum Studies (CCS) ecosystem can optionally align it to [OpenEvo ConceptBase](https://github.com/openevo-ccs/conceptbase)'s schemas — using OpenLPM itself never requires that.

## Roles

| Role | Responsibility | Who holds it today |
|---|---|---|
| **Maintainer** | Merge rights; final arbitration on architecture, the AI Ethics Framework, and licensing. | Dustin Eirdosh |
| **Contributors** | Anyone; submit issues and pull requests. | — |

**Note on seat consolidation:** every seat above is currently one person. As real contributors and adopting research groups join, this table is where they get named — not invented ad hoc under time pressure.

## Proposing a change

Substantive changes — a new data-model entity, a change to the AI Ethics Framework's tiers, a licensing change — go through a pull request against [`proposals/`](proposals/). Routine bug fixes and small features don't need an RFC; open a normal PR. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Versioning

The application version follows semver. The AI Ethics Framework versions independently (see its own document header) since it can change on a different cadence than the codebase.

## License

- **Content** (this document, the AI Ethics Framework, proposals, documentation): [CC BY-NC-SA 4.0](LICENSE)
- **Code** (the application itself): [MIT](LICENSE-CODE)

How this applies to a specific project's own content, to third-party source material stored here, and what citation/liability terms apply: see the [Data Rights & Licensing Framework](ethics/data-rights-and-licensing-framework.md).
