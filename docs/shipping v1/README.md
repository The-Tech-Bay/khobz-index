# KKI public ship — baseline audit and decision guides

**Audit date:** 2026-05-26  
**Scope:** [`ship-todo.md`](../../ship-todo.md) Phases 0–7 complete; human decisions **D1–D4** recorded  
**Audited tree:** `khobz-index/` inside the Karama monorepo

## Purpose

Phase 0 produces a precise inventory before changing copy, methodology, domains, or repo topology. Later phases (1–7 in `ship-todo.md`) should treat these files as the source of truth for what to fix and in what order.

## Human decisions (start here if you are a stakeholder)

**[Decision guide — D1 through D4](./decisions-d1-d4-guide.md)** — recorded choices for repo topology, README Karama framing, research doc placement, and legacy URL policy. Use this before Phase 2+ implementation.

## Deliverables

| File | Task | Contents |
|------|------|----------|
| [phase0-readiness-summary.md](./phase0-readiness-summary.md) | 0.1 + 0.2 | Executive status, acceptance criteria, blockers, Phase 1 decisions |
| [task-0.1-karama-reference-inventory.md](./task-0.1-karama-reference-inventory.md) | 0.1 | Full reference table: path, snippet, action, rationale |
| [task-0.2-duplicate-clutter-inventory.md](./task-0.2-duplicate-clutter-inventory.md) | 0.2 | `* 2.*` duplicate analysis and deletion plan |
| [phase1-identity-alignment.md](./phase1-identity-alignment.md) | 1.1–1.3 | Naming, cadence, coverage alignment + recorded D1–D4 follow-up scope |
| [phase2-methodology-truthfulness.md](./phase2-methodology-truthfulness.md) | 2.x | Methodology truthfulness pass |
| [phase3-landing-ux.md](./phase3-landing-ux.md) | 3.x | Landing UX: coverage metadata, ranking/map filters, D4-B URLs |
| [phase4-domain-wiring.md](./phase4-domain-wiring.md) | 4.x | Domain verification, kilocalorie redirect, API privacy, URL sweep |
| [phase6-data-publication.md](./phase6-data-publication.md) | 6.x | Data README finalization + public release checklist |
| [phase7-verification.md](./phase7-verification.md) | 7 | Verification gate: build/test/typecheck, domain + language sweeps, link check, remediation |
| [decisions-d1-d4-guide.md](./decisions-d1-d4-guide.md) | D1–D4 | Stakeholder decision record (repo, README, research doc, URLs) |

## How to use in later phases

- **Phase 1 (identity/copy):** Complete for naming, cadence, and country coverage; use its status doc to avoid re-opening settled scope.
- **Phase 4 (domains):** ✅ Complete — [`phase4-domain-wiring.md`](./phase4-domain-wiring.md). Verify: `bash scripts/verify-landing-urls.sh`.
- **Phase 5 (GitHub readiness):** Execute task-0.2 deletion list; reconcile workflow/README topology rows in task-0.1.
- **Phase 7 (verification):** ✅ Complete — [`phase7-verification.md`](./phase7-verification.md). Gate green (typecheck, lint, format:check, 147 tests, `pages:build`); domain + prohibited-language sweeps clean; link check + remediation done.

## Canonical ship guide

Full execution plan: [`../../ship-todo.md`](../../ship-todo.md)
