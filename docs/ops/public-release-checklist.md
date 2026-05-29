# Public release checklist

Repeatable monthly release procedure for the **Karama Khobz Index (KKI)**. Designed so a new maintainer can ship a release without reading internal design docs. Detailed deploy/rollback steps live in [`runbook.md`](./runbook.md); this file is the ordered checklist.

All commands run from the `khobz-index/` directory unless noted.

## 0. Preconditions

- [ ] On `main`, clean working tree (`git status`)
- [ ] `bun install --frozen-lockfile`
- [ ] Required secrets available for deploy steps (see [`runbook.md`](./runbook.md) §3.1): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `KKI_KV_NAMESPACE_ID` (+ `PINATA_JWT`, `IA_S3_*` if archive mirrors enabled)

## 1. Regenerate data + fixture

- [ ] `bun run pipeline:rebuild-fixture`
  - Merges `build/khobz-index-YYYY-MM.json` rollups, applies CPI replacement pass, enriches latest month with FAOSTAT line items, writes `landing/src/data/fixture-snapshot.json` + sharded public fixture.

## 2. Verify locally

- [ ] `bun test tests/unit` — all unit tests pass
- [ ] `bun run typecheck` — `tsc --noEmit` clean
- [ ] `bun run lint` and `bun run format:check` — CI parity
- [ ] `bun run pages:build` — landing builds (Vite + shards)

## 3. Deploy

- [ ] Landing — `bun run pages:deploy` (deploys from `landing/`: `dist/` + `functions/` middleware)
- [ ] API Worker — `bun run deploy:api` (run `bun run deploy:api:dry-run` first)

## 4. Verify production surfaces

- [ ] Custom domains — `bash scripts/verify-landing-urls.sh`
  - Canonical `https://khobz-index.thebay.ma/` → 200
  - `https://kilocalorie-index.thebay.ma/` → 301 to canonical
  - Legacy `karama.thebay.ma/khobz` does not redirect to KKI
- [ ] API health — `curl -sS "https://khobz-index-api.<subdomain>.workers.dev/health" | jq .` (internal URL; see runbook §0)

## 5. Create the monthly release

- [ ] Trigger weekly pipeline (creates GitHub Release artifacts):
  - CLI: `gh workflow run kki-weekly.yml --ref main`
  - or GitHub UI: Actions → **KKI Weekly Pipeline** → Run workflow
- [ ] Monthly archive (first-Monday gate) publishes the canonical `vYYYY-MM` release via the archive path (GitHub Release + optional IPFS + Internet Archive). See [`data/README.md`](../../data/README.md) and `src/archive/`.

## 6. Verify release assets

- [ ] Release exists under [`The-Tech-Bay/khobz-index/releases`](https://github.com/The-Tech-Bay/khobz-index/releases) with tag `vYYYY-MM`
- [ ] `khobz-index-YYYY-MM.json` and `khobz-index-YYYY-MM.csv` attached and downloadable
- [ ] Release notes include methodology version, hashes, and IPFS CID / IA URL (or `pending`)
- [ ] `data/archive-log.json` and `data/ipfs-manifest.json` updated for the month

## 7. Verify public docs + privacy

- [ ] Public README links resolve ([`README.md`](../../README.md))
- [ ] [`data/README.md`](../../data/README.md) download patterns match the new release tag
- [ ] No private references in public surfaces:
  - no personal Worker hostname (e.g. `*.workers.dev` owner subdomain)
  - no `<org>/<repo>` placeholders
  - no "Pre-publication" framing
  - no prohibited product framing (`coin`, `token`, `crypto`, `wallet`, `investment`) — full sweep is Phase 7

## 8. Close out

- [ ] Tag/announce per communication kit if this is a public-facing publication month
- [ ] If anything failed: see [`runbook.md`](./runbook.md) §2 (rollback), §6 (pipeline failure), §7 (data integrity)

---

*Maps to ship-todo Phase 6.2. Verification commands mirror Phase 7 (`bun test tests/unit`, `bun run typecheck`, `bun run pages:build`).*
