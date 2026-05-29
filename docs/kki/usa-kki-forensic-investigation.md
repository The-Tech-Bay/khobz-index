# Forensic Investigation — KKI USA Series (2023–2026)

> Independent forensic audit of the apparent deterioration in US purchasing power
> beginning late 2024 / early 2025.
>
> Scope: read-only investigation. **No code or methodology changes were made.**
> Author posture: skeptical peer reviewer (IMF / World Bank / OECD / academic standard).
>
> Evidence base: published fixture archive
> `khobz-index/landing/public/data/fixture/shard-1.json` (`generated_at` 2026-05-24),
> the v1.0 engine (`src/engine/*.ts`), the FAOSTAT prefetch script
> (`scripts/fetch-faostat-prices.ts`), `data/v1.0/alpha-config.json`,
> `data/baskets/oecd-v1.0.json`, and independent external series (BLS, USDA ERS, FAO).

---

## 0. Bottom Line Up Front (BLUF)

The late-2024/early-2025 deterioration in the **US** series is **mostly a methodology /
data-source artifact, with a small genuine signal underneath it.**

Two distinct artifacts compound:

1. **A forward-fill freeze.** From **2025-01 onward the US local basket leg is pinned
   at exactly `1.097` for 16 consecutive months** (2025-01 → 2026-04). This is the
   FAOSTAT producer-price proxy being forward-filled from its latest available annual
   anchor. Because the US has the highest local weight (`alpha = 0.80`), 80% of the index
   becomes a constant, which both **creates the one-month step up** at the 2024→2025
   boundary and **causes the post-2025 flat line.**

2. **A unit/level distortion in the basket cost.** The basket "weights" are **calorie
   shares**, but they are multiplied directly against **per-unit producer prices** of
   incompatible magnitudes. The realized value is therefore dominated by **cooking oil
   (48.5%) and eggs (44.2%)** — *not* oil and sugar as the nominal weights suggest. The
   frozen egg price locks in the 2025 US avian-influenza spike permanently, even though
   real egg prices have since collapsed ~45%.

Independent data is unambiguous: US **food-at-home CPI rose only +1.2% (2024) and +2.3%
(2025)** (USDA ERS / BLS). KKI's local leg posted a **+18.3% single-month jump** and then
**zero further variation**. The magnitude, the timing (step), and the post-shock dynamics
(permanent flatness vs. real-world mean reversion) are all inconsistent with observed US
staple-food behavior.

**Final verdict: Mixed signal and methodology artifact — leaning "mostly methodology
artifact."** Confidence: **High** for the mechanism; **High** for the conclusion.

---

## Phase 1 — Reproduce the Result

### 1.1 Configuration (verified from source)

| Parameter | Value | Source |
|---|---|---|
| `alpha(US)` | **0.80** (`high_trust`) | `data/v1.0/alpha-config.json` |
| Basket | `oecd-v1.0` "Loaf basket" | `data/baskets/oecd-v1.0.json` |
| Currency / FX | USD, FX = 1.0 (no conversion noise) | fixture |
| Formula | `KKI = alpha·LOCAL + (1−alpha)·GLOBAL` | `src/engine/hybrid.ts`, `calculate.ts` |
| Purchasing power | `100 / kki_value` (KK per 100 USD) | `landing/src/lib/countryChartSemantics.ts` |

### 1.2 Full monthly reproduction (2023-01 → 2026-04)

`KKIcalc = 0.8·LOCAL + 0.2·GLOBAL`. The formula reproduces the published `kki_value`
**exactly** — max absolute residual across all 40 months = **0.0006** (pure 3-dp rounding).
The formula and purchasing-power derivation are therefore **mathematically correct**; the
problem lies upstream in the inputs.

| Month | LOCAL | GLOBAL | KKI (fixture) | KKI (calc) | PP = 100/KKI | quality | conf | period |
|---|---:|---:|---:|---:|---:|---|---|---|
| 2023-01 | 1.005 | 1.114 | 1.027 | 1.0268 | 97.4 | full | observed | monthly |
| 2023-06 | 0.737 | 1.049 | 0.799 | 0.7994 | 125.2 | full | observed | monthly |
| 2023-10 | 0.651 | 1.061 | 0.733 | 0.7330 | 136.4 | full | observed | monthly |
| 2024-06 | 0.644 | 1.026 | 0.720 | 0.7204 | 138.9 | full | observed | monthly |
| 2024-09 | 0.667 | 1.060 | 0.746 | 0.7456 | 134.1 | full | observed | monthly |
| 2024-10 | 0.786 | 1.091 | 0.847 | 0.8470 | 118.1 | full | observed | monthly |
| 2024-11 | 0.762 | 1.104 | 0.831 | 0.8304 | 120.3 | full | observed | monthly |
| **2024-12** | **0.927** | 1.095 | **0.960** | 0.9606 | **104.2** | full | observed | monthly |
| **2025-01** | **1.097** | 1.071 | **1.092** | 1.0918 | **91.6** | full | observed | monthly |
| 2025-02 | 1.097 | 1.090 | 1.096 | 1.0956 | 91.2 | full | observed | monthly |
| 2025-06 | 1.097 | 1.063 | 1.090 | 1.0902 | 91.7 | full | observed | monthly |
| 2025-12 | 1.097 | 1.076 | 1.093 | 1.0928 | 91.5 | full | observed | monthly |
| 2026-04 | 1.097 | 1.148 | 1.107 | 1.1072 | 90.3 | full | observed | monthly |

(Full 40-row table reproduced in the appendix calculation; abridged here.)

### 1.3 The decline begins at **2025-01**

- Purchasing power falls from **104.2 → 91.6 KK/100 USD** between 2024-12 and 2025-01
  (a **−12.1%** one-month collapse).
- This is driven **entirely by the LOCAL leg**: `LOCAL` 0.927 → **1.097 (+18.3%)** while
  `GLOBAL` actually *fell* (1.095 → 1.071).
- **From 2025-01 the LOCAL leg never changes again** (16 identical values of `1.097`,
  population std = **0.000000**).

> **Key Phase-1 finding:** the index math is correct to rounding. The decline is a
> property of the **local basket input**, which steps up once and then freezes.

---

## Phase 2 — Contribution Analysis

The fixture stores per-commodity prices only for the latest snapshot (2026-04), which —
because the local leg is frozen — is identical to the entire 2025-01→2026-04 plateau.
Local cost is computed as `Σ(weightᵢ × price_localᵢ)` (`src/engine/local-coverage.ts`).

### 2.1 Decomposition of the frozen US local basket (= 1.097)

| Commodity | Nominal weight | Price (LCU, frozen) | Contribution = w×p | **% of basket value** |
|---|---:|---:|---:|---:|
| **Cooking oil (sunflower)** | 0.522 | 1.02 /L | 0.5324 | **48.5%** |
| **Eggs** | 0.0552 | 8.79 /kg* | 0.4852 | **44.2%** |
| Sugar, refined | 0.2285 | 0.15 /kg | 0.0343 | 3.1% |
| Wheat bread | 0.1565 | 0.16 /kg | 0.0250 | 2.3% |
| Dairy, milk | 0.0378 | 0.53 /L | 0.0200 | 1.8% |
| **Total** | 1.000 | — | **1.097** | 100% |

\* Eggs price is a FAOSTAT producer price in LCU/tonne ÷ 1000 → LCU/kg (no retail markup
applied). The number `8.79` enters the cost as-is.

### 2.2 What explains the movement?

The single-month rise was `LOCAL` +0.170 (0.927 → 1.097). Monthly per-commodity history is
not retained in the fixture, so the jump cannot be decomposed commodity-by-commodity from
the archive alone. However, the **frozen plateau composition is decisive**:

- **Oil and eggs together account for 92.7% of the local basket value.**
- The contribution that is *anomalously large relative to its nominal weight* is **eggs**:
  a **5.5% calorie weight producing 44% of the cost**, because its per-unit price (8.79) is
  ~8× the next-largest (oil at 1.02) and ~50–60× sugar/bread.
- External data (Phase 5) shows eggs were the dominant US food shock of exactly this
  period (avian flu), and oil was the only rising FAO sub-index in 2025 (+17.1%). Both of
  the two dominant basket lines were independently elevated at the freeze date — so the
  frozen `1.097` captured a **transient joint peak** and then held it.

> **Answer:** Cooking oil and eggs jointly explain essentially all (>90%) of the basket
> level. Eggs are the component whose *value contribution wildly exceeds its weight*, and
> eggs are the line most responsible for both the level and the misleading dynamics.

---

## Phase 3 — Source Audit

### 3.1 Per-commodity provenance (latest snapshot)

| Commodity | `source_id` | tier | periodicity (native) | observed vs estimated |
|---|---|---:|---|---|
| Wheat bread | `faostat` | 1 | **annual** producer price | proxy, interpolated→monthly, **forward-filled** |
| Dairy | `faostat` | 1 | annual | proxy, interpolated, forward-filled |
| Cooking oil | `faostat` | 1 | annual | proxy, interpolated, forward-filled |
| Sugar | `faostat` | 1 | annual | proxy, interpolated, forward-filled |
| Eggs | `faostat` | 1 | annual | proxy, interpolated, forward-filled |

All five local lines come from **one source**: FAOSTAT Producer Prices. There is **no WFP
VAM, no retail observation**. `quality = full` and `estimate_method = observed` for every
2025–2026 month, which **overstates the evidentiary status**: these are forward-filled
annual producer proxies, not fresh monthly retail observations.

### 3.2 The forward-fill mechanism (verified in code)

`scripts/fetch-faostat-prices.ts → convertToEnvelope()`:

1. FAOSTAT producer prices are **annual** for the US (element 5530, LCU/tonne).
2. Annual rows are spread to months by **linear interpolation between adjacent years**;
   the latest year (no successor) gets a half-slope ramp (`val = row.value + trend·frac·0.5`).
3. **Forward-fill block (lines ~268–310):** for each `area:item`, the *latest available*
   value is carried forward month-by-month through the current calendar month:
   ```
   while (y < fillToYear || (y === fillToYear && m <= fillToMonth)) {
     output.push(toEnvelopeRow({...latest.row, year: y, value: latest.val}, mm));
   }
   ```
   The carried value is a **constant** (`latest.val`), which is why every forward-filled
   month is identical.

### 3.3 Diagnosis

- **A source froze:** FAOSTAT annual producer prices publish with a long lag. The latest
  annual anchor (2024 vintage) is the newest data, so **all of 2025 and 2026 are
  forward-filled** at that constant anchor → `LOCAL = 1.097` flat.
- **Structural jump at the year boundary:** within 2024 the local leg is the
  *interpolated/observed* monthly path (noisy, see §7); at 2025-01 it switches to the
  *forward-filled annual anchor*, which is a different (higher) number than the
  interpolated 2024-12 value (0.927). That discontinuity is the **+18.3% step**. It is a
  **splice between two regimes of the same proxy**, not a market event.
- **Commodity that drove it:** the elevated anchor reflects high 2024 producer prices for
  the two dominant lines (oil, eggs), so the freeze locked in a high basket.

> **Phase-3 verdict:** the affected period is **100% forward-filled annual producer-price
> proxy**, mislabeled `observed/full/monthly`. This is the proximate cause of both the step
> and the flatness.

---

## Phase 4 — Flat-Line Investigation (2025-01 → 2026-04)

KKI post-2025 std = **0.0043**; pre-2025 (2023-24) std = **0.0806** — a **~19× collapse in
volatility**. The residual 0.0043 is *entirely* the 20% global leg leaking through
(`0.2 × std(GLOBAL) = 0.2 × 0.0217 ≈ 0.0043`). The 80% local leg contributes **zero**.

| Hypothesis | Evidence | Impact | Likelihood |
|---|---|---|---|
| **H1 — Forward-filled source freezes commodity values** | `LOCAL` = 1.097 for 16 months, std 0; matches forward-fill code path exactly | Explains 100% of the local-leg flatness; 80% of index | **VERY HIGH (primary)** |
| **H2 — Annual producer data repeated** | Same as H1; FAOSTAT US is annual; forward-fill repeats the latest annual anchor | Identical to H1 (the *form* of H1) | **VERY HIGH** |
| **H3 — Global track stabilization** | GLOBAL still varies (std 0.0217, range 1.063–1.148) — *not* flat | Would only matter for 20% leg; global isn't flat anyway | **LOW** |
| **H4 — Weighting interaction creates flatness** | Flatness originates in a frozen *input*, not in weights; any weights on a constant vector give a constant (see Phase 6) | Weights change the *level*, never restore variance | **LOW (not causal)** |
| **H5 — Legitimate market stabilization** | Contradicted by external data: US food-at-home CPI kept rising (+2.3% in 2025, +2.9% YoY to Apr-2026); eggs *fell 45%*. Real markets were **not** flat | Real variance exists; KKI shows none | **VERY LOW** |

**Ranking:** H1 ≡ H2 (same mechanism) ≫ H4 ≈ H3 ≫ H5.

> **Phase-4 verdict:** the flat line is a **frozen forward-filled input**, definitively not
> market stabilization. A real US staple basket would have continued to move (notably the
> large egg *down*-move of 2025).

---

## Phase 5 — External Validation

| Series | Real-world 2024 → 2025/26 | KKI behavior | Verdict |
|---|---|---|---|
| **USDA ERS / BLS food-at-home CPI** | **+1.2% (2024), +2.3% (2025)**; +2.9% YoY to Apr-2026 | LOCAL **+18.3% in one month**, then 0% | **KKI grossly overstates magnitude & mis-times** |
| **BLS eggs** (APU0000708111, $/doz) | $4.15 (Dec-24) → **$6.23 peak (Mar-25)** → $2.58 (Jan-26), **−45% YoY** | Egg line frozen high (8.79) entire period | **Overstates; misses the collapse entirely** |
| **FAO Vegetable Oil index** | **+17.1% in 2025** (3-yr high, tight supply) | Oil frozen at 1.02 | Right *direction* in 2024, but frozen (no 2025 path) |
| **FAO Sugar index** | **−17.0% in 2025** (lowest since 2020) | Sugar frozen at 0.15 | Misses the decline |
| **FAO Cereals index** | **−4.9% in 2025** | Bread frozen at 0.16 | Misses the decline |
| **FAO dairy** | **+13–17% in 2025** | Dairy frozen at 0.53 | Misses the rise |
| **FAO Food Price Index (headline)** | +4.3% in 2025; −2.3% YoY by Dec-2025 | Captured only via 20% global leg | Partially captured |

**Timing test:** real US eggs peaked **March 2025**; KKI's step is **January 2025** and is a
*level shift that never reverses*. Real eggs round-tripped from $4.15 to $6.23 and back to
$2.58. KKI shows a one-way staircase. **The dynamics do not match reality.**

> **Phase-5 verdict:** KKI **overstates** the deterioration and, more importantly,
> **mis-represents its persistence**. The genuine kernel — eggs and oil were truly elevated
> entering 2025 — is real, but KKI converts a *transient, mean-reverting* shock into a
> *permanent* level via forward-fill.

---

## Phase 6 — Basket Sensitivity Analysis

Recomputing `Σ(wᵢ·pᵢ)` on the frozen snapshot prices (bread 0.16, dairy 0.53, oil 1.02,
sugar 0.15, eggs 8.79):

| Scenario | Weights (bread/dairy/oil/sugar/eggs) | LOCAL value | Step+freeze still present? |
|---|---|---:|---|
| **Current** | 0.157 / 0.038 / 0.522 / 0.229 / 0.055 | **1.097** | Yes |
| **A — Equal** | 0.20 each | **2.130** | Yes (eggs → 82% of value) |
| **B — Calories-only** | = calorie shares | **1.097** | Yes — *the current weights already are calorie shares* |
| **C — Typical US staple** | 0.35 / 0.30 / 0.12 / 0.08 / 0.15 | **≈1.67** | Yes (eggs still ≈ 1.32 of it) |
| **D — Nutrition-adjusted** | 0.25 / 0.25 / 0.15 / 0.15 / 0.20 | **≈2.11** | Yes |

**Critical observation:** the basket "weights" in `oecd-v1.0.json` are **exactly the
calorie shares** (e.g. oil 8840/16936 = 0.522; eggs 936/16936 = 0.055). So "Scenario B" is
the production basket. Multiplying calorie shares by *per-unit prices of different physical
quantities* is **dimensionally incoherent** and is why a 5.5%-calorie item (eggs) can carry
44% of the cost.

> **Would the 2025 drop still exist?** **Yes, under every weighting.** The step-and-freeze
> is a property of the **frozen input vector**, not of the weights: any fixed weights
> applied to a constant price vector yield a constant. Weighting changes the **level and the
> amplitude** of the one-month step (e.g., equal/nutrition weights make it *larger* because
> they raise the egg share) but **cannot remove the artifact**. Even deleting eggs entirely
> leaves oil (frozen 1.02, weight 0.52) dominating → still flat.

---

## Phase 7 — Statistical Plausibility

| Quantity | KKI | Plausible for US staples? |
|---|---|---|
| Local-leg MoM swings, 2023–24 | ±10–22% routinely (e.g. +21.7% Dec-24, +17.8% Oct-24, −13.9% Jun-24) | **No.** US food-at-home CPI MoM is ~±0.2–0.7%. ±15% monthly staple swings are implausible — a signature of noisy annual→monthly proxy interpolation, not observation. |
| The 2024→2025 jump | LOCAL +18.3% in one month | Not unique in the series (similar to Oct/Dec-24), which itself is the problem: the *whole* pre-2025 local leg is over-volatile. |
| Post-2025 variance | LOCAL std = **0** over 16 months | **No.** Zero variance over 16 months is impossible for a real food basket (eggs alone moved −45% YoY). A frozen input is the only explanation. |
| KKI volatility ratio (pre/post) | 0.0806 / 0.0043 ≈ **19×** drop | A regime change of this size with no market cause is a data-generation artifact. |

> **Phase-7 flag:** the US local leg is **simultaneously too noisy before 2025 and
> impossibly smooth after** — the classic fingerprint of an **annual series faked into
> monthly** (interpolation noise in the interior, flat forward-fill at the tail).

---

## Phase 8 — Economist Review (Peer-Review Report)

### Findings

The published US KKI deterioration from late-2024 is **predominantly an artifact of the
FAOSTAT producer-price proxy pipeline**, with a genuine but smaller economic kernel:

1. **Genuine kernel:** US eggs (avian flu) and global vegetable oils were truly elevated
   entering 2025. A real US staple index *should* show modest upward pressure in this window.
2. **Artifact 1 (dominant):** the local leg is **forward-filled from the latest annual
   FAOSTAT anchor**, freezing 80% of the index at `1.097` for 16 months. This both
   manufactures the one-month step (a regime splice at the year boundary) and produces the
   flat line.
3. **Artifact 2 (amplifier):** calorie-share weights multiplied by heterogeneous per-unit
   prices make **eggs carry 44% of basket value off a 5.5% weight**, so the frozen,
   already-mean-reverted egg spike is over-weighted and permanently embedded.
4. **Provenance mislabeling:** these months are tagged `observed / full / monthly`,
   overstating their evidentiary class (they are interpolated, forward-filled annual
   producer proxies).

### Confidence

- Mechanism (forward-fill freeze + formula correctness): **High** — reproduced to 0.0006,
  std = 0 confirmed, code path identified.
- External mismatch (over-/mis-statement): **High** — BLS/USDA/FAO all corroborate.
- Exact commodity split of the *jump*: **Medium** — monthly per-commodity history is not in
  the archive; inferred from frozen composition + external shocks.

### Most Likely Explanation (ranked)

1. **Forward-fill of annual producer prices freezes the local leg (C + B).** ★ primary
2. **Calorie-weight × per-unit-price unit incoherence over-weights eggs/oil (D).** ★ amplifier
3. **High `alpha=0.80` maximizes the frozen leg's dominance (methodology choice).**
4. **Genuine egg/oil shock entering 2025 (A).** real but minor and misrepresented as permanent.
5. **Calculation bug (E).** ❌ rejected — formula reproduces exactly.
6. **Legitimate stabilization (H5).** ❌ rejected — contradicted by external data.

### Methodology Risks Exposed

- **Forward-fill presented as observation.** A frozen annual anchor is published with
  `quality=full, estimate_method=observed, source_periodicity=monthly`. This is the single
  most damaging risk: it makes a stale constant look like fresh monthly truth.
- **Annual→monthly interpolation injects false monthly volatility** in the interior period
  and false stability at the tail.
- **Calorie weights applied to per-unit prices** (dimensional incoherence) — relative
  contributions (oil 48.5%, eggs 44.2%) diverge sharply from the stated weights (oil 52%,
  sugar 23%), and the egg unit (per-kg producer price vs. 12-count basket line) is not
  reconciled.
- **High `alpha` for "high-trust" markets** amplifies any local-leg defect to 80% of the
  index — the opposite of robustness when the local source is a forward-filled proxy.
- **Basket-version inconsistency:** `oecd-v1.0.json` includes eggs with
  `effective_from: 2026-01-01`, yet eggs price the 2018–2025 records, and methodology §4.3
  lists "basket v1.1 eggs" as *not yet live*. The egg line is being applied outside its
  stated effective window.
- **No staleness/decay flag** distinguishes a live observation from an N-month forward-fill.

### Recommended Fixes (ranked by impact — *for future work; not implemented here*)

1. **Stop labeling forward-filled months as `observed`/`monthly`.** Tag them
   `forward_filled` / `interpolated` with a staleness age, and surface "last true
   observation" on the chart. (Highest integrity impact, lowest effort.)
2. **Cap or decay forward-fill** (e.g. ≤3–6 months, or widen confidence bands / fall back to
   the global leg) instead of holding an annual constant indefinitely.
3. **Reconcile units**: convert each commodity to the *calorie-implied physical quantity*
   for one KK, then cost `Σ qtyᵢ·priceᵢ`, so contributions match intended weights and eggs
   cannot dominate off a 5.5% calorie share.
4. **Prefer a true monthly retail source** for the US (BLS Average Retail Food Prices is
   already on the roadmap, §4.3) over annual producer-price proxy + interpolation.
5. **Reconsider `alpha=0.80`** while the local leg is a forward-filled proxy; a lower alpha
   would reduce artifact dominance until a monthly retail source is live.
6. **Resolve the eggs basket-version inconsistency** (effective-date vs. applied-date).

### Final Verdict

> **Mixed signal and methodology artifact** — and within that band, **mostly methodology
> artifact.**
>
> The KKI engine math is correct (`KKI = 0.8·LOCAL + 0.2·GLOBAL`, reproduced to ±0.0006;
> purchasing power = 100/KKI). The deterioration is **not** a calculation bug and **not**
> primarily a genuine economic signal. It is the product of (i) a **forward-filled annual
> producer-price proxy** that freezes 80% of the US index at `1.097` from 2025-01, creating
> a spurious one-month step and a 16-month flat line, and (ii) a **calorie-weight ×
> per-unit-price** construction that hands ~44% of the basket to a frozen egg-spike value.
> A real but modest shock (eggs/oil entering 2025) exists underneath, but KKI **overstates
> its size (~18% vs. ~2% real), mis-times it (Jan vs. Mar), and—most seriously—mis-states
> its persistence**, converting a mean-reverting spike into a permanent level.

**Evidence summary:** local std post-2025 = 0.000000; KKI volatility drop 19×; 16 identical
`1.097` values matching the forward-fill code path; US food-at-home CPI +1.2%/+2.3% vs.
KKI +18.3% one-month; BLS eggs round-trip $4.15→$6.23→$2.58 vs. KKI frozen.

---

## Appendix A — Reproduction Notes

- Data extracted from `landing/public/data/fixture/shard-1.json`, country `US`.
- Formula check: `0.8·local_basket_cost + 0.2·global_basket_cost` vs. `kki_value`;
  max |residual| = 0.0006 over 2023-01…2026-04.
- Local basket decomposition: `Σ(weight × price_local)` using `latest_snapshot.prices`
  (frozen ⇒ representative of the whole 2025-01→2026-04 plateau).
- Volatility: population std of `kki_value`, pre = 2023-01…2024-12 (n=24) = 0.0806,
  post = 2025-01…2026-04 (n=16) = 0.0043; `std(local)` post = 0.000000.

## Appendix B — External Sources

- USDA ERS Food Price Outlook (food-at-home: +1.2% 2024, +2.3% 2025; +2.9% YoY Apr-2026).
- BLS CPI Average Price, eggs grade A large per dozen, series `APU0000708111`
  (Dec-24 $4.146; Mar-25 peak $6.227; Jan-26 $2.577; Mar-26 $2.348).
- BLS food-at-home CPI `CUUR0000SAF11`.
- FAO Food Price Index, Dec-2025 release (2025 avg 127.2, +4.3% YoY; vegetable oils +17.1%;
  sugar −17.0%; cereals −4.9%; dairy +13–17%).
