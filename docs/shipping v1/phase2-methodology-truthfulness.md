# Phase 2 - Methodology Truthfulness and Scientific Standard

**Date:** 2026-05-27  
**Ship guide:** [`ship-todo.md`](../../ship-todo.md) Phase 2  
**Prerequisites:** Phase 0 readiness summary and Phase 1 identity alignment

---

## Scope

Phase 2 corrected the public and research methodology surface so KKI v1.0 can be
read as implemented, not as a blend of implemented pipeline and source roadmap.

| Task | Goal | Status |
|---|---|---|
| **2.1** | Rewrite public methodology as v1.0 implemented truth | Done |
| **2.2** | Reconcile long-form research document | Done |
| **2.3** | Reclassify source research | Done |
| **2.4** | Update data-quality supplement | Done |

---

## Implementation Truth Captured

| Topic | Phase 2 wording |
|---|---|
| Cadence | Weekly source checks; monthly canonical country records |
| Local leg | FAOSTAT Producer Prices proxy, with markup, interpolation, and forward-fill caveats |
| Optional local enhancement | WFP VAM only when credentials/data URL are configured; not the default public claim |
| Global leg | FAO FPI cereals/oils/sugar, benchmark CSV fallback, Brent, gold |
| Historical estimates | World Bank WDI Food CPI preferred, headline CPI fallback |
| Precision | Annual CPI is annual-grain; no monthly precision claim |
| Index-number model | Fixed-basket Laspeyres-family interpretation |
| Diagnostics | Splice gaps are visible methodology diagnostics, not hidden smoothing |
| Roadmap sources | FPMA, IMF monthly Food CPI, Eurostat, BLS, MoSPI, implicit FX, basket v1.1 eggs, and weekly archive rows are not live v1.0 |

---

## Files Changed

| File | Phase 2 change |
|---|---|
| [`docs/methodology.md`](../../docs/methodology.md) | Rewritten as the public v1.0-as-implemented methodology source |
| [`../docs/kki/kki_research.md`](../../../docs/kki/kki_research.md) | Added implementation-status table and corrected live-source/cadence/API claims |
| [`../docs/kki/kki-data-sources-research.md`](../../../docs/kki/kki-data-sources-research.md) | Added implemented, roadmap, research, and deferred classifications before legacy research notes |
| [`../docs/kki/kki-data-quality.md`](../../../docs/kki/kki-data-quality.md) | Rewritten as a plain-language evidence, graph, CPI, splice, and failure-mode supplement |

---

## STOA Summary

### Context

Phase 1 already locked naming, cadence wording, and fixture coverage. Phase 2
needed to make the methodology itself match the shipped pipeline: FAOSTAT proxy
local records, benchmark global fallbacks, CPI historical backcasts, and explicit
quality/confidence labels.

### Impact

The changes affect documentation and public claims only. No calculation code,
schemas, fixtures, landing components, API routes, or source adapters changed in
this pass.

### Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Roadmap sources are mistaken for live coverage | Front-loaded status/classification tables in the research docs |
| Public methodology sounds weaker after caveats | Replaced marketing claims with reproducible provenance and interpretation rules |
| Annual CPI is read as monthly precision | Added annual-grain wording and graph interpretation rules |
| Producer-price proxy is mistaken for retail observation | Repeated producer-vs-retail caveat in methodology and data-quality docs |

### Test

Verification commands are recorded below. Because this was a docs-only pass,
tests primarily protect against accidental repo breakage and stale prohibited
claims.

### Document

This artifact records Phase 2 scope, acceptance criteria, tests, and follow-ups.
`ship-todo.md` is updated only after verification.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| A researcher can read public methodology and understand implemented v1.0 | Met |
| No roadmap source is described as live in the public methodology | Met |
| Long-form research separates implemented vs planned sections | Met |
| Source research cannot be misread as claiming FPMA/IMF/Eurostat/BLS/MoSPI are live | Met via Phase 2 classification |
| Data-quality doc explains graph behavior and source caveats plainly | Met |

---

## Verification

Executed 2026-05-27 from `khobz-index/`:

```bash
bun test tests/unit
bun run typecheck
bun run pages:build
```

| Check | Result |
|---|---|
| `bun test tests/unit` | 138 pass, 0 fail |
| `bun run typecheck` | pass |
| `bun run pages:build` | pass |

Targeted text check:

```bash
rg -n "weekly index|WFP VAM|FPMA|IMF monthly|Eurostat|BLS|MoSPI|coin|token|crypto|buy KK|wallet|investment|lending app|karama.thebay.ma/khobz" khobz-index/docs docs/kki
```

Intentional matches are allowed only when they are ban-list language, roadmap
classification, legacy-source discussion, or documented stale-domain work for
later phases.

Result: intentional matches only. Remaining hits are roadmap labels, legacy
research notes explicitly introduced as legacy, public ban-list language, or D4
domain follow-up references.

---

## Follow-Ups

- Phase 3/4 should continue the D4 hard cutover from `karama.thebay.ma/khobz` to
  `khobz-index.thebay.ma` in landing metadata, mobile links, and runbook URLs.
- Phase 5 should copy or split long-form research into the standalone public
  repository per D3.
- Future source implementation must update methodology, data-quality docs,
  tests, schema/source summaries, and this classification before claiming the
  source is live.
