# OpenLPM AI Ethics Framework

**Status:** Draft, versioned independently of the codebase — see [`GOVERNANCE.md`](../GOVERNANCE.md). Applies to how generative AI may be used within any OpenLPM-hosted project, and is offered more broadly as a candidate framework for any Learning Progression Model (LPM) development effort, on or off this platform.

## Executive Summary

This document provides a comprehensive, strategic, and deeply ethical approach to generative AI use in the development of Learning Progressions for educational research. Moving beyond simplistic binary approaches (permitted/prohibited), this framework establishes a nuanced, tiered system that recognizes AI's varying roles across different stages of LPM development, with appropriate human oversight proportional to the stakes of each decision.

---

## Core Philosophy: AI as Amplifier, Not Authority

A binary permitted/prohibited approach fails to capture the nuanced reality of AI-assisted research. Instead, this framework uses a **spectrum-based system** that recognizes AI's varying roles across different stages of LPM development, with appropriate human oversight proportional to the stakes of each decision.

---

## I. Four-Tiered AI Engagement Framework

### Tier 1: Augmentation (Low Risk)
*AI as efficiency tool for routine tasks*

**Permitted with minimal oversight:**
- **Literature Discovery**: AI-assisted search across databases (OpenAlex, Semantic Scholar)
- **Citation Formatting**: Automated bibliography generation
- **Text Enhancement**: Grammar, clarity, and readability improvements
- **Data Organization**: Structuring unstructured notes into tables/categories
- **Translation**: Initial translations for accessibility (human verification required)

**Transparency Requirement**: Label as "AI-assisted" in metadata

### Tier 2: Exploration (Medium Risk)
*AI as thought partner for hypothesis generation*

**Permitted with structured human review:**
- **Concept Mapping**: AI suggests relationships between concepts (human validates)
- **Gap Analysis**: AI identifies potential gaps in literature coverage (human investigates)
- **Cross-Domain Connections**: AI proposes interdisciplinary links (human evaluates relevance)
- **Alternative Explanations**: AI generates multiple ways to explain concepts (human selects)
- **Assessment Item Drafting**: AI creates initial assessment questions (human refines)

**Transparency Requirement**: Document AI suggestions and human decisions in version history

### Tier 3: Synthesis (High Risk)
*AI as synthesis engine for complex integration*

**Permitted with rigorous human validation:**
- **Evidence Integration**: AI synthesizes findings across multiple studies (human verifies accuracy)
- **Learning Trajectory Modeling**: AI suggests developmental sequences (human tests empirically)
- **Misconception Analysis**: AI identifies potential student misconceptions (human validates through research)
- **Cross-Cultural Adaptation**: AI proposes cultural adaptations (experts from target cultures review)
- **Grade Band Alignment**: AI suggests content placement across grade levels (educational experts validate)

**Transparency Requirement**: Full audit trail of AI contributions and human modifications

### Tier 4: Authority (Prohibited)
*AI as decision-maker — never permitted*

**Strictly Prohibited:**
- **Scientific Validity Determination**: AI cannot decide what is scientifically accurate
- **Educational Value Judgments**: AI cannot determine pedagogical appropriateness
- **Peer Review Decisions**: AI cannot accept/reject submissions
- **Schema Modifications**: AI cannot change the LPM structure without human approval
- **Evidence Weighting**: AI cannot determine the relative importance of different studies
- **Final Content Publication**: AI cannot publish without explicit human approval

---

## II. Domain-Specific AI Guidelines

### A. Literature Review & Evidence Synthesis

**Permitted AI Uses:**
- Systematic literature search across multiple databases
- Extraction of structured metadata (authors, year, methodology, findings)
- Identification of citation networks and research clusters
- Preliminary quality assessment (methodology detection, sample size analysis)
- Gap identification in existing research

**Required Human Oversight:**
- Manual verification of key studies
- Critical evaluation of AI-identified patterns
- Contextual interpretation of findings
- Determination of evidence quality and relevance

**Ethical Safeguards:**
- Maintain full citation trails for AI-discovered literature
- Document search parameters and AI model versions
- Regular audits for systematic bias in AI recommendations

### B. Concept & Competency Development

**Permitted AI Uses:**
- Analysis of existing concept definitions across disciplines
- Identification of conceptual relationships (broader/narrower/related)
- Generation of age-appropriate language for definitions
- Suggestion of examples and non-examples
- Cross-referencing with educational standards

**Required Human Oversight:**
- Scientific accuracy verification by domain experts
- Developmental appropriateness assessment by educational psychologists
- Cultural sensitivity review by diverse experts
- Alignment with learning theory validation

**Ethical Safeguards:**
- Multiple expert reviews for controversial concepts
- Documentation of all AI suggestions and human decisions
- Regular review for conceptual drift or bias

### C. Assessment & Evaluation Design

**Permitted AI Uses:**
- Generation of diverse assessment item formats
- Analysis of item difficulty and discrimination parameters
- Identification of potential bias in assessment items
- Suggestion of alternative phrasing for clarity
- Automated scoring rubric development

**Required Human Oversight:**
- Content validity review by subject matter experts
- Cognitive load analysis by educational psychologists
- Cultural bias review by diverse experts
- Field testing and validation with actual students

**Ethical Safeguards:**
- Transparency about AI involvement in assessment development
- Regular bias audits across demographic groups
- Human-in-the-loop for all high-stakes assessments

### D. Cross-Cultural & Interdisciplinary Integration

**Permitted AI Uses:**
- Identification of cultural references and contexts
- Translation and localization of content
- Analysis of interdisciplinary connections
- Suggestion of culturally relevant examples
- Detection of potential cultural insensitivity

**Required Human Oversight:**
- Review by cultural experts from target communities
- Validation by interdisciplinary scholars
- Field testing in diverse educational contexts
- Ongoing community feedback integration

**Ethical Safeguards:**
- Cultural expert involvement at every stage
- Community review processes for sensitive content
- Transparency about cultural adaptation processes

---

## III. Implementation Framework

### A. Technical Infrastructure

**AI Transparency System:**
```typescript
interface AIContribution {
  aiModel: string
  modelVersion: string
  timestamp: string
  taskType: 'augmentation' | 'exploration' | 'synthesis'
  input: string
  output: string
  humanReviewer: string
  humanModifications: string
  approvalStatus: 'approved' | 'modified' | 'rejected'
  confidenceScore?: number
}
```

**Audit Trail Requirements:**
- Every AI interaction logged with full context
- Version control for all AI-assisted content
- Human approval workflow for Tier 2+ activities
- Regular automated bias detection

### B. Governance Structure

**Role-Based Access Control** (mapped to OpenLPM's user roles, see `GOVERNANCE.md`):
- **Contributors**: Tier 1 access + supervised Tier 2
- **Editors**: Tier 1–2 access + supervised Tier 3
- **Reviewers**: Tier 1–2 access for review support
- **Admins**: Full access with audit responsibilities

Each OpenLPM-hosted project decides its own equivalent of an "AI ethics committee" — this framework defines the tiers; each project decides who sits in the review seats for Tier 2+ activity, sized to that project's own scale (see the seat-consolidation note in `GOVERNANCE.md` — one active maintainer is a legitimate answer for a young project).

### C. Training & Competency Framework

**Recommended for all users:**
- Understanding of AI capabilities and limitations
- Recognition of AI hallucinations and biases
- Proper documentation of AI contributions
- Ethical considerations in AI-assisted research

**Recommended for editors/reviewers:**
- Critical evaluation of AI-generated content
- Bias detection and mitigation strategies
- Complex synthesis validation techniques
- Cross-cultural sensitivity in AI outputs

---

## IV. Ethical Principles

### 1. Human Agency & Responsibility
- Humans maintain ultimate authority over all decisions
- AI suggestions are recommendations, not directives
- Clear accountability chains for all content

### 2. Transparency & Traceability
- Full documentation of AI involvement
- Publicly available AI usage policies
- Open audit trails for research reproducibility

### 3. Equity & Justice
- Regular bias audits across demographic groups
- Inclusive design processes with diverse stakeholders
- Accessibility considerations in AI tool selection

### 4. Scientific Rigor
- AI cannot substitute for empirical validation
- Evidence quality determined by human experts
- Peer review maintains human judgment at core

### 5. Cultural Responsiveness
- Cultural experts involved in all adaptations
- Community feedback integrated into development
- Respect for diverse knowledge systems

### 6. Privacy & Data Protection
- Student data never used for AI training
- Researcher data handled with appropriate consent
- Compliance with GDPR and other applicable regulations

---

## V. Monitoring & Evaluation

**Continuous Assessment Metrics:**
- **Quality**: Peer review acceptance rates, revision cycles
- **Bias**: Regular demographic bias audits
- **Efficiency**: Time savings vs. traditional methods
- **Learning**: User competency development over time
- **Satisfaction**: Stakeholder feedback on AI-assisted processes

**Recommended Annual Review Process:**
1. Comprehensive audit of AI usage patterns
2. Stakeholder survey on effectiveness and concerns
3. Literature review of emerging AI ethics research
4. Policy update based on findings
5. Training program refinement

---

## VI. Crisis Management

**AI Failure Protocols:**
- Immediate human review when AI errors detected
- Transparent communication about issues
- Systematic analysis of root causes
- Process improvements to prevent recurrence

**Bias Incident Response:**
- Rapid assessment team deployment
- Affected stakeholder notification
- Content correction and re-review
- Systemic bias investigation

---

## VII. Future-Proofing

**Adaptive Policy Framework:**
- Periodic policy review cycles
- Integration of emerging AI ethics research
- Stakeholder input on evolving challenges
- Flexibility to address new AI capabilities

**Research Integration:**
- Ongoing research on AI effectiveness in LPM development
- Collaboration with the AI ethics research community
- Publication of findings to contribute to field knowledge
- Participation in broader discussions about AI in education

This framework is also deliberately in dialogue with the wider OpenEvo Computational Curriculum Studies (CCS) Lab's own AI-use practices in curriculum research — see [`../docs/openevo-ccs-learning-loop.md`](../docs/openevo-ccs-learning-loop.md) for how lessons move in both directions.

---

## Adopting this framework elsewhere

This document is licensed [CC BY-NC-SA 4.0](../LICENSE) specifically so other LPM research groups and platforms can adopt, adapt, and improve it — with attribution — independent of whether they use OpenLPM itself. If you adapt it, we'd welcome hearing what changed and why; open an issue or a PR against `proposals/`.

---

## Appendix: Key References & Resources
**NOTE: these references have not been independently verified — treat as a starting bibliography, not a vetted one.**

### AI Ethics in Education Research
- UNESCO (2021). "Recommendation on the Ethics of Artificial Intelligence"
- Holmes, W., et al. (2022). "Artificial Intelligence and Education: A Critical View"
- Luckin, R., et al. (2022). "Intelligence Unleashed: An Argument for AI in Education"

### Learning Progression Development
- Corcoran, T., et al. (2009). "Learning Progressions in Science"
- National Research Council (2007). "Taking Science to School"
- Duschl, R., et al. (2011). "Reconceptualizing STEM Education"

### Bias and Fairness in AI
- Mehrabi, N., et al. (2021). "A Survey on Bias and Fairness in Machine Learning"
- Barocas, S., & Selbst, A. (2016). "Big Data's Disparate Impact"
- Buolamwini, J., & Gebru, T. (2018). "Gender Shades"

### Cross-Cultural Considerations
- Gay, G. (2018). "Culturally Responsive Teaching: Theory, Research, and Practice"
- Ladson-Billings, G. (2021). "Culturally Relevant Pedagogy 2.0"
- Paris, D. (2017). "Culturally Sustaining Pedagogies"

---

*Document Version: 1.0*
*Created: August 2026*
*Next Review: February 2027*
*Maintained by: OpenLPM (Dustin Eirdosh and contributors)*
