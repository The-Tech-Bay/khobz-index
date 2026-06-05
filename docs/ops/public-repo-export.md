# Public repo export runbook

**Decision D1-A:** Canonical public topology is standalone [The-Tech-Bay/khobz-index](https://github.com/The-Tech-Bay/khobz-index).

**Mirror policy (2026-06):** Standalone `main` is **mirror-only**. All development happens in `karama/khobz-index/`; the Karama monorepo workflow [`.github/workflows/khobz-index-mirror.yml`](../../../.github/workflows/khobz-index-mirror.yml) force-pushes a `git subtree split` on every `main` push that touches `khobz-index/**`.

## Current state (monorepo)

| Item | Location |
|------|----------|
| Source of truth | `The-Tech-Bay/karama/khobz-index/` |
| **Automated mirror** | [`.github/workflows/khobz-index-mirror.yml`](../../../.github/workflows/khobz-index-mirror.yml) |
| **Active** weekly cron | [`.github/workflows/kki-weekly.yml`](../../../.github/workflows/kki-weekly.yml) (`working-directory: khobz-index`) |
| Standalone weekly (post-cutover) | [`../../.github/workflows/kki-weekly.yml`](../../.github/workflows/kki-weekly.yml) |
| CI (lint/test/mirror gate) | [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |

Do **not** disable the parent cron until the standalone repo is public, secrets are migrated, and a green `workflow_dispatch` on standalone `KKI Weekly Pipeline` is recorded.

## Mirror deploy key (one-time setup)

Generate an Ed25519 deploy key with **write** access to `The-Tech-Bay/khobz-index` only:

```bash
ssh-keygen -t ed25519 -C "karama-khobz-index-mirror" -f ./khobz-index-mirror-deploy -N ""
```

1. Add **`khobz-index-mirror-deploy.pub`** to **The-Tech-Bay/khobz-index** → Settings → Deploy keys → **Allow write access**.
2. Add the **private key** contents to the **Karama** repo → Settings → Secrets → Actions as **`KHOBZ_INDEX_MIRROR_DEPLOY_KEY`**.

Verify: merge to `karama` `main` with a `khobz-index/**` change, or run **KKI subtree mirror** via `workflow_dispatch`. Standalone `main` should advance to the new split SHA.

## Pre-mirror gate (automated)

The mirror workflow runs before push:

```bash
cd khobz-index
bun run mirror:verify    # no * 2.* clutter; public-surface domain/language scan
bun test tests/unit
bun run typecheck
bun run pages:build
```

[`scripts/verify-mirror-readiness.ts`](../../scripts/verify-mirror-readiness.ts) also runs in standalone CI.

## Manual subtree export (fallback)

If Actions is unavailable:

```bash
# From Karama repo root
git subtree split --prefix=khobz-index -b khobz-index-export
git push --force git@github.com:The-Tech-Bay/khobz-index.git khobz-index-export:main
```

## Secrets migration (standalone repo)

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

Or run from monorepo checkout:

```bash
cd khobz-index
bun run cf:provision-deploy -- --sync-github
```

## Launch cutover (operator)

Full checklist: [`launch-cutover-checklist.md`](./launch-cutover-checklist.md).

Summary:

1. Confirm mirror workflow green and standalone CI green.
2. `workflow_dispatch` **KKI Weekly Pipeline** on **The-Tech-Bay/khobz-index** until green.
3. Run [`public-release-checklist.md`](./public-release-checklist.md) for first `vYYYY-MM` release.
4. Set **The-Tech-Bay/khobz-index** visibility to **Public**.
5. Remove `schedule` from parent [`.github/workflows/kki-weekly.yml`](../../../.github/workflows/kki-weekly.yml) (keep `workflow_dispatch`).
6. `bash scripts/verify-landing-urls.sh` from standalone clone.

## Rollback

If mirror or cutover fails mid-flight:

1. Re-enable parent `kki-weekly.yml` schedule if disabled
2. Continue development in `karama/khobz-index/`; fix mirror gate or deploy key
3. Re-run mirror `workflow_dispatch` after fix

## Related

- [`ship-todo.md`](../../ship-todo.md) Phase 8
- [`decisions-d1-d4-guide.md`](../shipping%20v1/decisions-d1-d4-guide.md) — D1-A standalone repo
- [`launch-cutover-checklist.md`](./launch-cutover-checklist.md)
