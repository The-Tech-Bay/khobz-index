# KKI Data Quality

This note explains how to read KKI v1.0 data quality, fixture diagnostics, and
landing-page graph behavior. It is the practical supplement to the public
methodology, not a source roadmap.

## 1. Evidence Classes

KKI records combine two independent ideas:

| Field | Answers | Values |
|---|---|---|
| `quality` | How much current local basket evidence was available? | `full`, `degraded`, `global_only` |
| `estimate_method` | Is this direct/proxy KKI or a historical estimate? | `observed`, `cpi_chained`, `headline_cpi_chained`, `global_only_historical` |
| `estimate_confidence` | How strong is the historical evidence? | `observed`, `high`, `medium`, `low` |
| `source_periodicity` | What grain did the source actually publish? | `monthly`, `annual`, `interpolated`, etc. |

A record can be `quality: global_only` and still be useful as a global commodity
reference. It should not be described as a local retail basket measurement.

## 2. Implemented v1.0 Source Truth

### 2.1 Local basket leg

The implemented public fixture uses **FAOSTAT Producer Prices** as a
commodity-level proxy for local basket prices. The script
[`khobz-index/scripts/fetch-faostat-prices.ts`](../../khobz-index/scripts/fetch-faostat-prices.ts):

1. Downloads FAOSTAT Producer Prices bulk data.
2. Filters local-currency-per-tonne rows for KKI basket item codes.
3. Maps FAOSTAT item codes to KKI commodity codes.
4. Converts tonne prices to kg/L basket units.
5. Applies retail markup factors.
6. Interpolates annual rows into monthly rows.
7. Forward-fills the latest available year through the current fixture month.

This creates useful country differentiation, but it remains a **producer-price
proxy**. It is not the same as field-observed shelf prices or household retail
receipts.

### 2.2 Global track

[`khobz-index/data/reference/monthly-global-benchmarks.csv`](../../khobz-index/data/reference/monthly-global-benchmarks.csv)
contains FAO FPI cereals/oils/sugar sub-indices, Brent, and gold. The pipeline
uses it when live global adapters return no usable rows. When that happens,
`global_track.source_ids` includes `benchmark-csv(fpi,gold,brent)`.

### 2.3 Historical CPI envelope

[`khobz-index/scripts/fetch-historical-cpi.ts`](../../khobz-index/scripts/fetch-historical-cpi.ts)
downloads World Bank WDI:

- `FP.CPI.FOOD` as `food_cpi` (preferred).
- `FP.CPI.TOTL` as `headline_cpi` (fallback).

The output is `data/reference/historical-cpi-envelope.json`. Backfills chain the
local basket leg from an observed/proxy base month and preserve the target
month's global leg where available.

## 3. Graph And Fixture Diagnostics

Landing fixtures carry per-country diagnostics:

| Diagnostic | Meaning |
|---|---|
| `first_observed_month` | First month with local KKI data rather than only CPI/global history |
| `last_estimated_month_before_observed` | Last historical estimate before the observed boundary |
| `splice_gap_pct` | Gap between the estimate and the first observed/proxy local record |
| `dominant_estimate_method` | Main historical method for the country |
| `has_annual_cpi_history` | Whether annual CPI appears in the series |

Graph colors and badges should be read as evidence labels:

- **Observed / proxy KKI:** current v1.0 KKI computation from source pipeline.
- **High confidence:** usually Food CPI chained at monthly grain.
- **Medium confidence:** Food CPI annual/interpolated or headline CPI monthly.
- **Low confidence:** headline CPI annual/interpolated or global-only history.

Annual CPI history should render as annual-grain or stepped history. A smooth
monthly curve from annual CPI would overstate precision.

## 4. Splice Gaps

The first local basket/proxy month can differ sharply from the CPI-chained month
before it. That **splice gap** is a diagnostic. It can come from:

- Producer-price proxy vs retail-price reality.
- Food CPI or headline CPI not matching the KKI staple basket.
- Different source periodicity or publication lag.
- Basket item coverage changing at the observed boundary.
- Global-only history meeting a local-data record.

Do not smooth the splice away silently. It is evidence about source mismatch and
should guide future validation work.

## 5. Operational Commands

Use the packaged scripts so the pipeline receives both local proxy and CPI inputs:

```bash
cd khobz-index
bun run pipeline
bun run pipeline:backfill
```

`pipeline:backfill` runs FAOSTAT prefetch, CPI prefetch, and then executes the
pipeline with:

```text
FAOSTAT_CP_JSON_PATH=data/reference/faostat-pp-backfill.json
HISTORICAL_CPI_JSON_PATH=data/reference/historical-cpi-envelope.json
```

Do not run `bun run src/pipeline/run.ts --backfill` directly unless those inputs
are already present and intentionally configured.

## 6. Common Failure Modes

| Symptom | Likely cause | Interpretation |
|---|---|---|
| Many countries have nearly identical USD values | Global track only, no local differentiation | Check FAOSTAT prefetch and local-price coverage |
| Latest month is mostly `global_only` | Local proxy file missing or sparse | Not a local retail ranking; global commodity reference only |
| Long-run history looks stepped | Annual CPI source | Correct if labeled as annual-grain |
| Big jump at observed boundary | Splice gap | Methodology diagnostic, not necessarily a one-month price shock |
| Basket breakdown table is empty | No matching FAOSTAT item rows for latest country/month | UI should show empty state, not blank data |

## 7. Public Wording Rules

- Say **producer-price proxy** for FAOSTAT-derived local records.
- Say **CPI-chained estimate** for pre-observation history.
- Say **headline CPI fallback** when `estimate_method` is
  `headline_cpi_chained`.
- Say **annual-grain** for annual CPI-derived records.
- Do not say FAOSTAT v1.0 records are direct retail observations.
- Do not say FPMA, IMF monthly Food CPI, Eurostat, BLS, MoSPI, implicit FX, or
  weekly archive rows are live until the corresponding implementation ships.
