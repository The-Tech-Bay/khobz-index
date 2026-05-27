# Phase 1 — Public identity and communication alignment

**Date:** 2026-05-26  
**Ship guide:** [`ship-todo.md`](../../ship-todo.md) Phase 1  
**Prerequisite:** Phase 0 audit ([`phase0-readiness-summary.md`](./phase0-readiness-summary.md))

---

## Scope (from ship-todo)

| Task | Goal | Status |
|------|------|--------|
| **1.1** | Lock naming rules in communication docs + README + methodology | ✅ Done (URL implementation deferred to later phases) |
| **1.2** | Standardize cadence sentence across listed surfaces | ✅ Done (URL implementation deferred to later phases) |
| **1.3** | Align country coverage wording with fixture stats | ✅ Done |

**Canonical cadence sentence:**

> KKI refreshes source checks weekly and publishes canonical country records at monthly grain.

**Fixture coverage (2026-04, `landing/src/data/fixture-snapshot.json`):**

| Metric | Value |
|--------|------:|
| Countries in fixture | **238** |
| With local basket signal (latest month) | **~46** (`full` + `degraded` with local leg) |
| Global-only (latest month) | **192** |

---

## Task 1.1 — naming

### Completed

- [`docs/strategy/communication-kit/README.md`](../../../docs/strategy/communication-kit/README.md) — new §5.4 KKI public naming and cadence
- [`docs/strategy/communication-kit/translations.md`](../../../docs/strategy/communication-kit/translations.md) — §8 KKI public strings (EN/FR/AR)
- [`docs/methodology.md`](../../methodology.md) — executive summary, nomenclature, ban list
- [`README.md`](../../README.md) — consumer naming, ban list, coverage definitions

### Deferred (decisions now recorded)

| Item | Decision | Why blocked |
|------|----------|-------------|
| README **Used By Karama** section | **D2-C** | Later README pass should use maximum-neutral framing with minimal origin attribution |
| Press/boilerplate KKI URLs in `channel-copy.md` | **D4-B** | Later URL pass should hard-cut to `khobz-index.thebay.ma` |
| `learnMoreUrl` in mobile i18n (`en`/`fr`/`ar`) | **D4-B** | Later URL pass should hard-cut to `khobz-index.thebay.ma` |

---

## Task 1.2 — cadence

### Completed

| File | Change |
|------|--------|
| `README.md` | Opening + cadence sentence |
| `docs/methodology.md` | Executive summary cadence |
| `landing/index.html` | Meta descriptions |
| `landing/src/pages/HomePage.tsx` | Hero subtitle |
| `landing/src/pages/MethodologyPage.tsx` | FAQ; standalone API wording |
| `docs/architecture/architecture.md` | TL;DR cadence |
| `docs/ops/runbook.md` | Public cadence note |
| `docs/design/userFlows/flows/M17-inflation-anchor.md` | Summary + wireframe hint |
| `apps/mobile/src/lib/i18n/en.ts` | `howCalculated` |
| `apps/mobile/src/lib/i18n/fr.ts` | `howCalculated` |
| `apps/mobile/src/lib/i18n/ar.ts` | `howCalculated` |

### Not changed (blocked or out of scope)

- `landing/index.html` / JSON-LD **canonical URLs** — **D4**
- `channel-copy.md` boilerplate URLs — **D4**

---

## Task 1.3 — country coverage

### Completed

- Defined three-tier wording everywhere Phase 1 touched: **238 in fixture**, **~46 local signal**, **global-only** remainder
- Removed ambiguous **85+** / **245** / **15+** claims from README badge, landing SEO, methodology source table, mobile explainer

### Not changed

- Landing page body copy beyond hero/SEO (full UX pass is Phase 3.2)
- `channel-copy.md` press paragraphs (still reference legacy counts/URLs until D2/D4)

---

## Duplicate deletion (applied with Phase 0 recommendation)

Executed 2026-05-26 before Phase 1 copy pass:

- **13** root `* 2.*` files (per task-0.2)
- **3** additional: `.env 2.example`, `landing/dist/index 2.html`, `landing/dist/og-image 2.png`
- Verification: `find . -name '* 2.*' | wc -l` → **0**

---

## Acceptance criteria check

| Criterion | Met? |
|-----------|------|
| Communication docs and methodology agree on naming | ✅ |
| Public copy has no ambiguous coin/token framing (Phase 1 surfaces) | ✅ |
| Cadence sentence consistent (Phase 1 file list) | ✅ |
| Country count copy has clear definition and matches fixture | ✅ |
| No assumptions on D1–D4 where ship-todo requires wait | ✅ Documented below |

---

## Recorded decisions for later phases

### D1 — Public repo topology

**Decision:** A — standalone `The-Tech-Bay/khobz-index`.  
**Later work:** Phase 5.1/5.4 mass URL + CI edits.

---

### D2 — README "Used By Karama"

**Context:** Current section links Karama app at legacy URL; reads as runtime dependency.  
**Decision:** C — maximum neutral index, with minimal origin attribution.  
**Later work:** README standalone framing in Phase 5.2; avoid “Used By Karama” dependency framing.

---

### D3 — Long-form research doc on public site

**Context:** `MethodologyPage` links to `docs/kki/kki_research.md` which lives in **parent** `docs/kki/` — 404 on future public repo.  
**Decision:** A — copy/split into public repo with implemented vs roadmap markers.  
**Later work:** Phase 2.2 scope and Phase 3.2 GitHub link fix.

---

### D4 — Legacy URL `karama.thebay.ma/khobz`

**Context:** Canonical/OG/mobile `learnMoreUrl` still use legacy path. Phase 1 intentionally did not change URLs.  
**Decision:** B — hard cutover to `https://khobz-index.thebay.ma`. Add `https://kilocalorie-index.thebay.ma` as a scientific-name redirect. No public KKI API for v1.  
**Later work:** Phase 3.1, 3.3, 4.1, communication-kit §7 boilerplate.

---

## Tests (2026-05-26)

```bash
cd khobz-index && bun test tests/unit && bun run typecheck
```

| Check | Result |
|-------|--------|
| `bun test tests/unit` | **138 pass**, 0 fail |
| `bun run typecheck` | **pass** |
| `bun run pages:build` | Not run (Phase 7; copy-only pass) |

---

## Next phase

After **D1** and **D4** answers: Phase 4 domain wiring + Phase 3 landing metadata URLs. Phase 2 methodology truthfulness can proceed in parallel with D3.
