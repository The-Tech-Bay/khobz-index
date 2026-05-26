# KKI Methodology

> v1.0 - draft, pre-publication
>
> This document is the public methodology reference for the Karama Khobz Index (KKI).
> It will serve as the source content for the methodology landing page at karama.thebay.ma/khobz.

---

## 1. Executive Summary

The Karama Khobz Index (KKI) is a weekly purchasing-power index that measures the
local-currency cost of a fixed weekly subsistence basket in each market. A single KK
(Khobz unit) represents approximately one day of staple subsistence calories for one
adult (~2,200 kcal), making it the most fundamental possible inflation measure:
biologically universal, culturally neutral, and resistant to government manipulation
because it is sourced from observed market prices via UN/multilateral datasets.

KKI is a published reference index, not a token or currency. It has the same legal
status as the Big Mac Index, the IMF SDR rate, or Colombia UVR.

### 1.1 Nomenclature (scientific writing and branding)

- **Public name:** **Karama Khobz Index (KKI)** — used in product, press, and this site. *Khobz* (from Arabic *khubz*, bread; everyday bread in Maghrebi Arabic) names the cultural anchor of the MENA staple basket, not a separate methodology.
- **Scientific and formal papers:** Authors may use **Karama Kilocalorie Index** as the descriptive title — same **KKI**, same math — when a **kcal**-grounded label helps international readers. **Suggested first mention:** *Karama Kilocalorie Index (KKI; branded Karama Khobz Index)*, then **KKI** only. English uses **kilocalorie** (**kcal**); other languages may use cognates (e.g. *kilokalorie*).

Normative detail: [`docs/kki/kki_research.md`](../../../docs/kki/kki_research.md) §3.3 and §12 glossary.

---

## 2. Caloric-Subsistence Invariant

**1 KK ≈ 1 day of staple subsistence calories for one adult (~2,200 kcal).**

Each regional basket is calibrated to ~7 days of subsistence per purchase unit
(~15,300 kcal). This biological constant is the universal anchor: a Casablancan and a
Mumbaikar both need ~2,200 kcal/day. The biology is universal even when the menu is not.

---

## 3. Hybrid Weighting

### Formula

```
KKI(C, t) = α × LOCAL_basket(C, t) + (1 − α) × GLOBAL_basket(t)
```

Where:
- C = country / market
- t = time period (month)
- α = 0.65 (default; tuneable per market)
- LOCAL_basket(C, t) = weighted average price of the regional staple basket in country C,
  sourced from FAOSTAT consumer prices **or** WFP VAM depending on orchestrator cascade
- **Coverage gate (v1.0 pipeline):** if fewer than **60%** of the basket’s nominal weights have observed local prices,
  the local leg is suppressed (`alpha → 0`, `global_only`). Between **60–100%** coverage the engine publishes as **`degraded`** with weights re‑normalised on the priced subset.
- GLOBAL_basket(t) = composite of FAO Food Price Index (cereals + oils + sugar) +
  World Bank Pink Sheet energy (Brent) + LBMA Gold Fix (XAU spot)

### Alpha Tuning by Market Type

| Market type | α | Rationale |
|---|---|---|
| High-trust local data, no subsidies (e.g., France, USA) | 0.80 | Local data is reliable; global track is a small hedge |
| Standard (e.g., Morocco, Kenya, Turkey) | 0.65 | Default balanced |
| Subsidy-heavy (e.g., Egypt baladi bread, Algeria) | 0.50 | Subsidized prices understate real cost; global track lifts toward truth |
| Low-trust or conflict (e.g., Lebanon, South Sudan) | 0.35 | Local data delayed/unreliable; lean on global commodities |
| Missing local data entirely | 0.00 | Global-only with regional data unavailable tag |

---

## 4. Regional Baskets

Each basket targets ~7 days of subsistence (~15,300 kcal):

| Region | Basket name | Items | Approx. kcal |
|---|---|---|---|
| MENA / North Africa | Khobz basket | Wheat flour 1 kg + cooking oil 1 L + sugar 1 kg + pulses 1 kg | ~15,400 |
| South Asia | Atta basket | Atta 1 kg + rice 1 kg + dal 1 kg + edible oil 1 L | ~15,200 |
| East / Southern Africa | Sadza/Ugali basket | Maize meal 1 kg + cooking oil 1 L + dried beans 1 kg + sugar 1 kg | ~15,300 |
| West Africa | Riz basket | Rice 1 kg + cassava/yam 1 kg + palm oil 1 L + dried fish 0.5 kg | ~15,100 |
| East Asia | Mihan basket | Rice 1 kg + cooking oil 1 L + soy 1 kg + sugar 1 kg | ~15,300 |
| Latin America | Tortilla basket | Maize/wheat flour 1 kg + oil 1 L + black beans 1 kg + sugar 1 kg | ~15,400 |
| OECD / Europe / N. America | Loaf basket | Wheat bread 1 kg + dairy 1 L + oil 1 L + sugar 1 kg + eggs 12 ct | ~15,500 |

Cross-region comparability: 1 KK in Casablanca = 1 KK in Mumbai = 1 KK in Sao Paulo,
defined as a fixed share of weekly subsistence-calorie cost in the local-appropriate basket.

---

## 5. Data Sources

| Data slot | Primary | Backup 1 | Backup 2 | Coverage |
|---|---|---|---|---|
| Global cereals/oils/sugar | FAO Food Price Index | World Bank Pink Sheet | USDA FAS PSD | Global |
| Local-market food prices | FAOSTAT consumer prices | WFP VAM DataBridges | National stat office | ~245 countries (FAOSTAT), ~85 (WFP) |
| Gold spot | LBMA Fix | Goldprice.dev | Metals.dev | Global |
| Crude oil (energy) | World Bank Pink Sheet (Brent) | EIA STEO | Yahoo Finance Brent | Global |
| FX (display-only) | Frankfurter (ECB) | exchangerate.host | xe.com fallback | ~30 currencies |

**Pipeline vs. institutional ordering (gold).** In [`kki_research.md`](../../../docs/kki/kki_research.md), the gold slot lists **LBMA** as the institutional primary (Tier-1 benchmark). The automated pipeline in [`khobz-index/docs/architecture/stack.md`](./architecture/stack.md) calls **Goldprice.dev** first, then **Metals.dev**, then **LBMA direct CSV** — because there is no stable public REST for the LBMA fix, while Tier-3 wrappers expose machine-usable APIs. The underlying price remains the LBMA benchmark; order reflects **fetch ergonomics**, not a claim that the wrapper is more authoritative than LBMA.

**Crude oil / FX tertiary backups.** This document and `kki_research.md` list **Yahoo Finance** (Brent) and **xe.com** (FX) as conceptual last-resort backups. They are **not** wired as adapters in `stack.md`: Yahoo has no dependable free API for our pipeline, and xe.com does not provide a no-key, automation-friendly contract. The live pipeline uses **WB Pink Sheet + EIA STEO** (energy) and **Frankfurter + exchangerate.host** (FX only). See `stack.md` §3.7.

All primary sources are 36-107 year old multilateral institutions with explicit
publication mandates. Durability is at the source layer, not the API-wrapper layer.

---

## 6. Versioned Methodology

- **KKI v1.0** - Initial specification. All promises recorded under v1.0 reference v1.0 forever.
- **KKI v1.1** - Source substitution (e.g., if a primary source dies). Same basket, different pipeline.
- **KKI v2.0** - Basket revision (e.g., dietary shift detected over a decade). New version for new data only.

**Prose vs. `methodology_version` field.** Public copy and this doc use shorthand **v1.0**, **v1.1**, **v2.0**. In machine-readable payloads (API, JSON archives, Zod schemas in [`data-schema.md`](./architecture/data-schema.md)), the same lineage is stored as full **semantic versioning** strings (e.g. `1.0.0`, `1.1.0`, `2.0.0`). The major/minor line in prose maps to `MAJOR.MINOR.*` in data.

**Rule: never retroactive recalculation.** A KKI number published under v1.0 stays
v1.0 forever. If the methodology changes, it becomes v1.1+ and applies only to future
calculations. This is the same integrity discipline as versioned API contracts.

---

## 6A. Historical Estimates

Older dates may predate direct KKI basket observations. For those periods, the public site can display CPI-chain estimates with explicit provenance:

```
KKI(C,t) = KKI(C,t0) × CPI(C,t) / CPI(C,t0)
```

Food CPI is preferred because KKI measures staple-food purchasing power. Headline CPI is used only as a fallback. Historical estimates carry:

- `estimate_method` — observed, food CPI chained, headline CPI chained, or global-only historical
- `estimate_confidence` — observed, high, medium, or low
- `source_periodicity` — monthly, annual, interpolated, or source-native cadence
- `base_month` — the observed KKI month used as the chain-link baseline

Public calculators and charts must show these labels so old-money comparisons are useful without overstating precision.

### Historical chart eras and splice diagnostics

Historical KKI charts separate **observed item-price records** from **CPI-chained estimates**:

- **Observed records** use the live KKI basket pipeline for that month.
- **Food CPI chained records** estimate the local basket leg from a real observed base month using a food-price index.
- **Headline CPI chained records** are a lower-confidence fallback because headline CPI includes housing, services, energy, and other non-food components.
- **Annual CPI records** are annual-grain estimates. When shown on a monthly chart, they should appear as stepped annual segments and must not be interpreted as monthly observations.

The observed boundary can create a visible **splice gap** between the last CPI estimate and the first observed basket month. That gap is a methodology diagnostic: it may reflect source coverage, proxy-deflator mismatch, producer-vs-retail price differences, or basket composition differences. It should not be presented as a real one-month inflation shock.

For v1.0 historical backcasts, the local basket component is chain-linked with CPI while the historical global basket leg is preserved where the archive already has a global track for the target month. This keeps the hybrid formula closer to its macroeconomic meaning than scaling the entire KKI by a single headline CPI ratio.

---

## 7. Soundness

### Within-Market

Local-consumption-weighted baskets are the textbook-correct definition of
purchasing-power measurement. This is how every CPI on Earth is constructed. A single
universal basket would be wrong by construction: a Moroccan paying 50 percent more for
rice they do not eat has not lost purchasing power.

### Cross-Market Comparability

Preserved by three independent mechanisms:

1. **Caloric-subsistence invariant.** All baskets target the same biological constant.
2. **Identical 35 percent global track.** GLOBAL_basket(t) is the same everywhere.
   Cross-market gap can never get more than ~65 percent wide.
3. **Regional shock asymmetry is the truth, not noise.** A wheat shock should show up
   bigger in Casa than in Mumbai; that is what actually happened to those families.

---

*End of methodology document. Canonical research: [`docs/kki/kki_research.md`](../../../docs/kki/kki_research.md). Repo alignment log: [`alignment-audit.md`](./alignment-audit.md).*
