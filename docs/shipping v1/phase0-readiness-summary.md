# Phase 0 readiness summary

**Audit date:** 2026-05-26  
**Auditor:** Phase 0 baseline pass (inventory only)  
**Ship guide:** [`ship-todo.md`](../../ship-todo.md) Phase 0

---

## Scope (from ship-todo)

Phase 0 has two tasks:

| Task | Goal | Primary output |
|------|------|----------------|
| **0.1** | Inventory Karama-specific references | Classified table: keep / rewrite / move / delete / integration |
| **0.2** | Inventory duplicate public-launch clutter | Compare `* 2.*` files to canonical; merge or delete plan |

Phase 0 does **not** implement fixes. It establishes baseline truth for Phases 1–7.

---

## Overall readiness

| Area | Status | Notes |
|------|--------|-------|
| **Task 0.1 inventory** | ✅ Complete | 47 classified rows in [task-0.1-karama-reference-inventory.md](./task-0.1-karama-reference-inventory.md) |
| **Task 0.2 inventory** | ✅ Complete | 13 duplicate files catalogued in [task-0.2-duplicate-clutter-inventory.md](./task-0.2-duplicate-clutter-inventory.md) |
| **Task 0.1 acceptance** | ⚠️ Partial | Public-facing surfaces still frame KKI as Karama-app-dependent in places |
| **Task 0.2 acceptance** | ✅ Met (2026-05-26) | All `* 2.*` duplicates deleted; `find` count = 0 |
| **Ready for Phase 1** | ✅ Yes | Phase 1 naming/cadence/coverage pass started 2026-05-26 |

**Bottom line:** The codebase is **audited and actionable**, not **ship-ready**. Phase 0 acceptance for clutter deletion and public standalone framing remains open until Phase 5+ implementation passes.

---

## Task 0.1 — acceptance criteria check

> No hidden parent-app dependencies remain in public-facing KKI docs.  
> Any remaining Karama reference reads as attribution or integration context, not as required app context.

| Criterion | Result | Evidence |
|-----------|--------|----------|
| No hidden parent-app dependencies in **public-facing** docs | ❌ Fail | `landing/src/pages/MethodologyPage.tsx` FAQ: weekly API "for the Karama app"; `README.md` "Used By" implies runtime coupling; `docs/methodology.md` header targets `karama.thebay.ma/khobz` |
| Remaining references = attribution or integration | ⚠️ Partial | Brand name **Karama Khobz Index** is correct attribution; closed API + Supabase JWT docs are legitimate integration; several **public** rows still read as app-required context |
| Search term `confirm-web` | ✅ Clean | Zero hits under `khobz-index/` (only listed in `ship-todo.md`) |
| Search term `apps/mobile` | ✅ Clean in tree | Zero hits inside `khobz-index/` (parent i18n files are out-of-tree; Phase 3.3) |

**Public-facing gap count (rewrite required):** 8 high-priority rows (see task-0.1 § Public surfaces).

**Internal/ops gap count (rewrite or move before public export):** 6 rows (personal Worker URL, private repo slug, parent-only doc links).

---

## Task 0.2 — acceptance criteria check

> No `* 2.*` duplicate files remain in public repo surface unless explicitly justified.

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Zero `* 2.*` files | ✅ Pass | Deleted 2026-05-26 (13 root + 3 dist/env); see task-0.2 |
| Unique content merged before delete | ✅ Safe | 10 identical to canonical; 3 differ — canonical is strictly newer/correct |
| Justified exceptions | None | No duplicate should be kept |

**Deletion batch (Phase 5.2):** Safe to delete all 13 after confirming no open editor handles point at `* 2.*` paths.

---

## High-level findings

### Ready (no Phase 0 blockers)

- **Core implementation** — pipeline, API, landing app, tests, and CI workflows exist under `khobz-index/.github/workflows/`.
- **Brand naming in product copy** — "Karama Khobz Index (KKI)" is used consistently on landing pages and README title.
- **Prohibited product framing** — No problematic consumer-facing "buy KK", "coin", "wallet", or "investment" language found; existing "not a token" disclaimers are appropriate.
- **Fixture scale** — `landing/src/data/fixture-snapshot.json` contains **238 countries** and **436 months** (1990-01 → latest); contradicts landing SEO "15+ countries" and README badge "85+".
- **Governance skeleton** — `CONTRIBUTING.md`, `GOVERNANCE.md`, `CODE_OF_CONDUCT.md`, issue templates present.

### Gaps (address in Phases 1–7)

| Priority | Gap | Phase |
|----------|-----|-------|
| P0 | Stale domains: `karama.thebay.ma/khobz`, `*.workers.dev`, `*.pages.dev`, placeholder OpenAPI host | 3.1, 4 |
| P0 | Landing country count copy (`15+`) vs fixture (238) | 1.3, 3.2 |
| P0 | Broken public link: Methodology page → `docs/kki/kki_research.md` on future public repo (file lives in **parent** `docs/kki/`) | 2.2, 3.2, 5.1 |
| P1 | `docs/methodology.md` marked **draft, pre-publication**; not yet "v1.0 as implemented" | 2.1 |
| P1 | README CI section points to **parent** `.github/workflows/`; contradicts local `khobz-index/.github/workflows/` | 5.4 |
| P1 | Runbook exposes `i-bkf/karama`, personal Worker hostname, KV IDs | 5.2, 4 |
| ~~P2~~ | ~~13 `* 2.*` duplicate files~~ | ✅ Done 2026-05-26 |
| P2 | Missing `SECURITY.md` | 5.3 |
| P2 | `data/README.md` and citation URLs still use `<org>/<repo>` placeholders | 6.1 |
| P2 | Cadence wording inconsistent (weekly vs monthly archive grain) | 1.2 |

### Top blockers before public launch (not Phase 1)

1. **Repo topology decision** — standalone `The-Tech-Bay/khobz-index` vs monorepo path (affects every GitHub URL and CI secret home).
2. **Research doc placement** — `kki_research.md` and related parent docs are not in `khobz-index/`; public landing link will 404 unless copied, summarized, or relinked.
3. **Custom domains** — `khobz-index.thebay.ma` and `kilocalorie-index.thebay.ma` not wired in landing metadata or runbook production URLs; no public KKI API for v1.
4. **Duplicate file cleanup** — mechanical delete in Phase 5.2.

---

## Decisions recorded after Phase 1

These **human choices** (R11) are now recorded in [`decisions-d1-d4-guide.md`](./decisions-d1-d4-guide.md). Link, domain, workflow, and methodology edits should use these decisions in later phases.

### D1 — Public repo topology

**Decision:** A — standalone `The-Tech-Bay/khobz-index`; export from the inline monorepo directory when launch-ready.

### D2 — "Used By Karama" section (README)

**Decision:** C — maximum neutral index, with minimal origin attribution. Avoid “Used By Karama” runtime/dependency framing.

### D3 — Long-form research doc on public site

**Decision:** A — copy/split `kki_research.md` into the public repo with implemented vs roadmap markers.

### D4 — Legacy URL `karama.thebay.ma/khobz`

**Decision:** B — hard cutover to `https://khobz-index.thebay.ma`; add `https://kilocalorie-index.thebay.ma` as scientific-name redirect. No public KKI API for v1.

---

## Search-term sweep summary

Executed under `khobz-index/` on 2026-05-26:

| Term | Files (excl. ship-todo + duplicates) | Action summary |
|------|----------------------------------------|----------------|
| `Karama` / `karama` | ~22 | Mostly brand attribution; 8 public rewrites |
| `karama.thebay.ma` | 6 | All rewrite to `khobz-index.thebay.ma` (Phase 4) |
| `apps/mobile` | 0 | — |
| `confirm-web` | 0 | — |
| `Supabase` | ~12 | Keep (closed API integration) |
| `promise` / `settle` | ~8 meaningful | Rewrite public "promises" prose; keep API/settlement technical docs |
| `The-Tech-Bay` | 5 | Keep (target org) |
| `i-bkf` | 4 | Keep in governance; rewrite runbook private repo slug |
| `smail-elboukfaoui` | 1 | Rewrite runbook API URL (Phase 5.2) |

---

## Suggested next steps

1. **Phase 1** — Lock naming + cadence sentence + country coverage definitions using fixture stats (238 countries; derive local-signal counts in Phase 1.3).
2. **Resolve D1** before mass GitHub URL edits.
3. **Phase 5.2** — Delete all `* 2.*` files per task-0.2 (zero merge needed).
4. **Phase 7** — Re-run this inventory's search terms as automated grep checklist.

---

## Phase 0 Definition of Done (this pass)

| Item | Status |
|------|--------|
| Task 0.1 reference table produced | ✅ |
| Task 0.2 duplicate table produced | ✅ |
| Acceptance criteria assessed honestly | ✅ |
| Blockers and human decisions documented | ✅ |
| Artifacts linked from ship-todo | ✅ (see ship-todo Phase 0 header) |
