# Governance — Karama Khobz Index (KKI)

## Model: BDFL (Benevolent Dictator for Life)

**BDFL:** [@i-bkf](https://github.com/i-bkf) (Moulay Smail El Boukfaoui)

The BDFL has final merge authority on all changes to this repository, including code, data, and methodology.

---

## Decision Process

| Action | Process |
|---|---|
| Bug report | Open an Issue → fix via PR → BDFL merges |
| New source adapter | Open an Issue → discuss feasibility → implement via PR → BDFL merges |
| Regional basket proposal | Open an Issue (Basket Proposal template) → 14-day discussion → BDFL decides |
| Methodology patch (v1.x) | RFC Issue → 14-day discussion → BDFL merges with documented rationale |
| Methodology revision (v2.0) | RFC Issue → 30-day discussion → external review → BDFL merges with documented rationale |
| Governance change | RFC Issue → 30-day discussion → BDFL decides |

---

## Methodology Versioning Governance

KKI uses strict semantic versioning for its methodology:

### Patch-level (v1.0.x)
- Typo corrections in documentation
- No impact on calculated index values
- BDFL merges directly

### Minor-level (v1.x.0)
- Source substitution (e.g., replacing a discontinued API with an equivalent)
- Alpha (α) tuning for specific markets based on new evidence
- Does not change historical published values
- Requires RFC Issue + 14-day comment period

### Major-level (vX.0.0)
- Basket composition changes (adding/removing items)
- Formula structure changes
- May affect future calculations (never retroactive)
- Requires RFC Issue + 30-day comment period + at least one external review
- Old promises always reference their origin methodology version

---

## Conflict Resolution

1. Discussion happens in the open (Issues and PR comments)
2. The BDFL makes the final decision
3. Every decision is documented with public rationale in the relevant PR or Issue
4. Disagreements after a decision are welcome as new Issues for future consideration

---

## Transparency Commitments

- All methodology decisions are documented publicly in this repository
- No private channels for governance decisions
- Annual methodology review (first at 6-month mark post-publication)
- The BDFL will seek external review from domain experts (food security, econometrics) for major version changes

---

## Evolution

This governance model may evolve as the project grows. Changes to governance follow the same RFC process as methodology revisions (30-day discussion, BDFL decides).

If the BDFL becomes unavailable for more than 6 months, the most active contributor with merge history may petition to assume maintainership via a public Issue.

---

*Governance v1.0 — Effective from repository creation.*
