/**
 * Global track composite calculator (§3.3B.3).
 *
 * Produces GLOBAL_basket(t) — a single cost figure in local currency —
 * from the five global benchmark inputs (FAO FPI cereals/oils/sugar,
 * Brent crude, XAU gold spot).
 *
 * Each component is normalised to its 2014-16 base value, weighted,
 * then scaled by COMPOSITE_SCALE_USD and converted via the FX rate.
 */

import type { GlobalTrack } from '../shared/schema.js';

/** Component weights in the global composite (sum to 1.0). */
export const GLOBAL_WEIGHTS = {
  fao_cereals: 0.35,
  fao_oils: 0.25,
  fao_sugar: 0.15,
  brent_crude: 0.15,
  gold_xau: 0.1,
} as const;

/** Base-period values used to normalise each component to ~1.0 at reference date. */
export const BASE_VALUES = {
  fpi: 100,
  brent_usd: 65,
  xau_usd: 1200,
} as const;

/**
 * USD cost of one "global KK" at the base period. Calibrated so that
 * the composite output is on the same order-of-magnitude as LOCAL basket cost.
 */
export const COMPOSITE_SCALE_USD = 0.8;

export interface GlobalBasketResult {
  global_basket_cost: number;
  /** Which components were missing and filled with stale/base fallback. */
  stale_flags: {
    stale_gold: boolean;
    stale_energy: boolean;
    missing_fao: string[];
  };
}

/**
 * Compute the global basket cost in local currency.
 *
 * @param track  - Five global benchmark values (nullable — missing values
 *                 fall back to base-period defaults).
 * @param fxRate - Units of local currency per 1 USD.
 */
export function computeGlobalBasketCost(track: GlobalTrack, fxRate: number): GlobalBasketResult {
  const staleGold = track.gold_xau_usd == null;
  const staleEnergy = track.brent_crude_usd == null;
  const missingFao: string[] = [];

  if (track.fao_fpi_cereals == null) missingFao.push('fao_fpi_cereals');
  if (track.fao_fpi_oils == null) missingFao.push('fao_fpi_oils');
  if (track.fao_fpi_sugar == null) missingFao.push('fao_fpi_sugar');

  const cereals = (track.fao_fpi_cereals ?? BASE_VALUES.fpi) / BASE_VALUES.fpi;
  const oils = (track.fao_fpi_oils ?? BASE_VALUES.fpi) / BASE_VALUES.fpi;
  const sugar = (track.fao_fpi_sugar ?? BASE_VALUES.fpi) / BASE_VALUES.fpi;
  const brent = (track.brent_crude_usd ?? BASE_VALUES.brent_usd) / BASE_VALUES.brent_usd;
  const xau = (track.gold_xau_usd ?? BASE_VALUES.xau_usd) / BASE_VALUES.xau_usd;

  const compositeUsd =
    COMPOSITE_SCALE_USD *
    (GLOBAL_WEIGHTS.fao_cereals * cereals +
      GLOBAL_WEIGHTS.fao_oils * oils +
      GLOBAL_WEIGHTS.fao_sugar * sugar +
      GLOBAL_WEIGHTS.brent_crude * brent +
      GLOBAL_WEIGHTS.gold_xau * xau);

  return {
    global_basket_cost: compositeUsd * fxRate,
    stale_flags: {
      stale_gold: staleGold,
      stale_energy: staleEnergy,
      missing_fao: missingFao,
    },
  };
}
