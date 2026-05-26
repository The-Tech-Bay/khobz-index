import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import {
  extractFaostatPriceRecordsFromEnvelope,
  resolveFaostatJsonPath,
  type FaostatPriceEnvelope,
} from '../../adapters/faostat.js';
import { getBasketForCountry } from '../../engine/basket.js';
import type { CommodityPrice, GlobalTrack, IndexRecord } from '../../shared/schema.js';
import { loadMonthlyBenchmarkCsv } from './benchmark-csv.js';
import { priceRecordsToBasketCommodityPrices } from './commodity-prices.js';
import type { CountryMonthlyPipelineRow } from './fixture-builder.js';
import { assembleGlobalTrackForMonth } from './global-track-assemble.js';

function resolveFromRoot(root: string, pathRaw: string): string {
  return isAbsolute(pathRaw) ? pathRaw : resolve(root, pathRaw);
}

function lcuPerUsdFromRecord(record: IndexRecord): number | null {
  if (!Number.isFinite(record.kki_value) || !Number.isFinite(record.kki_value_usd)) return null;
  if (record.kki_value <= 0 || record.kki_value_usd <= 0) return null;
  return record.kki_value / record.kki_value_usd;
}

export function enrichLatestSnapshotRows(args: {
  readonly khobzRoot: string;
  readonly month: string;
  readonly rowsByCountry: ReadonlyMap<string, CountryMonthlyPipelineRow>;
  readonly methodologyVersion: string;
}): { enrichedCountries: number; faostatRows: number; globalTrack: GlobalTrack } {
  const faostatPathRaw = resolveFaostatJsonPath();
  if (!faostatPathRaw) {
    throw new Error(
      'Cannot enrich latest snapshots: FAOSTAT_CP_JSON_PATH is unset and bundled FAOSTAT file was not found.',
    );
  }

  const faostatPath = resolveFromRoot(args.khobzRoot, faostatPathRaw);
  if (!existsSync(faostatPath)) {
    throw new Error(`Cannot enrich latest snapshots: FAOSTAT file not found: ${faostatPath}`);
  }

  const faostatEnvelope = JSON.parse(readFileSync(faostatPath, 'utf8')) as FaostatPriceEnvelope;
  const lcuPerUsdByCountry: Record<string, number> = {};
  for (const [cc, row] of args.rowsByCountry) {
    const fx = lcuPerUsdFromRecord(row.record);
    if (fx !== null) lcuPerUsdByCountry[cc] = fx;
  }

  const allPriceRecords = extractFaostatPriceRecordsFromEnvelope(
    faostatEnvelope,
    {
      countries: [...args.rowsByCountry.keys()],
      filter_month: args.month,
      lcu_per_usd_by_country: lcuPerUsdByCountry,
    },
    new Date().toISOString(),
  );

  const byCountry = new Map<string, typeof allPriceRecords>();
  for (const price of allPriceRecords) {
    const cc = price.country_code?.toUpperCase();
    if (!cc) continue;
    const list = byCountry.get(cc) ?? [];
    list.push(price);
    byCountry.set(cc, list);
  }

  const benchmarks = loadMonthlyBenchmarkCsv(
    resolve(args.khobzRoot, 'data/reference/monthly-global-benchmarks.csv'),
  );
  const globalTrack = assembleGlobalTrackForMonth({
    month: args.month,
    globalCerealRecords: [],
    crudeSlotRecords: [],
    goldSlotRecords: [],
    benchmark: benchmarks.get(args.month) ?? null,
  });

  let enrichedCountries = 0;
  for (const [cc, row] of args.rowsByCountry) {
    let commodityPrices: CommodityPrice[] = [];
    try {
      const basket = getBasketForCountry(cc, args.methodologyVersion);
      commodityPrices = priceRecordsToBasketCommodityPrices(
        basket,
        byCountry.get(cc) ?? [],
        args.month,
        'faostat',
      );
    } catch {
      commodityPrices = [];
    }
    if (commodityPrices.length > 0) enrichedCountries += 1;
    row.commodityPrices = commodityPrices;
    row.schemaGlobalTrack = globalTrack;
  }

  return { enrichedCountries, faostatRows: allPriceRecords.length, globalTrack };
}
