import { describe, expect, test } from 'bun:test';
import { deriveLocalProvenanceFromCommodityPrices } from '../../../src/pipeline/lib/local-provenance.js';
import type { CommodityPrice } from '../../../src/shared/schema.js';

const basePrice: CommodityPrice = {
  commodity_code: '21531',
  commodity_name: 'Cooking oil',
  price_local: 1,
  currency: 'USD',
  price_usd: 1,
  source_id: 'faostat',
  source_tier: 1,
};

describe('deriveLocalProvenanceFromCommodityPrices', () => {
  test('observed when all fill_kind observed or absent', () => {
    const p = deriveLocalProvenanceFromCommodityPrices([basePrice]);
    expect(p.sourcePeriodicity).toBe('monthly');
    expect(p.estimateConfidence).toBe('observed');
    expect(p.interpolatedCommodityCodes).toEqual([]);
  });

  test('interpolated/low when any forward_filled', () => {
    const p = deriveLocalProvenanceFromCommodityPrices([
      { ...basePrice, fill_kind: 'forward_filled', last_observation_month: '2024-12' },
    ]);
    expect(p.sourcePeriodicity).toBe('interpolated');
    expect(p.estimateConfidence).toBe('low');
    expect(p.interpolatedCommodityCodes).toEqual(['21531']);
  });
});
