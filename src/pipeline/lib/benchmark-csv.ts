/**
 * Loads bundled gold/brent + optional FAO FPI sub-indices (2020+) for pipeline backfill fallback.
 */

import { readFileSync } from 'node:fs';

export type MonthBenchmarkRow = {
  readonly month: string;
  readonly gold_xau_usd: number;
  readonly brent_crude_usd: number;
  /** Nominal FAO FPI cereals sub-index (2014–2016 = 100), from bundled CSV / FAO public series. */
  readonly fao_fpi_cereals?: number | undefined;
  readonly fao_fpi_oils?: number | undefined;
  readonly fao_fpi_sugar?: number | undefined;
};

/** header: month,gold_xau_usd,brent_crude_usd[,fao_fpi_cereals,fao_fpi_oils,fao_fpi_sugar] */
export function loadMonthlyBenchmarkCsv(filePath: string): Map<string, MonthBenchmarkRow> {
  const text = readFileSync(filePath, 'utf8');
  const lines = text.trim().split(/\r?\n/);
  const map = new Map<string, MonthBenchmarkRow>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const parts = line.split(',');
    const month = parts[0];
    if (!month) continue;
    const gold_xau_usd = Number(parts[1]);
    const brent_crude_usd = Number(parts[2]);
    if (!Number.isFinite(gold_xau_usd) || !Number.isFinite(brent_crude_usd)) continue;

    let fao_fpi_cereals: number | undefined;
    let fao_fpi_oils: number | undefined;
    let fao_fpi_sugar: number | undefined;
    if (parts.length >= 6) {
      const c = Number(parts[3]);
      const o = Number(parts[4]);
      const s = Number(parts[5]);
      if (Number.isFinite(c) && c > 0) fao_fpi_cereals = c;
      if (Number.isFinite(o) && o > 0) fao_fpi_oils = o;
      if (Number.isFinite(s) && s > 0) fao_fpi_sugar = s;
    }

    map.set(month, {
      month,
      gold_xau_usd,
      brent_crude_usd,
      fao_fpi_cereals,
      fao_fpi_oils,
      fao_fpi_sugar,
    });
  }
  return map;
}
