import { describe, expect, test } from 'bun:test';
import { computeCaloricContributions } from '../../../src/engine/calories.js';
import type { BasketVersion, CommodityPrice } from '../../../src/shared/schema.js';

const MENA_BASKET: BasketVersion = {
  basket_id: 'mena-v1.0',
  region: 'mena',
  basket_name: 'Khobz basket',
  effective_from: '2026-01-01',
  superseded_by: null,
  items: [
    {
      commodity_code: '23112',
      commodity_name: 'Wheat flour',
      faostat_item_code: 16,
      unit: 'kg',
      quantity: 1.0,
      kcal_per_unit: 3640,
      weight: 0.3,
    },
    {
      commodity_code: '21531',
      commodity_name: 'Cooking oil',
      faostat_item_code: 268,
      unit: 'L',
      quantity: 1.0,
      kcal_per_unit: 8840,
      weight: 0.25,
    },
    {
      commodity_code: '23511',
      commodity_name: 'Sugar, refined',
      faostat_item_code: 2543,
      unit: 'kg',
      quantity: 1.0,
      kcal_per_unit: 3870,
      weight: 0.15,
    },
    {
      commodity_code: '01342',
      commodity_name: 'Pulses (lentils/chickpeas)',
      faostat_item_code: 186,
      unit: 'kg',
      quantity: 1.0,
      kcal_per_unit: 3530,
      weight: 0.3,
    },
  ],
  target_kcal: 15400,
  methodology_version: '1.0.0',
};

const MENA_PRICES: CommodityPrice[] = [
  {
    commodity_code: '23112',
    commodity_name: 'Wheat flour',
    price_local: 8.0,
    currency: 'MAD',
    price_usd: 0.8,
    source_id: 'wfp-vam',
    source_tier: 1,
  },
  {
    commodity_code: '21531',
    commodity_name: 'Cooking oil',
    price_local: 14.0,
    currency: 'MAD',
    price_usd: 1.4,
    source_id: 'wfp-vam',
    source_tier: 1,
  },
  {
    commodity_code: '23511',
    commodity_name: 'Sugar, refined',
    price_local: 7.0,
    currency: 'MAD',
    price_usd: 0.7,
    source_id: 'wfp-vam',
    source_tier: 1,
  },
  {
    commodity_code: '01342',
    commodity_name: 'Pulses (lentils/chickpeas)',
    price_local: 20.0,
    currency: 'MAD',
    price_usd: 2.0,
    source_id: 'wfp-vam',
    source_tier: 1,
  },
];

describe('§3.3B.2 caloric calibration', () => {
  test('caloric shares sum to ~1.0 for MENA basket', () => {
    const result = computeCaloricContributions(MENA_BASKET, MENA_PRICES);
    expect(result.length).toBe(4);
    const shareSum = result.reduce((s, c) => s + c.caloric_weight, 0);
    expect(Math.abs(shareSum - 1.0)).toBeLessThan(0.001);
  });

  test('caloric weights reflect kcal × basket-weight ratio', () => {
    const result = computeCaloricContributions(MENA_BASKET, MENA_PRICES);

    // Cooking oil has highest kcal_per_unit × weight = 8840 × 0.25 = 2210
    const oil = result.find((c) => c.commodity_code === '21531');
    expect(oil).toBeDefined();
    expect(oil?.caloric_weight).toBeGreaterThan(0.4);

    // Sugar has lowest kcal_per_unit × weight = 3870 × 0.15 = 580.5
    const sugar = result.find((c) => c.commodity_code === '23511');
    expect(sugar).toBeDefined();
    expect(sugar?.caloric_weight).toBeLessThan(0.15);
  });

  test('price_contribution = caloric_weight × price_local', () => {
    const result = computeCaloricContributions(MENA_BASKET, MENA_PRICES);
    for (const c of result) {
      const price = MENA_PRICES.find((p) => p.commodity_code === c.commodity_code);
      expect(price).toBeDefined();
      expect(c.price_contribution).toBeCloseTo(c.caloric_weight * (price?.price_local ?? 0), 6);
    }
  });

  test('skips items with no matching price', () => {
    const partialPrices = MENA_PRICES.slice(0, 2);
    const result = computeCaloricContributions(MENA_BASKET, partialPrices);
    expect(result.length).toBe(2);
    const shareSum = result.reduce((s, c) => s + c.caloric_weight, 0);
    expect(Math.abs(shareSum - 1.0)).toBeLessThan(0.001);
  });

  test('returns empty array when no prices match', () => {
    const result = computeCaloricContributions(MENA_BASKET, []);
    expect(result).toEqual([]);
  });
});
