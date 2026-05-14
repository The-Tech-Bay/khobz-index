import { describe, expect, test } from 'bun:test';
import { CountrySnapshotSchema, IndexRecordSchema } from '../../src/shared/schema.js';

/** data-schema.md §2.3 */
const countrySnapshotExample = {
  country_code: 'MA',
  snapshot_date: '2026-05-05',
  basket_version: 'mena-v1.0',
  prices: [
    {
      commodity_code: '23112',
      commodity_name: 'Wheat flour',
      price_local: 7.5,
      currency: 'MAD',
      price_usd: 0.74,
      source_id: 'faostat',
      source_tier: 1,
    },
    {
      commodity_code: '21531',
      commodity_name: 'Cooking oil',
      price_local: 18.0,
      currency: 'MAD',
      price_usd: 1.78,
      source_id: 'faostat',
      source_tier: 1,
    },
    {
      commodity_code: '23511',
      commodity_name: 'Sugar, refined',
      price_local: 8.2,
      currency: 'MAD',
      price_usd: 0.81,
      source_id: 'faostat',
      source_tier: 1,
    },
    {
      commodity_code: '01342',
      commodity_name: 'Pulses (lentils/chickpeas)',
      price_local: 22.0,
      currency: 'MAD',
      price_usd: 2.17,
      source_id: 'faostat',
      source_tier: 1,
    },
  ],
  global_track: {
    fao_fpi_cereals: 128.4,
    fao_fpi_oils: 145.2,
    fao_fpi_sugar: 112.8,
    brent_crude_usd: 78.5,
    gold_xau_usd: 2340.0,
    source_ids: ['fao-fpi', 'wb-pink-sheet', 'goldprice-dev'],
  },
  fetch_timestamp: '2026-05-05T06:12:34.567Z',
  quality_flags: {
    missing_sources: [],
    interpolated: [],
    stale_gold: false,
    gold_stale_since: null,
    global_only: false,
  },
  content_hash: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
} as const;

/** data-schema.md §3.4 */
const indexRecordExample = {
  country_code: 'MA',
  month: '2026-04',
  kki_value: 9.345,
  kki_value_usd: 0.923,
  currency: 'MAD',
  alpha: 0.65,
  local_basket_cost: 9.1,
  global_basket_cost: 9.8,
  basket_version: 'mena-v1.0',
  methodology_version: '1.0.0',
  computed_at: '2026-05-05T06:15:22.123Z',
  source_summary: [
    {
      slot: 'global_cereals_oils_sugar',
      source_ids: ['fao-fpi'],
      tiers: [1],
    },
    {
      slot: 'local_market_prices',
      source_ids: ['faostat'],
      tiers: [1],
    },
    {
      slot: 'gold_spot',
      source_ids: ['goldprice-dev'],
      tiers: [3],
    },
    {
      slot: 'crude_oil_energy',
      source_ids: ['wb-pink-sheet'],
      tiers: [1],
    },
  ],
  quality: 'full',
  record_hash: 'f0e1d2c3b4a5968778695a4b3c2d1e0f1234567890abcdef1234567890abcdef',
} as const;

describe('data-schema.md example JSON', () => {
  test('§2.3 CountrySnapshot parses', () => {
    const parsed = CountrySnapshotSchema.safeParse(countrySnapshotExample);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.country_code).toBe('MA');
      expect(parsed.data.prices).toHaveLength(4);
    }
  });

  test('§3.4 IndexRecord parses', () => {
    const parsed = IndexRecordSchema.safeParse(indexRecordExample);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.month).toBe('2026-04');
      expect(parsed.data.source_summary).toHaveLength(4);
    }
  });
});
