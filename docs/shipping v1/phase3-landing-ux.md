# Phase 3 — Landing page copy and public UX

**Status:** ✅ Complete (2026-05-27)

**Goal:** Make the KKI landing understandable without Karama app context; separate global-fallback countries from local-basket rankings; expose local coverage metadata.

**Rollback:** `landing-backup-pre-phase3-2026-05-27/` — see `README-ROLLBACK.md`.

## Deliverables

| Area | Change |
|------|--------|
| Engine | `calculate.ts` imports `computeLocalBasketCost` + `LOCAL_BASKET_COVERAGE_THRESHOLD` from `local-coverage.ts` |
| Fixture | `fixture-builder.ts` adds `latest_snapshot.local_coverage`; enrich via `bun run scripts/enrich-fixture-local-coverage.ts` |
| Landing helpers | `landing/src/lib/localCoverage.ts`, `rankingFilters.ts` + unit tests |
| SEO | `landing/index.html` → `https://khobz-index.thebay.ma/`, `temporalCoverage` `2026-04/..` |
| Ranking UX | `RankingFilters`, `CountryRanking` split (default `local_only`: full+degraded main, global_only collapsed) |
| Map UX | Color scale excludes `global_only`; pale sage-green solid fill (not hatched) + human quality labels; Antarctica hidden |
| Country page | Coverage callouts, basket title logic, US/MA sanity notes |
| Methodology | FAQ sources fixed, quality FAQ, source roadmap, GitHub link to `docs/kki/kki_research.md` |
| Mobile / UI | `learnMoreUrl` → `https://khobz-index.thebay.ma`; `O19` `LEARN_MORE_URL` |
| Docs | `runbook.md`, `api-contract.md`, `translations.md`, `alignment-audit.md` glossary |

## Acceptance

- [x] Rankings do not treat identical `global_only` USD values as country-specific affordability
- [x] 60% local-basket threshold unchanged and explained in UI
- [x] `bun test tests/unit`, `bun run typecheck`, `bun run pages:build` pass

## Related

- `ship-todo.md` Phase 3 + KKI UX Addendum
- Phase 4: Cloudflare custom domain wiring (`khobz-index.thebay.ma`)
