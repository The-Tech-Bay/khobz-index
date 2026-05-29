/**
 * Local basket coverage summary — shared by calculate.ts and fixture-builder.
 * Threshold matches §pipeline D6 (0.6 nominal weight gate).
 */

import type { BasketVersion, CommodityPrice } from '../shared/schema.js';

/** Nominal basket weight required for local leg acceptance (§pipeline D6). */
export const LOCAL_BASKET_COVERAGE_THRESHOLD = 0.6;

export interface LocalBasketCostResult {
  cost: number;
  matched: string[];
  missing: string[];
  adjustedWeights: Map<string, number>;
  weightCoverageSum: number;
}

export interface MissingBasketItem {
  commodity_code: string;
  commodity_name: string;
  weight: number;
}

export interface LocalCoverageSummary {
  items_expected: number;
  items_priced: number;
  weight_covered: number;
  threshold: number;
  local_leg_accepted: boolean;
  missing_high_weight: MissingBasketItem[];
}

/**
 * Compute the local basket cost as Σ(weight_i × price_local_i) for
 * items whose price is available.
 */
export function computeLocalBasketCost(
  basket: BasketVersion,
  prices: CommodityPrice[],
): LocalBasketCostResult {
  const priceMap = new Map<string, CommodityPrice>();
  for (const p of prices) {
    priceMap.set(p.commodity_code, p);
  }

  const matched: string[] = [];
  const missing: string[] = [];
  let weightCoverageSum = 0;

  for (const item of basket.items) {
    if (priceMap.has(item.commodity_code)) {
      matched.push(item.commodity_code);
      weightCoverageSum += item.weight;
    } else {
      missing.push(item.commodity_code);
    }
  }

  const adjustedWeights = new Map<string, number>();
  let cost = 0;

  for (const item of basket.items) {
    const price = priceMap.get(item.commodity_code);
    if (!price) continue;

    const adjustedWeight = weightCoverageSum > 0 ? item.weight / weightCoverageSum : 0;
    adjustedWeights.set(item.commodity_code, adjustedWeight);
    cost += adjustedWeight * price.price_local;
  }

  return { cost, matched, missing, adjustedWeights, weightCoverageSum };
}

export function computeLocalCoverageSummary(
  basket: BasketVersion,
  prices: CommodityPrice[],
): LocalCoverageSummary {
  const local = computeLocalBasketCost(basket, prices);
  const missingItems: MissingBasketItem[] = basket.items
    .filter((item) => !local.matched.includes(item.commodity_code))
    .map((item) => ({
      commodity_code: item.commodity_code,
      commodity_name: item.commodity_name,
      weight: item.weight,
    }))
    .sort((a, b) => b.weight - a.weight);

  const localLegAccepted =
    local.matched.length > 0 && local.weightCoverageSum >= LOCAL_BASKET_COVERAGE_THRESHOLD;

  return {
    items_expected: basket.items.length,
    items_priced: local.matched.length,
    weight_covered: Number(local.weightCoverageSum.toFixed(4)),
    threshold: LOCAL_BASKET_COVERAGE_THRESHOLD,
    local_leg_accepted: localLegAccepted,
    missing_high_weight: missingItems,
  };
}
