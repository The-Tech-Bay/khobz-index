# KKI operations runbook (§3.8B)

Canonical architecture: [`../architecture/architecture.md`](../architecture/architecture.md) (pipeline DAG, storage, observability, WAF §5–§6).

## Public production URLs (v1)

| Surface | URL | Notes |
|---------|-----|--------|
| **Landing (canonical)** | [https://khobz-index.thebay.ma/](https://khobz-index.thebay.ma/) | Cloudflare Pages project `khobz-index-landing` |
| **Scientific alias** | [https://kilocalorie-index.thebay.ma/](https://kilocalorie-index.thebay.ma/) | **301** → canonical (Pages `functions/_middleware.ts`) |
| **Data archive** | GitHub Releases | See [`data/README.md`](../../data/README.md) |

**Legacy (D4-B):** `https://karama.thebay.ma/khobz` is **not** a canonical or redirect target — hard cutover.

**Ops preview only:** `https://khobz-index-landing.pages.dev` — deploy verification; do not use in public copy.

**Repo mirror:** Source of truth is `karama/khobz-index/`. Automated subtree push: Karama [`.github/workflows/khobz-index-mirror.yml`](../../../.github/workflows/khobz-index-mirror.yml). Setup: [`public-repo-export.md`](./public-repo-export.md). Launch: [`launch-cutover-checklist.md`](./launch-cutover-checklist.md).

## Internal operator URLs (not public v1 API)

| Surface | URL / location |
|---------|----------------|
| **KKI Worker (closed API)** | `https://khobz-index-api.<your-subdomain>.workers.dev` — set in Cloudflare dashboard after deploy; Track A upstream + `/health` probes only |
| **Pages deploy** | `wrangler pages deploy dist` from `landing/` (includes Functions middleware) |
| **GitHub Actions secrets** | Parent monorepo (folder containing `khobz-index/`) — Settings → Secrets |

**Cloudflare Resources**

| Resource | Name / ID |
|----------|-----------|
| Worker | `khobz-index-api` |
| R2 Bucket | `khobz-index-snapshots` |
| KV Namespace | `KKI_KV` (`98ddd13ae32647dd92d253c6f1144676`) |
| KV Cache | `KKI_CACHE` (`047e5d19798441e2af794ab6d1001c02`) |

**GitHub Actions Secrets** (parent monorepo)

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | R2 sync, KV update, Pages deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |
| `KKI_KV_NAMESPACE_ID` | Workers KV pipeline status |
| `GITHUB_TOKEN` | Auto-provided for releases |

**Cron Schedule**: `0 6 * * 1` — Mondays 06:00 UTC (workflow_dispatch also available)

**Public cadence wording:** KKI refreshes source checks weekly and publishes canonical country records at monthly grain (see [`../architecture/architecture.md`](../architecture/architecture.md) §TL;DR).

---

> **Releasing?** For the ordered, repeatable monthly publication steps see [`public-release-checklist.md`](./public-release-checklist.md). This runbook holds the detailed deploy/rollback/incident procedures it references.

## 1. Deploy

### 1.1 Prerequisites

- Cloudflare account; **`wrangler login`** (or `CLOUDFLARE_API_TOKEN` with Workers + R2 + KV edit permissions).
- **R2** product enabled for the account (Dashboard → R2 → *Get started*). Otherwise `wrangler r2 bucket create` returns **code 10042** until R2 is turned on.
- **Supabase** project ref for `SUPABASE_PROJECT_REF` (Worker secret).
- Bun ≥ 1.2, repo cloned.

### 1.1b One-shot script (API token + parent repo `.env`)

With **`CLOUDFLARE_API_TOKEN`** (real value, not `<your-...>`), **`CLOUDFLARE_ACCOUNT_ID`**, and **`SUPABASE_PROJECT_REF`** in the **parent repository root** (folder that contains `khobz-index/`): **[`../../../.env`](../../../.env)** from this file — same as **`../.env` relative to `khobz-index/`**:

```bash
cd khobz-index
bun run cf:provision-deploy
```

This runs **`wrangler whoami` → R2 create → KV create (`--update-config`) → `secret put` → deploy Worker → build landing → Pages project create → Pages deploy**.  
To also push **`CLOUDFLARE_*`** and **`KKI_KV_NAMESPACE_ID`** to GitHub Actions (**`gh` CLI logged in**):

```bash
cd khobz-index
bun run cf:provision-deploy -- --sync-github
```

### 1.2 One-time provisioning (R2 + KV)

From repo root:

```bash
cd khobz-index
bash scripts/cf-bootstrap.sh
```

Copy the printed **KV namespace id** into [`wrangler.jsonc`](../wrangler.jsonc) → exactly **one** `kv_namespaces` entry with that id (if `wrangler --update-config` left a placeholder row **and** appended a new row, delete the placeholder so only the real id remains).

Create R2 bucket `khobz-index-snapshots` if the script reports it missing (script uses `r2 bucket create`).

**Lifecycle / CORS (R2)**  
- Default R2 retention is **no automatic expiry** — aligns with “`v*/` never expire” (no destructive lifecycle required at MVP).  
- **CORS:** leave **disabled** / deny browser origins — the Worker accesses R2 via **binding** only (not public bucket URLs).

### 1.3 Worker secrets and vars

```bash
cd khobz-index
bunx wrangler secret put SUPABASE_PROJECT_REF
# Optional overrides (see .env.example):
# bunx wrangler secret put SUPABASE_JWT_ISSUER
# bunx wrangler secret put SUPABASE_JWT_AUDIENCE
```

JWT verification uses **`https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`** — there is **no** separate `SUPABASE_JWKS_URL` secret in code; the TODO §3.8B.1 line is superseded by this.

### 1.4 Deploy API Worker

```bash
cd khobz-index
bun run cf:check
bun run deploy:api:dry-run   # bundle + validate
bun run deploy:api
```

Verify:

```bash
curl -sS "https://khobz-index-api.<subdomain>.workers.dev/health" | jq .
```

### 1.5 Production WAF (Dashboard)

Worker **rate limits and `/auth/*` Origin rules** are enforced in **Hono middleware** ([`architecture.md`](../architecture/architecture.md) §5.2). On the **Cloudflare zone** (when using a custom hostname) add **WAF custom rules** as needed:

- Optional **geo / bot** rules if abuse appears.
- Do **not** rely on `Origin` for **`GET`** data routes — clients must send **`Authorization: Bearer`** (opaque token).

### 1.6 Deploy landing (Pages)

The landing app loads historical KKI data from **`landing/public/data/fixture/`** (manifest + shards under 25 MiB each). Regenerate after pipeline backfill:

```bash
cd khobz-index
bun run pipeline:rebuild-fixture
bun run pages:shard    # optional if pipeline already wrote shards
bun run pages:build
bun run pages:deploy   # deploys from landing/ (dist + functions/)
bash scripts/verify-landing-urls.sh
```

`pipeline:rebuild-fixture` merges all `build/khobz-index-YYYY-MM.json` rollups, applies the CPI replacement pass for pre-local `global_only` months, enriches the latest month with FAOSTAT basket line items, and writes both `landing/src/data/fixture-snapshot.json` and sharded public fixture files.

### 1.6a Additive fixture publish + collapse / density guards (history protection)

**Why (recurrence 2026-09-03):** the weekly pipeline rebuilds the published fixture from the months it processes in a single run. Pre-observation history (back to 1990) is regenerated by CPI-chaining from a recent base month. Because the bundled CPI envelope is annual and trails real time, once the rolling 6-month window cleared the envelope's last year (2024), the CPI backfill produced nothing — and a from-scratch write collapsed the live site to ~6 months while `manifest.months` still listed 439 keys (1990–2026). The 31 Aug 2026 weekly run (`33397222218`) stayed green. A June 2026 merge draft never shipped to [The-Tech-Bay/khobz-index](https://github.com/The-Tech-Bay/khobz-index).

Guards in `src/pipeline/lib/fixture-publish.ts` (wired from `src/pipeline/run.ts`):

- **Loud previous-load.** Logs path, bytes, month count, and record count. `JSON.parse` / shape errors are printed. Snapshot load falls back to `landing/public/data/fixture/` shards (the 45 MB pretty-printed JSON must not silently become `null`).
- **Previous is required when merge is on** (weekly default). Missing previous → `process.exit(1)` unless `--force`. This is the hole that skipped both merge and the old collapse guard.
- **Additive merge (default).** Union the fresh window onto the prior full history (fresh months win per-month). Disabled for `--backfill`, `--no-merge`, or `PIPELINE_FIXTURE_NO_MERGE=1`.
- **Collapse guard.** If the about-to-be-written fixture has fewer than 50% of the previously published per-country records, the run fails. `--force` overrides.
- **Density guard.** If `months.length >= 24` and median records/country is below 50% of that list, the run fails — catches “439 labels, 6 records” even with no previous. Weekly CI also runs `scripts/assert-fixture-density.ts` (median floor 100) **before** Pages deploy.
- **Honest `months` list.** After guards pass, `payload.months` is the union of country record keys. The homepage slider and 1Y/5Y ranges must not advertise empty history.

**Recovery if history is ever lost on the live site:**

```bash
cd khobz-index   # or the standalone clone
# Prefer the git snapshot (full history) + live latest window:
bun run scripts/restore-landing-history.ts
bun run pages:build && bun run pages:deploy
# OR regenerate from scratch (RAM-heavy):
bun run pipeline:backfill && bun run pipeline:rebuild-fixture
bun run pages:build && bun run pages:deploy
```

Live `methodology_version` on the landing fixture may be **1.1.0** while public prose still says v1.0 / 1.0.0. That is documentation drift, not a reason to skip history merge.

---

## 2. Rollback

### 2.1 Worker

```bash
cd khobz-index
bunx wrangler rollback
```

Or **Workers** → **khobz-index-api** → **Deployments** → select previous revision.

### 2.2 Pages

**Workers & Pages** → **khobz-index-landing** → **Deployments** → **Rollback** to a prior production deployment.

---

## 3. Manual pipeline trigger

Workflow file (parent repository root): [`../../../.github/workflows/kki-weekly.yml`](../../../.github/workflows/kki-weekly.yml)

**GitHub UI:** Actions → **KKI Weekly Pipeline** → **Run workflow**.

**CLI:**

```bash
gh workflow run kki-weekly.yml --ref main
```

### 3.1 Required GitHub Actions secrets

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | `wrangler` R2 + KV from CI |
| `CLOUDFLARE_ACCOUNT_ID` | Account id for API |
| `KKI_KV_NAMESPACE_ID` | KV id for `pipeline:status` (same as `wrangler.jsonc`) |
| `PINATA_JWT` | Optional — IPFS (archive path §3.6B) |

If Cloudflare secrets are **unset**, the workflow still runs the **pipeline + Release**; R2/KV sync steps print a skip message.

### 3.1b Local pipeline inputs (FAO FPI + FAOSTAT + CPI)

- **Full historical backfill:** `cd khobz-index && bun run pipeline:backfill` (prefetch FAOSTAT + World Bank CPI, then `--backfill --from=1990-01`). Do **not** call `src/pipeline/run.ts` directly without prefetch.
- **Global FPI fallback:** When `FAO_FPI_JSON_URL` / `FAO_FPI_CSV_URL` are empty, the cereals/oils/sugar sub-indices are filled from [`data/reference/monthly-global-benchmarks.csv`](../../data/reference/monthly-global-benchmarks.csv) (columns `fao_fpi_*`) so the global composite varies month-to-month. See root [`docs/kki/kki-data-quality.md`](../../../docs/kki/kki-data-quality.md).
- **Local prices (FAOSTAT CP):** Set **`FAOSTAT_CP_JSON_PATH=data/reference/faostat-pp-backfill.json`** (from `pipeline:prefetch`) or rely on bundled auto-detect. Countries without FAOSTAT data remain `global_only`; the pipeline only exits fatally when nearly all countries collapse to the same global-only USD value, which indicates a missing local-price input rather than normal coverage gaps.
- **Historical CPI:** Set **`HISTORICAL_CPI_JSON_PATH=data/reference/historical-cpi-envelope.json`** (from `pipeline:prefetch-cpi`). Replaces pre-local `global_only` months with CPI-chained estimates. If the latest KKI month is newer than the CPI envelope, the backfill anchors to the latest local month with CPI coverage instead of no-oping.
- **FX (monthly loop):** The pipeline uses the **`fx_display` slot** (`Frankfurter` → `exchangerate.host`, with adapter retries) instead of calling Frankfurter directly. Transient Frankfurter **HTTP 520** errors should fall through after retries; set **`EXCHANGERATE_HOST_URL`** or **`EXCHANGERATE_HOST_API_KEY`** for the backup. Throttle with **`PIPELINE_FRANKFURTER_DELAY_MS`** (default 500 ms between months on backfill).
- **Progress:** Each month logs `[pipeline] month N/M · YYYY-MM` at loop start (CPI backfill and R2 export remain silent until the final `OK` line).
- **Memory (`PIPELINE_SKIP_R2_MIRROR=1`):** `pipeline:backfill` sets this by default. It still writes `build/khobz-index-YYYY-MM.json` rollups but skips holding ~100k per-country R2 snapshots in RAM. After any partial or full backfill, run **`bun run pipeline:rebuild-fixture`** to merge rollups + CPI-chained history into the landing fixture.
- **FAOSTAT horizon:** `pipeline:prefetch` forward-fills through **`PIPELINE_FILL_TO`** or the same **previous UTC month** the pipeline uses as `--to`. Without this extension, months after the 6-month staleness cap have no local rows and the run fatals on `global_only`. Re-run **`bun run pipeline:prefetch`** after changing fill logic or when the latest month shifts.

### 3.1c Exit code 137 / `Killed: 9` (OOM)

macOS/Linux sent **SIGKILL** because the Bun process exceeded available RAM. Typical on a full `1990-01` → present run **without** `PIPELINE_SKIP_R2_MIRROR` (each month × country snapshot was kept in an in-memory map until export).

**Check progress:**

```bash
ls build/khobz-index-*.json | wc -l   # expect 437 when complete
```

**Finish a partial run** (only missing months — do not restart from 1990):

```bash
cd khobz-index
bun run pipeline:backfill:tail -- --from=2026-05 --to=2026-05
bun run pipeline:rebuild-fixture
bun run pages:build   # optional — refresh landing shards
```

Use `--dry-run` on the tail command if you only need month rollups and will rebuild the fixture separately (same R2 skip, no APK bundle).

**Full regen from scratch:** use `pipeline:backfill` (R2 mirror skip is on by default), then `pipeline:rebuild-fixture`. Close other heavy apps; 16 GB+ RAM recommended for the CPI + fixture merge step.

### 3.2 `GlobalTrackMismatch` during `--backfill`

`persistCountryMonth` writes **one** shared object per month at `v1.0/global/YYYY-MM.json`. A false failure used to occur when the **same** canonical `global_track` was persisted for subsequent countries but the **serialized file** differed only by `computed_at` (first country vs later ISO timestamps). Persistence now compares the **canonical** global-track skeleton hash (excluding `computed_at` / envelope `content_hash`) so all countries for that month agree.

You still see `GlobalTrackMismatch` if a **prior** artefact truly disagrees—for example stale `build/r2-mirror/v1.0/global/2020-01.json` from an old run merged into backend state, or a bug changing `assembleGlobalTrackForMonth` mid-backfill. **Fix:** wipe in-memory artefacts and re-run from a clean snapshot of R2 mirrors, or delete the offending global object before re-append (append-only caveat—prefer a fresh sandbox backend).

---

## 4. Source adapter swap (degraded source)

1. Identify failing slot in `build/pipeline-run-summary.json` (weekly artifact) or `/health` `sources` map.
2. In code, adjust **fallback order** per [`../architecture/stack.md`](../architecture/stack.md) (Tier-1 → Tier-2).
3. Run **`bun run test`** and a manual **`bun run pipeline`** locally.
4. Merge → let **`kki-weekly.yml`** publish; monitor `/health`.

---

## 5. Incident: API down

1. `curl` **`/health`** — expect `200` + JSON.
2. **Cloudflare dashboard** → Worker **invocations / errors**; **Real-time logs** (free).
3. `cd khobz-index && bunx wrangler tail` — watch JSON lines with `kki_observability`.
4. If bad deploy: **§2 Rollback**.
5. If **KV / R2** binding error: verify `wrangler.jsonc` ids and bucket name.

---

## 6. Incident: Pipeline failed

1. Open failed **GitHub Actions** run → logs for `bun run pipeline` + R2/KV steps.
2. **notify-failure** job opens a **GitHub Issue** — ensure repo notifications/email enabled.
3. Fix cause → **Re-run jobs** or `gh workflow run kki-weekly.yml`.
4. If **R2 Class A** errors persist: workflow logs; consider manual **`wrangler r2 object put`** from laptop with token.

---

## 7. Incident: Data integrity alert

1. Compare **GitHub Release** artifact `khobz-index-YYYY-MM.json` with **R2** keys under `v1.0/<CC>/` (dashboard or `wrangler r2 object get`).
2. Check **`state/last-run.json`** on R2 vs `build/last-run-state.json` in CI logs.
3. Verify **manifest** hash / `record_hash` in index records ([`data-schema.md`](../architecture/data-schema.md)).
4. If corruption suspected: **rollback Worker** + restore R2 from last good Release (re-upload objects).

---

## 8. Secret rotation

| Secret | Rotate via |
|--------|------------|
| **Supabase JWT / project** | `wrangler secret put SUPABASE_PROJECT_REF`; confirm JWKS URL still matches issuer. |
| **Cloudflare API token** | Create new token → GitHub repo **Settings → Secrets**; re-run workflow. |
| **R2 S3 keys** (if used outside Worker) | Cloudflare R2 **Manage R2 API Tokens**; update GH secrets `R2_*` if pipeline uses S3 API. |
| **Pinata JWT** | Pinata dashboard → GitHub `PINATA_JWT`; optional archive `pinToIpfs`. |

After rotation: **`bun run deploy:api`** if Worker secrets changed.

### 8.1 Custom domains (Phase 4 — complete)

| Host | Role | Implementation |
|------|------|----------------|
| `khobz-index.thebay.ma` | **Canonical** public landing | Pages custom domain on `khobz-index-landing` |
| `kilocalorie-index.thebay.ma` | Scientific alias | **301 redirect** to canonical via [`landing/functions/_middleware.ts`](../../landing/functions/_middleware.ts) |
| `karama.thebay.ma/khobz` | Legacy | **Hard cutover (D4-B)** — not maintained; no redirect to KKI |

Verify after deploy: `bash scripts/verify-landing-urls.sh`

Alternative (zone-level): Cloudflare **Redirect Rules** on `thebay.ma` if Pages middleware is removed — prefer middleware for path preservation in-repo.

---

## 9. Observability (§3.8B.4)

| Signal | Mechanism (MVP / free) |
|--------|-------------------------|
| Worker HTTP metrics | **Cloudflare** Workers **Analytics** (dashboard, automatic). |
| Structured request log | **Real-time Logs** — `kki_observability` JSON from [`src/api/middleware/observability.ts`](../../src/api/middleware/observability.ts). |
| Pipeline | **GitHub Actions** conclusion + **`pipeline-run-summary.json`** on Release. |
| **Logpush → R2** | **Not** on free tier in general (Enterprise). **Do not** block MVP on log push; use logs + R2 **`state/last-run.json`**. |
| **`GET /health`** | Reads KV key **`pipeline:status`** (written by weekly job). |

### 9.1 API error-rate “alerting”

Automated **>5% / >20% error** thresholds need **Workers Analytics Engine**, Logpush, or a third party. **MVP:** watch **dashboard error rate**; optional **UptimeRobot** content-check on `/health` body (see §10).

---

## 10. Uptime monitoring (§3.8B.5)

**UptimeRobot** (free tier — verify current limits on [uptimerobot.com](https://uptimerobot.com)):

1. Add monitor: **HTTP(s)** → `GET` **internal API** `/health` every **5 minutes**; expect **200** (Worker URL in internal table above).
2. Add monitor: **HTTP(s)** → **`https://khobz-index.thebay.ma/`** every **15 minutes**; expect **200**.
3. **Alert contacts:** email; set threshold **3 failures** (~15 min) = critical.

**Test alert:** pause Worker or point monitor to bad URL → confirm email.

**Cloudflare Health Checks** require a **proxied hostname** on a **zone**; use when custom domain is attached.

---

## 11. Alerting rules (§3.8B.6)

| Rule | Implementation (email-first) |
|------|-------------------------------|
| Pipeline failure | **`notify-failure`** job in `kki-weekly.yml` opens **GitHub Issue**; enable **email notifications** for Actions/Issues. |
| **≥2 sources unhealthy** | **`::warning`** in workflow + `degraded_source_count` in JSON; tune to **Issue** later if needed. |
| API error spike | **Manual** dashboard review (§9.1); Discord deferred. |
| R2 write failure | **`wrangler r2 object put` exits non-zero** → job failure → **§6**. |

---

## 12. First production run checklist (§3.8B.8)

Documented output: [`first-run-2026-05-11.md`](./first-run-2026-05-11.md) (local + CI).

**Track A** closed API (`POST /auth/exchange` → `GET /kki/latest/MA`) requires a **valid Supabase JWT** from the app — verify manually after deploy.

---

*Last updated: 2026-05-28 — Phase 4 domain wiring (public vs internal URLs, kilocalorie redirect middleware).*
