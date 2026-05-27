# Task 0.2 — Duplicate / stray public-launch clutter

**Audit date:** 2026-05-26  
**Method:** Glob `* 2.*` under `khobz-index/`; `diff` each duplicate against canonical sibling

---

## Summary

| Metric | Value |
|--------|------:|
| Duplicate files found (`* 2.*`) | **13** |
| Identical to canonical (safe delete) | **10** |
| Differs from canonical (canonical wins) | **3** |
| Unique content requiring merge | **0** |
| Justified exceptions | **0** |

**Task 0.2 acceptance ("no `* 2.*` remain"):** ✅ **Met** (2026-05-26) — 13 root duplicates deleted; 3 additional build/env duplicates removed (`landing/dist/* 2.*`, `.env 2.example`). Post-delete: `find . -name '* 2.*' | wc -l` → **0**.

---

## Full inventory

| Duplicate file | Canonical file | Relationship | Delete? | Notes |
|----------------|----------------|--------------|---------|-------|
| `README 2.md` | `README.md` | **Identical** | ✅ Yes | macOS duplicate copy |
| `LICENSE 2` | `LICENSE` | **Identical** | ✅ Yes | |
| `LICENSE-DATA 2` | `LICENSE-DATA` | **Identical** | ✅ Yes | |
| `CODE_OF_CONDUCT 2.md` | `CODE_OF_CONDUCT.md` | **Identical** | ✅ Yes | |
| `CONTRIBUTING 2.md` | `CONTRIBUTING.md` | **Identical** | ✅ Yes | |
| `GOVERNANCE 2.md` | `GOVERNANCE.md` | **Identical** | ✅ Yes | |
| `biome 2.json` | `biome.json` | **Identical** | ✅ Yes | |
| `lefthook 2.yml` | `lefthook.yml` | **Identical** | ✅ Yes | |
| `tsconfig 2.json` | `tsconfig.json` | **Identical** | ✅ Yes | |
| `bun 2.lock` | `bun.lock` | **Identical** | ✅ Yes | |
| `package 2.json` | `package.json` | **Differs** | ✅ Yes | Canonical adds pipeline prefetch/backfill, fixture shard scripts (May 2026) |
| `wrangler 2.jsonc` | `wrangler.jsonc` | **Differs** | ✅ Yes | Canonical updates `compatibility_date` `2025-04-01` → `2026-05-01` |
| `.gitignore 2` | `.gitignore` | **Differs** | ✅ Yes | Canonical adds ignore for generated `data/reference/faostat-pp-backfill.json` |

---

## Diff details (non-identical only)

### `package 2.json` vs `package.json`

Canonical adds (duplicate lacks):

- `pipeline:prefetch`, `pipeline:prefetch-cpi`
- Updated `pipeline` / `pipeline:backfill` with FAOSTAT + CPI env paths
- `pipeline:rebuild-fixture`, `pages:shard`
- `pages:build` runs shard step before landing build

**Verdict:** Canonical is strictly ahead. No merge from duplicate.

### `wrangler 2.jsonc` vs `wrangler.jsonc`

Only meaningful delta: `compatibility_date` older in duplicate.

**Verdict:** Keep canonical; delete duplicate.

### `.gitignore 2` vs `.gitignore`

Canonical adds:

```
data/reference/faostat-pp-backfill.json
```

**Verdict:** Keep canonical; delete duplicate.

---

## Other clutter (not `* 2.*` pattern)

These are **not** Task 0.2 duplicates but appear on Phase 5.2 public-surface checklist:

| Item | Type | Phase |
|------|------|-------|
| `docs/methodology.md` "draft, pre-publication" banner | Pre-launch marker | 2.1, 5.2 |
| `data/README.md` `<org>/<repo>` placeholders | Unresolved placeholder | 6.1 |
| `docs/ops/runbook.md` personal Worker URL | Dev-only URL | 5.2 |
| Missing `SECURITY.md` | Policy gap | 5.3 |

---

## Recommended deletion procedure (Phase 5.2)

```bash
cd khobz-index
rm -f \
  "README 2.md" \
  "LICENSE 2" \
  "LICENSE-DATA 2" \
  "package 2.json" \
  "wrangler 2.jsonc" \
  "bun 2.lock" \
  "biome 2.json" \
  "lefthook 2.yml" \
  "tsconfig 2.json" \
  ".gitignore 2" \
  "CODE_OF_CONDUCT 2.md" \
  "CONTRIBUTING 2.md" \
  "GOVERNANCE 2.md"
```

**Pre-delete check:** `git status` — ensure no editor/CI references `* 2.*` paths (audit found none).

**Post-delete verify:**

```bash
find . -name '* 2.*' | wc -l   # expect 0
```

---

## Acceptance criteria (Task 0.2)

| Criterion | Met? |
|-----------|------|
| Every known duplicate compared to canonical | ✅ |
| Unique content merged before delete | ✅ N/A (none) |
| No `* 2.*` on public repo surface | ✅ Deleted 2026-05-26 |
