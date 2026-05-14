import { describe, expect, test } from 'bun:test';
import { BasketVersionMismatchError, UnknownCountryError } from '../../../src/engine/basket.js';
import { calculateKKI } from '../../../src/engine/calculate.js';
import { computeGlobalBasketCost } from '../../../src/engine/global-track.js';
import { computeHybridKKI } from '../../../src/engine/hybrid.js';
import type {
  CommodityPrice,
  GlobalTrack,
  SourceContribution,
} from '../../../src/shared/schema.js';

// ─── Worked example fixtures (kki_research.md §3.4) ──────────────────────────
//
// Promise: 200 MAD, 2022-04-14
// LOCAL_basket(MA, 2022-04) = 7.5 MAD
// GLOBAL_basket(2022-04) = 8.2 MAD equivalent
// α = 0.65
// KKI(MA, 2022-04) = 0.65 × 7.5 + 0.35 × 8.2 = 4.875 + 2.87 = 7.745
// anchor_units = 200 / 7.745 ≈ 25.82

const MENA_PRICES_RECORD: CommodityPrice[] = [
  {
    commodity_code: '23112',
    commodity_name: 'Wheat flour',
    price_local: 5.0,
    currency: 'MAD',
    price_usd: 0.5,
    source_id: 'wfp-vam',
    source_tier: 1,
  },
  {
    commodity_code: '21531',
    commodity_name: 'Cooking oil',
    price_local: 12.0,
    currency: 'MAD',
    price_usd: 1.2,
    source_id: 'wfp-vam',
    source_tier: 1,
  },
  {
    commodity_code: '23511',
    commodity_name: 'Sugar, refined',
    price_local: 5.0,
    currency: 'MAD',
    price_usd: 0.5,
    source_id: 'wfp-vam',
    source_tier: 1,
  },
  {
    commodity_code: '01342',
    commodity_name: 'Pulses (lentils/chickpeas)',
    price_local: 7.5,
    currency: 'MAD',
    price_usd: 0.75,
    source_id: 'wfp-vam',
    source_tier: 1,
  },
];

const WORKED_GLOBAL: GlobalTrack = {
  fao_fpi_cereals: 102.5,
  fao_fpi_oils: 102.5,
  fao_fpi_sugar: 102.5,
  brent_crude_usd: 66.625,
  gold_xau_usd: 1230,
  source_ids: ['fao-fpi', 'wb-pink-sheet', 'goldprice-dev'],
};
const FX_MAD_USD = 10.0;

const SOURCES: SourceContribution[] = [
  { slot: 'local_market_prices', source_ids: ['wfp-vam'], tiers: [1] },
  { slot: 'global_cereals_oils_sugar', source_ids: ['fao-fpi'], tiers: [1] },
  { slot: 'crude_oil_energy', source_ids: ['wb-pink-sheet'], tiers: [1] },
  { slot: 'gold_spot', source_ids: ['goldprice-dev'], tiers: [2] },
];

// ─── §3.3B.6 worked-example verification ─────────────────────────────────────

describe('§3.3B.6 worked-example verification', () => {
  test('hybrid formula: LOCAL=7.5, GLOBAL=8.2, α=0.65 → KKI=7.745', () => {
    const result = computeHybridKKI(0.65, 7.5, 8.2);
    expect(result.kki_value).toBeCloseTo(7.745, 2);
  });

  test('anchor_units = 200 / 7.745 ≈ 25.82', () => {
    const kki = 0.65 * 7.5 + 0.35 * 8.2;
    const anchorUnits = 200 / kki;
    expect(anchorUnits).toBeCloseTo(25.82, 1);
  });

  test('global track fixture produces GLOBAL ≈ 8.2 MAD', () => {
    const result = computeGlobalBasketCost(WORKED_GLOBAL, FX_MAD_USD);
    expect(result.global_basket_cost).toBeCloseTo(8.2, 1);
  });

  test('full calculateKKI reproduces worked example within ±0.01', async () => {
    const { record } = await calculateKKI({
      countryCode: 'MA',
      month: '2022-04',
      prices: MENA_PRICES_RECORD,
      globalTrack: WORKED_GLOBAL,
      fxRate: FX_MAD_USD,
      currency: 'MAD',
      sourceSummary: SOURCES,
    });

    expect(record.local_basket_cost).toBeCloseTo(7.5, 1);
    expect(record.global_basket_cost).toBeCloseTo(8.2, 1);
    expect(record.kki_value).toBeCloseTo(7.745, 2);
    expect(record.alpha).toBe(0.65);
    expect(record.quality).toBe('full');

    const anchorUnits = 200 / record.kki_value;
    expect(anchorUnits).toBeCloseTo(25.82, 1);
  });

  test('settlement: LOCAL=9.1, GLOBAL=9.8, α=0.65 → KKI=9.345', () => {
    const result = computeHybridKKI(0.65, 9.1, 9.8);
    expect(result.kki_value).toBeCloseTo(9.345, 3);
  });
});

// ─── Edge-case tests ──────────────────────────────────────────────────────────

describe('§3.3B.6 edge-case tests', () => {
  test('stable market: local ≈ global → KKI ≈ both', async () => {
    // Prices calibrated so LOCAL ≈ GLOBAL ≈ 8.0
    const stablePrices: CommodityPrice[] = [
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
        price_local: 8.0,
        currency: 'MAD',
        price_usd: 0.8,
        source_id: 'wfp-vam',
        source_tier: 1,
      },
      {
        commodity_code: '23511',
        commodity_name: 'Sugar, refined',
        price_local: 8.0,
        currency: 'MAD',
        price_usd: 0.8,
        source_id: 'wfp-vam',
        source_tier: 1,
      },
      {
        commodity_code: '01342',
        commodity_name: 'Pulses (lentils/chickpeas)',
        price_local: 8.0,
        currency: 'MAD',
        price_usd: 0.8,
        source_id: 'wfp-vam',
        source_tier: 1,
      },
    ];
    // LOCAL = 0.3×8 + 0.25×8 + 0.15×8 + 0.3×8 = 8.0
    const { record } = await calculateKKI({
      countryCode: 'MA',
      month: '2022-04',
      prices: stablePrices,
      globalTrack: WORKED_GLOBAL,
      fxRate: FX_MAD_USD,
      currency: 'MAD',
    });
    expect(record.local_basket_cost).toBeCloseTo(8.0, 1);
    expect(record.quality).toBe('full');
  });

  test('high-inflation: local 3× global', async () => {
    const inflatedPrices: CommodityPrice[] = [
      {
        commodity_code: '23112',
        commodity_name: 'Wheat flour',
        price_local: 25.0,
        currency: 'MAD',
        price_usd: 2.5,
        source_id: 'wfp-vam',
        source_tier: 1,
      },
      {
        commodity_code: '21531',
        commodity_name: 'Cooking oil',
        price_local: 25.0,
        currency: 'MAD',
        price_usd: 2.5,
        source_id: 'wfp-vam',
        source_tier: 1,
      },
      {
        commodity_code: '23511',
        commodity_name: 'Sugar, refined',
        price_local: 25.0,
        currency: 'MAD',
        price_usd: 2.5,
        source_id: 'wfp-vam',
        source_tier: 1,
      },
      {
        commodity_code: '01342',
        commodity_name: 'Pulses (lentils/chickpeas)',
        price_local: 25.0,
        currency: 'MAD',
        price_usd: 2.5,
        source_id: 'wfp-vam',
        source_tier: 1,
      },
    ];
    // LOCAL = 25.0 (all same price × weights sum to 1)
    // GLOBAL ≈ 8.2
    // KKI = 0.65 × 25 + 0.35 × 8.2 = 16.25 + 2.87 = 19.12
    const { record } = await calculateKKI({
      countryCode: 'MA',
      month: '2022-04',
      prices: inflatedPrices,
      globalTrack: WORKED_GLOBAL,
      fxRate: FX_MAD_USD,
      currency: 'MAD',
    });
    expect(record.local_basket_cost).toBeCloseTo(25.0, 1);
    expect(record.kki_value).toBeGreaterThan(record.global_basket_cost * 2);
    expect(record.quality).toBe('full');
  });

  test('missing-source degraded: 3 of 4 commodities → ≥60% weight coverage, locals still degraded', async () => {
    const partialPrices = MENA_PRICES_RECORD.slice(0, 3);
    // Matched nominal weights 0.3 + 0.25 + 0.15 = 0.7 — above D6 gate; pulses still missing ⇒ degraded path.
    const { record, quality } = await calculateKKI({
      countryCode: 'MA',
      month: '2022-04',
      prices: partialPrices,
      globalTrack: WORKED_GLOBAL,
      fxRate: FX_MAD_USD,
      currency: 'MAD',
    });
    expect(quality).toBe('degraded');
    expect(record.quality).toBe('degraded');
    expect(record.local_basket_cost).toBeCloseTo(7.5, 1);
    expect(record.kki_value).toBeGreaterThan(0);
  });

  test('all-local-missing: α→0 (global_only)', async () => {
    const { record, quality } = await calculateKKI({
      countryCode: 'MA',
      month: '2022-04',
      prices: [],
      globalTrack: WORKED_GLOBAL,
      fxRate: FX_MAD_USD,
      currency: 'MAD',
    });
    expect(quality).toBe('global_only');
    expect(record.alpha).toBe(0);
    expect(record.local_basket_cost).toBe(0);
    expect(record.kki_value).toBeCloseTo(record.global_basket_cost, 3);
  });

  test('basket-version-mismatch throws typed error', async () => {
    try {
      await calculateKKI({
        countryCode: 'MA',
        month: '2022-04',
        prices: MENA_PRICES_RECORD,
        globalTrack: WORKED_GLOBAL,
        fxRate: FX_MAD_USD,
        currency: 'MAD',
        methodologyVersion: '99.0.0',
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(BasketVersionMismatchError);
    }
  });

  test('unknown country throws typed error', async () => {
    try {
      await calculateKKI({
        countryCode: 'XX',
        month: '2022-04',
        prices: MENA_PRICES_RECORD,
        globalTrack: WORKED_GLOBAL,
        fxRate: FX_MAD_USD,
        currency: 'MAD',
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownCountryError);
    }
  });
});
