/**
 * Shared helpers for source adapters (stack.md §2.2).
 */
import { createHash } from 'node:crypto';
import type {
  AdapterError,
  FetchMetadata,
  PriceRecord,
  SourceId,
  SourceTier,
} from '../shared/schema.js';

export function stableRecordsJson(records: PriceRecord[]): string {
  const sorted = [...records].sort((a, b) => a.commodity.localeCompare(b.commodity));
  return JSON.stringify(sorted);
}

export function hashRecords(records: PriceRecord[]): string {
  return createHash('sha256').update(stableRecordsJson(records), 'utf8').digest('hex');
}

export function mkMeta(
  source_id: SourceId,
  tier: SourceTier,
  record_count: number,
  target_date: string,
  ms: number,
  cache_hit = false,
): FetchMetadata {
  return {
    source_id,
    tier,
    response_time_ms: ms,
    record_count,
    date_range: { from: target_date.slice(0, 10), to: target_date.slice(0, 10) },
    cache_hit,
  };
}

export function adapterErr(
  source_id: SourceId,
  partial: Omit<AdapterError, 'source_id' | 'timestamp'> & { timestamp?: string },
): AdapterError {
  return {
    source_id,
    timestamp: partial.timestamp ?? new Date().toISOString(),
    code: partial.code,
    message: partial.message,
    retryable: partial.retryable,
    http_status: partial.http_status,
  };
}

/** YYYY-MM from YYYY-MM-DD or YYYY-MM */
export function monthFromTargetDate(target_date: string): string {
  const m = target_date.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(m)) {
    throw new Error(`Invalid target_date for month: ${target_date}`);
  }
  return m;
}

export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit & { timeout_ms?: number },
): Promise<Response> {
  const timeout_ms = init.timeout_ms ?? 30_000;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout_ms);
  try {
    const { timeout_ms: _tm, ...rest } = init;
    return await fetchImpl(url, { ...rest, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON body (length ${text.length})`);
  }
}

/** Map FAOSTAT item code → CPC commodity key used in PriceRecord.commodity */
export const FAOSTAT_ITEM_TO_CPC: Readonly<Record<string, string>> = {
  '16': '23112',
  '31': '23161',
  '58': '23120',
  '186': '01342',
  '191': '01341',
  '176': '01310',
  '2543': '23511',
  '268': '21531',
  '257': '21491',
  '236': '21521',
  '2571': '2153',
  '125': '01520',
  '1579': '04120',
  '2905': '23413',
  '882': '02211',
  '1062': '02310',
};
