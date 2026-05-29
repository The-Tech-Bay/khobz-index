# KKI Data Sources Deep Research — Alternatives & Enhancements to WFP VAM / FAOSTAT

> **Task:** Deep research for alternatives/complements to WFP VAM and FAOSTAT for local commodity prices
> **Status:** ✅ Complete; Phase 2 public-ship classification applied 2026-05-27
> **Date:** 2026-05-14
> **Parent:** [`kki_research.md`](./kki_research.md) §4 (Data Sources & Resilience Architecture)
> **Decision scope:** Affects the `LOCAL_basket(C, t)` data slot — the 65%-weighted local track of the KKI hybrid formula.

---

## 0. Phase 2 Classification

This document is source research. It includes implemented facts, validated
roadmap decisions, and exploratory candidates. The classification below is
binding for public v1.0 copy.

### 0.1 Implemented v1.0

| Source / technique | v1.0 role | Public claim allowed |
|---|---|---|
| FAOSTAT Producer Prices bulk backfill | Implemented local basket proxy | "FAOSTAT producer-price proxy with markup/interpolation/forward-fill caveats." |
| World Bank WDI `FP.CPI.FOOD` | Implemented preferred historical CPI backcast input where available | "Food CPI is preferred for CPI-chained historical estimates." |
| World Bank WDI `FP.CPI.TOTL` | Implemented headline CPI fallback | "Headline CPI is a lower-confidence fallback." |
| FAO FPI cereals/oils/sugar benchmark CSV | Implemented global-track fallback | "Benchmark CSV prevents flat global composites when live source rows are unavailable." |
| World Bank Pink Sheet Brent and EIA STEO | Implemented energy leg / fallback | "Energy component uses Brent with a second source path." |
| Goldprice.dev / Metals.dev / LBMA CSV fallback | Implemented gold fetch path / institutional fallback | "Wrappers are machine-readable paths; LBMA remains the benchmark family." |
| Frankfurter / exchangerate.host | Implemented FX display/conversion path | "FX supports display and conversion; it is not the food-price signal." |

### 0.2 Validated / Approved Roadmap

These items are promising and may be scheduled, but are not live v1.0:

| Source / technique | Classification | Reason |
|---|---|---|
| FAO FPMA | Roadmap primary local retail/wholesale source | Strong institutional fit, but adapter not shipped in v1.0. |
| WFP VAM / HDX | Optional configured enhancement / roadmap fallback | Adapter exists, but default public fixture must not imply WFP-primary coverage. |
| World Bank RTFP | Roadmap complement | Useful ML-imputed retail/wholesale estimates; not wired. |
| IMF monthly Food CPI | Roadmap/research | Useful for broader monthly CPI chain-linking; current implemented CPI envelope is World Bank WDI. |
| Eurostat HICP food | Specialized roadmap | Strong EU/EEA food-price source; not wired. |
| BLS Average Retail Food Prices | Specialized roadmap | Strong US exact retail source; not wired. |
| India MoSPI / NSO | Specialized roadmap | Strong India source; not wired. |
| Implicit parallel FX derivation | Roadmap method | Scientifically plausible for crisis markets; schema/pipeline change not shipped. |
| Basket v1.1 eggs / commodity refinements | Roadmap basket revision | Requires versioned basket change; not v1.0. |
| WFP weekly fetch / weekly archive rows | Roadmap cadence upgrade | v1.0 checks weekly but publishes monthly canonical archive records. |

### 0.3 Research Candidates

RATIN, IFPRI Domestic Food Price Monitor, Numbeo, PriceStats, Open Food
Facts/Open Prices, World Bank HFCP, and e-commerce scraping are research
candidates. They need source contracts, licensing review, operational cost
checks, validation tests, and bias documentation before becoming methodology.

### 0.4 Deferred / Not Implemented

Do not present these as live:

- FPMA as current primary source.
- IMF, Eurostat, BLS, or MoSPI as current adapters.
- Crowd/e-commerce prices as current observations.
- Parallel FX correction as current global-basket conversion.
- Eggs in all baskets or substitution-aware basket changes.
- Weekly public archive rows.

---

## Legacy Research Notes

The remainder of this file preserves discovery notes and recommendations. Treat
phrases like "Phase 1.0 immediate" or "current coverage" as historical research
language unless the source appears in §0.1 above.

---

## 1. Problem Statement

The current KKI v1.0 spec (§4.1 of `kki_research.md`) relies on:

| Source | Role | Actual coverage | Cadence | Risk |
|---|---|---|---|---|
| **WFP VAM DataBridges** | Primary local prices | ~85–98 countries (crisis/fragile focus) | Monthly (weekly in crisis) | **Donor-funded, no statistical mandate** — highest discontinuation risk of any primary source |
| **FAOSTAT consumer prices** | Backup local prices | 245 countries (claimed) | Annual/irregular | **Producer prices, not consumer/retail** — often 12–24 month lag; not what KKI needs |

Two structural weaknesses:

1. **WFP VAM is operationally funded, not mandate-funded.** If donor priorities shift (post-crisis fatigue), coverage contracts. WFP already has the highest discontinuation risk in the §4.2 reliability table.
2. **FAOSTAT's "245 countries" is misleading for KKI.** FAOSTAT primarily publishes *producer* prices and *food CPI indices*, not commodity-level *retail* prices for wheat flour, rice, oil, and sugar. Annual cadence and 12–24 month lag makes it useless as a weekly/monthly local-price source. It's a backup of last resort, not a real alternative.

**Goal:** Find sources that deliver **retail/consumer-level commodity prices**, for **maximum country coverage**, at **monthly or better cadence**, with **institutional durability** (statistical mandate > donor funding).

---

## 2. Source-by-Source Analysis

### 2.1 FAO FPMA (Food Price Monitoring and Analysis) — ⭐ TOP DISCOVERY

| Attribute | Detail |
|---|---|
| **Operator** | UN FAO GIEWS (Global Information and Early Warning System) |
| **URL** | https://fpma.fao.org/giews/food-prices/tool |
| **Coverage** | **88+ countries**, 1,300+ domestic and international price series |
| **Cadence** | Monthly (some series weekly) |
| **Price type** | **Domestic retail and wholesale** — exactly what KKI needs |
| **Commodities** | Wheat/wheat flour, rice, maize, beans/pulses, cooking oil, sugar, and 30+ more staples |
| **API** | Yes — undocumented REST API; reverse-engineered by [tezamo/FPMA](https://github.com/tezamo/FPMA) (MIT, March 2026) |
| **Formats** | JSON (API), CSV (bulk/tool download) |
| **Backed by** | UN FAO — **statistical/early-warning mandate** (not donor-funded like WFP) |
| **First publication** | GIEWS established 1975 (51 years); FPMA database continuous since ~2000 |
| **Discontinuation risk** | **Negligible** — same institutional mandate as FAOSTAT and FAO FPI |
| **Gap-filling** | The tezamo/FPMA wrapper outputs gap-filled time series in USD + local currency |

**Why this is the top discovery:** FPMA is operationally distinct from FAOSTAT. While FAOSTAT publishes annual producer-price aggregates, FPMA publishes *monthly domestic retail/wholesale prices at market level* for 88+ countries. It covers exactly the commodities in every KKI regional basket (wheat flour, rice, maize meal, cooking oil, sugar, pulses/beans). It has the same institutional backing as FAOSTAT (UN FAO Rome) but is purpose-built for food-price monitoring — essentially doing what WFP VAM does, but under FAO's statistical mandate rather than WFP's operational/humanitarian funding.

**KKI fit:** Direct replacement for WFP VAM as primary local-price source. Higher institutional durability. Comparable country coverage (88 vs ~85-98). Same or better commodity match. Monthly cadence matches KKI's weekly-pipeline design (local data only needs monthly refresh; global track provides the weekly delta).

---

### 2.2 World Bank RTFP (Real-Time Food Prices) — STRONG COMPLEMENT

| Attribute | Detail |
|---|---|
| **Operator** | World Bank Group |
| **URL** | https://microdata.worldbank.org/catalog/4483 |
| **Coverage** | **36–40 countries**, 3,277 markets |
| **Cadence** | Monthly estimates, updated weekly |
| **Price type** | Retail and wholesale — **ML-imputed from WFP, FAO, and national stat offices** |
| **Commodities** | Apples, bananas, beans, bread, cassava, eggs, fish, lentils, maize, millet, oil, onion, peas, potatoes, rice, salt, sorghum, sugar, wheat flour, yam — comprehensive |
| **API** | Data API via World Bank microdata catalog; bulk CSV download |
| **Backed by** | World Bank Group (UN-affiliated) |
| **First publication** | 2021 (current methodology); underlying data from 2007 |
| **Discontinuation risk** | **Low** — World Bank has 66-year publication track record |
| **ML gap-filling** | Uses machine learning to impute missing prices from nearby markets and related commodities. 99% correlation with field-enumerator data for maize; 93% for rice in validation studies. |

**Why this matters:** RTFP doesn't just mirror WFP data — it *adds value* through ML gap-filling. When WFP has gaps (which is frequent in fragile states), RTFP provides modeled estimates with confidence bounds (Open/High/Low/Close). The 756K+ data points across 809 variables give granular subnational coverage. It's essentially a "cleaned and filled" version of WFP + FAO + national data.

**KKI fit:** Excellent backup/complement to FPMA. Particularly valuable for fragile states (South Sudan, CAR, Somalia, Yemen) where even FPMA has gaps. The ML-imputed estimates align with KKI's philosophy of "best available observation > no observation."

---

### 2.3 IMF CPI Food Sub-Index — UNIVERSAL COVERAGE FALLBACK

| Attribute | Detail |
|---|---|
| **Operator** | International Monetary Fund |
| **URL** | https://data.imf.org/CPI |
| **Coverage** | **~165 economies** — near-universal |
| **Cadence** | Monthly |
| **Price type** | **Consumer Price Index — Food and Non-Alcoholic Beverages sub-index** |
| **Commodities** | Not individual commodities — aggregate food CPI |
| **API** | SDMX 2.1 / 3.0 API (free, no key required for basic access) |
| **Backed by** | IMF — 189 member countries, statistical publication mandate |
| **First publication** | IFS database since 1948 (78 years) |
| **Discontinuation risk** | **Negligible** |

**Strategic insight for KKI:** The IMF Food CPI sub-index is not individual commodity prices — it's a food-inflation index. But this is *exactly what KKI fundamentally measures*: purchasing-power change for food. For countries where FPMA/WFP/RTFP don't provide commodity-level prices, KKI can use the IMF Food CPI change rate to derive basket movement from a known baseline:

```
LOCAL_basket(C, t) = LOCAL_basket(C, t₀) × (FoodCPI(C,t) / FoodCPI(C,t₀))
```

Where `t₀` is the last period with actual commodity prices. This is mathematically sound — if we know the basket cost at one point in time, and we know how food prices moved (via food CPI), we can estimate the current basket cost with high accuracy. This approach unlocks **~80 additional countries** that have no FPMA/WFP coverage but do report food CPI to the IMF.

**KKI fit:** Universal fallback. Gets KKI from ~88 countries (FPMA) to **~145+ countries** with monthly data. Requires one-time baseline calibration per country.

---

### 2.4 Eurostat HICP Food Sub-Index — EU/EEA GOLD STANDARD

| Attribute | Detail |
|---|---|
| **Operator** | Eurostat (EU Statistical Office) |
| **URL** | https://ec.europa.eu/eurostat/web/hicp/database |
| **Coverage** | **27 EU + 4 EEA + candidate countries** (~36 countries) |
| **Cadence** | Monthly |
| **Price type** | Harmonised Index of Consumer Prices — Food, Alcohol & Tobacco |
| **API** | SDMX 2.1 API (free, well-documented) |
| **Backed by** | EU — legal mandate (ECB monetary policy input) |
| **Discontinuation risk** | **Negligible** — required by EU Treaty for ECB operations |
| **Data quality** | Highest in the world — the EU has the best public-price-data infrastructure on Earth |

**KKI fit:** Replaces the vague "INSEE food sub-indices + Eurostat HICP" note in the current spec with a concrete, API-accessible source covering all of EU/EEA. The HICP food sub-index is the definitive source for European food-price inflation.

---

### 2.5 HDX / WFP Global Food Prices Database — ACCESSIBILITY LAYER

| Attribute | Detail |
|---|---|
| **Operator** | OCHA Centre for Humanitarian Data (hosting WFP data) |
| **URL** | https://data.humdata.org/dataset/wfp-food-prices |
| **Coverage** | **~98 countries**, ~3,000 markets |
| **Cadence** | Monthly (updated weekly on HDX) |
| **Price type** | Retail and wholesale commodity prices |
| **API** | HDX CKAN API + bulk CSV; automated scraper pipeline on GitHub |
| **Backed by** | UN OCHA + WFP (same underlying data as WFP VAM) |

**Why this matters:** This is the same WFP data, but accessible via HDX's open-data infrastructure rather than the WFP VAM DataBridges API. The [OCHA-DAP/hdx-scraper-wfp-foodprices](https://github.com/OCHA-DAP/hdx-scraper-wfp-foodprices) GitHub pipeline automates extraction and produces per-country CSVs. For KKI, this provides an alternative ingestion path if the WFP DataBridges API changes or rate-limits.

**KKI fit:** Alternative access path for WFP data. Not a new source, but reduces single-point-of-failure risk on the WFP API endpoint.

---

### 2.6 BLS Average Retail Food Prices — US GOLD STANDARD

| Attribute | Detail |
|---|---|
| **Operator** | US Bureau of Labor Statistics |
| **URL** | https://data.bls.gov/timeseries/APU0000701111 |
| **Coverage** | **US only** — national and regional averages |
| **Cadence** | Monthly |
| **Price type** | Average retail prices (exact $/lb or $/unit) |
| **Commodities** | ~70 food items including flour (white, all purpose), rice (white, long grain), eggs, bread, sugar, vegetable oil |
| **API** | BLS Public Data API (free, key optional) + bulk TSV download |
| **Backed by** | US Department of Labor — 141-year statistical mandate |
| **Discontinuation risk** | **Negligible** |

**KKI fit:** Already noted in `kki_research.md` §6 as "gold-standard" for US. Confirmed: BLS publishes exact prices for flour, rice, sugar, and eggs — matching the Loaf basket. Oil series needs verification (vegetable oil vs cooking oil classification).

---

### 2.7 India MoSPI / NSO — INDIA GOLD STANDARD

| Attribute | Detail |
|---|---|
| **Operator** | Ministry of Statistics & Programme Implementation, Government of India |
| **URL** | https://esankhyiki.mospi.gov.in/ |
| **Coverage** | **India** — 1,407 urban markets + 1,465 villages, all States/UTs |
| **Cadence** | Weekly collection, monthly release |
| **Price type** | Consumer price indices with food sub-components |
| **API** | Two Python API clients: `mospi-unitdata` (microdata) and `mospi-esankhyiki` (500+ indicators) |
| **Backed by** | Government of India — constitutional statistical mandate |
| **Discontinuation risk** | **Negligible** |

**KKI fit:** For the Atta basket (India), MoSPI provides the most granular data available — state-level food prices from nearly 3,000 collection points. Far superior to any international source for India-specific tracking.

---

### 2.8 RATIN (Regional Agricultural Trade Intelligence Network) — EAST AFRICA

| Attribute | Detail |
|---|---|
| **Operator** | Eastern Africa Grain Council (EAGC) |
| **URL** | https://ratin.net |
| **Coverage** | Kenya, Uganda, Tanzania, Ethiopia — hundreds of markets |
| **Cadence** | Real-time / daily updates |
| **Price type** | Wholesale and retail for grains, beans, oilseeds |
| **Commodities** | Maize, beans, groundnuts, rice, sorghum, millet, wheat, sesame |
| **API** | Web-accessible (unclear if formal API) |
| **Discontinuation risk** | **Medium** — regional trade body, donor co-funded |

**KKI fit:** Excellent for the Sadza/Ugali basket in East Africa. Higher cadence than FPMA for these four countries. Could serve as a daily "fast signal" for East African markets where weekly refresh matters (e.g., Kenya, Uganda in crisis periods).

---

### 2.9 IFPRI Food Security Portal / Domestic Food Price Monitor

| Attribute | Detail |
|---|---|
| **Operator** | IFPRI (International Food Policy Research Institute, CGIAR) |
| **URL** | https://www.foodsecurityportal.org/tools/domestic-food-price-monitor |
| **Coverage** | India, Guatemala, Rwanda, Kenya, Tanzania, Uganda, Burundi (expanding) |
| **Cadence** | **Daily updates** |
| **Price type** | Wholesale and retail market prices |
| **API** | JSON API via CKAN; 12,000+ datasets; 50 countries historically |
| **Backed by** | CGIAR — international agricultural research mandate |
| **Discontinuation risk** | **Low-Medium** — CGIAR-funded, not donor-dependent |

**KKI fit:** Daily cadence is valuable for crisis-market refresh. The CGIAR backing provides institutional stability. Expanding coverage makes this a "watch" source for v1.1+.

---

### 2.10 Numbeo — CROWDSOURCED GLOBAL COVERAGE

| Attribute | Detail |
|---|---|
| **Operator** | Numbeo (private, Serbian company) |
| **URL** | https://www.numbeo.com/food-prices |
| **Coverage** | **180+ countries**, city-level data |
| **Cadence** | Continuous (crowdsourced) |
| **Price type** | Consumer retail prices — specific items (bread, eggs, milk, rice, oil, etc.) |
| **Commodities** | Bread (white, 500g), Rice (white, 1kg), Eggs (12), Milk (1L), cooking oil — maps well to KKI baskets |
| **API** | Paid REST API (tiered pricing) |
| **Quality controls** | 30+ automated filters; manually-gathered data weighted 3× vs crowdsourced; IP-based spam blocking |
| **Backed by** | Private company (since 2009, 17 years) |
| **Discontinuation risk** | **Medium** — private company, but 17-year track record + revenue-generating API |

**Why this is interesting:** Numbeo covers countries that no UN/multilateral source touches — particularly middle-income OECD countries and small island states. Its commodity list maps well to KKI baskets (bread, rice, eggs, milk, oil). The 3× weighting for manually-gathered data and 30+ quality filters provide reasonable confidence for a crowdsourced source.

**KKI fit:** Fill coverage gaps in countries that have no FPMA/WFP/RTFP data but do have Numbeo contributors (many European, Asian, and Latin American middle-income countries). Not primary-source quality, but better than global-only (α=0). Could be used as a tertiary fallback or cross-validation source.

**Caveat:** Paid API; private company risk; crowdsourced data skews urban/middle-class (may not reflect prices faced by low-income populations the index is designed to protect).

---

### 2.11 PriceStats (State Street) — COMMERCIAL GOLD STANDARD

| Attribute | Detail |
|---|---|
| **Operator** | State Street Global Markets (acquired from MIT BPP lineage) |
| **URL** | https://www.pricestats.com |
| **Coverage** | **27+ countries** |
| **Cadence** | **Daily** (3-day publication lag) |
| **Price type** | Online retail prices scraped from 1,500+ retailer websites |
| **History** | 17+ years (from Billion Prices Project, 2008) |
| **Backed by** | State Street Corporation ($44T AUM) |
| **Discontinuation risk** | **Low** — revenue-generating product for institutional investors |

**Why this matters:** PriceStats is the academic gold standard for alternative inflation measurement (Cavallo & Rigobon, MIT/Harvard). KKI already cites BPP lineage in `kki_research.md` §7.3. PriceStats publishes daily food price indices that could serve as a high-cadence validation signal.

**KKI fit:** Too expensive and narrow (27 countries) for primary use. But the BPP/PriceStats methodology validates KKI's approach: observed market prices as an alternative to official CPI. For academic credibility, citing PriceStats validation studies strengthens KKI's positioning.

---

### 2.12 E-Commerce Scraping (Jumia, Carrefour, Noon) — PHASE 2+ SIGNAL

| Platform | Coverage | Commodities | Access |
|---|---|---|---|
| **Jumia** | 11 African countries (NG, KE, EG, MA, GH, CI, SN, UG, TZ, CM, DZ) | Groceries including flour, rice, oil, sugar | Scraping APIs ($0.90–3/1K results) |
| **Carrefour** | Morocco, Egypt, Kenya, UAE, Saudi Arabia, France | Full grocery catalog | Scraping services available |
| **Noon** | UAE, Saudi Arabia, Egypt | Grocery delivery catalog | Scraping API ($1.20/1K results) |

**KKI fit:** Real-time, ground-truth prices from actual retail transactions. Aligned with Q-K3 in `kki_research.md` §11 (BPP-style web scraping integration). Not viable for v1.0 (brittle, requires maintaining scraping infrastructure, TOS risk), but valuable for v1.2+ as a validation/cadence-improvement layer. Carrefour is particularly interesting because it operates in Morocco (launch market), Egypt, and Kenya — three of the first KKI markets.

---

### 2.13 Open Food Facts / Open Prices — OPEN-SOURCE CROWDSOURCED

| Attribute | Detail |
|---|---|
| **Operator** | Open Food Facts (nonprofit, France) |
| **URL** | https://prices.openfoodfacts.org |
| **Coverage** | Primarily France, Belgium, Russia; 248K+ price entries |
| **Cadence** | Continuous (~107 new prices/day) |
| **API** | REST API (free, OdBL license) |
| **Discontinuation risk** | **Medium-High** — small nonprofit, volunteer-driven |

**KKI fit:** Too limited in coverage for primary use. The ~248K entries are mostly European. But the open-source, open-data ethos aligns with KKI's OSS philosophy. Worth monitoring as the project grows; could become a useful European validation source.

---

### 2.14 World Bank HFCP (High Frequency Crowdsourced Prices) — EMERGING

| Attribute | Detail |
|---|---|
| **Operator** | World Bank |
| **Coverage** | Nigeria only (2024-2025); pilot in 15 countries (2015-2016) |
| **Cadence** | Daily |
| **Price type** | Retail prices from mobile-app volunteers + trained enumerators |

**KKI fit:** Proof-of-concept for KKI's own "price ping" feature (Phase 1.2+, Q-K3). The Nigeria HFCP validates that crowdsourced mobile-app price collection works at national scale. KKI could eventually plug into HFCP if World Bank expands it, or build a compatible system.

---

## 3. Coverage Gap Analysis

### 3.1 Legacy Coverage Assumption (WFP VAM primary + FAOSTAT backup)

This table records the original research assumption. It is **not** the current
v1.0 public fixture claim. Implemented v1.0 uses the FAOSTAT producer-price proxy
as the scalable default local leg and treats WFP as optional/configured.

| Region | WFP VAM | FAOSTAT (usable) | Actual KKI coverage |
|---|---|---|---|
| Sub-Saharan Africa | ~40 countries | Annual/lagged | ~40 |
| MENA | ~10 countries | Annual/lagged | ~10 |
| South Asia | ~5 countries | Annual/lagged | ~5 |
| Southeast Asia | ~5 countries | Annual/lagged | ~5 |
| Latin America | ~5 countries | Annual/lagged | ~5 |
| East Asia | ~2 countries | Annual/lagged | ~2 |
| OECD/Europe | 0 | Annual/lagged | 0 (global-only) |
| **Total** | **~67 (realistic)** | **Backup only** | **~67 with monthly data** |

### 3.2 Proposed Coverage (Multi-Source Stack)

| Region | Primary | Backup 1 | Backup 2 | New total |
|---|---|---|---|---|
| Sub-Saharan Africa | FAO FPMA (~45) | WFP VAM/HDX | WB RTFP (ML-filled) | **~48** |
| MENA | FAO FPMA (~12) | WFP VAM | IMF Food CPI | **~15** |
| South Asia | FAO FPMA + India MoSPI | WFP VAM | IMF Food CPI | **~8** |
| Southeast Asia | FAO FPMA (~8) | WFP VAM | IMF Food CPI | **~10** |
| Latin America | FAO FPMA (~10) | IMF Food CPI | Numbeo | **~20** |
| East Asia | IMF Food CPI | Numbeo | — | **~5** |
| OECD/Europe | Eurostat HICP (~36) | IMF Food CPI | BLS (US) | **~40** |
| Other (Pacific, Caribbean, etc.) | IMF Food CPI | Numbeo | — | **~15** |
| **Total** | | | | **~145–165** |

**Net gain: from ~67 countries with usable monthly data to ~145–165 countries.**

---

## 4. Recommended Revised Source Stack (Roadmap)

### 4.1 New Source Inventory (roadmap; does not replace implemented v1.0)

| Data slot | Primary | Backup 1 | Backup 2 | Coverage |
|---|---|---|---|---|
| **Global cereals/oils/sugar** | FAO Food Price Index | World Bank Pink Sheet | USDA FAS PSD | Global |
| **Local prices — developing** | **FAO FPMA** (88+ countries) | WFP VAM DataBridges via HDX (~98 countries) | **World Bank RTFP** (36 countries, ML-imputed) | ~100 unique countries |
| **Local prices — EU/EEA** | **Eurostat HICP food sub-index** (~36 countries) | IMF CPI Food sub-index | — | ~36 countries |
| **Local prices — US** | **BLS Average Retail Food Prices** | IMF CPI Food sub-index | Numbeo | US |
| **Local prices — India** | **India MoSPI / NSO** (3,000 markets) | FAO FPMA | WFP VAM | India |
| **Local prices — universal fallback** | **IMF CPI Food sub-index** (~165 economies) | Numbeo (180+ countries) | — | ~80 additional countries |
| **Gold spot** | LBMA Fix | Goldprice.dev | Metals.dev | Global |
| **Crude oil (energy)** | World Bank Pink Sheet (Brent) | EIA STEO | Yahoo Finance Brent | Global |
| **FX (display-only)** | Frankfurter (ECB) | exchangerate.host | xe.com fallback | ~30 currencies |

### 4.2 New Reliability Tiering

| Source | Backed by | First continuous publication | Discontinuation risk | Price type |
|---|---|---|---|---|
| **FAO FPMA** | UN FAO (GIEWS mandate) | 1975/~2000 (26+ yrs digital) | **Negligible** | Domestic retail/wholesale |
| **World Bank RTFP** | World Bank Group | 2007 (19 yrs) | **Low** | ML-imputed retail |
| **IMF CPI Food** | IMF (189 members) | 1948 (78 yrs) | **Negligible** | Food CPI sub-index |
| **Eurostat HICP** | EU (treaty obligation) | 1996 (30 yrs) | **Negligible** | Harmonised food CPI |
| **BLS Retail Prices** | US DoL | 1880s (141 yrs) | **Negligible** | Exact retail prices |
| **India MoSPI** | GoI (constitutional) | 2011 (15 yrs, current series) | **Negligible** | Consumer food CPI |
| WFP VAM DataBridges | UN WFP | 2009; portal 2018 | **Medium-High** | Domestic retail |
| RATIN | EAGC (regional) | ~2010 | **Medium** | Wholesale/retail grains |
| IFPRI DFPM | CGIAR | ~2015 | **Low-Medium** | Daily wholesale/retail |
| Numbeo | Private company | 2009 (17 yrs) | **Medium** | Crowdsourced retail |
| PriceStats | State Street | 2008 (18 yrs) | **Low** (commercial) | Scraped online retail |

**Key upgrade:** The three new primary sources (FPMA, Eurostat HICP, IMF CPI Food) all have **negligible discontinuation risk** and institutional mandates. WFP VAM demoted from primary to backup; still valuable but no longer a single point of failure.

---

## 5. Basket Enhancement Opportunities

### 5.1 IMF Food CPI Derivative Approach (Expanding Coverage Without New Commodities)

For countries where FPMA/WFP provide no commodity-level prices but the IMF publishes a monthly food CPI, KKI can derive basket movement using the following approach:

```
LOCAL_basket(C, t) = LOCAL_basket(C, t₀) × (FoodCPI(C,t) / FoodCPI(C,t₀))
```

Where:
- `t₀` = last period with actual commodity-level prices (from FPMA, WFP, or national stat office)
- `FoodCPI(C,t)` = IMF-published Food & Non-Alcoholic Beverages CPI for country C at time t

**Calibration:** Requires a one-time baseline commodity-price survey per country. Options:
1. Use FPMA/WFP historical data (even a single monthly observation is sufficient as `t₀`)
2. Use Numbeo city-level prices as a calibration point
3. Use ICP (International Comparison Program, World Bank) PPP food-basket data (published every ~3 years)

**Accuracy:** This is mathematically equivalent to chain-linking a Laspeyres index to observed base-period prices — the same methodology every national CPI uses. If the IMF food CPI says prices rose 12% and the last observed basket was 50 MAD, the derived basket is 56 MAD. The approximation breaks only if the composition of the food CPI basket diverges significantly from the KKI basket — unlikely for staple-food-dominated markets where both baskets are calorie-heavy.

**Result:** ~80 additional countries get monthly KKI coverage (total ~145) without any new commodity data collection.

### 5.1A Historical CPI Chain-Linking for Pre-Observation Periods

> **Added:** 2026-05-22

For old-debt and old-salary use cases, KKI now distinguishes direct observations from historical backcasts. The preferred historical source stack is:

1. Food CPI, monthly, from IMF CPI / World Bank Global Inflation Database / national statistical office.
2. Food CPI, annual, interpolated only when the UI labels the annual cadence.
3. Headline CPI, monthly or annual, for countries without food CPI.
4. Global-only historical proxy, only when country CPI is unavailable.

The macroeconomic method is CPI chain-linking:

```
KKI(C,t) = KKI(C,t0) × CPI(C,t) / CPI(C,t0)
```

This is a Laspeyres-family index-number technique: a known basket-cost level is extended backward or forward using an institutional price index. It is scientifically acceptable for long-run purchasing-power estimates, provided that provenance and confidence are displayed. It is not the same as direct observed market prices.

Current pipeline diagnostics should report how many countries have Food CPI coverage versus Headline CPI-only coverage. This matters because Food CPI is the correct proxy for KKI’s staple-food local leg, while Headline CPI is a lower-confidence cost-of-living proxy. When the historical global commodity leg is already archived for a target month, the local leg should be CPI-chained and the hybrid KKI reconstructed rather than scaling the entire index by a single CPI ratio.

Splice gaps between CPI-estimated history and observed item-price history should be stored as diagnostics. They are evidence about source/model disagreement and should guide future source upgrades (IMF Food CPI, Eurostat HICP food, national food CPI, FPMA), not be hidden by smoothing.

### 5.2 Potential Basket Alterations

If the goal is maximum source coverage, consider these basket modifications:

| Current item | Alternative | Rationale | Source availability |
|---|---|---|---|
| Pulses (lentils/chickpeas) | **Beans (generic)** | FPMA and WB RTFP track "beans" more broadly than "lentils" or "chickpeas" — beans appear in more country series | Beans in FPMA: ~60 countries; Lentils: ~25 countries |
| Cooking oil (1L) | **Vegetable/sunflower oil (1L)** | FPMA tracks "oil (vegetable)" as a standard series; WFP tracks "oil (sunflower)" or "oil (vegetable)" | Vegetable oil in FPMA: ~70 countries |
| Dried fish (West Africa) | **Beans + oil** (increase oil allocation) | Dried fish is tracked in very few FPMA series; substituting maintains calories via beans+oil | Avoids the weakest data slot in the Riz basket |

These are minor label refinements, not structural basket changes. Calories remain within the ~15,000-15,500 kcal target.

### 5.3 Adding a "Protein Signal" Item (Enhancement)

Several sources (FPMA, WFP, BLS, Eurostat) robustly track **eggs**. Adding eggs (12 count, ~900 kcal) to all baskets would:
1. Add a non-grain protein signal (catches animal-feed-driven inflation)
2. Eggs are culturally universal (available in every KKI market)
3. Widely tracked: FPMA has egg prices for 60+ countries
4. Already in the OECD/Europe "Loaf basket" — extending to all baskets creates more uniformity

**Trade-off:** Slightly increases basket cost and adds one more data dependency. But eggs are among the most reliably reported food prices worldwide.

---

## 6. Implementation Recommendations (Roadmap)

### 6.1 Roadmap Batch A (not implemented in v1.0)

1. **Add FAO FPMA adapter** to the khobz-index pipeline alongside existing FAOSTAT adapter
   - Use tezamo/FPMA as reference implementation for API reverse-engineering
   - Ingest domestic retail prices for all KKI basket items across 88+ countries
   - FPMA becomes primary local-price source; WFP VAM becomes Backup 1

2. **Add World Bank RTFP adapter** as Backup 2 for developing countries
   - Bulk CSV download (monthly), not real-time API
   - Provides ML-gap-filled prices for fragile states where FPMA/WFP have gaps

3. **Add Eurostat HICP food sub-index adapter** for EU/EEA coverage
   - SDMX API, well-documented
   - Covers the Loaf basket region (EU/EEA) with gold-standard institutional data

4. **Add IMF CPI Food sub-index adapter** as universal fallback
   - SDMX API, covers ~165 economies
   - Implement the derivative approach (§5.1) for countries without commodity-level data
   - Requires one-time baseline calibration per new country

### 6.2 Roadmap Batch B (3-6 Months Post-Launch)

5. **Add India MoSPI / NSO adapter** for India-specific coverage
   - Python API clients available (`mospi-esankhyiki`)
   - State-level granularity

6. **Add BLS adapter** for US Loaf basket with exact commodity prices
   - BLS Public Data API (free)
   - Benchmark-quality validation for the US market

7. **Evaluate Numbeo API** for gap-filling in middle-income countries
   - Paid API — assess cost vs coverage benefit
   - Use as tertiary fallback or cross-validation

### 6.3 Research Batch C (6-12 Months Post-Launch)

8. **Evaluate e-commerce scraping** for real-time signals (Carrefour Morocco/Egypt/Kenya, Jumia)
9. **Evaluate RATIN integration** for East Africa daily signals
10. **Begin "price ping" pilot** (KKI's own crowdsourced data, aligned with Q-K3)

---

## 7. Proposed Future Source Cascade Logic

The cascade below is a target design for a later methodology/pipeline version.
It is not the implemented v1.0 cascade.

For each country C and time period t, the KKI fetcher should attempt sources in this order:

```
1. National gold-standard source (if adapter exists)
   → US: BLS  |  India: MoSPI  |  EU: Eurostat HICP
   
2. FAO FPMA domestic retail prices
   → 88+ countries, monthly, commodity-level

3. WFP VAM DataBridges (via HDX bulk CSV as fallback)
   → ~98 countries, monthly, commodity-level

4. World Bank RTFP (ML-imputed)
   → 36 countries, monthly, commodity-level with confidence bounds

5. IMF CPI Food sub-index (derivative approach)
   → ~165 countries, monthly, index-level
   → Requires baseline calibration

6. Global-only (α = 0)
   → Remaining ~30 countries with no food price data
   → Tagged "regional data unavailable"
```

Each source hit is cached; the pipeline logs which source was used per country-period for auditability.

---

## 8. Summary Comparison: Legacy Assumption vs Proposed Roadmap

| Dimension | Legacy assumption | Proposed roadmap |
|---|---|---|
| Countries with commodity-level prices | ~67 (realistic WFP coverage) | **~100** (FPMA + WFP + RTFP union) |
| Countries with monthly food-price signal | ~67 | **~145–165** (adding IMF CPI derivative + Eurostat) |
| Primary source discontinuation risk | **Medium-High** (WFP VAM) | **Negligible** (FAO FPMA) |
| OECD/Europe coverage | None (global-only α=0) | **Full** (Eurostat HICP + IMF CPI) |
| India coverage | Generic WFP/FAO | **3,000-market MoSPI** |
| US coverage | BLS noted but not integrated | **BLS adapter proposed** |
| Institutional mandate sources | 2 (FAO FPI, WB Pink Sheet) | **6** (FPMA, IMF, Eurostat, BLS, MoSPI, WB RTFP) |
| Redundancy per country | 1–2 sources | **2–4 sources** |
| Global-only fallback countries | ~180 | **~30** |

---

## 9. Cross-References

- KKI Methodology: [`docs/kki/kki_research.md`](./kki_research.md) — §4 (Data Sources), §6 (Universal Applicability), §11 (Open Questions Q-K3)
- Master TODO: [`docs/masterTODO.md`](../masterTODO.md)
- Track B TODO: [`docs/masterTODO-trackB.md`](../masterTODO-trackB.md) — khobz-index adapters
- FPMA reference implementation: [tezamo/FPMA](https://github.com/tezamo/FPMA) (MIT license)
- WFP VAM API: [WFP-VAM/DataBridgesAPI](https://github.com/WFP-VAM/DataBridgesAPI)
- HDX WFP scraper: [OCHA-DAP/hdx-scraper-wfp-foodprices](https://github.com/OCHA-DAP/hdx-scraper-wfp-foodprices)

---

## 10. Verified Finding: Beans vs Lentils in MENA Markets

> **Date:** 2026-05-14
> **Status:** Verified — DO NOT rename pulses to beans for MENA baskets.

### 10.1 Morocco Market Evidence

Casablanca wholesale market prices (Dec 2025 – Jan 2026, source: le360.ma):

| Commodity | Moroccan name | Price (MAD/kg) | Notes |
|---|---|---|---|
| **Lentils (Canadian)** | Lentilles canadiennes | 7.40–12.80 | Main staple pulse |
| **Red lentils** | Lentilles rouges | 10.50–15.00 | Premium variety |
| **Chickpeas** | Pois chiches | 6.00–13.00 | Quality-dependent |
| **White beans** | Loubia / haricots blancs | 11.50–17.00 | Different commodity entirely |
| **Fava beans** | Fèves | 8.50–16.50 | Seasonal |

**Key finding:** Lentils and beans are **distinct commodities** in Morocco with a **~2x price ratio** (lentils 7.40 MAD/kg vs white beans 16.70 MAD/kg). Substituting one for the other would introduce systematic measurement error in the MENA basket.

### 10.2 FPMA Commodity Categorization

FPMA classifies pulses into separate series: "Lentils", "Beans (white)", "Beans (red)", "Chickpeas", "Peas" — they are not lumped into a single "beans" category. FPMA coverage (estimated from category metadata):

| Commodity | FPMA countries with series | Best KKI regions |
|---|---|---|
| **Lentils** | ~25 countries | MENA, South Asia (lentils/dal are the staple) |
| **Beans (generic/white/red)** | ~60 countries | East/South Africa, Latin America, West Africa |
| **Chickpeas** | ~15 countries | MENA (secondary to lentils) |

### 10.3 Decision: Per-Region Commodity Mapping

The basket v1.1 **must not** apply a blanket rename. Instead, keep the pulse item **region-specific**:

| Region | v1.0 item | v1.1 item | CPC code | Rationale |
|---|---|---|---|---|
| **MENA** | Pulses (lentils/chickpeas) | **Lentils** | `01342` (unchanged) | Lentils are the dominant staple pulse; 2x price gap vs beans |
| **South Asia** | Lentils, dry | **Lentils (dal)** | `01342` (unchanged) | Dal = lentils; beans are a different product |
| **East/Southern Africa** | Dried beans | **Beans (generic)** | `01310` (unchanged) | Beans already correct; 60-country FPMA coverage |
| **Latin America** | Dried beans | **Beans (generic)** | `01310` (unchanged) | Black/pinto beans already correct |
| **West Africa** | Dried fish | **Dried fish** | `04120` (unchanged) | No pulse item in this basket |
| **East Asia** | Soy / soybeans | **Soy / soybeans** | `01441` (unchanged) | Soy already correct |
| **OECD** | (no pulse item) | (no pulse item) | — | Eggs + dairy provide protein |

**Net effect:** The "rename pulses to beans" recommendation from §5.2 is **withdrawn for MENA and South Asia** baskets. It was based on aggregate FPMA coverage numbers (60 vs 25 countries) without checking that the commodities are price-equivalent. They are not. The 25-country FPMA coverage for lentils is sufficient because it includes the actual MENA and South Asian markets where lentils are the staple.

---

## 11. Fix 1: Implicit Parallel FX Rate Derivation

> **Date:** 2026-05-14
> **Severity:** High — fixes the single biggest accuracy problem for crisis markets (LB, AR, NG, EG)
> **Scope:** Pipeline change in `pipeline/lib/fx-utils.ts` and `pipeline/run.ts`
> **Affects:** `global_basket_cost` computation (the `(1 - α) × GLOBAL` leg of the hybrid formula)

### 11.1 Problem

The pipeline uses Frankfurter (ECB official FX rates) to convert the global basket from USD to local currency:

```
global_basket_cost = COMPOSITE_SCALE_USD × weighted_composite × fxRate
```

In crisis/multi-rate markets, the ECB official rate diverges massively from the street/parallel rate:

| Country | Official FX (ECB) | Street/parallel FX | Divergence |
|---|---|---|---|
| Lebanon (2020 peak) | ~1,507 LBP/USD | ~37,000 LBP/USD | **~25x** |
| Argentina (2023 blue) | ~350 ARS/USD | ~750 ARS/USD | **~2.1x** |
| Nigeria (2023 parallel) | ~460 NGN/USD | ~900 NGN/USD | **~2x** |
| Egypt (2023 pre-float) | ~30.9 EGP/USD | ~70 EGP/USD | **~2.3x** |

Using the official rate makes KKI **massively understate** the real cost of the global basket in local currency for exactly the markets where purchasing-power tracking matters most.

### 11.2 Solution: Derive Implicit FX from Local Price Data

WFP VAM and FPMA collect prices **at street rates** — that is their mandate in crisis markets. When a local-price source reports both `price_local` and `price_usd` for the same commodity observation, the ratio reveals the **implicit street FX rate**:

```
implicit_fx(commodity_i) = price_local_i / price_usd_i
```

Taking the **median** across all basket commodities that have both values produces a robust estimate of the parallel rate. The pipeline already has both fields in every `PriceRecord`.

### 11.3 Implementation

**New function** in `pipeline/lib/fx-utils.ts`:

```typescript
function deriveImplicitFxFromLocalPrices(
  countryRecords: PriceRecord[],
  officialFxRate: number,
): { implicitFx: number; divergence: number } | null {
  const ratios: number[] = [];
  for (const r of countryRecords) {
    if (r.price_local && r.price_local > 0 && r.price_usd > 0) {
      ratios.push(r.price_local / r.price_usd);
    }
  }
  if (ratios.length < 2) return null;
  ratios.sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)];
  const divergence = Math.abs(median - officialFxRate) / officialFxRate;
  return { implicitFx: median, divergence };
}
```

**In `run.ts`**, after computing `countryLocals` for each country:

```typescript
const implicit = deriveImplicitFxFromLocalPrices(countryLocals, officialFxRate);
let effectiveFx = officialFxRate;
let parallelFxUsed = false;
if (implicit && implicit.divergence > 0.15) {
  effectiveFx = implicit.implicitFx;
  parallelFxUsed = true;
}
```

Use `effectiveFx` for `computeGlobalBasketCost` instead of `officialFxRate`.

### 11.4 Schema Addition

Add to `QualityFlagsSchema` in `schema.ts`:

```typescript
parallel_fx_used: z.boolean().default(false),
fx_divergence_pct: z.number().nullable().default(null),
```

This makes the correction auditable and transparent. The divergence percentage is itself a publishable signal (same class of insight as the "subsidy gap" already positioned for PR in `kki_research.md` §5.4).

### 11.5 Threshold Choice

The 15% divergence threshold is conservative:
- Normal FX bid-ask spread: <1%
- ECB vs market rate for stable currencies: <3%
- Managed-float currencies (MAD, CNY): 5–10%
- **>15% implies a structural parallel market** — the correction is warranted

Below 15%, the official rate is close enough. Above 15%, the implicit rate from observed prices is more truthful.

---

## 12. Fix 2: WFP VAM Weekly Fetch for All Available Countries

> **Date:** 2026-05-14
> **Severity:** Medium — improves cadence from monthly to weekly where data exists
> **Scope:** WFP VAM adapter enhancement + pipeline dual-speed mode

### 12.1 Problem

The current pipeline processes one month per weekly run. WFP VAM publishes **weekly** price data for many countries (not just crisis-flagged ones), but the pipeline doesn't consume it.

### 12.2 WFP Weekly Data Availability

WFP VAM DataBridges publishes weekly price series for all countries where their field monitoring is active — this is **not limited to crisis countries**. Countries with regular WFP monitoring (Kenya, Uganda, Mozambique, Philippines, etc.) also have weekly data. The cadence is determined by WFP's in-country data collection schedule, not by a crisis flag.

### 12.3 Solution: Dual-Speed Pipeline

**Phase A — Enhance WFP VAM adapter** to request weekly frequency when available:

The WFP DataBridges API already supports a frequency parameter. Update `wfp-vam.ts` to:
1. First attempt weekly data for the target date range
2. If weekly data exists, emit `PriceRecord` entries with weekly dates (e.g., `2026-05-05`)
3. If only monthly data exists, fall back to monthly (current behavior)

**Phase B — Add a "weekly refresh" pipeline mode:**

A new `--weekly` flag in `pipeline/run.ts`:
- Processes the current calendar week (not previous month)
- For each country, attempts WFP VAM weekly data first
- If weekly data exists, produces a mid-month partial update
- Writes weekly snapshots alongside monthly ones (e.g., `build/khobz-index-2026-W20.json`)

**Phase C — Second GitHub Action schedule:**

Update `kki-weekly.yml` or add a companion workflow:
```yaml
name: KKI weekly pipeline (weekly-frequency data)
on:
  schedule:
    - cron: '0 6 * * 1,4'   # Monday AND Thursday
  workflow_dispatch:
jobs:
  weekly-refresh:
    runs-on: ubuntu-latest
    steps:
      - run: bun run pipeline -- --weekly
```

### 12.4 Storage Model

Weekly snapshots are stored alongside monthly ones:
- Monthly: `v1.0/MA/2026-04.json` (canonical, used for promise anchoring)
- Weekly: `v1.0/MA/2026-W18.json` (supplementary, used for real-time display)

The KKI API serves the **most recent** snapshot (weekly if available, monthly otherwise). Promise anchoring always uses the monthly canonical value to avoid settlement disputes over which week's value applies.

### 12.5 Interaction with Fix 1

Weekly local-price data from WFP VAM provides more frequent implicit-FX observations for the parallel rate derivation (Fix 1). In crisis markets, the parallel rate moves week-to-week; weekly data captures this drift instead of averaging it into a single monthly number.

---

## 13. Revised Basket v1.1 Commodity Mapping (Post-Verification)

After the §10 beans/lentils verification, the basket v1.1 changes are:

### 13.1 Changes That Proceed

| Change | Affected baskets | Detail |
|---|---|---|
| **Rename "Cooking oil" → "Vegetable oil"** | MENA, East/South Africa, East Asia, Latin America, OECD | Cosmetic name alignment with FPMA standard series name. Same CPC code `21531`. |
| **Add "Eggs (12 ct)" to all non-OECD baskets** | MENA, South Asia, East/South Africa, West Africa, East Asia, Latin America | CPC `02310`, ~936 kcal. OECD already has eggs. |
| **Rebalance weights** | All 7 baskets | Adding eggs redistributes weight; all items decrease proportionally. |

### 13.2 Changes Withdrawn

| Original proposal | Reason withdrawn |
|---|---|
| **Rename "Pulses (lentils/chickpeas)" → "Beans (generic)" for MENA** | Lentils and beans are distinct commodities with ~2x price gap in Morocco. FPMA tracks them separately. |
| **Remap CPC `01342` → `01310` for MENA** | Would introduce systematic pricing error. MENA households buy lentils, not beans. |
| **Remap CPC `01342` → `01310` for South Asia** | Dal = lentils. Same issue. |

### 13.3 Adapter Commodity Mapping (Updated)

The `FPMA_COMMODITY_TO_CPC` map must preserve the lentils/beans distinction:

```typescript
export const FPMA_COMMODITY_TO_CPC: Readonly<Record<string, string>> = {
  'Wheat flour':     '23112',
  'Rice':            '23161',
  'Maize (white)':   '23120',
  'Maize meal':      '23120',
  'Lentils':         '01342',   // MENA + South Asia baskets
  'Beans (white)':   '01310',   // East/South Africa + Latin America baskets
  'Beans (red)':     '01310',
  'Beans (kidney)':  '01310',
  'Beans (dry)':     '01310',
  'Chickpeas':       '01342',   // Map to lentils CPC (MENA secondary pulse)
  'Sugar':           '23511',
  'Oil (vegetable)': '21531',
  'Oil (sunflower)': '21531',
  'Oil (palm)':      '21491',   // West Africa palm oil
  'Eggs':            '02310',
  'Cassava':         '01520',
  'Sorghum':         '23161',
  'Milk':            '02211',
  'Bread':           '23413',
};
```

---

## 14. Updated Implementation Phases (Roadmap, Post-Fixes)

### Roadmap Batch A (Before or shortly after public launch)

1. **FAO FPMA adapter** — primary local-price source (§2.1)
2. **Eurostat HICP adapter** — EU/EEA food CPI sub-index (§2.4)
3. **Fix 1: Implicit parallel FX** — derive street rate from local prices (§11)
4. **Fix 2: WFP VAM weekly fetch** — weekly data for all available countries (§12)
5. **Basket v1.1 files** — vegetable oil rename + eggs added (§13); lentils preserved for MENA/South Asia
6. **Orchestrator rewiring** — FPMA primary, FAOSTAT secondary, Eurostat tertiary, WFP fallback

### Roadmap Batch B (3-6 Months Post-Launch)

7. India MoSPI / NSO adapter
8. BLS adapter for US
9. Numbeo evaluation for gap-filling
10. Weekly pipeline dual-speed mode (Phase B/C of Fix 2)

### Research Batch C (6-12 Months)

11. E-commerce scraping evaluation (Carrefour, Jumia)
12. "Price ping" schema and ingestion endpoint
13. RATIN integration for East Africa daily signals

---

## 15. Cross-References (Updated)

- KKI Methodology: [`docs/kki/kki_research.md`](./kki_research.md) — §4 (Data Sources), §6 (Universal Applicability), §11 (Open Questions Q-K3)
- Master TODO: [`docs/masterTODO.md`](../masterTODO.md)
- Track B TODO: [`docs/masterTODO-trackB.md`](../masterTODO-trackB.md) — khobz-index adapters
- FPMA reference implementation: [tezamo/FPMA](https://github.com/tezamo/FPMA) (MIT license)
- WFP VAM API: [WFP-VAM/DataBridgesAPI](https://github.com/WFP-VAM/DataBridgesAPI)
- HDX WFP scraper: [OCHA-DAP/hdx-scraper-wfp-foodprices](https://github.com/OCHA-DAP/hdx-scraper-wfp-foodprices)
- Morocco legume prices: [le360.ma market reports](https://www.le360.ma) (Dec 2025 – Jan 2026)

---

---

## 16. Historical Deployment Snapshot (2026-05-14)

This is an ops snapshot from an earlier private deployment pass. It is not a
public v1 API or public-domain promise.

| Component | Status | Details |
|-----------|--------|---------|
| KKI Pipeline (v1.0) | **Live** | 238 countries, backfill 2020-01 → 2026-04 |
| API Worker | **Deployed (internal)** | Closed Bearer API on private Worker hostname — operators only; see runbook |
| R2 Storage | **Synced** | Bundle, state, and latest month data uploaded |
| KV Pipeline Status | **Updated** | `pipeline:status` key in `KKI_KV` namespace |
| Weekly Cron | **Active** | Mondays 06:00 UTC via GitHub Actions (`KKI Weekly Pipeline`) |
| GitHub Release | **Created** | First automated release: `kki-weekly-25870754632` |
| GitHub Secrets | **Configured** | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `KKI_KV_NAMESPACE_ID` |

*End of KKI Data Sources Research. This document supplements `kki_research.md` §4 and informs the source-adapter build plan for the khobz-index pipeline.*
