# Phase 6 — Data Publication and Citation

**Status:** ✅ Complete (2026-05-29)

**Goal:** Make the public data archive usable and citable by researchers without reading internal docs.

## Task 6.1 — Finalize data README

File: [`data/README.md`](../../data/README.md)

Already complete from Phase 5: final repo URL (`The-Tech-Bay/khobz-index`), release URL pattern, JSON/CSV naming, CC BY 4.0 license, citation format, DOI-pending, methodology + schema links.

Closed in Phase 6:

- **Canonical monthly grain** — new subsection: source checks run weekly, but the canonical citable record is monthly (`YYYY-MM`); intra-month runs refresh source health/landing fixture only; never retroactively recalculated. Cross-links [`methodology.md`](../methodology.md) §6 and [`architecture.md`](../architecture/architecture.md) §TL;DR.
- **Neutral attribution (D2-C)** — License section now names **The Tech Bay** as publisher with Karama-project methodology credit; citation prose and BibTeX key updated (`thetechbay2026kki`, `author = {{The Tech Bay}}`), consistent with README "Used By".

## Task 6.2 — Public release checklist

New file: [`docs/ops/public-release-checklist.md`](../ops/public-release-checklist.md) — ordered, repeatable monthly publication steps:

regenerate fixture → tests → typecheck → lint → build landing → deploy landing → deploy API → verify domains → verify API health → create monthly release → verify release assets → verify public links → verify no private references → close out.

Cross-linked from [`runbook.md`](../ops/runbook.md) (§1 banner) and [`README.md`](../../README.md) CI section. Runbook keeps the detailed deploy/rollback/incident procedures the checklist references.

## Acceptance

- [x] A researcher can cite and download the KKI dataset without internal docs
- [x] Citation includes neutral publisher attribution + DOI-pending
- [x] Canonical monthly grain explained
- [x] Release process repeatable by a new maintainer
- [x] `bun test tests/unit`, `bun run typecheck`, `bun run pages:build` green

## Related

- [`ship-todo.md`](../../ship-todo.md) Phase 6
- Phase 5: [`phase5-public-github-readiness.md`](./phase5-public-github-readiness.md)
- Phase 7: full grep verification + prohibited-language sweep
