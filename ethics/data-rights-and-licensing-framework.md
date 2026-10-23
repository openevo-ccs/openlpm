# OpenLPM Data Rights & Licensing Framework

*Proposed as [RFC-0007](../proposals/0007-data-rights-and-licensing-framework.md). A companion to the [AI Ethics Framework](ai-ethics-framework.md). Where that document governs how AI may be used inside an OpenLPM project, this one governs who owns what, who may reuse it, and what OpenLPM does and doesn't promise about it.*

## 1. Three kinds of content, three different rules

OpenLPM holds three genuinely different kinds of material, and they are not governed the same way:

1. **OpenLPM's own content** — this application, its documentation, and the AI Ethics Framework itself. Licensed CC BY-NC-SA 4.0 (content) / MIT (code). See [`LICENSE`](../LICENSE) / [`LICENSE-CODE`](../LICENSE-CODE).
2. **A project's own original work** — the strands, Lernziele, data objects, and discussion a research group writes themselves. Licensed under that project's own chosen `content_license`, shown on the project's page. Defaults silently to CC BY-NC-SA 4.0 if the project hasn't chosen otherwise — no extra step at project creation; the choice always lives in Settings.
3. **Quoted or summarized third-party source material** — a government curriculum document, an official standard, a ministry decree. This keeps *its own* legal status regardless of what license the surrounding project carries, shown per record as how much of it is stored (`citation-only` / `summary-only` / `excerpt-only` / `full-text-stored`) and the actual legal basis for that choice.

## 2. Citing OpenLPM

> Eirdosh, D. (2026). *OpenLPM: a collaborative platform for Learning Progression Model design* [Computer software]. OpenEvo CCS Lab. https://github.com/openevo-ccs/openlpm

If you're citing a specific project's content rather than the platform itself, cite that project's own publication once it has one, and credit OpenLPM as the tool it was built with. Where this app controls the output directly — a project export, a published repository's generated README — this citation is included automatically, instead of waiting on someone to remember to copy it from a page.

## 3. Using and reusing content stored here

- OpenLPM's own content and a project's original work (categories 1–2 above) may be freely used and adapted under the license shown, with credit, for non-commercial purposes, with any derivative shared under the same terms — unless a specific project has chosen a different license for its own work.
- Third-party source material (category 3) carries its own terms, shown per record. Nothing in this platform grants you any right to that material beyond what its own license allows — OpenLPM storing an excerpt doesn't create new rights to it.
- If you're unsure what you can do with something, check the license badge on the project, or the rights note on the specific record, before reusing it.

## 4. What OpenLPM does not promise

OpenLPM is a tool for collaborative curriculum research. It is not a certified or legally authoritative source. Content stored here — including quoted or summarized government and institutional curriculum material — may be incomplete, outdated, or inaccurately extracted. Always verify against the issuing authority's own current, official publication before relying on anything here for a compliance, accreditation, or legal purpose. OpenEvo, OpenLPM's maintainers, and any individual project's contributors provide this platform and its content "as is," without warranty of any kind, and are not liable for decisions made in reliance on it.

## 5. How a project sets its own license

A project owner chooses a `content_license` for their project's own original work from Settings, whenever they want to — not as a required step when the project is created. This governs only what the group itself writes. Material quoted from outside sources always keeps its own terms (§1, §3). A sub-project inherits its parent's license unless its own owner sets a different one.

## 6. Storing government and institutional source material

If you're adding a government curriculum document, official standard, or similar institutional material to a Curriculum Repository:

- Start cautious. The default is `citation-only` (a reference, no quoted text). Only move to a more permissive tier once you've confirmed the source document's legal status.
- National/federal decrees and decisions are often genuinely free to reuse (e.g. U.S. federal government works, many German federal/Land official decisions). A state- or Land-level *curriculum framework or standards booklet* is a different, more cautious case, especially if it's published through a commercial education publisher rather than issued as a bare decree. That's a signal to check carefully.
- A summary or extracted fact is safer to store than a verbatim quotation, but still needs to cite its source accurately and carry honest provenance if AI helped produce it.
- Before marking anything `full-text-stored`, a named person should confirm the legal basis in the record's rights note. This is the tier with the most legal exposure if it's wrong.

A real worked example: the KMK Biologie Bildungsstandards (RFC-0025) checked both source documents directly against their actual imprint pages rather than guessing by category. The AHR-2020 edition carries a commercial publisher's copyright notice (Carl Link/Wolters Kluwer) with no license grant, so its 67 records were kept at `citation-only`. The MSA-2024 edition is a plain KMK resolution PDF with no commercial imprint — a real, researched basis for Germany's §5(2) UrhG *amtliches Werk* exemption — so its 62 records kept their verbatim wording. Neither outcome was assumed from the document's category alone; both came from actually reading the source.

## 7. Federation

Content shared with another project through federation keeps the license and rights terms it already had. Federation changes who can see something — it never changes what they're allowed to do with it.

## 8. This still needs a lawyer's review

This framework, including §4's liability language and §6's reuse-rights reasoning, is a well-researched starting point. It has not been reviewed by a lawyer yet. It's solid enough to work from now, while OpenLPM is pre-launch — it should not be treated as settled, binding legal protection once schools, districts, or funders are relying on it.

## 9. Questions

This framework, like the AI Ethics Framework it accompanies, is offered for other LPM research groups and platforms to adopt and adapt, with attribution. Reach out at [dustin@globalesd.org](mailto:dustin@globalesd.org) or open an issue.
