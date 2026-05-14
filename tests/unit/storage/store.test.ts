import { describe, expect, test } from 'bun:test';
import { calculateKKI } from '../../../src/engine/calculate.js';
import type { CountrySnapshot, GlobalTrack, IndexRecord } from '../../../src/shared/schema.js';
import { SnapshotManifestSchema } from '../../../src/shared/schema.js';
import {
  APK_BUNDLE_GZIP_BUDGET_BYTES,
  buildCountrySnapshotMinimal,
  buildOfflineApkBundle,
  getLatestMonth,
  getSnapshot,
  gzipSizeJson,
  InMemoryBackend,
  persistApkBundle,
  persistCountryMonth,
  verifyIntegrity,
} from '../../../src/storage/index.js';

const SHARED_GT: GlobalTrack = {
  fao_fpi_cereals: 100,
  fao_fpi_oils: 100,
  fao_fpi_sugar: 100,
  brent_crude_usd: 65,
  gold_xau_usd: 1200,
  source_ids: ['fao-fpi', 'wb-pink-sheet'],
};

async function indexFor(
  isoMonth: string,
  country: string,
  currency: string,
  fx: number,
): Promise<IndexRecord> {
  const { record } = await calculateKKI({
    countryCode: country,
    month: isoMonth,
    prices: [],
    globalTrack: SHARED_GT,
    fxRate: fx,
    currency,
  });
  return record;
}

async function snapshotFor(
  record: IndexRecord,
  fetchIso: string,
  overrides?: Partial<Pick<CountrySnapshot, 'global_track'>>,
): Promise<CountrySnapshot> {
  return buildCountrySnapshotMinimal({
    country_code: record.country_code,
    snapshot_date: `${record.month}-20`,
    basket_version: record.basket_version,
    global_track: overrides?.global_track ?? SHARED_GT,
    fetch_timestamp_iso: fetchIso,
    prices: [],
    quality_flags: { global_only: record.quality === 'global_only' },
  });
}

describe('§3.4B snapshot storage — dual-publish', () => {
  test('dual-publish JSON envelope + CSV; global track object present', async () => {
    const backend = new InMemoryBackend();
    const month = '2026-04';
    const r = await indexFor(month, 'MA', 'MAD', 10);
    const snap = await snapshotFor(r, '2026-04-05T06:00:00.000Z');
    const res = await persistCountryMonth(backend, 'v1.0', month, r, snap);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected write');
    expect(res.skipped).toBe(false);
    const j = await backend.get(`v1.0/${r.country_code}/${month}.json`);
    const c = await backend.get(`v1.0/${r.country_code}/${month}.csv`);
    expect(j?.body).toContain('"index_record"');
    expect(j?.body).toContain('"snapshot"');
    expect(c?.body).toContain('fao_fpi_cereals');
    expect((await backend.get(`v1.0/global/${month}.json`))?.body).toContain('"global_track"');
  });

  test('second country same month allows same global skeleton (distinct computed_at on global JSON)', async () => {
    const backend = new InMemoryBackend();
    const month = '2026-08';
    const ma = await indexFor(month, 'MA', 'MAD', 10);
    const snapMa = await snapshotFor(ma, '2026-08-02T06:00:00.000Z');
    const first = await persistCountryMonth(backend, 'v1.0', month, ma, snapMa);
    expect(first.ok).toBe(true);

    const eg = await indexFor(month, 'EG', 'EGP', 30);
    const snapEg = await snapshotFor(eg, '2026-08-03T06:00:00.000Z');
    const second = await persistCountryMonth(backend, 'v1.0', month, eg, snapEg);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('expected second persist');
    expect(second.skipped).toBe(false);
  });

  test('duplicate country/month skips; manifest parses', async () => {
    const backend = new InMemoryBackend();
    const month = '2026-05';
    const r = await indexFor(month, 'MA', 'MAD', 10);
    const snap = await snapshotFor(r, '2026-05-06T06:00:00.000Z');
    await persistCountryMonth(backend, 'v1.0', month, r, snap);
    const dup = await persistCountryMonth(backend, 'v1.0', month, r, snap);
    expect(dup.ok).toBe(true);
    if (!dup.ok) throw new Error('expected ok');
    expect(dup.skipped).toBe(true);
    const m = await backend.get('v1.0/manifest.json');
    const parsed = SnapshotManifestSchema.safeParse(JSON.parse(m?.body ?? '{}'));
    expect(parsed.success).toBe(true);
  });

  test('contradictory global_track for another country rejects', async () => {
    const backend = new InMemoryBackend();
    const month = '2026-06';
    const ma = await indexFor(month, 'MA', 'MAD', 10);
    const snapMa = await snapshotFor(ma, '2026-06-02T06:00:00.000Z');
    await persistCountryMonth(backend, 'v1.0', month, ma, snapMa);

    const eg = await indexFor(month, 'EG', 'EGP', 30);
    const conflictingGt: GlobalTrack = { ...SHARED_GT, fao_fpi_cereals: 200 };
    const snapEg = await snapshotFor(eg, '2026-06-03T06:00:00.000Z', {
      global_track: conflictingGt,
    });
    const egRes = await persistCountryMonth(backend, 'v1.0', month, eg, snapEg);
    expect(egRes.ok).toBe(false);
  });
});

describe('§3.4B reader + integrity', () => {
  test('getSnapshot explicit version and getLatestMonth', async () => {
    const backend = new InMemoryBackend();
    const month = '2026-07';
    const r = await indexFor(month, 'TN', 'TND', 3);
    const snap = await snapshotFor(r, '2026-07-07T06:00:00.000Z');
    await persistCountryMonth(backend, 'v1.0', month, r, snap);
    const row = await getSnapshot(backend, 'tn', month, 'v1.0');
    expect(row?.country_code).toBe('TN');
    expect(await getLatestMonth(backend, 'TN', 'v1.0')).toBe(month);
    expect(await getSnapshot(backend, 'TN', '2010-01', 'v1.0')).toBeNull();
  });

  test('verifyIntegrity + tampering', async () => {
    const backend = new InMemoryBackend();
    const month = '2026-08';
    const r = await indexFor(month, 'IN', 'INR', 80);
    const snap = await snapshotFor(r, '2026-08-01T00:00:00.000Z');
    await persistCountryMonth(backend, 'v1.0', month, r, snap);

    expect((await verifyIntegrity(backend, 'IN', month, 'v1.0')).ok).toBe(true);
    backend._unsafeSetBody(`v1.0/${r.country_code}/${month}.json`, '{"tampered":true}\n');

    expect((await verifyIntegrity(backend, 'IN', month, 'v1.0')).ok).toBe(false);
  });
});

describe('§3.4B APK bundle', () => {
  test('5 countries × 12 months gzip ≤24 KB', async () => {
    const pairs: [string, string, number][] = [
      ['MA', 'MAD', 10],
      ['EG', 'EGP', 30],
      ['IN', 'INR', 82],
      ['NG', 'NGN', 450],
      ['KE', 'KES', 130],
    ];
    const byCountryMonths: Record<string, IndexRecord[]> = {};
    const ym = [...Array.from({ length: 12 })].map(
      (_, i) => `2026-${String(i + 1).padStart(2, '0')}`,
    );

    for (const [cc, cur, fx] of pairs) {
      const acc: IndexRecord[] = [];
      for (const m of ym) {
        acc.push(await indexFor(m, cc, cur, fx));
      }
      byCountryMonths[cc] = acc;
    }

    const built = buildOfflineApkBundle({
      methodology_version: '1.0.0',
      generated_at_iso: '2026-09-01T00:00:00.000Z',
      byCountryMonths,
    });
    expect(built.gzipBytes).toBeLessThanOrEqual(APK_BUNDLE_GZIP_BUDGET_BYTES);
    expect(built.warnings.length).toBe(0);

    expect(gzipSizeJson(built.bundle)).toBeLessThanOrEqual(APK_BUNDLE_GZIP_BUDGET_BYTES);

    const backend = new InMemoryBackend();
    await persistApkBundle(backend, built.bundle);
    expect((await backend.get('bundle/karama-kki-bundle.json'))?.body).toContain(
      'methodology_version',
    );
  }, 120_000);
});
