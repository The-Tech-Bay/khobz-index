# Public repo export runbook

**Decision D1-A:** Canonical public topology is standalone [The-Tech-Bay/khobz-index](https://github.com/The-Tech-Bay/khobz-index).

This document covers exporting `khobz-index/` from the Karama monorepo. **Phase 5 prepares the tree in-place**; the actual `git subtree split` and push are operator steps on export day.

## Current state (monorepo)

| Item | Location |
|------|----------|
| Source tree | `The-Tech-Bay/karama/khobz-index/` |
| **Active** weekly cron | [`.github/workflows/kki-weekly.yml`](../../../.github/workflows/kki-weekly.yml) (`working-directory: khobz-index`) |
| Standalone workflow (ready, inactive) | [`../../.github/workflows/kki-weekly.yml`](../../.github/workflows/kki-weekly.yml) |
| CI (lint/test) | [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |

Do **not** disable the parent cron until the standalone repo is live and secrets are migrated.

## Pre-export checklist

- [ ] Phase 5 deliverables complete ([`phase5-public-github-readiness.md`](../shipping%20v1/phase5-public-github-readiness.md))
- [ ] `bun test tests/unit`, `bun run typecheck`, `bun run pages:build`, `bun run pages:verify` green
- [ ] No personal Worker hostnames in public docs ([`runbook.md`](./runbook.md))
- [ ] GitHub links resolve to `The-Tech-Bay/khobz-index` ([`data/README.md`](../../data/README.md))

## Export procedure (operator)

### 1. Create or verify standalone repo

```bash
gh repo view The-Tech-Bay/khobz-index || gh repo create The-Tech-Bay/khobz-index --public --description "Karama Khobz Index (KKI) — open methodology and data"
```

### 2. Subtree split and push

From the Karama repo root:

```bash
git subtree split --prefix=khobz-index -b khobz-index-export
git push git@github.com:The-Tech-Bay/khobz-index.git khobz-index-export:main
```

Alternative: fresh clone of `khobz-index/` history if subtree history is too noisy.

### 3. Migrate GitHub Actions secrets

Copy from parent **karama** repo → **khobz-index** repo (Settings → Secrets):

| Secret | Required |
|--------|----------|
| `CLOUDFLARE_API_TOKEN` | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Yes |
| `KKI_KV_NAMESPACE_ID` | Yes |
| `R2_ACCESS_KEY_ID` | Optional (S3 path) |
| `R2_SECRET_ACCESS_KEY` | Optional |
| `PINATA_JWT` | If IPFS archive enabled |
| `IA_S3_ACCESS_KEY` | If Internet Archive enabled |
| `IA_S3_SECRET_KEY` | If Internet Archive enabled |

Or run from monorepo checkout (targets standalone repo after `gh repo set-default`):

```bash
cd khobz-index
bun run cf:provision-deploy -- --sync-github
```

### 4. Switch cron ownership

1. Enable schedule on standalone [`kki-weekly.yml`](../../.github/workflows/kki-weekly.yml) (already ported — verify one successful `workflow_dispatch` run).
2. Disable or remove schedule from parent [`.github/workflows/kki-weekly.yml`](../../../.github/workflows/kki-weekly.yml) (keep file with comment pointing here, or delete after cutover).

### 5. Post-export verification

```bash
cd khobz-index   # standalone clone
bun install --frozen-lockfile
bun test tests/unit
bun run typecheck
bash scripts/verify-landing-urls.sh
```

Confirm GitHub Releases attach under `The-Tech-Bay/khobz-index/releases`.

### 6. Update cross-repo links

- Karama app/docs: point data citations to standalone releases URL
- Communication kit: confirm `khobz-index.thebay.ma` and GitHub repo links
- UptimeRobot / monitoring: unchanged (landing URL is canonical)

## Rollback

If export fails mid-flight:

1. Re-enable parent `kki-weekly.yml` schedule
2. Delete or archive empty standalone repo push
3. Continue development in monorepo path

## Related

- [`ship-todo.md`](../../ship-todo.md) Phase 5–7
- [`decisions-d1-d4-guide.md`](../shipping%20v1/decisions-d1-d4-guide.md) — D1-A standalone repo
