# Contributing to OpenLPM

**Status:** Informative — a practical getting-started guide. For the authoritative process and roles, see [`GOVERNANCE.md`](GOVERNANCE.md).

## Before you start

Read [`README.md`](README.md) for orientation. OpenLPM is early — pre-launch, single maintainer — so the fastest way to find the right scope for a contribution is to open an issue describing what you want to do before writing code.

## Ways to contribute

1. **Use it and report back.** If you're part of a research group developing a Learning Progression Model, the most valuable early contribution is trying OpenLPM on real working-group content and telling us what broke or what was missing.
2. **Code contributions.** Bug fixes and small features: open a normal pull request. Larger changes (new data-model entities, architectural shifts): open an issue first.
3. **AI Ethics Framework.** If you think a tier boundary in [`ethics/ai-ethics-framework.md`](ethics/ai-ethics-framework.md) is wrong or missing a case your group has actually hit, open a PR against `proposals/` — this document is meant to evolve from real use, not stay static.
4. **Documentation.** Setup guides, translated READMEs, and clearer explanations of the workflows are always welcome.

## Development setup

See [`QUICKSTART.md`](QUICKSTART.md).

## Code style

- TypeScript throughout; keep components small and focused.
- Tailwind CSS for styling, following the existing component structure in `components/ui/`.
- Run `npm run lint` and `npm run type-check` before opening a PR.

## Questions

Open a [GitHub issue](../../issues), or reach out to Dustin Eirdosh via the OpenEvo Computational Curriculum Studies Lab ([openevo.eva.mpg.de](http://openevo.eva.mpg.de)). See the README for how to set up a conversation about your group's use case.
