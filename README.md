# OpenLPM

**An open-source, cost-free platform for research groups to collaboratively author Learning Progression Models (LPMs).**

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/Content%20License-CC--BY--NC--SA%204.0-lightgrey.svg)](LICENSE)
[![Code License: MIT](https://img.shields.io/badge/Code%20License-MIT-yellow.svg)](LICENSE-CODE)
[![Status](https://img.shields.io/badge/Status-Early%20%2F%20Pre--Launch-orange)](#status--roadmap)
[![AI Ethics](https://img.shields.io/badge/AI%20Use-Tiered%20%26%20Documented-blueviolet)](ethics/ai-ethics-framework.md)

## What is OpenLPM?

Building a rigorous Learning Progression Model is slow, collaborative, evidence-heavy work — and most research groups end up doing it in a patchwork of spreadsheets, shared docs, and email threads, reinventing the same workflow every time.

OpenLPM is a single, free tool built for that workflow specifically:

- **Literature management** — search, DOI-verify (via CrossRef), and organize the evidence base behind your progression
- **Schema co-design** — collaboratively define and refine concepts, competencies, and grade bands, with discussion attached to each element
- **LPM data objects** — manage strands, substrands, performance indicators, and assessment items as structured, versioned data rather than prose
- **Peer review** — a transparent, structured review pipeline from draft to accepted
- **Evidence linking** — connect specific literature to specific LPM elements, so every claim in your progression traces back to its source
- **Discussion forums** — threaded, citable conversation attached to the object it's actually about

It's free to run (a static Vite/React frontend + Supabase's free tier — deployable straight to GitHub Pages, no server to operate), open source, and designed so a research group with no dedicated engineering support can stand up their own instance.

## Built-in AI ethics, not an afterthought

Generative AI is genuinely useful for this kind of work — and genuinely risky if it's allowed to quietly make decisions that should stay human. OpenLPM ships with a **tiered AI Ethics Framework** baked into how the platform is designed to be used: AI is welcome for search, drafting, and synthesis assistance, and explicitly excluded from evidence evaluation, peer review decisions, and schema authority. See [`ethics/ai-ethics-framework.md`](ethics/ai-ethics-framework.md) for the full framework — we think it's useful on its own, independent of this specific tool, and we'd genuinely like feedback on it from other research groups thinking about the same problem.

## Where this comes from

OpenLPM is an [OpenEvo](http://openevo.eva.mpg.de) project, initiated and maintained by Dustin Eirdosh together with open source contributors. It draws design lessons from OpenEvo's own Computational Curriculum Studies (CCS) Lab — a more advanced, actively-used ecosystem for evolution/behavior/sustainability curriculum research — and feeds what it learns back the other way. The intent is for OpenLPM to be a generalized, freely available version of that same kind of infrastructure: a tool any expert group can stand up for their own Learning Progression project, on their own terms.

## Status & roadmap

OpenLPM is early — pre-launch, actively developed, not yet feature-complete. A draft phased plan:

- **Phase 0 — Foundation** *(now)*: open-source the core platform; solidify schema co-design and literature workflows end to end.
- **Phase 1 — Pilot partners**: work directly with a small number of LPM research groups using real working-group content, and let their needs shape the next round of features.
- **Phase 2 — Review & evidence at scale**: peer review pipelines, evidence linking, and discussion threading mature based on pilot feedback.
- **Phase 3 — Interoperability & wider adoption**: optional alignment paths for groups that want their LPM interoperable with other open curriculum infrastructure, plus a easier hosted option for groups that don't want to self-host.

This plan will change as pilot groups get involved — that's the point.

## Get involved

If you're part of a research group developing a Learning Progression Model — in evolutionary biology, or any other domain — **I'd genuinely welcome a conversation about whether OpenLPM could work for you, and what it would need to.** Reach out any time:

- **Email**: [dustin@globalesd.org](mailto:dustin@globalesd.org)
- **Issues / discussion**: open a [GitHub issue](../../issues)

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to contribute code or feedback, and [`GOVERNANCE.md`](GOVERNANCE.md) for how the project is run.

## Getting started (self-hosting)

See [`QUICKSTART.md`](QUICKSTART.md) for a 10-minute setup, or [`SETUP_GUIDE.md`](SETUP_GUIDE.md) for the full walkthrough.

## License

- **Content** (documentation, governance, the AI Ethics Framework): [CC BY-NC-SA 4.0](LICENSE)
- **Code** (the application): [MIT](LICENSE-CODE)
