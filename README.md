# Karama Khobz Index (KKI)

[![License: MIT](https://img.shields.io/badge/Code-MIT-blue.svg)](LICENSE)
[![License: CC BY 4.0](https://img.shields.io/badge/Data-CC%20BY%204.0-lightgrey.svg)](LICENSE-DATA)
[![Cadence](https://img.shields.io/badge/cadence-monthly-green.svg)]()
[![Countries](https://img.shields.io/badge/countries-238%20in%20fixture-orange.svg)]()

A published reference index measuring the local-currency cost of one day of staple subsistence calories (~2,200 kcal per KK). KKI refreshes source checks weekly and publishes canonical country records at monthly grain.

---

## What is 1 KK?

**1 KK (Khobz unit) ≈ 1 day of staple subsistence calories for one adult (~2,200 kcal).**

The biology is universal even when the menu is not. A Casablancan and a Mumbaikar both need ~2,200 kcal/day — KKI measures what that costs in local currency at **monthly archive grain**, using observed and estimated prices from UN/multilateral datasets (not retail market prices everywhere).

KKI is a **published reference index**, not a coin, token, cryptocurrency, investment product, wallet, or lending app. It has the same legal status as the Big Mac Index, the IMF SDR rate, or Colombia's UVR.

**Coverage (definitions):** **238 countries** appear in the public landing fixture; **~46** currently carry a local basket price signal in the latest month; countries without a qualifying local signal remain on the **global-only** track.

---

## How It Works

### Hybrid Weighting Formula

```
KKI(C, t) = α × LOCAL_basket(C, t) + (1 − α) × GLOBAL_basket(t)
```

| Parameter | Meaning |
|---|---|
| `C` | Country / market |
| `t` | Time period (month) |
| `α` | Local weight (default 0.65; tuneable per market) |
| `LOCAL_basket(C, t)` | Weighted average price of the regional staple basket — **automated pipeline order:** FAOSTAT consumer prices (then WFP VAM when OAuth works) |
| `GLOBAL_basket(t)` | Composite of FAO Food Price Index (cereals + oils + sugar) + World Bank Pink Sheet energy (Brent) + LBMA Gold Fix (XAU spot) |

### Regional Baskets

Each basket is calibrated to ~7 days of subsistence (~15,300 kcal):

| Region | Basket name | Items | Approx. kcal |
|---|---|---|---|
| MENA / North Africa | Khobz basket | Wheat flour 1 kg + cooking oil 1 L + sugar 1 kg + pulses 1 kg | ~15,400 |
| South Asia | Atta basket | Atta 1 kg + rice 1 kg + dal 1 kg + edible oil 1 L | ~15,200 |
| East / Southern Africa | Sadza/Ugali basket | Maize meal 1 kg + cooking oil 1 L + dried beans 1 kg + sugar 1 kg | ~15,300 |
| West Africa | Riz basket | Rice 1 kg + cassava/yam 1 kg + palm oil 1 L + dried fish 0.5 kg | ~15,100 |
| East Asia | Mihan basket | Rice 1 kg + cooking oil 1 L + soy 1 kg + sugar 1 kg | ~15,300 |
| Latin America | Tortilla basket | Maize/wheat flour 1 kg + oil 1 L + black beans 1 kg + sugar 1 kg | ~15,400 |
| OECD / Europe / N. America | Loaf basket | Wheat bread 1 kg + dairy 1 L + cooking oil 1 L + sugar 1 kg + eggs 12 ct | ~15,500 |

### Data Sources

| Data slot | Primary | Backup 1 | Backup 2 |
|---|---|---|---|
| Global cereals/oils/sugar | FAO Food Price Index | World Bank Pink Sheet | USDA FAS PSD |
| Local-market food prices | FAOSTAT consumer prices | WFP VAM DataBridges | National stat office |
| Gold spot | LBMA Fix | Goldprice.dev | Metals.dev |
| Crude oil (energy) | World Bank Pink Sheet (Brent) | EIA STEO | Yahoo Finance Brent |

All primary sources are 36–107 year old multilateral institutions with explicit publication mandates. Durability is concentrated at the source layer, not the API-wrapper layer.

### Monthly CLI (`src/pipeline/run.ts`)

```
bun run pipeline -- --month=YYYY-MM          # defaults to prior UTC month
bun run pipeline -- --backfill --from=2020-01 --to=YYYY-MM
bun run pipeline -- --dry-run              # skips R2/APK persists, still writes rollups/fixture locally
```

- **Audience:** GH Actions cron (`kki-weekly.yml`) and local debugging.
- **Output:** monthly `build/khobz-index-{month}.{json,csv}`, R2 mirror + offline bundle artefacts, regenerated `landing/src/data/fixture-snapshot.json` (last **six** computed months × all iterated countries).

### Public landing (`landing/`)

Vite + React map at `/`. **Desktop:** hover tooltip + single click to the country page (unchanged). **Touch / coarse pointer:** first tap highlights the country and opens a bottom preview sheet with an **Explore** CTA; tapping the same country again navigates; tapping “ocean” (the map background SVG layer) clears the preview. Region pills refocus Mercator projections (Global, Africa, MENA, Europe, Asia, Americas) and filter the **ranking** list using basket-region semantics — see [`src/lib/mapRegionFilter.ts`](landing/src/lib/mapRegionFilter.ts). Details: [`docs/kki/landing-mobile-map-ux.md`](../docs/kki/landing-mobile-map-ux.md).
- **Guards:** `PIPELINE_MONTHS_LIMIT`, `PIPELINE_MAX_COUNTRIES`, `PIPELINE_FRANKFURTER_DELAY_MS` (see `.env.example`).

---

## Methodology

Full methodology specification: [`docs/methodology.md`](docs/methodology.md)

Key design decisions:
- **Caloric-subsistence invariant** — all baskets target the same biological constant
- **Hybrid local/global weighting** — captures local reality while capping cross-market divergence
- **Versioned methodology** — old promises always reference their origin version; no retroactive recalculation
- **6-source resilience** — every data slot has 2–3 independent providers with bulk-CSV fallback

---

## Licensing

- **Code** (everything except `data/` and `snapshots/`): [MIT License](LICENSE)
- **Data** (`data/` and `snapshots/` directories): [CC BY 4.0](LICENSE-DATA)

---

## CI & automation

Architecture reference: [`docs/architecture/stack.md`](docs/architecture/stack.md) · [`docs/architecture/architecture.md`](docs/architecture/architecture.md) · static archive naming [`docs/architecture/api-contract.md`](docs/architecture/api-contract.md) §7.

> **Parent repository:** `khobz-index/` lives inside the **Karama checkout** (parent folder). GitHub Actions workflows live at that parent’s [`.github/workflows/`](../.github/workflows/) (not under `khobz-index/`).

| Workflow | Trigger | Purpose |
|---|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | Push / PR → `main` | Root Karama package CI; see root `package.json` |
| [`kki-weekly.yml`](../.github/workflows/kki-weekly.yml) | Cron Mon **06:00 UTC**, `workflow_dispatch` | Run `khobz-index` pipeline, optional R2/KV sync, weekly **Release**, **failure Issue** |
| `publish.yml` | *Planned* | Monthly archive gate (first Mon) — not yet in repo; see architecture §2 |

**Tests:** default CI excludes live HTTP calls. Integration tests use `describe('@live', …)` under `tests/live` and run with `LIVE_API=1 bun run test:live`.

**Snapshot storage (§3.4B):** runtime in [`src/storage/`](src/storage/) — `InMemoryBackend` for unit tests / pipeline smoke; persistence entrypoint `persistCountryMonth` (dual JSON+CSV, `vM.m/manifest.json`, SHA-256 + `x-kki-sha256` metadata). Offline bundle helper `buildOfflineApkBundle` (+ `persistApkBundle` → `bundle/karama-kki-bundle.json`, gzip budget 24 KB per `docs/kki/kki_research.md`). Tests: [`tests/unit/storage/store.test.ts`](tests/unit/storage/store.test.ts).

**Static archive (§3.6B):** [`src/archive/`](src/archive/) — `runMonthlyArchive` (GitHub Release + Pinata IPFS + Internet Archive S3-like upload, release-note placeholders); public data guide [`data/README.md`](data/README.md). Tests: [`tests/unit/archive/`](tests/unit/archive/).

**Closed API (§3.5B):** Cloudflare Worker entry [`src/api/index.ts`](src/api/index.ts) — Hono routes `POST /auth/exchange`, `GET /kki/:country/:month`, `GET /kki/latest/:country`, `GET /basket/:version`, `GET /health`. Bindings: R2 `KKI_DATA`, KV `KKI_KV`. Contract: [`docs/architecture/api-contract.md`](docs/architecture/api-contract.md). Local: `bun run dev:api` (requires [**`wrangler.jsonc`**](wrangler.jsonc) KV id + R2 bucket; run **`bash scripts/cf-bootstrap.sh`** once). Tests: [`tests/unit/api/integration.test.ts`](tests/unit/api/integration.test.ts). **Ops:** [`docs/ops/runbook.md`](docs/ops/runbook.md).

**Local parity:** `bun install && bun run lint && bun run format:check && bun run typecheck && bun run test`. Optional workflow emulation: [nektos/act](https://github.com/nektos/act) (`act push -W .github/workflows/ci.yml`).

**Operational notes**

- **Cron drift:** GitHub `schedule` is best-effort (~±15 min). Weekly Monday window remains acceptable for source freshness ([`architecture.md`](docs/architecture/architecture.md) §2).
- **IPFS / IA flakes:** Publish completes even if Pinata or Internet Archive steps fail; re-run **`publish`** manually after fixing credentials or upstream outages.
- **Secret rotation:** Replace values under GitHub → **Settings → Secrets and variables → Actions**; no code change. Re-run failed workflows after rotation.

### Repository secrets (GitHub Actions)

Configure these in the **GitHub repository** that contains this folder (e.g. **karama** at the parent repo root: Settings → Secrets and variables → Actions):

| Secret | Used by | Purpose |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Weekly pipeline (§3.8B+) | Cloudflare / `wrangler` for Workers + R2 |
| `CLOUDFLARE_ACCOUNT_ID` | Weekly pipeline | Account id for Wrangler API |
| `KKI_KV_NAMESPACE_ID` | Weekly pipeline | KV id for `pipeline:status` (must match `wrangler.jsonc`) |
| `R2_ACCESS_KEY_ID` | Weekly pipeline (optional S3 path) | R2 S3-compatible **access key** |
| `R2_SECRET_ACCESS_KEY` | Weekly pipeline (optional S3 path) | R2 S3-compatible **secret key** |
| `PINATA_JWT` | Publish | Pinata **Bearer** JWT for `uploads.pinata.cloud` IPFS pins |
| `IA_S3_ACCESS_KEY` | Publish | Internet Archive S3-like **access** key ([account/S3 credentials](https://archive.org/account/s3.php)) |
| `IA_S3_SECRET_KEY` | Publish | Internet Archive S3-like **secret** key |

The **`GITHUB_TOKEN`** granted to workflows handles releases. Enable **Actions failure notifications** on the repo if you want email alerts when `kki-weekly` fails.

Use **`bun run cf:provision-deploy -- --sync-github`** (with a real **`CLOUDFLARE_API_TOKEN`** in the **parent repository** `.env`, path **`../.env` relative to `khobz-index/`**) to push **`CLOUDFLARE_API_TOKEN`**, **`CLOUDFLARE_ACCOUNT_ID`**, and **`KKI_KV_NAMESPACE_ID`** to the repo’s Actions secrets in one step.

**API-token CI (`kki-weekly.yml`):** repo secrets **`CLOUDFLARE_API_TOKEN`**, **`CLOUDFLARE_ACCOUNT_ID`**, **`KKI_KV_NAMESPACE_ID`** (see table above; values are never logged in docs).

---

## Used By

- [Karama](https://karama.thebay.ma) — a promise-tracking app that uses KKI to anchor informal debts to real purchasing power

---

## Public ship status

Baseline audit (Phase 0) for standalone public launch: [`docs/shipping v1/`](docs/shipping%20v1/README.md). Execution plan: [`ship-todo.md`](ship-todo.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute code, data, or basket proposals.

## Governance

See [GOVERNANCE.md](GOVERNANCE.md) for decision-making process and methodology versioning.

## Code of Conduct

This project follows the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md).

---

*KKI v1.0 — Pre-publication. First historical dataset targeting Phase 1.5 launch.*
