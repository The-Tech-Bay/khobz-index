# Phase 5 — Public GitHub repo readiness

**Status:** ✅ Complete (2026-05-28) — prepare-only in monorepo; export deferred

**Goal:** Make `khobz-index/` safe and credible as a public standalone repo ([The-Tech-Bay/khobz-index](https://github.com/The-Tech-Bay/khobz-index)) without disabling monorepo production CI.

**Decision:** D1-A standalone repo; actual `git subtree split` + push on export day ([`docs/ops/public-repo-export.md`](../ops/public-repo-export.md)).

## Completed

| Task | Deliverable |
|------|-------------|
| **5.1 Topology** | [`data/README.md`](../../data/README.md), [`api-contract.md`](../architecture/api-contract.md), [`stack.md`](../architecture/stack.md), [`kki_research.md`](../kki/kki_research.md) — links → `The-Tech-Bay/khobz-index` |
| **5.2 Surface** | [`README.md`](../../README.md) footer + CI dual-mode; [`runbook.md`](../ops/runbook.md) personal Worker URL redacted; `private: true` documented in README |
| **5.3 Policies** | [`SECURITY.md`](../../SECURITY.md); [`source_correction.md`](../../.github/ISSUE_TEMPLATE/source_correction.md); [`CONTRIBUTING.md`](../../CONTRIBUTING.md) source-correction path |
| **5.4 CI docs** | README dual-mode table; [`public-repo-export.md`](../ops/public-repo-export.md) export runbook |

## Pending (requires agent mode)

_None — all Phase 5 prepare-only tasks complete._

## Acceptance

- [x] GitHub release/citation URLs use `The-Tech-Bay/khobz-index`
- [x] No personal Worker hostname in runbook
- [x] No "Pre-publication" README footer
- [x] SECURITY.md + source correction template + config.yml
- [x] Standalone `kki-weekly.yml` ported from parent
- [x] Backup folder gitignored
- [x] Parent workflow export comment
- [x] `bun test`, `typecheck`, `pages:build` green

## Related

- [`ship-todo.md`](../../ship-todo.md) Phase 5
- Phase 6: citation DOI / release checklist
- Phase 7: full grep verification
