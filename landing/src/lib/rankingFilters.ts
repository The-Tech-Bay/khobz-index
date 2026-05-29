import type { CountryData } from '../types';
import { getLocalCoverage } from './localCoverage';

export type RankingFilterMode = 'local_only' | 'include_partial' | 'include_global';

export interface MapRecord {
  code: string;
  name: string;
  currency: string;
  kki_value: number;
  kki_value_usd: number;
  quality: string;
}

export interface RankingSplit {
  primary: MapRecord[];
  fallback: MapRecord[];
}

export function splitRankingRecords(
  records: Record<string, MapRecord>,
  mode: RankingFilterMode,
  countries: Record<string, CountryData>,
): RankingSplit {
  const all = Object.values(records);
  if (mode === 'include_global') {
    return { primary: sortByUsd(all), fallback: [] };
  }

  const primary: MapRecord[] = [];
  const fallback: MapRecord[] = [];

  for (const record of all) {
    const country = countries[record.code];
    const coverage = country ? getLocalCoverage(country) : null;

    if (record.quality === 'global_only') {
      if (mode === 'include_partial' && coverage && coverage.items_priced > 0) {
        primary.push(record);
      } else {
        fallback.push(record);
      }
      continue;
    }

    if (record.quality === 'full' || record.quality === 'degraded') {
      primary.push(record);
    } else {
      fallback.push(record);
    }
  }

  return { primary: sortByUsd(primary), fallback: sortByUsd(fallback) };
}

export function sortByUsd(records: MapRecord[]): MapRecord[] {
  return [...records].sort((a, b) => a.kki_value_usd - b.kki_value_usd);
}

/** Records used for map color-scale domain (excludes global-only fallback). */
export function recordsForColorScale(
  records: Record<string, MapRecord>,
): Record<string, MapRecord> {
  const scaled: Record<string, MapRecord> = {};
  for (const [code, record] of Object.entries(records)) {
    if (record.quality !== 'global_only') {
      scaled[code] = record;
    }
  }
  return scaled;
}

export function rankingFilterLabel(mode: RankingFilterMode): string {
  if (mode === 'local_only') return 'Local basket only';
  if (mode === 'include_partial') return 'Include partial local';
  return 'Include global fallback';
}
