import { describe, expect, test } from 'bun:test';
import { calculateKKI } from '../../../src/engine/calculate.js';
import type {
  CommodityPrice,
  GlobalTrack,
  SourceContribution,
} from '../../../src/shared/schema.js';
import { IndexRecordSchema } from '../../../src/shared/schema.js';

/**
 * Fixture prices for the MENA basket that produce LOCAL ≈ 7.5 MAD:
 *   wheat 0.3×8 = 2.4, oil 0.25×14 = 3.5, sugar 0.15×7 = 1.05, pulses 0.3×5 = 1.5
 *   total when weights are already normalised (sum=1.0) → 8.45
 *   We need LOCAL = 7.5, so adjust: wheat 6, oil 12, sugar 5, pulses 8
 *   → 0.3×6 + 0.25×12 + 0.15×5 + 0.3×8 = 1.8+3.0+0.75+2.4 = 7.95 — close but not exact.
 *   Exact: solve for prices that give weighted sum = 7.5.
 *   Use: wheat=5, oil=12, sugar=5, pulses=7.5
 *   → 0.3×5 + 0.25×12 + 0.15×5 + 0.3×7.5 = 1.5+3.0+0.75+2.25 = 7.5 ✓
 */
const WORKED_PRICES: CommodityPrice[] = [
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

/**
 * Fixture global track + FX that produce GLOBAL ≈ 8.2 MAD.
 * We need computeGlobalBasketCost(track, fxRate) = 8.2.
 * composite_usd = SCALE × weighted_sum, global = composite_usd × fxRate.
 * With all indices at base (100, 65, 1200) → composite = SCALE = 0.80.
 * We need 0.80 × weighted_sum × fxRate = 8.2.
 * weighted_sum × fxRate = 10.25.
 * If fxRate = 10 → weighted_sum = 1.025.
 * weighted_sum = 0.35×(c/100) + 0.25×(o/100) + 0.15×(s/100) + 0.15×(b/65) + 0.10×(g/1200)
 * Set all FAO indices = 102.5 → food part = 0.75 × 1.025 = 0.76875
 * Set brent = 65 × 1.025 = 66.625 → energy = 0.15 × 1.025 = 0.153750
 * Set gold = 1200 × 1.025 = 1230 → gold = 0.10 × 1.025 = 0.102500
 * Total = 0.76875 + 0.15375 + 0.1025 = 1.025
 * global = 0.80 × 1.025 × 10 = 8.2 ✓
 */
const WORKED_GLOBAL: GlobalTrack = {
  fao_fpi_cereals: 102.5,
  fao_fpi_oils: 102.5,
  fao_fpi_sugar: 102.5,
  brent_crude_usd: 66.625,
  gold_xau_usd: 1230,
  source_ids: ['fao-fpi', 'wb-pink-sheet', 'goldprice-dev'],
};
const WORKED_FX = 10.0;

const SOURCES: SourceContribution[] = [
  { slot: 'local_market_prices', source_ids: ['wfp-vam'], tiers: [1] },
  { slot: 'global_cereals_oils_sugar', source_ids: ['fao-fpi'], tiers: [1] },
  { slot: 'crude_oil_energy', source_ids: ['wb-pink-sheet'], tiers: [1] },
  { slot: 'gold_spot', source_ids: ['goldprice-dev'], tiers: [2] },
];

describe('§3.3B.5 calculateKKI', () => {
  test('output validates against IndexRecordSchema', async () => {
    const { record } = await calculateKKI({
      countryCode: 'MA',
      month: '2022-04',
      prices: WORKED_PRICES,
      globalTrack: WORKED_GLOBAL,
      fxRate: WORKED_FX,
      currency: 'MAD',
      sourceSummary: SOURCES,
    });
    expect(() => IndexRecordSchema.parse(record)).not.toThrow();
  });

  test('methodology_version and v1.1 provenance fields are present in output', async () => {
    const { record } = await calculateKKI({
      countryCode: 'MA',
      month: '2022-04',
      prices: WORKED_PRICES,
      globalTrack: WORKED_GLOBAL,
      fxRate: WORKED_FX,
      currency: 'MAD',
    });
    expect(record.methodology_version).toBe('1.1.0');
    expect(record.formula_version).toBe('1.0.0');
    expect(record.correction_type).toBe('additive_provenance_and_staleness_cap');
  });

  test('degraded mode when some commodities missing', async () => {
    /** First 3 MENA items → weight coverage 0.70 (≥0.6 threshold); still missing one basket line → degraded. */
    const partialPrices = WORKED_PRICES.slice(0, 3);
    const { record, quality } = await calculateKKI({
      countryCode: 'MA',
      month: '2022-04',
      prices: partialPrices,
      globalTrack: WORKED_GLOBAL,
      fxRate: WORKED_FX,
      currency: 'MAD',
    });
    expect(quality).toBe('degraded');
    expect(record.quality).toBe('degraded');
    expect(record.kki_value).toBeGreaterThan(0);
    expect(() => IndexRecordSchema.parse(record)).not.toThrow();
  });

  test('global_only mode when all local prices missing', async () => {
    const { record, quality } = await calculateKKI({
      countryCode: 'MA',
      month: '2022-04',
      prices: [],
      globalTrack: WORKED_GLOBAL,
      fxRate: WORKED_FX,
      currency: 'MAD',
    });
    expect(quality).toBe('global_only');
    expect(record.alpha).toBe(0);
    expect(record.local_basket_cost).toBe(0);
    expect(record.kki_value).toBeCloseTo(record.global_basket_cost, 3);
  });

  test('global_only when local basket covers <60% nominal weight', async () => {
    const thin = WORKED_PRICES.slice(0, 2);
    const { record, quality } = await calculateKKI({
      countryCode: 'MA',
      month: '2022-04',
      prices: thin,
      globalTrack: WORKED_GLOBAL,
      fxRate: WORKED_FX,
      currency: 'MAD',
    });
    expect(quality).toBe('global_only');
    expect(record.quality).toBe('global_only');
    expect(record.alpha).toBe(0);
  });

  test('record_hash is a valid 64-char hex string', async () => {
    const { record } = await calculateKKI({
      countryCode: 'MA',
      month: '2022-04',
      prices: WORKED_PRICES,
      globalTrack: WORKED_GLOBAL,
      fxRate: WORKED_FX,
      currency: 'MAD',
    });
    expect(record.record_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
