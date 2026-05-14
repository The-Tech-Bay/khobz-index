/**
 * Caloric calibration (§3.3B.2).
 *
 * Computes each basket item's caloric weight and price contribution,
 * normalised so caloric weights sum to 1.0.
 */

import type { BasketVersion, CommodityPrice } from '../shared/schema.js';

export interface CaloricContribution {
  commodity_code: string;
  commodity_name: string;
  /** Normalised caloric weight (sums to 1.0 across the basket). */
  caloric_weight: number;
  /** caloric_weight × price_local for this commodity. */
  price_contribution: number;
}

/**
 * For each basket item, compute its caloric weight (the fraction of total
 * weighted calories it contributes) and the resulting price contribution.
 *
 * Raw caloric value per item = kcal_per_unit × weight.
 * Normalised caloric_weight_i = raw_i / Σ(raw_j).
 * price_contribution_i = caloric_weight_i × price_local_i.
 *
 * Items whose commodity_code has no matching price entry are skipped.
 */
export function computeCaloricContributions(
  basket: BasketVersion,
  prices: CommodityPrice[],
): CaloricContribution[] {
  const priceMap = new Map<string, CommodityPrice>();
  for (const p of prices) {
    priceMap.set(p.commodity_code, p);
  }

  const rawValues: { item: (typeof basket.items)[number]; price: CommodityPrice; raw: number }[] =
    [];
  let rawSum = 0;

  for (const item of basket.items) {
    const price = priceMap.get(item.commodity_code);
    if (!price) continue;
    const raw = item.kcal_per_unit * item.weight;
    rawSum += raw;
    rawValues.push({ item, price, raw });
  }

  if (rawSum === 0) return [];

  return rawValues.map(({ item, price, raw }) => {
    const caloric_weight = raw / rawSum;
    return {
      commodity_code: item.commodity_code,
      commodity_name: item.commodity_name,
      caloric_weight,
      price_contribution: caloric_weight * price.price_local,
    };
  });
}
