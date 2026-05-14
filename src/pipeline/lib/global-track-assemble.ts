/**
 * Builds `GlobalTrack` for a pipeline month from adapter records + bundled benchmark CSV.
 */

import type { GlobalTrack, PriceRecord } from '../../shared/schema.js';
import type { MonthBenchmarkRow } from './benchmark-csv.js';

function latestForMonth(
  records: readonly PriceRecord[],
  commodity: string,
  month: string,
): number | null {
  const ym = month.slice(0, 7);
  const hits = records.filter((r) => r.commodity === commodity && r.date.slice(0, 7) === ym);
  if (hits.length === 0) return null;
  const last = hits[hits.length - 1];
  return last !== undefined ? last.price_usd : null;
}

function uniqueSourceIds(
  extra: readonly string[],
  ...lists: readonly (readonly PriceRecord[])[]
): string[] {
  const s = new Set<string>();
  for (const id of extra) s.add(id);
  for (const list of lists) {
    for (const r of list) {
      if (typeof r.source_id === 'string' && r.source_id.length > 0) s.add(r.source_id);
    }
  }
  return [...s];
}

export function assembleGlobalTrackForMonth(args: {
  month: string;
  globalCerealRecords: readonly PriceRecord[];
  crudeSlotRecords: readonly PriceRecord[];
  goldSlotRecords: readonly PriceRecord[];
  benchmark?: MonthBenchmarkRow | null;
}): GlobalTrack {
  let cereals = latestForMonth(args.globalCerealRecords, 'fao_fpi_cereals', args.month);
  let oils = latestForMonth(args.globalCerealRecords, 'fao_fpi_oils', args.month);
  let sugar = latestForMonth(args.globalCerealRecords, 'fao_fpi_sugar', args.month);
  let brent = latestForMonth(args.crudeSlotRecords, 'brent_crude_usd', args.month);
  let gold = latestForMonth(args.goldSlotRecords, 'gold_xau_usd', args.month);

  const bm = args.benchmark;
  let benchmarkTouched = false;

  if ((cereals == null || cereals <= 0) && bm?.fao_fpi_cereals != null && bm.fao_fpi_cereals > 0) {
    cereals = bm.fao_fpi_cereals;
    benchmarkTouched = true;
  }
  if ((oils == null || oils <= 0) && bm?.fao_fpi_oils != null && bm.fao_fpi_oils > 0) {
    oils = bm.fao_fpi_oils;
    benchmarkTouched = true;
  }
  if ((sugar == null || sugar <= 0) && bm?.fao_fpi_sugar != null && bm.fao_fpi_sugar > 0) {
    sugar = bm.fao_fpi_sugar;
    benchmarkTouched = true;
  }

  if ((!brent || brent <= 0) && bm?.brent_crude_usd != null && bm.brent_crude_usd > 0) {
    brent = bm.brent_crude_usd;
    benchmarkTouched = true;
  }
  if ((!gold || gold <= 0) && bm?.gold_xau_usd != null && bm.gold_xau_usd > 0) {
    gold = bm.gold_xau_usd;
    benchmarkTouched = true;
  }

  const source_ids = uniqueSourceIds(
    [],
    args.globalCerealRecords,
    args.crudeSlotRecords,
    args.goldSlotRecords,
  );

  if (bm != null && benchmarkTouched) {
    source_ids.push('benchmark-csv(fpi,gold,brent)');
  }

  return {
    fao_fpi_cereals: cereals,
    fao_fpi_oils: oils,
    fao_fpi_sugar: sugar,
    brent_crude_usd: brent,
    gold_xau_usd: gold,
    source_ids: [...new Set(source_ids)],
  };
}
