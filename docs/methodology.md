# KKI Methodology

> v1.0 as implemented
>
> This is the public methodology reference for the **Karama Khobz Index (KKI)**.
> It describes the current pipeline, not the source roadmap.

---

## 1. Executive Summary

The **Karama Khobz Index (KKI)** measures the local-currency cost of one **KK**:
approximately one day of staple subsistence calories for one adult, using a
regional fixed basket calibrated around 2,200 kcal/day.

**Cadence:** KKI refreshes source checks weekly and publishes canonical country
records at monthly grain. Weekly runs can update operational caches when inputs
change, but the v1.0 public archive is month-based.

KKI is a published reference index. It is not a coin, token, cryptocurrency,
investment product, wallet, or lending app. The current public release is data,
methodology, and static archive material; the running API remains private/internal
for v1.

### 1.1 Naming

- **Public name:** **Karama Khobz Index (KKI)**.
- **Scientific/formal name:** **Karama Kilocalorie Index (KKI; branded Karama
  Khobz Index)**.
- **Unit:** **KK**, approximately one day of staple subsistence calories.

Use **Karama Khobz Index (KKI)** in public copy. Use the scientific name only
where the kilocalorie basis needs to be explicit.

---

## 2. What v1.0 Computes

For country `C` and month `t`, the implemented formula is:

```text
KKI(C, t) = alpha(C) * LOCAL_basket(C, t) + (1 - alpha(C)) * GLOBAL_basket(t)
```

Where:

- `LOCAL_basket(C, t)` is the weighted local-currency cost of the regional
  staple basket for country `C`.
- `GLOBAL_basket(t)` is a shared global commodity track converted into local
  currency for display and hybrid computation.
- `alpha(C)` is the country local-track weight. The default is `0.65`; country
  config can tune it for subsidy-heavy, low-trust, high-trust, or no-local-data
  markets.

The local coverage gate is implemented in the engine:

- If enough basket weight has local prices, KKI publishes as `full`.
- If at least about 60% but not all basket weight has local prices, the priced
  subset is re-normalized and the record publishes as `degraded`.
- If fewer than about 60% of basket weight has local prices, the local leg is
  suppressed, `alpha` is forced to `0`, and the record publishes as
  `global_only`.

The quality flag says how much local evidence went into the record. It is
separate from historical-estimate confidence.

---

## 3. Regional Baskets

Each v1.0 basket targets about seven days of subsistence calories
(roughly 15,100-15,500 kcal per basket). One KK is one seventh of that basket.

| Region | Basket name | v1.0 items | Approx. kcal |
|---|---|---|---:|
| MENA / North Africa | Khobz basket | Wheat flour 1 kg + cooking oil 1 L + sugar 1 kg + pulses 1 kg | ~15,400 |
| South Asia | Atta basket | Atta 1 kg + rice 1 kg + dal 1 kg + edible oil 1 L | ~15,200 |
| East / Southern Africa | Sadza/Ugali basket | Maize meal 1 kg + cooking oil 1 L + dried beans 1 kg + sugar 1 kg | ~15,300 |
| West Africa | Riz basket | Rice 1 kg + cassava/yam 1 kg + palm oil 1 L + dried fish 0.5 kg | ~15,100 |
| East Asia | Mihan basket | Rice 1 kg + cooking oil 1 L + soy 1 kg + sugar 1 kg | ~15,300 |
| Latin America | Tortilla basket | Maize/wheat flour 1 kg + oil 1 L + black beans 1 kg + sugar 1 kg | ~15,400 |
| OECD / Europe / North America | Loaf basket | Wheat bread 1 kg + dairy 1 L + oil 1 L + sugar 1 kg + eggs 12 ct | ~15,500 |

This is a fixed-basket, Laspeyres-family interpretation. It intentionally does
not model substitution inside v1.0. Basket revisions require a methodology or
basket-version change and do not rewrite old records.

---

## 4. Implemented Source Stack

This table describes the current v1.0 pipeline. Roadmap sources are not listed as
live sources here.

| Data slot | Implemented v1.0 source path | Role |
|---|---|---|
| Local basket prices | FAOSTAT Producer Prices bulk backfill (`data/reference/faostat-pp-backfill.json`) | Commodity-level proxy for local prices, converted from tonne to kg/L with markup factors, interpolated to months, and forward-filled |
| Optional local enhancement | WFP VAM DataBridges adapter when credentials and data URL are configured | Can provide retail/market observations where available; not required for the default public fixture |
| Global food track | FAO FPI cereals, oils, sugar; benchmark CSV fallback | Shared global food component |
| Energy | World Bank Pink Sheet Brent; EIA STEO fallback | Shared energy component |
| Gold | Goldprice.dev, Metals.dev, LBMA CSV fallback path | Shared gold component; wrappers are fetch ergonomics around benchmark gold data |
| FX display/conversion | Frankfurter, exchangerate.host | FX is used for display and local-currency conversion; it is not the conceptual food-price signal |
| Historical estimates | World Bank WDI Food CPI (`FP.CPI.FOOD`) and headline CPI (`FP.CPI.TOTL`) envelope | Backcasts periods before local basket observations |

### 4.1 FAOSTAT Producer-Price Proxy

The current public fixture relies on FAOSTAT Producer Prices as a pragmatic local
price proxy. The prefetch script:

1. Downloads FAOSTAT producer-price bulk data.
2. Filters to basket item codes and local-currency-per-tonne rows.
3. Maps FAOSTAT item codes to KKI commodity codes.
4. Converts tonne prices to kg/L basket units.
5. Applies markup factors to approximate retail-facing basket costs.
6. Interpolates annual rows to monthly records.
7. Forward-fills the latest available year through the current fixture month.

This makes country-level local differentiation possible, but it is not the same
as direct retail shelf-price observation. Producer-vs-retail differences are a
known v1.0 limitation.

### 4.2 Global Benchmark Fallback

If live FAO FPI, Brent, or gold adapters return no usable rows, the pipeline uses
`data/reference/monthly-global-benchmarks.csv`. Records that use this path expose
the benchmark source in `global_track.source_ids`.

### 4.3 Sources Not Yet Live

The following sources are researched or approved roadmap items, not implemented
v1.0 claims: FAO FPMA, IMF monthly Food CPI, Eurostat HICP, BLS Average Retail
Food Prices, India MoSPI, implicit parallel FX derivation, basket v1.1 eggs, and
weekly archive rows.

---

## 5. Historical Estimates

Observed v1.0 records and historical estimates are different evidence classes.
Older periods can predate local basket observations. For those periods, KKI uses
CPI chain-linking from an observed KKI base month:

```text
KKI(C, t) = KKI(C, t0) * CPI(C, t) / CPI(C, t0)
```

Implementation detail: the v1.0 backfill chains the **local basket leg** with CPI
and preserves the target month's archived global basket leg where available, then
reconstructs the hybrid formula. This is closer to the macroeconomic meaning of
KKI than multiplying the entire index by one CPI ratio.

Historical records carry these fields:

| Field | Meaning |
|---|---|
| `estimate_method` | `observed`, `cpi_chained`, `headline_cpi_chained`, or `global_only_historical` |
| `estimate_confidence` | `observed`, `high`, `medium`, or `low` |
| `source_periodicity` | `realtime`, `daily`, `weekly`, `monthly`, `annual`, `interpolated`, or `unknown` |
| `base_month` | Observed KKI month used as the chain-link base |
| `estimate_source_ids` | CPI or source identifiers used for the estimate |

Food CPI is preferred because KKI measures staple-food purchasing power. Headline
CPI is lower-confidence because it includes housing, services, transport, and
other non-food components.

Annual CPI-derived records are annual-grain estimates. If displayed on a monthly
chart, they must be visibly labeled as annual or interpolated and must not be
interpreted as monthly observations.

### 5.1 Splice Diagnostics

The boundary between CPI-chained history and observed/proxy basket records can
create a visible splice gap. That gap is a diagnostic, not an ordinary one-month
inflation shock. It can reflect producer-vs-retail mismatch, CPI-vs-staple-basket
mismatch, source coverage changes, or basket composition differences. v1.0 exposes
this rather than smoothing it away.

---

## 6. Interpretation Rules

- `quality` (`full`, `degraded`, `global_only`) describes the current basket data
  coverage for a record.
- `estimate_confidence` describes whether a record is observed/proxy-based or
  historically estimated.
- `source_periodicity` describes the native grain of the evidence, not the visual
  chart interval.
- `global_only` countries should be read as global commodity reference records,
  not local retail-price measurements.
- Producer-price proxy records should not be described as direct retail market
  observations.

---

## 7. Limitations

KKI v1.0 is scientifically useful because it is explicit about its evidence, but
it has limits:

- **Producer vs retail:** FAOSTAT producer prices are proxies for local basket
  costs, not household shelf prices.
- **Annual CPI:** World Bank WDI CPI inputs are often annual. They support
  long-run purchasing-power context, not monthly precision.
- **Headline CPI fallback:** Headline CPI is a broad cost-of-living proxy and can
  diverge materially from staple-food prices.
- **Fixed basket:** v1.0 is a fixed-basket index. It does not capture consumer
  substitution when prices move.
- **Forward-fill and interpolation:** Recent local proxy values may be carried
  forward from the latest FAOSTAT year. This is visible through source/provenance
  fields and should not be marketed as fresh retail observation.
- **No hidden smoothing:** Splice gaps and source disagreements are documented as
  diagnostics.

---

## 8. Versioning

Public prose uses `v1.0`, `v1.1`, and `v2.0`. Machine-readable records store
semantic versions such as `1.0.0`.

- **v1.0:** Current implemented formula, baskets, source stack, and historical
  provenance fields.
- **v1.1:** Future non-breaking source additions or source substitutions.
- **v2.0:** Future basket or formula revision.

Published records are immutable. Corrections are additive; old records are not
silently overwritten or recalculated under a newer methodology.

---

## 9. Further Reading

- Long-form methodology research: [`docs/kki/kki_research.md`](../../../docs/kki/kki_research.md)
- Data quality supplement: [`docs/kki/kki-data-quality.md`](../../../docs/kki/kki-data-quality.md)
- Data schema: [`docs/architecture/data-schema.md`](./architecture/data-schema.md)
- Pipeline stack: [`docs/architecture/stack.md`](./architecture/stack.md)
