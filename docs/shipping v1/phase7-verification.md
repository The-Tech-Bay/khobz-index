# Phase 7 — Verification

**Status:** ✅ Complete (2026-05-29)

**Goal:** Run the documented Phase 7 verification gate over the already-shipped Phases 1–6, confirm the Addendum UX work landed (Phase 3), remediate genuine breakages to green, and record results. Scope was strictly the documented gate in [`ship-todo.md`](../../ship-todo.md) §"Phase 7: Verification"; the in-flight Addendum UX work was verified, not re-implemented.

## 1. Mechanical gate

Run from `khobz-index/` (Bun):

| Check | Command | Result |
|-------|---------|--------|
| Install (lockfile) | `bun install --frozen-lockfile` | ✅ clean (65 installs, no changes) |
| Typecheck (root) | `bun run typecheck` | ✅ pass |
| Lint | `bun run lint` | ✅ 0 errors (29 pre-existing warnings; CI passes) |
| Format | `bun run format:check` | ✅ pass (after remediation, see §6) |
| Unit tests | `bun run test` | ✅ **147 pass / 0 fail** (652 assertions, 33 files) |
| Landing build | `bun run pages:build` | ✅ `pages:shard` (2 shards) + `tsc -b` + `vite build` (996 modules) |

Root `typecheck` (`tsc --noEmit`) covers the pipeline/engine/API; the landing app is typechecked separately by `pages:build` (`tsc -b`), which is why both are required.

## 2. Addendum UX work — confirmed shipped (Phase 3)

All six Addendum requirements (ship-todo §"Addendum — KKI UX Improvement Requirements") are wired and test-covered:

| # | Requirement | Evidence |
|---|-------------|----------|
| 1 | Separate global fallback from country KKI | [`landing/src/lib/rankingFilters.ts`](../../landing/src/lib/rankingFilters.ts) `splitRankingRecords` + `recordsForColorScale` (excludes `global_only` from map color scale); coverage metadata in fixture |
| 2 | Explain partial local rows below threshold | [`landing/src/lib/localCoverage.ts`](../../landing/src/lib/localCoverage.ts) `coverageSummaryText`; **60% threshold preserved** in [`src/engine/local-coverage.ts`](../../src/engine/local-coverage.ts) `LOCAL_BASKET_COVERAGE_THRESHOLD = 0.6` |
| 3 | Ranking UX filters + fallback section + footnote | [`RankingFilters.tsx`](../../landing/src/components/RankingFilters.tsx) (`local_only`/`include_partial`/`include_global`); footnote in [`CountryRanking.tsx`](../../landing/src/components/CountryRanking.tsx) |
| 4 | Country detail UX | `qualityLabel`/`basketSectionTitle` ("Available latest basket rows" for `global_only`), `hasPartialLocalRows`; consumed in [`CountryPage.tsx`](../../landing/src/pages/CountryPage.tsx) |
| 5 | Source-coverage roadmap | Documented (roadmap, not a UI feature) in [`docs/kki/kki-data-sources-research.md`](../kki/kki-data-sources-research.md) |
| 6 | US vs Morocco sanity checks | `usMoroccoSanityNote` in [`localCoverage.ts`](../../landing/src/lib/localCoverage.ts) |

Pipeline emits coverage metadata via `computeLocalCoverageSummary` in [`src/pipeline/lib/fixture-builder.ts`](../../src/pipeline/lib/fixture-builder.ts); covered by [`tests/unit/landing/local-coverage.test.ts`](../../tests/unit/landing/local-coverage.test.ts) and engine tests (all green in §1).

## 3. Stale-domain scan

Searched the `khobz-index/` public surface for `karama.thebay.ma/khobz`, `khobz-index-landing.pages.dev`, `kki-api.example.workers.dev`, `smail-elboukfaoui.workers.dev`, `i-bkf/karama`.

**Result: zero genuine violations.** All matches are legitimate:

- **Live config/public surfaces clean** — `openapi.yaml` uses relative `/` server (hostname marked private); `wrangler.jsonc` has no public routes; `landing/index.html`, `README.md`, `methodology.md`, `api-contract.md` carry no stale host.
- **Whitelisted** — the scan/ban list in `ship-todo.md`; the legacy/hard-cutover and ops-preview notes in [`runbook.md`](../ops/runbook.md) (explicitly "do not use in public copy"); the `verify-landing-urls.sh` checker; shipping-v1 history docs.
- `github.com/i-bkf` maintainer attribution in `GOVERNANCE.md`/`CONTRIBUTING.md`/`CODE_OF_CONDUCT.md` is intentional (per task-0.1).
- `*.workers.dev` references use placeholder `<subdomain>` and are marked closed/internal.

GitHub topology links resolve consistently to `The-Tech-Bay/khobz-index` across README, landing (`Layout.tsx`, `MethodologyPage.tsx`, `index.html`), `data/README.md`, issue templates, and workflows.

## 4. Prohibited-language scan

Searched for `coin`, `token`, `crypto`, `wallet`, `investment`, `lending app`, `buy KK`.

**Result: no consumer-facing violations.** Classification:

- **Technical (acceptable)** — `crypto.subtle`/`node:crypto`, OAuth/bearer `token` across `src/api/**`, `src/adapters/**`, architecture/contract docs, tests, `.env.example`.
- **Positive disclaimers (keep)** — `README.md`, `data/README.md`, `methodology.md`, `MethodologyPage.tsx` all state KKI is **not** a coin/token/investment.
- **Scan/ban lists & history** — `ship-todo.md`, `public-release-checklist.md`, phase0/1/2 deliverables.
- **Phase 5+ roadmap (acceptable)** — `kki_research.md` discusses an "Asset-backed-KK Coin" but explicitly gates it: "No 'Coin'/'tokenomics'/'buy KK' framing in any user-facing surface until Phase 5+." Properly labeled roadmap in the research authority doc, not live framing.

## 5. Link check

Verified relative targets in `README.md`, `docs/methodology.md`, `data/README.md`, and landing pages.

**Two genuine broken/overshooting links found and fixed:**

- [`docs/methodology.md`](../methodology.md) §9 — `../../../docs/kki/kki_research.md` and `.../kki-data-quality.md` resolved **outside** the repo. Repointed to the in-repo siblings `./kki/kki_research.md` and `./kki/kki-data-quality.md` (standalone-export safe).
- [`data/README.md`](../../data/README.md) — `../../docs/kki/kki-data-quality.md` pointed at the parent monorepo copy while an in-repo copy exists; repointed to `../docs/kki/kki-data-quality.md`, consistent with the doc's other in-repo `../docs/kki/` links.

All other relative targets (LICENSE, workflows, architecture docs, ops docs, `src/`/`tests/` references, governance/contributing/security, issue templates) resolve.

**Cross-repo dependency resolved:** `README.md` previously linked the parent-repo `../docs/kki/landing-mobile-map-ux.md` (no in-repo copy), which would 404 after a standalone export. The doc was brought in-repo as [`docs/kki/landing-mobile-map-ux.md`](../kki/landing-mobile-map-ux.md) with relative paths rewritten for its new location (`../../landing/...`), and the README link repointed to it. All public docs are now standalone-export safe — no remaining cross-repo `../docs/` overshoots.

## 6. Remediation (to green)

| Fix | File(s) | Why |
|-----|---------|-----|
| Format normalization | 15 in-flight files (`src/engine/*`, `scripts/enrich-fixture-local-coverage.ts`, `landing/src/lib/*`, addendum tests, `src/pipeline/lib/*`, etc.) | Addendum WIP was never run through Biome; `format:check` (and CI) would fail. Whitespace-only, non-regressive. |
| Exclude generated fixture data from Biome | [`biome.json`](../../biome.json) `files.includes` += `!**/landing/public/data/fixture/**` | `pages:shard` regenerates minified `manifest.json`, which Biome flagged — creating a `pages:build → format:check` failure loop. Now consistent with ignoring `dist`/`build`. Makes the gate deterministic. |
| Link fixes | `docs/methodology.md`, `data/README.md` | See §5. |

Post-remediation, the full gate is green **and stable** across the build→check cycle: regenerating the manifest then re-running `format:check` passes.

## Acceptance (ship-todo §"Phase 7" criteria)

- [x] Tests and build pass (`typecheck`, `lint`, `format:check`, 147 tests, `pages:build`)
- [x] No stale public domains outside intentional legacy/redirect docs
- [x] No prohibited product framing in user-facing surfaces
- [x] Docs distinguish implemented methodology from roadmap (verified in scan §4 + Phase 2)
- [x] Landing page and README stand alone without Karama app context (cross-repo doc link resolved; no remaining `../docs/` overshoots)

## Out of scope (captured, not done here)

- `git subtree split` export and DNS/Cloudflare dashboard actions (Phase 4/5 manual ops).
- Parent-repo `apps/mobile` i18n changes (cross-checked only for stale public KKI links).

## Related

- [`ship-todo.md`](../../ship-todo.md) Phase 7
- Phase 6: [`phase6-data-publication.md`](./phase6-data-publication.md)
- Release procedure: [`docs/ops/public-release-checklist.md`](../ops/public-release-checklist.md)
