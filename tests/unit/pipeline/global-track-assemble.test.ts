import { describe, expect, test } from 'bun:test';
import { assembleGlobalTrackForMonth } from '../../../src/pipeline/lib/global-track-assemble.js';
import type { PriceRecord } from '../../../src/shared/schema.js';

const bench = {
  month: '2020-01',
  gold_xau_usd: 1580,
  brent_crude_usd: 64,
  fao_fpi_cereals: 100.7,
  fao_fpi_oils: 108.73,
  fao_fpi_sugar: 87.5,
} as const;

describe('assembleGlobalTrackForMonth', () => {
  test('fills FAO cereals/oils/sugar from benchmark when prefetch slot returned no adapter rows', () => {
    const track = assembleGlobalTrackForMonth({
      month: '2020-01',
      globalCerealRecords: [],
      crudeSlotRecords: [],
      goldSlotRecords: [],
      benchmark: bench,
    });
    expect(track.fao_fpi_cereals).toBe(100.7);
    expect(track.fao_fpi_oils).toBe(108.73);
    expect(track.fao_fpi_sugar).toBe(87.5);
    expect(track.brent_crude_usd).toBe(64);
    expect(track.gold_xau_usd).toBe(1580);
    expect(track.source_ids).toContain('benchmark-csv(fpi,gold,brent)');
  });

  test('uses benchmark oil/sugar brent gold when cereals come from adapters', () => {
    const recs: PriceRecord[] = [
      {
        commodity: 'fao_fpi_cereals',
        price_usd: 99,
        price_local: 99,
        currency: 'USD',
        price_unit: 'idx',
        date: '2020-01',
        source_id: 'test-fpi',
        fetched_at: '',
        country_code: 'ZZ',
      },
    ];
    const track = assembleGlobalTrackForMonth({
      month: '2020-01',
      globalCerealRecords: recs,
      crudeSlotRecords: [],
      goldSlotRecords: [],
      benchmark: bench,
    });
    expect(track.fao_fpi_cereals).toBe(99);
    expect(track.fao_fpi_oils).toBe(108.73);
    expect(track.source_ids).toContain('benchmark-csv(fpi,gold,brent)');
    expect(track.source_ids).toContain('test-fpi');
  });

  test('does not duplicate benchmark marker when adapters fully supply globals', () => {
    const cereals: PriceRecord[] = ['fao_fpi_cereals', 'fao_fpi_oils', 'fao_fpi_sugar'].map(
      (commodity, i) => ({
        commodity,
        price_usd: 100 + i,
        price_local: 100 + i,
        currency: 'USD',
        price_unit: 'idx',
        date: '2020-01',
        source_id: 'f-test',
        fetched_at: '',
        country_code: 'ZZ',
      }),
    );
    const crude: PriceRecord[] = [
      {
        commodity: 'brent_crude_usd',
        price_usd: 64,
        price_local: 64,
        currency: 'USD',
        price_unit: 'usd/bbl',
        date: '2020-01',
        source_id: 'wb-test',
        fetched_at: '',
        country_code: 'ZZ',
      },
    ];
    const gold: PriceRecord[] = [
      {
        commodity: 'gold_xau_usd',
        price_usd: 1580,
        price_local: 1580,
        currency: 'USD',
        price_unit: 'usd/oz',
        date: '2020-01',
        source_id: 'gold-test',
        fetched_at: '',
        country_code: 'ZZ',
      },
    ];
    const track = assembleGlobalTrackForMonth({
      month: '2020-01',
      globalCerealRecords: cereals,
      crudeSlotRecords: crude,
      goldSlotRecords: gold,
      benchmark: bench,
    });
    expect(track.source_ids.filter((id) => id === 'benchmark-csv(fpi,gold,brent)').length).toBe(0);
    expect(track.source_ids).toEqual(expect.arrayContaining(['f-test', 'wb-test', 'gold-test']));
  });
});
