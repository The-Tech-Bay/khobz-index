import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  LandingFixtureCountryData,
  LandingFixtureCountryRecord,
  LandingFixturePayload,
} from '../../../src/pipeline/lib/fixture-builder.js';
import {
  countFixtureRecords,
  fixtureFailsDensityGuard,
  honestMonthsFromPayload,
  mergeLandingFixturePayloads,
  withHonestMonths,
} from '../../../src/pipeline/lib/fixture-merge.js';
import {
  loadPreviousPublishedFixture,
  loadSnapshotFixture,
  prepareFixtureForPublish,
} from '../../../src/pipeline/lib/fixture-publish.js';
import { writeLandingFixtureShards } from '../../../src/pipeline/lib/fixture-shards.js';

function rec(overrides: Partial<LandingFixtureCountryRecord> = {}): LandingFixtureCountryRecord {
  return {
    kki_value: 1,
    kki_value_usd: 1,
    local_basket_cost: 0,
    global_basket_cost: 1,
    quality: 'global_only',
    estimate_method: 'observed',
    estimate_confidence: 'observed',
    source_periodicity: 'monthly',
    base_month: null,
    estimate_source_ids: [],
    ...overrides,
  };
}

function snapshot(date: string) {
  return {
    snapshot_date: date,
    prices: [],
    global_track: {
      fao_fpi_cereals: 100,
      fao_fpi_oils: 100,
      fao_fpi_sugar: 100,
      brent_crude_usd: 65,
      gold_xau_usd: 1200,
    },
    quality_flags: { missing_sources: [], interpolated: [], stale_gold: false, global_only: true },
    local_coverage: {
      items_expected: 0,
      items_priced: 0,
      weight_covered: 0,
      threshold: 0.6,
      local_leg_accepted: false,
      missing_high_weight: [],
    },
  };
}

function country(
  records: Record<string, LandingFixtureCountryRecord>,
  latestDate: string,
  name = 'X',
): LandingFixtureCountryData {
  return {
    name,
    currency: 'USD',
    region: 'europe',
    basket_version: 'v1',
    alpha: 0.5,
    market_type: 'developed',
    diagnostics: {
      first_observed_month: null,
      last_estimated_month_before_observed: null,
      splice_gap_pct: null,
      dominant_estimate_method: null,
      has_annual_cpi_history: false,
    },
    records,
    latest_snapshot: snapshot(latestDate),
  };
}

function payload(
  countries: Record<string, LandingFixtureCountryData>,
  months?: string[],
): LandingFixturePayload {
  const monthSet = new Set<string>(months ?? []);
  if (!months) {
    for (const c of Object.values(countries)) {
      for (const m of Object.keys(c.records)) monthSet.add(m);
    }
  }
  return {
    schema_version: '1.0',
    methodology_version: '1.1.0',
    generated_at: '2026-06-08T00:00:00.000Z',
    months: [...monthSet].sort(),
    countries,
  };
}

function countryOf(p: LandingFixturePayload, code: string): LandingFixtureCountryData {
  const c = p.countries[code];
  if (!c) throw new Error(`missing country ${code}`);
  return c;
}

function advertisedMonths(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const out: string[] = [];
  let y = fy ?? 1990;
  let m = fm ?? 1;
  const endY = ty ?? 2026;
  const endM = tm ?? 7;
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

describe('mergeLandingFixturePayloads', () => {
  test('preserves history and refreshes the fresh window (the regression)', () => {
    const previous = payload({
      AD: country(
        {
          '1990-01': rec({ kki_value: 0.5 }),
          '2024-12': rec({ kki_value: 0.9 }),
          '2026-04': rec({ kki_value: 1.0 }),
        },
        '2026-04-15',
      ),
    });
    const fresh = payload({
      AD: country(
        {
          '2025-12': rec({ kki_value: 1.1 }),
          '2026-04': rec({ kki_value: 1.23 }),
          '2026-05': rec({ kki_value: 1.3 }),
        },
        '2026-05-15',
      ),
    });

    const merged = mergeLandingFixturePayloads(previous, fresh);
    const ad = countryOf(merged, 'AD');

    expect(ad.records['1990-01']?.kki_value).toBe(0.5);
    expect(ad.records['2026-05']?.kki_value).toBe(1.3);
    expect(ad.records['2026-04']?.kki_value).toBe(1.23);
    expect(merged.months[0]).toBe('1990-01');
    expect(merged.months.at(-1)).toBe('2026-05');
    expect(ad.latest_snapshot.snapshot_date).toBe('2026-05-15');
  });

  test('keeps countries present only in the previous fixture', () => {
    const previous = payload({ AD: country({ '1990-01': rec() }, '1990-01-15') });
    const fresh = payload({ FR: country({ '2026-05': rec() }, '2026-05-15') });
    const merged = mergeLandingFixturePayloads(previous, fresh);
    expect(Object.keys(merged.countries).sort()).toEqual(['AD', 'FR']);
  });

  test('recomputes diagnostics over the merged history', () => {
    const previous = payload({
      MA: country(
        {
          '1995-12': rec({
            kki_value: 8,
            estimate_method: 'headline_cpi_chained',
            estimate_confidence: 'low',
            source_periodicity: 'annual',
            base_month: '2018-01',
          }),
        },
        '1995-12-15',
      ),
    });
    const fresh = payload({
      MA: country({ '2018-01': rec({ kki_value: 10, local_basket_cost: 10 }) }, '2018-01-15'),
    });
    const merged = mergeLandingFixturePayloads(previous, fresh);
    const d = countryOf(merged, 'MA').diagnostics;
    expect(d.first_observed_month).toBe('2018-01');
    expect(d.last_estimated_month_before_observed).toBe('1995-12');
    expect(d.splice_gap_pct).toBe(25);
    expect(d.dominant_estimate_method).toBe('headline_cpi_chained');
    expect(d.has_annual_cpi_history).toBe(true);
  });

  test('countFixtureRecords totals every per-country month', () => {
    const p = payload({
      AD: country({ '1990-01': rec(), '1990-02': rec() }, '1990-02-15'),
      FR: country({ '1990-01': rec() }, '1990-01-15'),
    });
    expect(countFixtureRecords(p)).toBe(3);
  });

  test('honest months equals the union of record keys, not an advertised empty range', () => {
    const advertised = advertisedMonths('1990-01', '2026-07');
    const sparse = payload(
      {
        MA: country(
          {
            '2026-02': rec(),
            '2026-03': rec(),
            '2026-04': rec(),
            '2026-05': rec(),
            '2026-06': rec(),
            '2026-07': rec(),
          },
          '2026-07-15',
        ),
      },
      advertised,
    );
    expect(sparse.months.length).toBeGreaterThan(400);
    const honest = withHonestMonths(sparse);
    expect(honest.months).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ]);
    expect(honestMonthsFromPayload(sparse)).toEqual(honest.months);
  });
});

describe('density guard', () => {
  test('fails 439 advertised months × 6 records/country', () => {
    const advertised = advertisedMonths('1990-01', '2026-07');
    const sparse = payload(
      {
        MA: country(
          {
            '2026-02': rec(),
            '2026-03': rec(),
            '2026-04': rec(),
            '2026-05': rec(),
            '2026-06': rec(),
            '2026-07': rec(),
          },
          '2026-07-15',
        ),
      },
      advertised,
    );
    expect(advertised.length).toBeGreaterThanOrEqual(24);
    expect(fixtureFailsDensityGuard(sparse)).toBe(true);
  });

  test('passes dense history', () => {
    const months = advertisedMonths('1990-01', '2026-07');
    const records: Record<string, LandingFixtureCountryRecord> = {};
    for (const m of months) records[m] = rec();
    const dense = payload({ MA: country(records, '2026-07-15') }, months);
    expect(fixtureFailsDensityGuard(dense)).toBe(false);
  });
});

describe('loadPreviousPublishedFixture', () => {
  test('missing file returns an error, not a silent null-only result', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kki-fix-'));
    const load = loadSnapshotFixture(join(dir, 'missing.json'));
    expect(load.payload).toBeNull();
    expect(load.error).toContain('missing');
  });

  test('invalid JSON is loud', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kki-fix-'));
    const path = join(dir, 'bad.json');
    writeFileSync(path, '{not-json', 'utf8');
    const load = loadSnapshotFixture(path);
    expect(load.payload).toBeNull();
    expect(load.error).toContain('load failed');
  });

  test('valid snapshot loads with record counts available', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kki-fix-'));
    const path = join(dir, 'ok.json');
    const p = payload({ AD: country({ '1990-01': rec() }, '1990-01-15') });
    writeFileSync(path, JSON.stringify(p), 'utf8');
    const load = loadSnapshotFixture(path);
    expect(load.payload?.months).toEqual(['1990-01']);
    expect(load.source).toBe('snapshot');
    expect(load.bytes).toBeGreaterThan(0);
    expect(load.error).toBeNull();
  });

  test('falls back to shards when the snapshot is unparsable', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kki-fix-'));
    const snap = join(dir, 'snapshot.json');
    writeFileSync(snap, '{broken', 'utf8');
    const shardsDir = join(dir, 'fixture');
    mkdirSync(shardsDir, { recursive: true });
    const full = payload({
      AD: country({ '1990-01': rec(), '2026-04': rec() }, '2026-04-15'),
    });
    writeLandingFixtureShards(full, shardsDir);
    const load = loadPreviousPublishedFixture(snap, shardsDir);
    expect(load.source).toBe('shards');
    expect(load.payload && countFixtureRecords(load.payload)).toBe(2);
  });
});

describe('prepareFixtureForPublish', () => {
  test('merge-on + null previous is fatal unless --force', () => {
    const fresh = payload({ AD: country({ '2026-07': rec() }, '2026-07-15') });
    const blocked = prepareFixtureForPublish({
      fresh,
      previous: null,
      mergeFixture: true,
      force: false,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toContain('no previous fixture');

    const forced = prepareFixtureForPublish({
      fresh,
      previous: null,
      mergeFixture: true,
      force: true,
    });
    expect(forced.ok).toBe(true);
  });

  test('density collapse of advertised empty history is fatal', () => {
    const advertised = advertisedMonths('1990-01', '2026-07');
    const fresh = payload(
      {
        MA: country(
          {
            '2026-02': rec(),
            '2026-03': rec(),
            '2026-04': rec(),
            '2026-05': rec(),
            '2026-06': rec(),
            '2026-07': rec(),
          },
          '2026-07-15',
        ),
      },
      advertised,
    );
    const blocked = prepareFixtureForPublish({
      fresh,
      previous: null,
      mergeFixture: false,
      force: false,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toContain('density');
  });

  test('successful merge writes honest months from the record union', () => {
    const previous = payload({
      AD: country(
        {
          '1990-01': rec({ kki_value: 0.5 }),
          '2026-04': rec({ kki_value: 1.0 }),
        },
        '2026-04-15',
      ),
    });
    const advertised = advertisedMonths('1990-01', '2026-07');
    const fresh = payload(
      {
        AD: country({ '2026-07': rec({ kki_value: 1.4 }) }, '2026-07-15'),
      },
      advertised,
    );
    const result = prepareFixtureForPublish({
      fresh,
      previous,
      mergeFixture: true,
      force: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.merged).toBe(true);
    expect(result.payload.months).toEqual(['1990-01', '2026-04', '2026-07']);
    expect(result.payload.countries.AD?.records['1990-01']?.kki_value).toBe(0.5);
    expect(result.payload.countries.AD?.records['2026-07']?.kki_value).toBe(1.4);
  });
});
