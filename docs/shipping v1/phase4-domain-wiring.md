# Phase 4 — Domain wiring

**Status:** ✅ Complete (2026-05-28)

**Goal:** Verify live custom domains, fix scientific-alias SEO, purge stale legacy URLs, and mark the KKI API as private/internal in public surfaces.

**Decisions:** D4-B hard cutover — canonical `https://khobz-index.thebay.ma/`; no redirect from `karama.thebay.ma/khobz`; no public KKI API for v1.

## Live verification (2026-05-28)

| Check | URL | Baseline | Post-deploy |
|-------|-----|----------|-------------|
| Canonical landing | `https://khobz-index.thebay.ma/` | 200 | 200 |
| Canonical meta | same | `khobz-index.thebay.ma` | OK |
| Fixture manifest | `…/data/fixture/manifest.json` | 200 | 200 |
| Scientific alias | `https://kilocalorie-index.thebay.ma/country/MA` | **200 duplicate** | **301 → canonical** |
| Legacy path | `https://karama.thebay.ma/khobz` | unreachable (OK for D4-B) | unreachable |

**Baseline issue:** Both `khobz-index.thebay.ma` and `kilocalorie-index.thebay.ma` were CNAMEs to the same Pages project (duplicate content).

**Fix:** [`landing/functions/_middleware.ts`](../landing/functions/_middleware.ts) — 301 redirect preserving path/query. Deploy from `landing/` so Functions bundle is included (`bun run pages:deploy`).

Verify anytime: `bash scripts/verify-landing-urls.sh`

## Deliverables

| Area | Change |
|------|--------|
| Redirect | `landing/functions/_middleware.ts` — kilocalorie → canonical 301 |
| Deploy | `package.json` `pages:deploy` runs from `landing/`; `kki-weekly.yml` aligned |
| Verify script | `scripts/verify-landing-urls.sh` |
| URLs | Communication kit + `kki_research.md` (both trees) — `/khobz` → `khobz-index.thebay.ma` |
| API privacy | `openapi.yaml`, `api-contract.md`, `architecture.md`, `README.md`, `runbook.md`, `wrangler.jsonc`, `apps/api/wrangler.toml` |
| Public links | `README.md` public site block; `data/README.md` landing + methodology links |
| Runbook | Public vs internal URL tables; §8.1 domains complete; UptimeRobot → canonical landing |

## Acceptance

- [x] `https://khobz-index.thebay.ma/` passes smoke checks
- [x] `https://kilocalorie-index.thebay.ma/` 301 redirects to canonical
- [x] Legacy `/khobz` does not redirect to KKI
- [x] No stale `/khobz` in public khobz-index or communication-kit surfaces (excluding backup + historical audit docs)
- [x] Public docs do not advertise a public KKI API hostname
- [x] `bun test`, `typecheck`, `pages:build` green

## Related

- [`ship-todo.md`](../ship-todo.md) Phase 4
- Phase 5: public GitHub repo readiness
- Phase 7: full grep verification pass
