import { describe, expect, test } from 'bun:test';
import {
  COMPOSITE_SCALE_USD,
  computeGlobalBasketCost,
  GLOBAL_WEIGHTS,
} from '../../../src/engine/global-track.js';
import type { GlobalTrack } from '../../../src/shared/schema.js';

const FULL_TRACK: GlobalTrack = {
  fao_fpi_cereals: 150,
  fao_fpi_oils: 170,
  fao_fpi_sugar: 120,
  brent_crude_usd: 105,
  gold_xau_usd: 1900,
  source_ids: ['fao-fpi', 'wb-pink-sheet', 'goldprice-dev'],
};

describe('§3.3B.3 global track composite', () => {
  test('weights sum to 1.0', () => {
    const sum =
      GLOBAL_WEIGHTS.fao_cereals +
      GLOBAL_WEIGHTS.fao_oils +
      GLOBAL_WEIGHTS.fao_sugar +
      GLOBAL_WEIGHTS.brent_crude +
      GLOBAL_WEIGHTS.gold_xau;
    expect(sum).toBeCloseTo(1.0, 10);
  });

  test('full track produces expected composite in local currency', () => {
    const fxRate = 10.0;
    const result = computeGlobalBasketCost(FULL_TRACK, fxRate);

    // Manual calc:
    // cereals = 150/100 = 1.5, oils = 170/100 = 1.7, sugar = 120/100 = 1.2
    // brent = 105/65 ≈ 1.6154, xau = 1900/1200 ≈ 1.5833
    // composite_usd = 0.80 * (0.35*1.5 + 0.25*1.7 + 0.15*1.2 + 0.15*1.6154 + 0.10*1.5833)
    //               = 0.80 * (0.525 + 0.425 + 0.18 + 0.24231 + 0.15833)
    //               = 0.80 * 1.53064
    //               ≈ 1.22451
    // local = 1.22451 * 10 = 12.2451
    expect(result.global_basket_cost).toBeCloseTo(12.245, 1);
    expect(result.stale_flags.stale_gold).toBe(false);
    expect(result.stale_flags.stale_energy).toBe(false);
    expect(result.stale_flags.missing_fao).toEqual([]);
  });

  test('missing gold falls back to base and flags stale', () => {
    const track: GlobalTrack = {
      ...FULL_TRACK,
      gold_xau_usd: null,
    };
    const result = computeGlobalBasketCost(track, 1.0);
    expect(result.stale_flags.stale_gold).toBe(true);

    // With base gold (1200/1200=1.0), the gold component decreases
    const fullResult = computeGlobalBasketCost(FULL_TRACK, 1.0);
    expect(result.global_basket_cost).toBeLessThan(fullResult.global_basket_cost);
  });

  test('missing energy falls back to base and flags stale', () => {
    const track: GlobalTrack = {
      ...FULL_TRACK,
      brent_crude_usd: null,
    };
    const result = computeGlobalBasketCost(track, 1.0);
    expect(result.stale_flags.stale_energy).toBe(true);
  });

  test('all nulls fall back to base period → composite = COMPOSITE_SCALE_USD × fxRate', () => {
    const track: GlobalTrack = {
      fao_fpi_cereals: null,
      fao_fpi_oils: null,
      fao_fpi_sugar: null,
      brent_crude_usd: null,
      gold_xau_usd: null,
      source_ids: [],
    };
    const fxRate = 10.0;
    const result = computeGlobalBasketCost(track, fxRate);
    // All normalized to 1.0, weights sum to 1.0 → composite_usd = COMPOSITE_SCALE_USD
    expect(result.global_basket_cost).toBeCloseTo(COMPOSITE_SCALE_USD * fxRate, 6);
  });

  test('fxRate=1 gives result in USD', () => {
    const result = computeGlobalBasketCost(FULL_TRACK, 1.0);
    expect(result.global_basket_cost).toBeGreaterThan(0);
    expect(result.global_basket_cost).toBeLessThan(5);
  });
});
