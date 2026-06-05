# KKI public launch cutover checklist

Operator steps after automated mirroring is configured. Run from a machine with `gh` and Cloudflare access.

## 1. Mirror + CI green

- [ ] `KHOBZ_INDEX_MIRROR_DEPLOY_KEY` set on **Karama** repo
- [ ] **KKI subtree mirror** workflow succeeded (or `workflow_dispatch` manually)
- [ ] Standalone **CI** green on `The-Tech-Bay/khobz-index` `main`
- [ ] `cd khobz-index && bun run mirror:verify` passes locally

## 2. Standalone weekly pipeline

- [ ] Secrets on **The-Tech-Bay/khobz-index**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `KKI_KV_NAMESPACE_ID` (+ optional R2 / IPFS / IA)
- [ ] `gh workflow run kki-weekly.yml --repo The-Tech-Bay/khobz-index --ref main`
- [ ] Run completes without FATAL `global_only` degeneracy (see runbook § FAOSTAT / `PIPELINE_FILL_TO`)

## 3. First monthly release

Follow [`public-release-checklist.md`](./public-release-checklist.md):

- [ ] `vYYYY-MM` release on [The-Tech-Bay/khobz-index/releases](https://github.com/The-Tech-Bay/khobz-index/releases)
- [ ] `khobz-index-YYYY-MM.json` and `.csv` attached

## 4. Go public

```bash
gh repo edit The-Tech-Bay/khobz-index --visibility public --accept-visibility-change-consequences
```

- [ ] Repo visibility **Public**
- [ ] README and `data/README.md` links resolve for anonymous users

## 5. Cron ownership

In **Karama** [`.github/workflows/kki-weekly.yml`](../../../.github/workflows/kki-weekly.yml):

- [ ] Remove or comment out the `schedule:` cron block
- [ ] Keep `workflow_dispatch` for emergency reruns from monorepo

Standalone [`kki-weekly.yml`](../../.github/workflows/kki-weekly.yml) keeps the Monday **06:00 UTC** schedule.

## 6. Verify production

```bash
cd khobz-index   # standalone clone
bash scripts/verify-landing-urls.sh
```

- [ ] `https://khobz-index.thebay.ma/` → 200
- [ ] `https://kilocalorie-index.thebay.ma/` → 301 to canonical

## 7. Cross-repo links

- [ ] Karama mobile `learnMoreUrl` → `https://khobz-index.thebay.ma`
- [ ] Communication kit GitHub + landing URLs updated if needed

---

*Maps to ship-todo Phase 8. Mirror automation: [`public-repo-export.md`](./public-repo-export.md).*
