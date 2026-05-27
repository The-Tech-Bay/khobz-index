# KKI Public Ship TODO

Purpose: prepare `khobz-index` to ship as a public, scientifically credible, standalone KKI repository and landing page.

Scope: communication, methodology, landing-page wording, domain wiring, public GitHub readiness, and research/documentation alignment. This document is an execution guide for AI multitask agents. It is not a changelog and does not itself implement the changes.

Canonical public identity:

- Public/product name: **Karama Khobz Index (KKI)**.
- Scientific/formal name: **Karama Kilocalorie Index (KKI; branded Karama Khobz Index)**.
- Unit: **KK**, approximately one day of staple subsistence calories.
- Avoid: coin, token, buy KK, cryptocurrency, wallet, investment, lending app.
- Domain target: `https://khobz-index.thebay.ma`.
- Scientific-name redirect: `https://kilocalorie-index.thebay.ma` -> `https://khobz-index.thebay.ma/`.
- API target: no public KKI API for v1; any API hostname remains private/internal unless a later release explicitly opens it.
- Legacy URL policy: hard cutover from `https://karama.thebay.ma/khobz`; do not keep it as a public canonical URL.

## Operating Rules

- Do not weaken the scientific standard to improve marketing copy.
- Separate **implemented v1.0** from **roadmap/research** everywhere.
- Keep observed records, CPI-chained records, and calibrated/estimated records visibly distinct.
- Do not present annual CPI-derived data as monthly precision.
- Do not imply current KKI is a currency, token, investment product, wallet, or lending system.
- Do not remove Karama attribution entirely; rewrite it as origin/creator context, not a runtime dependency.
- Before deleting files, confirm they are duplicate/unneeded public-launch clutter.
- After any implementation pass, update relevant docs and run tests/build checks.

## Reference Inventory

### Communication and Naming

- `../docs/strategy/communication-kit/README.md`
  - Canonical brand voice, do/don't vocabulary, legal boilerplate, audience framing.
- `../docs/strategy/communication-kit/channel-copy.md`
  - Website, store, press, social, founder DM, waitlist copy.
- `../docs/strategy/communication-kit/translations.md`
  - Translation table and localization rules. New public strings should be reflected here when relevant.
- `../docs/project/principles.md`
  - KKI is published, not issued. Reference-KK doctrine.
- `../docs/architecture/alignment-audit.md`
  - Cross-doc glossary and canonical Karama domain history.

### KKI Methodology and Research

- `../docs/kki/kki_research.md`
  - Deepest research/spec authority. Contains product context, scientific rationale, risks, and long-form methodology.
- `docs/methodology.md`
  - Public methodology intended for landing page. Must become the clean “as implemented v1.0” source.
- `../docs/kki/kki-data-quality.md`
  - Current implementation truth: benchmark CSV fallback, FAOSTAT producer-price proxy, CPI backcast, source caveats.
- `../docs/kki/kki-data-sources-research.md`
  - Source roadmap: FPMA, IMF Food CPI, Eurostat, BLS, MoSPI, etc. Not all implemented.
- `../docs/kki/historical-kki-implementation.md`
  - Historical CPI, chart provenance, component-aware backcast, splice diagnostics.
- `docs/architecture/data-schema.md`
  - Public/research schema reference.
- `docs/architecture/stack.md`
  - Implemented adapter/pipeline stack.
- `docs/architecture/architecture.md`
  - Runtime architecture and pipeline cadence.

### Landing and Domain Wiring

- `landing/index.html`
  - SEO title, description, canonical URL, Open Graph/Twitter metadata, JSON-LD.
- `landing/src/pages/HomePage.tsx`
  - Landing hero, map/ranking copy, public positioning.
- `landing/src/pages/MethodologyPage.tsx`
  - Public methodology page copy and outbound docs links.
- `landing/src/pages/CountryPage.tsx`
  - Chart copy, provenance UX, basket table wording.
- `landing/src/components/Layout.tsx`
  - Nav, footer, GitHub link, license copy.
- `landing/src/components/SalaryCalculator.tsx`
  - Old-money / purchasing-power calculator wording.
- `landing/public/_redirects`
  - SPA fallback.
- `landing/vite.config.ts`
  - Base path behavior. No base change should be needed for subdomain-root deployment.
- `wrangler.jsonc`
  - Worker/API config; keep API hostnames private/internal for v1 unless a later release explicitly opens a public API.
- `docs/architecture/openapi.yaml`
  - API server URL.
- `docs/ops/runbook.md`
  - Deploy/verification URLs and manual ops.
- `../apps/api/wrangler.toml`
  - Parent Karama API upstream `KKI_API_URL`.
- `../apps/mobile/src/lib/i18n/en.ts`
- `../apps/mobile/src/lib/i18n/fr.ts`
- `../apps/mobile/src/lib/i18n/ar.ts`
  - `learnMoreUrl` and any public KKI links in mobile copy.

### Public GitHub Readiness

- `README.md`
  - Public GitHub front door.
- `data/README.md`
  - Public data/citation guide.
- `LICENSE`
  - MIT license for code.
- `LICENSE-DATA`
  - CC BY 4.0 data license.
- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `CODE_OF_CONDUCT.md`
- `.github/ISSUE_TEMPLATE/`
- `.github/workflows/ci.yml`
- `.github/workflows/kki-weekly.yml`
- `.github/workflows/publish.yml`
- `package.json`
- `landing/package.json`
- `.env.example`

### Public Repo Export Strategy

`khobz-index/` is currently developed as an inline directory inside the private Karama monorepo, not as a Git submodule. This is intentional for now: Karama remains the working source of truth, while the public `khobz-index` repository should be created from this directory when launch-ready.

Recommended launch path:

- Keep daily development inside `karama/khobz-index/`.
- Before public release, audit `khobz-index/` for secrets, private URLs, internal-only notes, and misleading Karama runtime dependencies.
- Export the directory to a standalone public repo, preferably with `git subtree split --prefix=khobz-index`.
- Push the split branch to `github.com/The-Tech-Bay/khobz-index`.
- After launch, decide whether the public repo is synced manually, mirrored from Karama, or becomes the primary Track B repository.

Do not reintroduce a submodule during this ship pass unless there is a deliberate decision to accept the CI and cross-repo access complexity.

## Phase 0: Baseline Audit

Goal: produce a precise inventory before changing copy or docs.

**Status (2026-05-26):** ✅ Audit complete — deliverables in [`docs/shipping v1/`](docs/shipping%20v1/README.md):

- [Readiness summary](docs/shipping%20v1/phase0-readiness-summary.md) — acceptance criteria, blockers, Phase 1 decisions
- [Task 0.1 reference inventory](docs/shipping%20v1/task-0.1-karama-reference-inventory.md)
- [Task 0.2 duplicate clutter inventory](docs/shipping%20v1/task-0.2-duplicate-clutter-inventory.md)

Implementation fixes (copy, domains, methodology truth) remain for Phases 1–7. **Task 0.2** (`* 2.*` deletion) ✅ 2026-05-26. Standalone public framing and domain wiring still open.

**Phase 1 (2026-05-26):** ✅ Complete for naming, cadence, and country-coverage alignment — deliverable [`docs/shipping v1/phase1-identity-alignment.md`](docs/shipping%20v1/phase1-identity-alignment.md). Human decisions **D1–D4** recorded in [`docs/shipping v1/decisions-d1-d4-guide.md`](docs/shipping%20v1/decisions-d1-d4-guide.md); implementation remains for later phases.

### Task 0.1: Inventory Karama-specific references inside `khobz-index`

Inputs:

- `khobz-index/`
- Search terms:
  - `Karama`
  - `karama`
  - `karama.thebay.ma`
  - `apps/mobile`
  - `confirm-web`
  - `Supabase`
  - `promise`
  - `settle`
  - `The-Tech-Bay`
  - `i-bkf`
  - `smail-elboukfaoui`

Execution notes:

- Classify every reference as:
  - keep as attribution,
  - rewrite as standalone KKI context,
  - move to parent Karama docs,
  - delete as internal/private,
  - leave because it is a legitimate integration reference.

Output:

- A table in the implementation notes or PR description with path, current reference, action, and rationale.

Acceptance criteria:

- No hidden parent-app dependencies remain in public-facing KKI docs.
- Any remaining Karama reference reads as attribution or integration context, not as required app context.

### Task 0.2: Inventory duplicate/stray public-launch clutter

Inputs:

- `khobz-index/`
- Known duplicate candidates:
  - `README 2.md`
  - `LICENSE 2`
  - `LICENSE-DATA 2`
  - `package 2.json`
  - `wrangler 2.jsonc`
  - `bun 2.lock`
  - `biome 2.json`
  - `lefthook 2.yml`
  - `tsconfig 2.json`
  - `.gitignore 2`
  - `CODE_OF_CONDUCT 2.md`
  - `CONTRIBUTING 2.md`
  - `GOVERNANCE 2.md`

Execution notes:

- Compare duplicate content against canonical files before deletion.
- If duplicates contain unique content, merge intentionally into canonical files before deleting.

Acceptance criteria:

- No `* 2.*` duplicate files remain in public repo surface unless explicitly justified.

## Phase 1: Public Identity and Communication Alignment

**Status (2026-05-26):** Tasks **1.1–1.3** implemented for copy/cadence/coverage — deliverable [`docs/shipping v1/phase1-identity-alignment.md`](docs/shipping%20v1/phase1-identity-alignment.md). **Blocked:** README "Used By" (**D2**), all canonical/OG/`learnMoreUrl` URLs (**D4**), press boilerplate URLs (**D4**), GitHub topology links (**D1**).

Goal: make all public-facing copy use one naming system and avoid Karama-app-only framing.

### Task 1.1: Lock naming rules in communication docs

Files:

- `../docs/strategy/communication-kit/README.md`
- `../docs/strategy/communication-kit/translations.md`
- `../docs/strategy/communication-kit/channel-copy.md`
- `docs/methodology.md`
- `README.md`

Required wording:

- Consumer first mention: `Karama Khobz Index (KKI)`.
- Scientific first mention: `Karama Kilocalorie Index (KKI; branded Karama Khobz Index)`.
- Short unit explanation: `1 KK is approximately one day of staple subsistence calories`.
- Explicit ban list: coin, token, buy KK, crypto, investment, lending app.

Execution notes:

- Do not put `Kilocalorie` prominently in consumer hero copy unless it is a footnote or methodology context.
- Do not use `Kilokalory` in English copy. If a locale requires a variant, document it in `translations.md`.

Acceptance criteria:

- Communication docs and KKI methodology agree on naming.
- Public copy has no ambiguous coin/token framing.

### Task 1.2: Standardize cadence sentence

Files:

- `README.md`
- `docs/methodology.md`
- `landing/index.html`
- `landing/src/pages/HomePage.tsx`
- `landing/src/pages/MethodologyPage.tsx`
- `docs/architecture/architecture.md`
- `docs/ops/runbook.md`
- Parent references if applicable:
  - `../docs/design/userFlows/flows/M17-inflation-anchor.md`
  - `../apps/mobile/src/lib/i18n/en.ts`
  - `../apps/mobile/src/lib/i18n/fr.ts`
  - `../apps/mobile/src/lib/i18n/ar.ts`

Canonical sentence:

> KKI refreshes source checks weekly and publishes canonical country records at monthly grain.

Execution notes:

- Use this sentence or a close variant in public docs.
- Do not say “weekly index” unless immediately clarified.
- Keep “monthly archive grain” for technical docs.

Acceptance criteria:

- README badges, landing copy, methodology FAQ, and app learn-more copy do not contradict each other.

### Task 1.3: Align country coverage wording

Inputs:

- Current fixture: `landing/src/data/fixture-snapshot.json`
- Data-quality doc: `../docs/kki/kki-data-quality.md`
- README and landing metadata.

Execution notes:

- Use definitions rather than a single ambiguous number:
  - `238 countries in fixture`
  - `~N countries with current local basket signal` (derive from latest fixture if implementing)
  - `countries without local signal remain global-only`
- Do not claim `245 countries` or `retail market prices everywhere`.

Acceptance criteria:

- Country count copy has a clear definition and matches current data.

## Phase 2: Methodology Truthfulness and Scientific Standard

Goal: make public methodology reflect actual implemented v1.0 and separate roadmap from live claims.

**Status (2026-05-27):** ✅ Complete — public methodology, long-form research,
source research, and data-quality supplement now distinguish implemented v1.0
from roadmap/research claims. Deliverable:
[`docs/shipping v1/phase2-methodology-truthfulness.md`](docs/shipping%20v1/phase2-methodology-truthfulness.md).

### Task 2.1: Rewrite public methodology as “v1.0 as implemented”

File:

- `docs/methodology.md`

Must include:

- KK definition and basket formula.
- Source cadence clarification.
- Current local leg source:
  - FAOSTAT producer-price proxy,
  - markup/interpolation/forward-fill caveat,
  - WFP/other sources only if implemented in cascade.
- Global leg source:
  - FAO FPI / benchmark CSV fallback,
  - Brent,
  - gold.
- Historical estimates:
  - CPI-chained pre-observation era,
  - Food CPI preferred,
  - Headline CPI fallback,
  - annual CPI is annual-grain,
  - component-aware local/global backcast,
  - splice diagnostics.
- Limitations:
  - producer vs retail,
  - headline CPI vs food CPI,
  - fixed basket / Laspeyres interpretation,
  - no hidden smoothing.

Acceptance criteria:

- A researcher can read `docs/methodology.md` and understand what is implemented today.
- No roadmap source is described as live.

### Task 2.2: Reconcile long-form research document

File:

- `../docs/kki/kki_research.md`

Required changes:

- Mark implemented vs planned sections clearly.
- Ensure WFP-primary / FAOSTAT-primary / FPMA-roadmap conflict is resolved.
- Keep scientific rigor:
  - index-number theory,
  - fixed-basket caveat,
  - proxy deflator caveat,
  - splice/calibration governance,
  - versioned methodology.
- Make clear that KKI is not a CPI replacement; it is a staple-food reference index.

Acceptance criteria:

- `kki_research.md` can be public or semi-public without overstating the current pipeline.
- Roadmap items are not confused with implemented methodology.

### Task 2.3: Reclassify source research

File:

- `../docs/kki/kki-data-sources-research.md`

Required structure:

- Implemented v1.0.
- Validated/approved roadmap.
- Research candidates.
- Deferred / not implemented.

Specific items to classify:

- FAOSTAT producer proxy: implemented.
- World Bank WDI headline CPI: implemented.
- World Bank WDI food CPI: supported by script if available; coverage diagnostics required.
- FPMA: roadmap.
- IMF monthly Food CPI: roadmap/research.
- Eurostat/BLS/MoSPI: roadmap/specialized sources.
- Implicit FX: roadmap/research.
- Basket v1.1 eggs/substitution: roadmap, not v1.0.

Acceptance criteria:

- Source document cannot be misread as claiming FPMA/IMF/Eurostat/BLS/MoSPI are already live.

### Task 2.4: Update data quality supplement

File:

- `../docs/kki/kki-data-quality.md`

Must include:

- Practical implementation truth.
- Known limitations.
- What the landing graph colors mean.
- Why annual headline CPI is low-confidence.
- How fixture diagnostics should be interpreted.

Acceptance criteria:

- Data-quality doc explains graph behavior and source caveats in plain, scientifically careful language.

## Phase 3: Landing Page Copy and Public UX

Goal: make the landing page understandable without Karama app context.

### Task 3.1: Update SEO and metadata

File:

- `landing/index.html`

Required updates:

- Canonical URL: `https://khobz-index.thebay.ma/`.
- OG URL: `https://khobz-index.thebay.ma/`.
- JSON-LD URL: `https://khobz-index.thebay.ma/`.
- Title/description should use `Karama Khobz Index (KKI)`.
- Description should avoid overclaiming retail precision.

Acceptance criteria:

- Search/social previews show standalone KKI, not Karama app dependency.

### Task 3.2: Update landing hero and page copy

Files:

- `landing/src/pages/HomePage.tsx`
- `landing/src/pages/MethodologyPage.tsx`
- `landing/src/components/Layout.tsx`
- `landing/src/pages/CountryPage.tsx`
- `landing/src/components/SalaryCalculator.tsx`

Required copy themes:

- Explain KKI as open food-purchasing-power data.
- Keep `Karama Khobz Index` primary.
- Add scientific alias in methodology, not as consumer headline.
- Clarify annual CPI estimates and observed data boundaries where charts appear.
- Keep “latest observed basket” semantics for commodity table.
- Fix any broken docs/GitHub links.

Acceptance criteria:

- A journalist, economist, or developer can understand the landing page without knowing Karama promises.

### Task 3.3: Align translation/source strings

Files:

- `../docs/strategy/communication-kit/translations.md`
- `../apps/mobile/src/lib/i18n/en.ts`
- `../apps/mobile/src/lib/i18n/fr.ts`
- `../apps/mobile/src/lib/i18n/ar.ts`

Required updates:

- `learnMoreUrl` points to the chosen public landing domain if still present.
- Add any new public KKI strings to translation source table.
- Keep Darija marketing-only rule unless explicitly changed.

Acceptance criteria:

- Public links in app copy do not point to stale `karama.thebay.ma/khobz` unless deliberately using redirect.

## Phase 4: Domain Wiring

Goal: prepare domain configuration for launch.

### Task 4.1: Landing domain

Target:

- `khobz-index.thebay.ma` -> Cloudflare Pages project `khobz-index-landing`.

Files to update:

- `landing/index.html`
- `docs/ops/runbook.md`
- `README.md`
- `data/README.md`
- Any docs mentioning `karama.thebay.ma/khobz`.

Cloudflare action:

- Add `khobz-index.thebay.ma` as custom Pages domain.
- Add `kilocalorie-index.thebay.ma` as a scientific-name redirect to `khobz-index.thebay.ma`.
- Hard-cut `karama.thebay.ma/khobz`; remove it from public canonical links rather than preserving it as a compatibility redirect.

Acceptance criteria:

- Landing can run at subdomain root without Vite basename changes.

### Task 4.2: Private API configuration

Target:

- No public KKI API for v1.
- Keep Worker/API hostnames private/internal unless a later release explicitly opens a public API.

Files to update:

- `wrangler.jsonc`
- `docs/architecture/openapi.yaml`
- `docs/ops/runbook.md`
- `../apps/api/wrangler.toml`

Acceptance criteria:

- Public docs do not present an official public API endpoint.
- Closed API docs, Karama API upstream, and runbook clearly mark any Worker/API hostname as private/internal.

## Phase 5: Public GitHub Repo Readiness

Goal: make `khobz-index/` safe and credible as a public repo.

### Task 5.1: Decide topology

Options:

- Standalone repo: `The-Tech-Bay/khobz-index`.
- Monorepo path: `The-Tech-Bay/karama/tree/main/khobz-index`.

Recommendation:

- Use standalone `The-Tech-Bay/khobz-index` for clarity, open data, and methodology credibility.

Inputs:

- `README.md`
- `.github/workflows/`
- parent `.github/workflows/kki-weekly.yml`
- `data/README.md`
- `landing/src/components/Layout.tsx`

Acceptance criteria:

- All GitHub links point to the chosen final topology.

### Task 5.2: Clean public repo surface

Files/areas:

- Duplicate `* 2.*` files.
- Personal URLs in `docs/ops/runbook.md`.
- Placeholder org/repo strings in `data/README.md`.
- Pre-publication markers in `README.md` and `docs/methodology.md`.
- `package.json` and `landing/package.json` `private` fields.

Execution notes:

- Do not remove `private: true` automatically unless the package is intended for npm publication. For a public repo that is not published to npm, `private: true` can be acceptable. Decide explicitly and document it.

Acceptance criteria:

- Public visitor sees no local duplicate clutter, personal deployment URLs, or unresolved placeholders.

### Task 5.3: Add missing public policies

Files:

- `SECURITY.md` (new if absent)
- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `CODE_OF_CONDUCT.md`
- `.github/ISSUE_TEMPLATE/`

Required content:

- Security contact and disclosure policy.
- Data/methodology issue path.
- Basket proposal path.
- Source correction path.

Acceptance criteria:

- GitHub repo meets basic open-source trust expectations.

### Task 5.4: Reconcile CI/workflows

Inputs:

- Parent `.github/workflows/kki-weekly.yml`
- `khobz-index/.github/workflows/ci.yml`
- `khobz-index/.github/workflows/kki-weekly.yml`
- `khobz-index/.github/workflows/publish.yml`

Required decisions:

- If standalone, production weekly workflow must live in `khobz-index/.github/workflows/`.
- Remove or update stub workflow.
- Confirm required secrets are documented:
  - Cloudflare token/account.
  - KV namespace.
  - R2 bucket.
  - GitHub release token if needed.
  - Pinata/Internet Archive if archive mirrors enabled.

Acceptance criteria:

- Public repo CI instructions match actual workflow files.

## Phase 6: Data Publication and Citation

Goal: make the public data archive usable by researchers.

### Task 6.1: Finalize data README

File:

- `data/README.md`

Required updates:

- Final repo URL.
- Release URL pattern.
- JSON/CSV file naming.
- License and attribution.
- Citation format.
- DOI placeholder or “DOI pending” status.
- Explanation of canonical monthly grain.
- Link to methodology and schema.

Acceptance criteria:

- A researcher can cite and download the KKI dataset without reading internal docs.

### Task 6.2: Add public release checklist

File:

- `docs/ops/runbook.md` or new `docs/ops/public-release-checklist.md`.

Checklist:

- Regenerate fixture.
- Run tests.
- Build landing.
- Deploy landing.
- Deploy API.
- Verify custom domains.
- Create monthly release.
- Verify release assets.
- Verify public README links.
- Verify no private references.

Acceptance criteria:

- Release process is repeatable by a new maintainer.

## Phase 7: Verification

Run after implementation:

```bash
cd khobz-index
bun test tests/unit
bun run typecheck
bun run pages:build
```

Recommended additional checks:

- Link check for `khobz-index/README.md`, `docs/methodology.md`, `data/README.md`, and landing links.
- Search for stale domains:
  - `karama.thebay.ma/khobz`
  - `khobz-index-landing.pages.dev`
  - `kki-api.example.workers.dev`
  - `smail-elboukfaoui.workers.dev`
  - `i-bkf/karama`
- Search for prohibited language:
  - `coin`
  - `token`
  - `crypto`
  - `buy KK`
  - `wallet`
  - `investment`
  - `lending app`

Acceptance criteria:

- Tests and build pass.
- No stale public domains remain outside intentional legacy redirect docs.
- No prohibited product framing remains.
- Docs distinguish implemented methodology from roadmap.
- Landing page and README stand alone without requiring Karama app context.

## Suggested Multitask Agent Split

### Agent A: Communication and Naming

Scope:

- Communication kit.
- Landing copy.
- README front matter.
- Translation source rows.

Inputs:

- `../docs/strategy/communication-kit/README.md`
- `../docs/strategy/communication-kit/channel-copy.md`
- `../docs/strategy/communication-kit/translations.md`
- `landing/src/pages/HomePage.tsx`
- `landing/src/pages/MethodologyPage.tsx`
- `README.md`

Return:

- List of changed copy surfaces.
- Naming/cadence consistency report.

### Agent B: Methodology and Research

Scope:

- Scientific and methodology docs.
- Implemented vs roadmap classification.

Inputs:

- `docs/methodology.md`
- `../docs/kki/kki_research.md`
- `../docs/kki/kki-data-quality.md`
- `../docs/kki/kki-data-sources-research.md`
- `../docs/kki/historical-kki-implementation.md`
- `docs/architecture/data-schema.md`

Return:

- Scientific claims changed.
- Remaining external-review or DOI gaps.

### Agent C: Domains and Landing Metadata

Scope:

- Domain references.
- SEO/canonical/OG.
- API URL docs/config.

Inputs:

- `landing/index.html`
- `wrangler.jsonc`
- `docs/architecture/openapi.yaml`
- `docs/ops/runbook.md`
- `../apps/api/wrangler.toml`
- mobile i18n files.

Return:

- Domain wiring checklist.
- Config changes requiring Cloudflare dashboard action.

### Agent D: Public GitHub Readiness

Scope:

- Repo cleanup.
- README/data README.
- Security policy.
- Workflow reconciliation.

Inputs:

- `README.md`
- `data/README.md`
- `.github/workflows/`
- parent `.github/workflows/kki-weekly.yml`
- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `CODE_OF_CONDUCT.md`
- duplicate file inventory.

Return:

- Public repo readiness checklist.
- Remaining manual GitHub settings.

## Definition of Done

- `khobz-index` can be read as a standalone public project.
- Public methodology reflects implemented v1.0 and latest scientific enhancements.
- Research docs maintain high macroeconomics/inflation standards and clearly mark roadmap work.
- Landing page uses final public domains and careful scientific wording.
- GitHub repo has clean README, licensing, governance, contribution, security, data citation, and workflows.
- Tests/build pass.
- Final review finds no stale private URLs or misleading Karama-app dependencies.

---

## Addendum — KKI UX Improvement Requirements

These requirements come from the latest landing-page audit after the scientific KKI UX work. They should be handled without weakening the current 60% local-basket coverage gate or hiding methodological uncertainty.

### 1. Separate Global Fallback From Country-Specific KKI

- Do not rank `global_only` countries as if their identical USD value is country-specific.
- Group or visually de-emphasize `global_only` countries in rankings with copy such as: “Global fallback only — insufficient local basket coverage.”
- On map and country detail pages, distinguish:
  - `full` — complete observed local basket.
  - `degraded` — observed local basket above coverage threshold, but missing some items.
  - `global_only` — local basket suppressed; KKI uses global commodity track only.
- Add local coverage metadata to public UI where practical:
  - number of priced basket items,
  - nominal basket weight covered,
  - whether local leg was accepted or suppressed.

### 2. Explain Partial Local Rows Below Threshold

- For countries like Luxembourg, show that local rows may exist but still be below the acceptance threshold.
- Example explanation: “2 of 5 local basket items available, covering 9.3% of nominal basket weight; below the 60% threshold, so the local leg is suppressed.”
- Keep the 60% threshold unless a documented methodology change is approved; relaxing it would risk false precision.

### 3. Improve Ranking UX

- Add filters/toggles for:
  - “Observed local only”
  - “Include partial local”
  - “Include global fallback”
- Consider a separate “Global fallback countries” collapsible section below the main ranking.
- Do not let 100+ identical fallback values dominate “most expensive” or “least expensive” lists.
- Add a ranking footnote explaining that identical fallback values reflect shared global commodity pricing, not equal local food costs.

### 4. Improve Country Detail UX

- In the hero/meta row, show a stronger fallback label for `global_only`.
- In the basket breakdown section, show:
  - available local rows,
  - coverage weight,
  - missing high-weight basket items,
  - whether local prices are used in the KKI formula.
- Rename “Latest observed basket breakdown” to “Available latest basket rows” when `quality = global_only` but some rows exist below threshold.
- Keep local/global split cards, but add copy that the local leg is `0` because coverage failed the threshold, not because food is free.

### 5. Source-Coverage Roadmap

- Prioritize better local sources for high-visibility markets and countries currently stuck at `global_only`:
  - US: BLS Average Retail Food Prices.
  - EU/OECD: Eurostat HICP food sub-index and/or national statistical retail food datasets.
  - Developing markets: FAO FPMA, WFP/HDX, World Bank RTFP.
  - Universal fallback: IMF Food CPI for local basket movement when item-level prices are absent.
- Preserve provenance by source and confidence. Better source coverage should improve quality labels; it should not silently backfill weak data as observed.

### 6. US vs Morocco Sanity Checks

- Add an explicit validation note for high-visibility comparisons such as US vs Morocco.
- The current formula can make Morocco’s KKI higher than the US because Morocco’s observed local basket leg is higher in USD and US industrial food inputs are low-cost.
- However, US exact levels should be validated against BLS retail prices because FAOSTAT producer-price proxies may understate true retail basket costs.
- Treat US BLS integration as a source-quality upgrade before making strong public claims about the absolute US level.
