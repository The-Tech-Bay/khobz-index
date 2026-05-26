import { describe, expect, test } from 'bun:test';
import { lcuPerUsdFromFxRecords } from '../../../src/pipeline/lib/fx-utils.js';
import type { PriceRecord } from '../../../src/shared/schema.js';

function fxRecord(commodity: string, rate: number): PriceRecord {
  return {
    commodity,
    price_usd: rate,
    price_unit: 'pair',
    date: '1990-01',
    source_id: 'frankfurter',
    fetched_at: '1990-01-15T00:00:00.000Z',
  };
}

describe('lcuPerUsdFromFxRecords', () => {
  test('parses Frankfurter fx_USD_* commodities', () => {
    const map = lcuPerUsdFromFxRecords([fxRecord('fx_USD_MAD', 10.5)]);
    expect(map.MAD).toBe(10.5);
    expect(map.USD).toBe(1);
  });

  test('parses exchangerate.host fx_USDXXX commodities', () => {
    const map = lcuPerUsdFromFxRecords([fxRecord('fx_USDMAD', 10.5)]);
    expect(map.MAD).toBe(10.5);
  });
});
