/**
 * Snapshot serialization (data-schema.md §5.3–§5.5, architecture.md §3.1 keys).
 */

import type { CountrySnapshot, GlobalTrack, IndexRecord } from '../shared/schema.js';

/** File envelope persisted at `vM.m/CC/YYYY-MM.json` — data-schema.md §5.3. */
export interface CountryMonthEnvelopeJson {
  schema_version: '1.0';
  index_record: IndexRecord;
  snapshot: {
    snapshot_date: string;
    prices: CountrySnapshot['prices'];
    global_track: CountrySnapshot['global_track'];
    fetch_timestamp: string;
    quality_flags: CountrySnapshot['quality_flags'];
    content_hash: string;
  };
}

export const CSV_HEADER =
  'country_code,month,kki_value,kki_value_usd,currency,alpha,local_basket_cost,global_basket_cost,basket_version,methodology_version,formula_version,correction_type,computed_at,quality,estimate_method,estimate_confidence,source_periodicity,base_month,estimate_source_ids,fao_fpi_cereals,fao_fpi_oils,fao_fpi_sugar,brent_crude_usd,gold_xau_usd,record_hash\n';

/** Serialize one CSV row matching data-schema.md §5.4. */
export function serializeIndexCsvRow(record: IndexRecord, globalTrack: GlobalTrack): string {
  const cells = [
    record.country_code,
    record.month,
    csvNum(record.kki_value),
    csvNum(record.kki_value_usd),
    record.currency,
    csvNum(record.alpha),
    csvNum(record.local_basket_cost),
    csvNum(record.global_basket_cost),
    record.basket_version,
    record.methodology_version,
    record.formula_version ?? '',
    record.correction_type ?? '',
    record.computed_at,
    record.quality,
    record.estimate_method,
    record.estimate_confidence,
    record.source_periodicity,
    record.base_month ?? '',
    record.estimate_source_ids.join('|'),
    csvNumNullable(globalTrack.fao_fpi_cereals),
    csvNumNullable(globalTrack.fao_fpi_oils),
    csvNumNullable(globalTrack.fao_fpi_sugar),
    csvNumNullable(globalTrack.brent_crude_usd),
    csvNumNullable(globalTrack.gold_xau_usd),
    record.record_hash,
  ];
  return `${cells.map(escapeCsvCell).join(',')}\n`;
}

function csvNum(n: number): string {
  return escapeCsvCell(Number.isFinite(n) ? Number(n.toFixed(6)).toString() : String(n));
}

function csvNumNullable(n: number | null): string {
  if (n === null || n === undefined) return '';
  return csvNum(n);
}

export function escapeCsvCell(cell: string): string {
  if (/[\r\n",]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

export function buildCountryMonthEnvelope(
  record: IndexRecord,
  snapshot: CountrySnapshot,
): CountryMonthEnvelopeJson {
  const { country_code: _cc, basket_version: _bv, ...embed } = snapshot;
  void _cc;
  void _bv;
  return {
    schema_version: '1.0',
    index_record: record,
    snapshot: {
      snapshot_date: embed.snapshot_date,
      prices: embed.prices,
      global_track: embed.global_track,
      fetch_timestamp: embed.fetch_timestamp,
      quality_flags: embed.quality_flags,
      content_hash: embed.content_hash,
    },
  };
}

export interface GlobalTrackFileJson {
  schema_version: '1.0';
  month: string;
  methodology_version: string;
  global_track: GlobalTrack;
  computed_at: string;
  content_hash: string;
}

/**
 * Canonical global-track file body hash excludes `computed_at` + `content_hash`
 * so the fingerprint is stable across re-runs while fields may shift.
 */
export async function canonicalGlobalTrackFileHash(
  month: string,
  methodologyVersion: string,
  gt: GlobalTrack,
): Promise<string> {
  const { computeSha256Hex } = await import('./integrity.js');
  const skeleton = JSON.stringify({
    schema_version: '1.0',
    month,
    methodology_version: methodologyVersion,
    global_track: gt,
  });
  return computeSha256Hex(skeleton);
}

export function buildGlobalTrackFileJson(
  month: string,
  methodologyVersion: string,
  globalTrack: GlobalTrack,
  computedAt: string,
  contentHash: string,
): GlobalTrackFileJson {
  return {
    schema_version: '1.0',
    month,
    methodology_version: methodologyVersion,
    global_track: globalTrack,
    computed_at: computedAt,
    content_hash: contentHash,
  };
}

export function formatCountryBodies(
  envelope: CountryMonthEnvelopeJson,
  globalTrackForCsv: GlobalTrack,
): { jsonPretty: string; csvLine: string } {
  const jsonPretty = `${JSON.stringify(envelope, null, 2)}\n`;
  const csvLine = serializeIndexCsvRow(envelope.index_record, globalTrackForCsv);
  return { jsonPretty, csvLine };
}
