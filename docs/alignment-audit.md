# Khobz-index documentation alignment audit

> **Task:** §2.6B of [`masterTODO.md`](../../docs/masterTODO.md)  
> **Status:** ✅ Complete  
> **Date:** 2026-05-11  
> **Purpose:** Reconcile `khobz-index` architecture/methodology docs with the authoritative [`docs/kki/kki_research.md`](../../docs/kki/kki_research.md) and Track A [`docs/architecture/api.md`](../../docs/architecture/api.md).

No changes in this pass required rework of any completed §2.1B–§2.5B deliverable (implementation unchanged; docs clarified only). One **forward** action is recorded for Track A §2.6A.

**Public ship baseline (2026-05-26):** Phase 0 audit for standalone KKI launch lives under [`docs/shipping v1/`](./shipping%20v1/README.md) (Karama-reference inventory, duplicate clutter, readiness summary). Use that pack before Phase 1+ copy or repo-export work in [`ship-todo.md`](../ship-todo.md).

---

## Change log (file → edit → rationale)

| ID | File | Change | Rationale |
|----|------|--------|-----------|
| T1 | [`docs/methodology.md`](./methodology.md) | After §5 source table: notes on **pipeline vs institutional** gold ordering and on **Yahoo/xe** as non-implemented tertiary backups | Aligns public methodology with [`stack.md`](./architecture/stack.md) without contradicting `kki_research.md` §4.1 narrative |
| T1 | [`docs/architecture/stack.md`](./architecture/stack.md) | After §5.1 fallback table: paragraph **Gold slot: institutional primary vs pipeline fetch order** | Explains why Goldprice.dev is first in code path while LBMA remains Tier-1 benchmark |
| T3 | [`docs/methodology.md`](./methodology.md) | §6: paragraph **Prose vs `methodology_version` field** (v1.0 shorthand vs `1.0.0` semver) | Removes ambiguity between human copy and Zod/API payloads |
| T4 | [`docs/methodology.md`](./methodology.md) | §2: **1 KK ≈ 1 day** (was `=`) | Matches authoritative caloric approximation in `kki_research.md` §3.1 |
| T6 | [`docs/architecture/stack.md`](./architecture/stack.md) | §3.7: paragraph **Sources evaluated but not implemented** (Yahoo Finance, xe.com) | Documents why redundancy chain stops at WB+EIA and Frankfurter+exchangerate.host |
| T7 | [`docs/methodology.md`](./methodology.md) | §3: Greek **α** in formula, bullets, and alpha table | Matches `kki_research.md` notation |
| T7 | [`docs/methodology.md`](./methodology.md) | Footer: link to `alignment-audit.md` and canonical `kki_research.md` | Discoverability |
| T2 | [`docs/kki/kki_research.md`](../../docs/kki/kki_research.md) | §7.2: exchange flow + **15 min** token; **`POST /auth/exchange`**; Worker as caller | Matches ratified [`api-contract.md`](./architecture/api-contract.md); removes stale “5-minute” + app-direct wording |
| T2 | [`docs/architecture/api-contract.md`](./architecture/api-contract.md) | §3.3: note **Authoritative TTL** — 15 min normative; `kki_research.md` §7.2 “5-minute” is superseded draft | Single source of truth for token lifetime remains §2.3B / OpenAPI |
| S1 / C4 | [`docs/architecture/api-contract.md`](./architecture/api-contract.md) | §8 table: `source_summary` is **typed array**, not “object or array”; new **§8.1 Track A schema correction (§2.6A)** | `z.record()` on Track A would reject Track B’s array; flagged for `api.md` fix |
| A1 | [`docs/architecture/architecture.md`](./architecture/architecture.md) | §3.1: **Prefix vs git path** — R2 keys omit `data/` | Same version segment as git `data/v1.0/…`, different root |
| N1 | [`docs/kki/kki_research.md`](../../docs/kki/kki_research.md); [`docs/methodology.md`](./methodology.md) | §3.3 + glossary: **Karama Kilocalorie Index** for scientific writing; **khobz** etymology; §1.1 in public methodology | Product direction: universal scientific label while keeping **Karama Khobz Index** as the public brand |

---

## Addendum (post–§2.6B)

| ID | Date | Note |
|----|------|------|
| N1 | 2026-05-11 | Scientific vs brand nomenclature documented (see change log row N1). |
| S2 | 2026-05-11 | **§3.1B.1** — `src/{adapters,engine,storage,api}/index.ts` barrel stubs; inline types mirror `stack.md` §2.1 / `data-schema.md` §3.1 until `src/shared/schema.ts` (§3.1B.2). |
| S3 | 2026-05-11 | **§3.1B.2** — `src/shared/schema.ts` (Zod + adapter contracts), `src/shared/countries.ts`, `zod` in `package.json`; tests parse `data-schema.md` §2.3 / §3.4 examples. |
| S5 | 2026-05-11 | **§3.4B Snapshot storage** — `src/storage/*`: dual JSON+CSV + `manifest.ts`/`history.ts` append-only coordinator, SHA-256 + R2 meta (`integrity.ts`), `reader.ts`, gzip-budgeted `bundle/karama-kki-bundle.json` generator; `tests/unit/storage/store.test.ts`; pipeline smoke calls `persistCountryMonth` / `persistApkBundle`. |
| S7 | 2026-05-11 | **§3.8B KKI Deployment** — [`wrangler.jsonc`](../wrangler.jsonc), [`scripts/cf-bootstrap.sh`](../scripts/cf-bootstrap.sh), repo-root [`../../.github/workflows/kki-weekly.yml`](../../.github/workflows/kki-weekly.yml), [`docs/ops/runbook.md`](./ops/runbook.md), [`docs/ops/first-run-2026-05-11.md`](./ops/first-run-2026-05-11.md); pipeline exports `build/r2-mirror/` + KV JSON; `src/api/middleware/observability.ts`. |
| P4 | 2026-05-28 | **Phase 4 domain wiring** — canonical `khobz-index.thebay.ma`; `kilocalorie-index.thebay.ma` 301 via [`landing/functions/_middleware.ts`](../landing/functions/_middleware.ts); public vs internal URLs in runbook; no public KKI API hostname in OpenAPI/README. See [`phase4-domain-wiring.md`](./shipping%20v1/phase4-domain-wiring.md). |
| P5 | 2026-05-28 | **Phase 5 public GitHub readiness** — `The-Tech-Bay/khobz-index` links in `data/README.md`; SECURITY.md + source correction template; README CI dual-mode; runbook Worker URL redacted; export runbook. See [`phase5-public-github-readiness.md`](./shipping%20v1/phase5-public-github-readiness.md). |
| P6 | 2026-05-29 | **Phase 6 data publication + citation** — `data/README.md` canonical monthly-grain section + neutral The Tech Bay attribution/BibTeX; new [`docs/ops/public-release-checklist.md`](./ops/public-release-checklist.md) cross-linked from runbook + README. See [`phase6-data-publication.md`](./shipping%20v1/phase6-data-publication.md). |
| P8 | 2026-06-05 | **Phase 8 automated mirroring** — mirror-only policy; Karama [`.github/workflows/khobz-index-mirror.yml`](../../../.github/workflows/khobz-index-mirror.yml); `mirror:verify` gate; FAOSTAT `PIPELINE_FILL_TO` + `extendForwardFillThroughTarget`; launch cutover checklist. See [`docs/ops/public-repo-export.md`](./ops/public-repo-export.md), [`launch-cutover-checklist.md`](./ops/launch-cutover-checklist.md). |
| H1 | 2026-09-03 | **Landing history collapse** — weekly run 33397222218 published 6 months/country under a 439-month `manifest.months` list. Merge/density/required-previous guards added in `fixture-publish.ts`; live restore via `scripts/restore-landing-history.ts`. **Doc drift:** public methodology prose still says v1.0 / 1.0.0; engine/`methodology_version` on the fixture may be **1.1.0**. Do not treat that mismatch as a reason to skip additive history merge. |

## Verification summary

### Terminology (KKI, KK, semver, basket_version, tiers)

- **KKI** — **Karama Khobz Index** (public brand). **Karama Kilocalorie Index** is the optional formal name in scientific documents (same **KKI**); see `kki_research.md` §3.3 and [`methodology.md`](./methodology.md) §1.1.
- **KK** — Khobz unit / ~1 day staple subsistence; §2 now uses **≈** per research doc.
- **`methodology_version`** — Full semver `MAJOR.MINOR.PATCH` in schemas; prose “v1.0” explained in methodology §6.
- **`basket_version`** — Pattern `{region}-v{X.Y}` unchanged per [`data-schema.md`](./architecture/data-schema.md) §4.2.
- **Tiers** — **Tier 1 / Tier 2 / Tier 3** and **Tier-1** hyphenated form in tables both appear in `stack.md`; meaning is consistent (institutional vs national vs wrapper).

### Schema ↔ API contract

- **`IndexRecord`** fields in [`api-contract.md`](./architecture/api-contract.md) §2.2 match [`data-schema.md`](./architecture/data-schema.md) §3.1 (14 fields). **`source_summary`** is only field that needed cross-track clarification (§8.1).

### Architecture ↔ stack

- DAG in [`architecture.md`](./architecture/architecture.md) §1 references `SourceAdapter`, Zod, GH Actions + Bun, R2/KV — consistent with [`stack.md`](./architecture/stack.md).
- R2 key convention vs `data/` paths documented in architecture §3.1.

### Cross-track (Track A proxy)

- `kki_value` → `kk_value`, `methodology_version` → `kki_version`, month `YYYY-MM` vs `YYYY-MM-01` unchanged and documented.
- **Action:** [`docs/architecture/api.md`](../../docs/architecture/api.md) `KkiRateCacheRowSchema.source_summary` must accept arrays (§2.6A).

### Methodology version

- Active methodology line remains **v1.0** / **`1.0.0`** in examples; no doc asserted a conflicting version number.

### Internal links (khobz-index)

- Spot-checked: `../methodology.md`, `./stack.md`, `./data-schema.md`, `./api-contract.md`, `./openapi.yaml`, `../../../docs/...` paths from `khobz-index/docs/architecture/` resolve within the parent repository layout (Karama checkout containing `khobz-index/`).
- [`docs/architecture/alignment-audit.md`](../../docs/architecture/alignment-audit.md) (Track A §2.6A) did **not** exist at audit time — expected; no false link added from khobz-index to that path.

---

## Impact (STOA)

| Area | Impact |
|------|--------|
| §2.1B–§2.5B code/workflow | **None** — documentation only |
| Track A | **§2.6A** should update `api.md` Zod sketch for `source_summary` + optionally align `kki_research.md` §7.2 token duration prose |

---

*End of §2.6B alignment audit.*
