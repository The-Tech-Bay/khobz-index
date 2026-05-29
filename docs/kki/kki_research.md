# Karama Khobz Index (KKI) — Methodology Research

> **Task:** §1.5.0 of [`masterTODO.md`](../masterTODO.md)
> **Status:** ✅ Complete; Phase 2 public-ship reconciliation applied 2026-05-27
> **Date:** 2026-05-09
> **Supersedes:** §0.4 R4 (FX-only anchor validation) — R4 is re-resolved by this document.
> **Companion:** [`docs/project/principles.md`](../project/principles.md) (Related Doctrine: "KKI is published, not issued"), [`docs/project/project-brief.md`](../project/project-brief.md) §6.1 (Currency block updated), [`docs/strategy/feasibility-validation.md`](../strategy/feasibility-validation.md) (R4 re-resolved, R15 + R16 added).
> **Canonical reference for:** long-form KKI rationale across both repos. For public v1.0 implementation truth, use [`khobz-index/docs/methodology.md`](../../khobz-index/docs/methodology.md).

---

## 0. Phase 2 Implementation Status

This document contains both the original KKI research rationale and later source
research. It is safe to read publicly only with the following distinction:

| Category | Status in v1.0 public fixture |
|---|---|
| Caloric KK definition, seven regional fixed baskets, hybrid local/global formula, versioned methodology | **Implemented v1.0** |
| Weekly source checks with monthly canonical country records | **Implemented v1.0** |
| FAOSTAT producer-price proxy with markup/interpolation/forward-fill | **Implemented v1.0** |
| FAO FPI benchmark fallback, Brent, gold, FX display adapters | **Implemented v1.0** |
| World Bank WDI Food CPI / headline CPI historical backcast | **Implemented v1.0** |
| WFP VAM as default primary local source | **Not default v1.0**; adapter exists and can enhance local prices when credentials/data URL are configured |
| FPMA, IMF monthly Food CPI, Eurostat, BLS, MoSPI, implicit parallel FX, basket v1.1 eggs/substitution, weekly archive rows | **Roadmap/research** |

Whenever an older section says "weekly index", read that as **weekly source
checks / operational refresh with monthly canonical archive grain**, unless it
explicitly discusses a future weekly archive design.

---

## 1. Executive Summary

The **Karama Khobz Index (KKI)** measures the local-currency cost of a fixed
regional staple basket calibrated to daily subsistence calories. It replaces the
original FX-only anchor (USD/EUR/XAU exchange-rate snapshots at recording time)
with a calorie-calibrated, hybrid local/global price index. A single KK (Khobz
unit) represents approximately one day of staple subsistence calories for one
adult (~2,200 kcal).

KKI v1.0 refreshes source checks weekly and publishes canonical country records
at monthly grain. Current local differentiation relies primarily on FAOSTAT
producer-price proxy data with documented markup, interpolation, and forward-fill
caveats. Historical pre-observation periods use CPI-chain estimates with explicit
provenance. Do not describe producer-price proxy records, CPI-chained records, or
annual-grain CPI records as direct monthly retail observations.

At MVP, KKI is a **published reference index**, not a token or currency. The
methodology, calculation engine, and data are designed for open-source/open-data
review. The running KKI API is private/internal for v1; public consumers read
from static archive and landing-page data.

---

## 2. The Flaw in FX-Anchor (Motivation)

The original M17 design (§0.4 R4, using Frankfurter + Goldprice.dev) anchored promises to USD, EUR, or XAU via exchange-rate snapshots at recording time. The math was:

```
settlement_local = anchor_value_USD × FX_rate(USD → local, today)
```

This is **two FX snapshots** — origin date and settlement date. Nothing more. Three structural leaks make this inadequate as an "inflation anchor":

### Leak 1 — USD itself inflates

$19.50 in April 2022 has ~17% less purchasing power by May 2026 (US CPI). When the system settles "$19.50 USD's worth of MAD today", it delivers 2026-dollars of value, not 2022-dollars. The anchor preserves USD-denominated *nominal* value, not USD-denominated *real* value.

### Leak 2 — Pegged/managed currencies break the proxy

The MAD floats in a managed band against a 60% EUR / 40% USD basket; Bank Al-Maghrib defends it. From 2022→2026 Moroccan CPI rose roughly +10–12% cumulatively, but MAD/USD barely moved. A Casa user who anchors a 200 MAD promise to USD in 2022 and settles in 2026 sees a **near-zero anchor delta** despite genuinely losing ~10% of real local purchasing power. The FX-anchor tells them "+22.3%" only because USD weakened against the EUR basket — a currency event, not an inflation event.

### Leak 3 — ECB-official rate is wrong in crisis markets

Frankfurter is ECB-sourced (§0.4 R4). In Lebanon at peak, the parallel rate was ~25× the official rate. In Argentina, the blue/MEP/CCL diverges from BCRA. ECB-official rate is wrong-by-default for exactly the inflation-watch markets the brief's §0.2 GTM strategy wants to expand into (LB, AR).

### Concrete example (existing wireframe)

The design system screen (`ScreensPage.tsx`) displays:

> Anchor: 200 MAD ≈ $19.50 USD (at Apr 2022 rate)
> Rate: 1 USD = 10.26 MAD
> Today: 200 MAD ≈ 245 MAD (+22.3%)

That "+22.3%" is **MAD/USD drift**, not Moroccan inflation. Under KKI:

> Anchor: 200 MAD ≈ 25 KK (at Apr 2022 KKI)
> KKI v1.0 · Morocco · monthly record
> Today: 25 KK ≈ 240 MAD (+20%)

The +20% now reflects actual change in purchasing power in Morocco, not a currency event in Washington.

---

## 3. KKI v1.0 Specification

### 3.1 Caloric-Subsistence Invariant

**1 KK ≈ 1 day of staple subsistence calories for one adult (~2,200 kcal).**

Each regional basket is calibrated to ~7 days of subsistence per purchase unit (~15,300 kcal). This biological constant is the universal anchor: a Casablancan and a Mumbaikar both need ~2,200 kcal/day. The biology is universal even when the menu is not.

### 3.2 Hybrid Weighting

```
KKI(C, t) = α × LOCAL_basket(C, t) + (1 − α) × GLOBAL_basket(t)
```

Where:
- `C` = country / market
- `t` = time period (month)
- `α` = 0.65 (default; tuneable per market)
- `LOCAL_basket(C, t)` = weighted average price of the regional staple basket in country C at time t. In the implemented v1.0 public fixture this is primarily the FAOSTAT producer-price proxy; WFP VAM is an optional configured enhancement, not the default public claim.
- `GLOBAL_basket(t)` = composite of FAO Food Price Index (cereals + oils + sugar sub-indices) + World Bank Pink Sheet energy (Brent crude) + LBMA Gold Fix (XAU spot)

**Tuning guidance for `α`:**

| Market type | α (local weight) | Rationale |
|---|---|---|
| High-trust local data, no subsidies (e.g., France, USA) | 0.80 | Local data is reliable; global track is a small hedge |
| Standard (e.g., Morocco, Kenya, Turkey) | 0.65 | Default — balanced |
| Subsidy-heavy (e.g., Egypt baladi bread, Algeria, Tunisia) | 0.50 | Subsidized shelf prices understate real cost; global track lifts toward truth |
| Low-trust or conflict (e.g., Lebanon, South Sudan, CAR) | 0.35 | Local data is delayed/unreliable; lean on global commodities |
| Missing local data entirely | 0.00 | Global-only with "regional data unavailable" tag |

### 3.3 Regional Basket Definitions

**Branding and scientific nomenclature**

- **Public / product:** **Karama Khobz Index (KKI)** is the canonical name globally — comms, app, OSS repo branding, and citations where cultural recognition matters. Each regional basket has a documented nickname for PR/press hooks but never replaces KKI as the index name.
- **Scientific / formal writing:** In peer-reviewed papers, reports, and international datasets where a **calorie-grounded** label aids universal understanding, authors **may** use **Karama Kilocalorie Index** as the descriptive name. It is the **same index**, same abbreviation **KKI**, same formulas and data — the name foregrounds that baskets and the **KK** unit are calibrated in **kilocalories (kcal)**. **Recommended first mention:** *Karama Kilocalorie Index (KKI; branded Karama Khobz Index)* — then **KKI** thereafter. In English, **kilocalorie** (symbol **kcal**) is standard; cognates such as *kilokalorie* appear in other languages and refer to the same unit.
- **Why “khobz”:** The word comes from Arabic **خبز** *khubz* (bread); in **Maghrebi Arabic**, *khobz* is the ordinary word for the daily bread tied to the MENA staple basket. The **Khobz** brand ties the index to that cultural anchor; it does not change the calorie mathematics and need not appear in the formal scientific title if authors prefer the Kilocalorie label.

| Region | Basket nickname | Items | Approx. calories | Days of subsistence |
|---|---|---|---|---|
| MENA / North Africa | Khobz basket | Wheat flour 1 kg + cooking oil 1 L + sugar 1 kg + pulses (lentils/chickpeas) 1 kg | ~15,400 kcal | ~7 days |
| South Asia | Atta basket | Atta (wheat flour) 1 kg + rice 1 kg + dal (lentils) 1 kg + edible oil 1 L | ~15,200 kcal | ~7 days |
| East / Southern Africa | Sadza/Ugali basket | Maize meal 1 kg + cooking oil 1 L + dried beans 1 kg + sugar 1 kg | ~15,300 kcal | ~7 days |
| West Africa | Riz basket | Rice 1 kg + cassava/yam 1 kg + palm oil 1 L + dried fish 0.5 kg | ~15,100 kcal | ~7 days |
| East Asia | Mihan basket | Rice 1 kg + cooking oil 1 L + soy 1 kg + sugar 1 kg | ~15,300 kcal | ~7 days |
| Latin America | Tortilla basket | Maize/wheat flour 1 kg + oil 1 L + black beans 1 kg + sugar 1 kg | ~15,400 kcal | ~7 days |
| OECD / Europe / N. America | Loaf basket | Wheat bread 1 kg + dairy (milk) 1 L + cooking oil 1 L + sugar 1 kg + eggs (12 ct) | ~15,500 kcal | ~7 days |

All baskets share the same methodology (hybrid weighting, weekly source checks,
monthly canonical archive grain), the same global commodity track, and the same
caloric anchor (~7 days of subsistence for one adult). Cross-region comparability:
1 KK in Casablanca = 1 KK in Mumbai = 1 KK in Sao Paulo, defined as a fixed
share of subsistence-calorie cost in the local-appropriate basket.

### 3.4 Index Formula and Worked Example

**At record time:**

```
Promise recorded: 200 MAD on 2022-04-14
LOCAL_basket(MA, 2022-04) = 7.5 MAD per basket-item average
GLOBAL_basket(2022-04) = 8.2 MAD equivalent (converted via MAD/USD)
KKI(MA, 2022-04) = 0.65 × 7.5 + 0.35 × 8.2 = 4.875 + 2.87 = 7.745 MAD per daily KK
→ promise.anchor_units = 200 / 7.745 ≈ 25.82 KK
→ Stored on the Promise: { anchor_units: 25.82, anchor_version: "kki-v1.0", anchor_country: "MA", anchor_date: "2022-04" }
```

**At settlement (any later date):**

```
KKI(MA, 2026-05) = 0.65 × 9.1 + 0.35 × 9.8 = 5.915 + 3.43 = 9.345 MAD per daily KK
settlement.anchored = 25.82 × 9.345 ≈ 241 MAD (+20.5%)
```

**For a cross-currency lender (Marseille, EUR):**

```
KKI(FR, 2026-05) = 5.2 EUR per daily KK
settlement.lender_view = 25.82 × 5.2 ≈ 134 EUR
```

---

## 4. Data Sources & Resilience Architecture

### 4.1 Implemented v1.0 Source Inventory

| Data slot | Implemented v1.0 source path | Notes |
|---|---|---|
| Global cereals/oils/sugar | FAO Food Price Index; benchmark CSV fallback | FAO FPI sub-indices are the intended source; benchmark CSV protects public fixture rebuilds when live adapters return no rows. |
| Local basket prices | FAOSTAT Producer Prices bulk proxy | Converted from tonne to kg/L, marked up, interpolated to months, and forward-filled. This is not direct retail observation. |
| Optional local enhancement | WFP VAM DataBridges | Adapter exists; requires credentials and configured data URL. Do not treat as default public coverage. |
| Gold spot | Goldprice.dev -> Metals.dev -> LBMA CSV fallback | LBMA remains the institutional benchmark; wrappers are machine-readable fetch paths. |
| Crude oil (energy) | World Bank Pink Sheet (Brent) -> EIA STEO | Yahoo Finance is not wired as a v1.0 adapter. |
| FX display/conversion | Frankfurter -> exchangerate.host | FX supports display and local-currency conversion; it is not the food-price signal. |
| Historical CPI | World Bank WDI `FP.CPI.FOOD` then `FP.CPI.TOTL` | Used for pre-observation chain-linking with explicit confidence labels. |

### 4.1A Roadmap Sources From Later Research

FPMA, IMF monthly Food CPI, Eurostat HICP, BLS retail prices, India MoSPI,
World Bank RTFP, implicit parallel FX derivation, and basket v1.1 changes are
source roadmap/research items. They should not be described as live v1.0
methodology until their adapters, schema fields, tests, and docs ship together.

### 4.2 Reliability Tiering

| Source | Backed by | First continuous publication | Discontinuation risk |
|---|---|---|---|
| World Bank Pink Sheet | World Bank Group (UN-affiliated) | 1960 (66 yrs) | Negligible |
| FAO Food Price Index | UN FAO, Rome | 1990 (36 yrs) | Negligible |
| FAOSTAT | UN FAO | 1961 (65 yrs) | Negligible |
| LBMA Gold Fix | LBMA / ICE Benchmark Administration | 1919 (107 yrs) | Negligible |
| WFP VAM DataBridges | UN WFP | 2009; current portal 2018 | Higher — operational/donor-funded, not statistical mandate |
| Goldprice.dev / Frankfurter / Metals.dev | Private third-party aggregators | 2014–2019 | Highest — underlying data (LBMA/ECB) is durable; these are wrappers |

**Key insight:** durability is concentrated at the source layer (FAO/WB/LBMA), not the API-wrapper layer. Three of four legs are 60+ year multilateral institutions with explicit publication mandates.

### 4.3 Failure Modes & Mitigations

**Mode A — Temporary API outage** (monthly occurrence across the basket of providers).

Every source has a bulk-CSV alternative path alongside the live API. FAOSTAT, FAO FPI, WB Pink Sheet all publish monthly bulk CSVs that are guaranteed-published even when REST APIs hiccup. Fetcher falls through: REST API → bulk CSV → last-cached.

**Mode B — Source becomes paid or rate-limited** (medium-likely for third-party wrappers, near-zero for UN sources).

Per-slot redundancy designed in from day one (see table above). Every data slot has 2–3 independent sources. Switching cost is one config change + regression test; the calculation engine is source-agnostic.

**Mode C — Permanent discontinuation** (extremely unlikely, but the design survives it).

Three layers:

1. **Versioned methodology.** KKI v1.0 specifies its sources and weights. If a source dies, we publish KKI v1.1 with revised weights using surviving sources. Promises recorded under v1.0 keep referencing v1.0 (the historical data has already been bundled). No retroactive recalculation.
2. **Pre-bundled historical snapshot in the APK.** The whole 5-year × 50-country index is ~24 KB compressed. Bundled in the APK. Every historical promise's anchor is computable offline forever, even if all APIs disappeared simultaneously.
3. **Open data pipeline.** Three archival locations, updated automatically: GitHub Releases (`khobz-index` repo, CSV + JSON per month in the static archive; live API updated weekly), Internet Archive monthly snapshot, IPFS pin for canonical data files.

### 4.4 Versioned Methodology Pattern

- **KKI v1.0** — initial specification (this document). All promises recorded under v1.0 reference v1.0 forever.
- **KKI v1.1** — source substitution (e.g., if a primary source dies). Same basket composition, different data pipeline. Old promises stay v1.0.
- **KKI v2.0** — basket revision (e.g., dietary shift detected over a decade). New version starts for new promises. Old promises always reference their origin version.

Rule: **never retroactive recalculation**. A promise anchored at 25 KK under v1.0 stays 25 KK under v1.0 forever, even if v2.0 would have computed 24.8 KK. This is the same integrity discipline as versioned API contracts.

---

## 5. Soundness Analysis (Regional-Basket Sanity Check)

### 5.1 Within-Market Soundness

**Local-consumption-weighted baskets are the textbook-correct definition of purchasing-power measurement.** This is how every CPI on Earth is constructed: US BLS CPI uses the Consumer Expenditure Survey; French INSEE/Eurostat HICP uses the national household budget survey; Indian NSO CPI uses the NSS Consumer Expenditure Survey; Egyptian CAPMAS CPI uses the Egyptian household survey. Every one uses country-specific baskets.

A single universal basket would be **wrong by construction**: a Moroccan paying 50% more for rice they don't eat hasn't lost purchasing power. A Moroccan paying 50% more for khobz, which is 30% of their food spend, has lost purchasing power. The regional basket is the truth, not an approximation.

### 5.2 Cross-Market Comparability

Preserved by three independent mechanisms:

1. **Caloric-subsistence invariant.** All baskets target ~7 days of subsistence at ~2,200 kcal/day. The unit means the same thing biologically even when the menu differs culturally.
2. **Identical 35% global track.** `GLOBAL_basket(t)` is the same FAO FPI + Brent + XAU everywhere. One-third of the index is a globally-uniform anchor. Cross-market gap can never get more than ~65% wide.
3. **Regional shock asymmetry is the truth, not noise.** A 2010-style wheat shock *should* show up bigger in Casa than in Mumbai; that's what actually happened to those families. Averaging across markets would be a lie.

### 5.3 Cross-Border Lending Workflow

For a Casa borrower / Marseille lender: the borrower's basket is the natural reference (the borrower's daily reality is what changed). Settlement screen shows both options. Karama informs; does not enforce.

Worked example:
- Origin: 2010-04. Karim in Marseille lends cousin in Casa 200 MAD (~€18).
- Casa basket at origin: 8.0 MAD/KK → promise = 25 KK.
- Settlement: 2011-09. Casa basket today: 9.6 MAD/KK (wheat shock, +20%).
- Settlement anchored: 25 × 9.6 = 240 MAD ≈ €21 at today's FX.
- Karim sees: "Cousin owes you €21 in real Casa-purchasing-power terms, or €18 nominal — your call."

### 5.4 Subsidy Gap as Signal

When local shelf prices are suppressed by subsidies (Egyptian baladi bread, Algerian subsidized flour), the 35% global track lifts the index toward economic truth. The local-global gap is itself a publishable insight: it reveals the size of the implicit fiscal subsidy. This is a story AfDB, Brookings, and food-security researchers will republish — free PR.

---

## 6. Coverage and Illustrative Roadmap

This section is illustrative. It explains why KKI can become stronger across
many markets, but several rows name sources that are roadmap rather than live
v1.0. For implemented public coverage, use the latest fixture diagnostics and
the source summary embedded in records.

| Country | Global track | Local track source / roadmap note | Confidence | Notes |
|---|---|---|---|---|
| **Morocco (MA)** | FAO FPI + WB Pink Sheet | Implemented: FAOSTAT producer proxy; WFP/FPMA are upgrade paths | **Medium** | Launch market. Khobz basket. Retail validation remains a roadmap improvement. |
| **Egypt (EG)** | FAO FPI + WB Pink Sheet | Implemented: FAOSTAT proxy where available; WFP/FPMA roadmap improves crisis retail signal | **Medium** | Subsidy-heavy -> alpha can lean lower when configured. |
| **Turkey (TR)** | FAO FPI + WB Pink Sheet | FAOSTAT + TurkStat | **High** | Fast inflation captured by local + global |
| **Argentina (AR)** | FAO FPI + WB Pink Sheet | WFP VAM + INDEC (state-published, distrusted) | **Medium-High** | BPP/PriceStats lineage validates non-official observation. Tortilla basket. |
| **Lebanon (LB)** | FAO FPI + WB Pink Sheet | WFP VAM (weekly in crisis) | **High** | Multi-rate currency; WFP VAM collects at street (parallel) prices |
| **Nigeria (NG)** | FAO FPI + WB Pink Sheet | WFP VAM + FAOSTAT | **High** | Riz/Sadza basket depending on region |
| **Kenya (KE)** | FAO FPI + WB Pink Sheet | WFP VAM + KNBS | **High** | Sadza/Ugali basket |
| **USA** | FAO FPI + WB Pink Sheet | BLS Average Retail Food Prices (gold-standard) | **Very high** | Loaf basket. BLS data independently verifiable via Walmart/Kroger e-commerce |
| **France (FR)** | FAO FPI + WB Pink Sheet | INSEE food sub-indices + Eurostat HICP | **Very high** | EU has the best public-price-data infra on Earth |
| **Russia (RU)** | FAO FPI + WB Pink Sheet | Rosstat-via-FAOSTAT (state-influenced, but FAO normalizes) | **Medium** | Lean global-heavy (α ≈ 0.35). Not a pilot market. |
| **India (IN)** | FAO FPI + WB Pink Sheet | NSO + RBI (well-respected) + e-commerce (Bigbasket, Reliance Fresh) | **High** | Atta basket. Needs India-specific staple substitution. |
| **China (CN)** | FAO FPI + WB Pink Sheet | NBS-via-FAOSTAT (Cavallo's BPP found CN food CPI within ~1 ppt of scraped reality) | **Medium-High** | E-commerce scraping hard but NBS food data reasonably trustworthy |

---

## 7. Strategic Positioning

### 7.1 Reference-KK vs Asset-backed-KK Coin

Two entities that must be kept verbally separate in every doc, screen, and founder pitch:

**Reference-KK (Phase 1 onward):**
- A published number. No reserve, no token, no custody, no regulator.
- Same legal status as the Big Mac Index, the IMF SDR rate, Colombia's UVR, or BLS CPI.
- Used to denominate promises in real terms; settlement happens off-platform in fiat at the rate-of-the-day.
- Anyone can write into a contract: "I owe Sara 25 KK, settling at the prevailing KK → MAD rate on settlement date." Karama's role is publishing the rate.

**Asset-backed-KK Coin (Phase 5+, regulated entity):**
- A token, 1:1 redeemable for a real reserve of commodity futures + gold + cash.
- Subject to MiCA (EU), GENIUS Act (US), Bank Al-Maghrib (MA), equivalent regimes elsewhere.
- Requires: regulated issuer entity, reserve custody, quarterly audited attestation, redemption mechanism, banking partners.
- Real arc: 5–7 years from Phase 1 launch.

**Verbal discipline (binding):**
1. No "Coin" / "tokenomics" / "buy KK" framing in any user-facing surface or external comms until Phase 5+ regulatory readiness.
2. We do not issue KK. We publish the rate. Installation of the verb "publish" everywhere "issue" might creep in.
3. P5 (tracker → router → rails) is the regulatory firewall; KKI does not violate it because publishing a price index is not a regulated activity.

### 7.2 Closed-API + Static-Archive-Primary Architecture (Big Mac Model)

At MVP the running KKI API is **closed to authenticated traffic only**. The Karama app authenticates via a Supabase-JWT-exchanged short-lived token. The flow:

1. App signs user in via Supabase Auth (phone + OTP).
2. The **Karama Worker** POSTs the Supabase session JWT to the khobz-index **`POST /auth/exchange`** endpoint (normative: [`khobz-index/docs/architecture/api-contract.md`](../../khobz-index/docs/architecture/api-contract.md) §2.1; legacy prose below referred to “`/token`”).
3. KKI verifies the JWT against Supabase (JWKS) and returns a **short-lived opaque KKI access token** (**15 minutes** TTL at MVP — not 5 minutes; see api-contract §3.3).
4. All KKI **data** calls from Track A present that token (`Authorization: Bearer`).

Reverse-engineering the APK does not yield a usable KKI key — an attacker needs a real Karama Supabase session with a verified phone number.

All public consumers (journalists, researchers, landing-page widget at `https://khobz-index.thebay.ma/`) read from the **static data archive** on GitHub Releases + IPFS + Internet Archive. Zero anonymous traffic touches our running API at MVP. Same architectural pattern as TheEconomist's `big-mac-data` repo: zero anonymous attack surface, zero public-tier ops cost, full OSS credibility because code and data are public even though the running API endpoint is closed.

Decision to open a free public API tier is deferred to Phase 1.5+ (or declined permanently — Big Mac never did and didn't suffer for it).

### 7.3 Open-Source + Open-Data = Credibility Moat

The `khobz-index` GitHub repo (public, MIT code + CC BY 4.0 data) is the canonical source of truth for both the methodology and the numbers. This serves three functions:

1. **Auditability.** Anyone can clone the repo, re-run the pipeline, and verify every published KKI number.
2. **Academic credibility.** Lineage to PriceStats / Billion Prices Project (Cavallo & Rigobon, MIT, 2008+) — the academic community already accepts "alternative price observations" as legitimate responses to government CPI manipulation.
3. **Permanence.** Even if Karama the company disappears, the index survives as an open dataset on GitHub + Internet Archive + IPFS.

### 7.4 Competitive Positioning vs Big Mac Index

| Dimension | Big Mac Index (1986 →) | Karama Khobz Index (proposed) |
|---|---|---|
| Coverage | 57 countries (mostly OECD + emerging) | 85+ via WFP, 245 via FAOSTAT |
| Africa coverage | 3 (South Africa, Egypt, UAE-via-MENA) | ~50 |
| Cadence | Annual / semi-annual | Weekly (real-time sources + WFP crisis data); monthly sources re-checked weekly |
| Update mechanism | Journalist surveys | API-driven, automated |
| Cultural neutrality | Beef + cheese (breaks in India, halal-strict markets) | Local staple by region |
| Subsidy-aware | No | Yes (publishes local–global gap as separate signal) |
| Hyperinflation usable | No (annual cadence) | Yes |
| Open data | Yes (CC BY 4.0) | Yes (CC BY 4.0 for data, MIT for code) |
| Live use case | Editorial only | Reference for live Karama promises |

### 7.5 Cultural Fit with Islamic Finance

Asset-backed reference units are structurally compatible with Islamic finance principles. *Salam* contracts (forward sales of agricultural commodities) are 1,400 years old in Islamic jurisprudence. A KK-denominated promise descends from that tradition: the unit of account is tied to real commodities (grain, oil, gold), not to a fiat currency issued by a central bank. This is a real moat for MENA expansion that fiat-backed stablecoins (USDC, USDT) structurally cannot match.

### 7.6 Landing Page as Top-of-Funnel

Public launch target: `https://khobz-index.thebay.ma/` — fully static page (no
public API calls), loads a bundled JSON snapshot from the data archive at page
load, serves high traffic through static hosting.

Features:
- World map, color-graded by KKI inflation since user's chosen baseline date
- Time slider: any date 1995–today, any country
- Side-by-side: "In Casablanca, 100 MAD bought X Khobz in 2010 / Y Khobz today"
- Ranking: worst purchasing-power losses 2022–2026
- Methodology page (transparency = academic credibility)
- Export: PDF / share card / embed widget for journalists and bloggers
- Open-source badge linking to `khobz-index` repo

---

## 8. Risks & Mitigations Master Table

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R-K1 | Local proxy lag or stale FAOSTAT producer data | Medium | Display source/as-of/provenance; use weekly source checks; mark records `degraded` or `global_only` when local evidence is weak. |
| R-K2 | Country with no usable FAOSTAT/local coverage | Medium | Fall back to global-only (`alpha=0`) with explicit `quality: global_only`; do not market this as local retail coverage. |
| R-K3 | Subsidized shelf prices mask real purchasing-power loss | Medium | 35% global track lifts the index. Local–global gap published as separate signal ("subsidy gap index"). |
| R-K4 | Conflict / multi-rate currency markets (LB, AR blue, VE) | Medium | v1.0 remains vulnerable where FX and local proxy prices diverge. WFP/FPMA retail data and implicit-FX derivation are roadmap mitigations, not current blanket guarantees. |
| R-K5 | Transient supply shock briefly inflates a regional basket, then reverses | Low | Same behavior as all CPI. Settle during shock = pay shocked price. Index reverses when shock reverses. |
| R-K6 | Two regional indices drift apart over long arc, confusing cross-border lenders | Medium | 35% global track caps divergence. Methodology page publishes indices side-by-side. Settlement screen shows both options for cross-border promises. |
| R-K7 | Region's dominant staple changes over decades | Low | Versioned methodology. KKI v1.0 stays canonical for promises under v1.0. v2.0 adapts baskets; old promises reference origin-version. |
| R-K8 | Substitution effects (when wheat spikes, consumers shift to cheaper alternatives) | Low | KKI v1 uses fixed-basket Laspeyres (same as Big Mac). v2+ can introduce chain-weighted Paasche/Tornqvist if needed. |
| R-K9 | Methodology disputed ("Karama manipulates the index") | Medium | Open-source pipeline + archived data. Methodology page serves as audit trail. Annual third-party review (could be AfDB/university collaboration). |
| R-K10 | Central-bank pushback ("publishing a parallel CPI undermines monetary authority") | Low | KKI is a food-price index for private contract denomination, not a CPI replacement. Same legal status as Big Mac Index. No country has ever challenged The Economist's right to publish it. |
| R-K11 | Hyperinflation cadence | Medium | v1.0 checks sources weekly but archives monthly records. True weekly archive rows and price-ping workflows are roadmap items. |
| R-K12 | Source discontinuation (permanent) | Low | Versioned methodology + pre-bundled APK snapshot + open archive on GitHub/IPFS/Internet Archive. See §4.3 Mode C. |
| R-K13 | KKI API abuse / DDoS surface | Low | API is closed at MVP (no anonymous tier). Cloudflare WAF + DDoS protection in front. Per-token rate limits. Static archive serves all public consumers via GitHub CDN at $0 ops cost. See §7.2. |
| R-K14 | "Karama becomes the price authority" — brand responsibility | Medium | Publish corrections protocol. Annual third-party audit (AfDB / North African university collaboration). |

---

## 9. Implementation Arc

| Phase | What happens | KKI role |
|---|---|---|
| **Phase 1 (MVP)** | Integrate KKI as default anchor option (M17 re-scoped). App stores promises in KK units. | Reference index; no public surface beyond in-app display |
| **Phase 1.5** | Open-source `khobz-index` repo. Launch `khobz-index.thebay.ma` static landing page. Publish first historical KKI dataset. | Public reference + OSS credibility |
| **Phase 1.2+** | Optional crowdsourced "price ping" — single-question prompt at recording time ("flour 1 kg near you?"). Median across users gives weekly refresh. | Cadence improvement for crisis markets |
| **Phase 4 (KU)** | Native KK-denominated promises. Users can opt to record "I owe you 25 KK" instead of "I owe you 200 MAD anchored to 25 KK". KK becomes a unit of account (§13 of preserved brief). | Unit of account (not a token) |
| **Phase 5+ (Coin)** | Asset-backed KK Coin in regulated jurisdictions. 1 KK-Coin redeemable for the commodity basket. Requires regulated issuer, reserve custody, audited attestation. | Regulated instrument (only if scale + regulatory alignment) |

---

## 10. Deliverables Across Two Repos

### `karama/` (this repo, private)

- `docs/kki/kki_research.md` — this document (canonical methodology reference)
- `docs/project/project-brief.md` — §6.1 updated with KK anchor option
- `docs/project/principles.md` — Related Doctrine: "KKI is published, not issued"
- `docs/project/moscow-prioritization.md` — M17 re-scoped, M27 added, S6 added
- `docs/strategy/feasibility-validation.md` — R4 re-resolved, R15 + R16 added
- All design artifacts (M17 flow, wireframes, design system) updated to reference KK
- App code (Phase 3A) — consumes the closed KKI API via Supabase-JWT-exchange tokens

### `khobz-index/` ([github.com/The-Tech-Bay/khobz-index](https://github.com/The-Tech-Bay/khobz-index), public OSS, MIT code + CC BY 4.0 data)

- README + LICENSE + CONTRIBUTING + methodology landing-page source
- Calculation engine (basket math, hybrid weighting, caloric calibration)
- Source adapters (FAO FPI, FAOSTAT, optional WFP VAM, WB Pink Sheet, gold, energy, FX)
- Weekly scheduled job that checks sources and writes monthly-grain records
- Tests proving the math is correct
- `.env.example` documenting which secrets the deployment needs
- GitHub Actions workflow for weekly data refresh + monthly archive publication
- Static data archive auto-published to GitHub Releases (CSV + JSON)
- IPFS pin + Internet Archive sync for permanent archival
- Closed API endpoint (Cloudflare Workers) — Karama-app-only via Supabase-JWT exchange; no anonymous tier at MVP
- Landing page source (`khobz-index.thebay.ma`) — fully static, no public API calls

---

## 11. Open Methodology Questions for v1.1+

| # | Question | When to resolve | Working assumption for v1.0 |
|---|---|---|---|
| Q-K1 | Basket-revision schedule — how often to review regional compositions? | After 12 months of published data | Annual review; no changes inside a version |
| Q-K2 | Substitution / Paasche extension — should v2.0 use chain-weighted baskets? | When 24+ months of data show substitution patterns | Fixed-basket Laspeyres for v1.0 (same as Big Mac) |
| Q-K3 | BPP-style web scraping integration — should KKI incorporate scraped e-commerce prices? | When pilot markets with e-commerce (MA Jumia, EG Noon, IN Bigbasket) are active | No scraping in v1.0; purely API-sourced |
| Q-K4 | Central-bank / institution co-publication — should KKI be co-branded with AfDB, WFP, or a university? | After 6 months of solo publication with demonstrable adoption | Solo Karama brand at MVP; offer co-pub deal once established |
| Q-K5 | Third-party audit cadence — how often should methodology be externally reviewed? | Before Phase 1.5 public launch | Annual; first audit at 6-month mark |
| Q-K6 | Free public API tier — should we ever open the running API to anonymous consumers? | Phase 1.5+ (deferred) | No. Big Mac model: static archive only. Decision can be revisited or declined permanently. |
| Q-K7 | Weight calibration (α = 0.65 default) — should we run a formal sensitivity analysis? | Before Phase 1.5 public launch | 0.65 default; per-market tuning based on subsidy/trust profile |

---

## 11A. Historical Extension for Old-Debt Anchoring

> **Added:** 2026-05-22  
> **Status:** Implemented as additive v1.0-compatible provenance fields and landing utilities.

The KKI historical extension keeps observed KKI records intact and adds a transparent backcast layer for dates older than direct basket observations. The goal is to let users reason about old debts and old salaries without pretending that a 1995 estimate has the same evidentiary strength as a 2026 basket observation.

### 11A.1 Method Cascade

For each country and period, consumers should interpret KKI values by `estimate_method`:

| Method | Meaning | Confidence |
|---|---|---|
| `observed` | Direct current KKI calculation from basket/local-source pipeline | `observed` |
| `cpi_chained` | Food CPI chain-linked from an observed KKI base month | `high` when monthly, `medium` when annual/interpolated |
| `headline_cpi_chained` | Headline CPI chain-linked from an observed KKI base month | `medium` monthly, `low` annual/interpolated |
| `global_only_historical` | Durable global commodity proxy when no country CPI is available | `low` |

The conceptual chain-linking formula is:

```
KKI(C,t) = KKI(C,t0) × CPI(C,t) / CPI(C,t0)
```

Where `t0` is the nearest observed KKI base month with CPI coverage. Food CPI is preferred because KKI measures staple-food purchasing power. Headline CPI is allowed as a fallback for long-run salary/purchasing-power comparisons, but must be labelled as lower-confidence for debt anchoring.

Implementation note: the v1.0 historical pipeline applies CPI to the **LOCAL_basket** component and preserves the archived **GLOBAL_basket(t)** component where available before reconstructing `α × LOCAL + (1 − α) × GLOBAL`. This respects the hybrid KKI decomposition better than multiplying local and global legs by one headline CPI ratio.

### 11A.2 Anti-False-Precision Rule

Annual CPI-derived records can support year-level calculators and long-run charts. If displayed at month granularity, they must carry `source_periodicity = "annual"` or `"interpolated"` and expose `base_month` plus `estimate_source_ids`.

Landing charts should render annual CPI-derived history as stepped or otherwise visibly annual-grain. A smooth monthly curve from annual CPI would overstate precision and violate the index-number interpretation.

### 11A.3 Splice and Calibration Governance

The boundary between CPI-chained history and observed local basket records is a **splice**, not an ordinary price observation. A large jump at the first observed month is a diagnostic of source mismatch, proxy-deflator mismatch, producer-vs-retail price differences, or basket coverage changes. It should be displayed and documented; it should not be silently smoothed.

Any future calibration factor must be:

1. based on a documented overlap window,
2. published as a methodology/versioned change,
3. tested country-by-country,
4. kept separate from observed records in `estimate_method` / `estimate_confidence`.

Current additive fields:

- `estimate_method`
- `estimate_confidence`
- `source_periodicity`
- `base_month`
- `estimate_source_ids`

These fields do not replace existing `quality` (`full | degraded | global_only`) or mobile freshness (`fresh | cached | stale | bundled | version_mismatch`). They add historical provenance beside them.

---

## 12. Glossary

| Term | Definition |
|---|---|
| **KKI** | Karama Khobz Index (public brand) — a published purchasing-power reference index with weekly source checks and monthly canonical records; formally the **Karama Kilocalorie Index** in scientific documents (same abbreviation **KKI**) |
| **Karama Kilocalorie Index** | Formal scientific name for the same index as **KKI** — use when calorie calibration and **kcal** should be explicit; always cite the **Karama Khobz Index** brand on first mention (see §3.3) |
| **khobz** | Etymology: Arabic *khubz* / Maghrebi *khobz* — bread; signals the MENA staple-basket anchor in the **public** product name |
| **KK** | Khobz unit — one unit of KKI; represents ~1 day of staple subsistence calories for one adult (~2,200 kcal) |
| **KU** | Karama Unit — the Phase 4 unit of account (§13 of preserved brief); KK becomes KU when promises can be natively denominated in it |
| **KKI v1.0** | First version of the KKI methodology specification (this document) |
| **Reference-KK** | KK as a published reference index (Phase 1 onward) — no reserve, no token, no custody |
| **Asset-backed-KK** | KK as a regulated, reserve-backed token (Phase 5+ only) — requires regulated issuer entity |
| **Khobz basket** | MENA/North Africa regional basket: wheat flour + cooking oil + sugar + pulses |
| **Regional basket** | Market-specific staple-food basket calibrated to ~7 days of subsistence calories |
| **Caloric invariant** | The constraint that all regional baskets must target the same ~2,200 kcal/day, making 1 KK biologically universal |
| **Hybrid weighting** | `KKI(C, t) = α × LOCAL + (1−α) × GLOBAL` — default α = 0.65 |
| **α (alpha)** | Local-track weight in the hybrid formula — tuneable per market based on data trust and subsidy profile |
| **GLOBAL_basket** | Composite of FAO FPI + World Bank Pink Sheet energy + LBMA Gold Fix — identical across all markets |
| **LOCAL_basket** | Weighted average price of the regional staple basket in country C; implemented v1.0 primarily uses a FAOSTAT producer-price proxy, with WFP VAM as an optional configured enhancement |
| **FAO FPI** | UN FAO Food Price Index — monthly composite of cereals, oils, sugar, dairy, meat sub-indices (since 1990) |
| **WFP VAM** | UN World Food Programme Vulnerability Analysis and Mapping — local-market food prices, ~85 countries, weekly–monthly |
| **FAOSTAT** | UN FAO statistical database — food and agriculture data for 245 countries (since 1961) |
| **WB Pink Sheet** | World Bank commodity price data ("Pink Sheet") — global commodities since 1960 |
| **LBMA Fix** | London Bullion Market Association gold price fix — benchmark gold spot price (since 1919) |
| **Big Mac model** | Architectural pattern: code + data are public; no running public API; consumers read from static archive (GitHub Releases / IPFS / Internet Archive) |
| **Versioned methodology** | Discipline that old promises always reference their origin KKI version; no retroactive recalculation |
| **Subsidy gap** | Difference between local (potentially subsidized) basket cost and global (unsubsidized) benchmark — publishable signal of implicit fiscal subsidy |
| **Price ping** | Phase 1.2+ feature: optional single-question crowdsourced price observation at recording time, used to increase cadence in crisis markets |

---

## Cross-references

- Project brief: [`docs/project/project-brief.md`](../project/project-brief.md)
- Core principles: [`docs/project/principles.md`](../project/principles.md)
- MoSCoW prioritization: [`docs/project/moscow-prioritization.md`](../project/moscow-prioritization.md)
- Feasibility validation: [`docs/strategy/feasibility-validation.md`](../strategy/feasibility-validation.md) (R4 re-resolved)
- M17 user flow: [`docs/design/userFlows/flows/M17-inflation-anchor.md`](../design/userFlows/flows/M17-inflation-anchor.md)
- Preserved brief §13 (KU/Coin long-arc): [`docs/legacy brief/Karama_Product_Brief_2026.md`](../legacy%20brief/Karama_Product_Brief_2026.md)
- **Data sources deep research:** [`docs/kki/kki-data-sources-research.md`](./kki-data-sources-research.md) — alternatives/enhancements to WFP VAM & FAOSTAT (2026-05-14)
- Master TODO: [`docs/masterTODO.md`](../masterTODO.md) — §1.5.0

---

*End of KKI Methodology Research. This document is the canonical reference for all downstream KKI work across both repos.*
