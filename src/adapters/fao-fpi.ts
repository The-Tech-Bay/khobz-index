/**
 * FAO Food Price Index — cereals / oils / sugar sub-indices (stack.md §3.1).
 * JSON primary (SDMX-like fixture or live envelope); CSV bulk fallback.
 */
import type { AdapterResult, FetchParams, PriceRecord, SourceAdapter } from '../shared/schema.js';
import { PriceRecordSchema } from '../shared/schema.js';
import { adapterErr, fetchWithTimeout, hashRecords, mkMeta } from './utils.js';

const SOURCE_ID = 'fao-fpi' as const;

type FaoJsonRow = { series: string; time_period: string; value: number; unit?: string };

const SERIES_TO_COMMODITY: Record<string, string> = {
  FPI_Cereals: 'fao_fpi_cereals',
  FPI_Oils: 'fao_fpi_oils',
  FPI_Sugar: 'fao_fpi_sugar',
};

export type FaoFpiAdapterOptions = {
  fetchImpl?: typeof fetch;
  /** Primary JSON endpoint (FAOSTAT SDMX / FPI service). */
  jsonUrl?: string;
  /** Optional CSV bulk URL (fallback when JSON fails). */
  csvUrl?: string;
};

function parseJsonBody(text: string, fetchedAt: string): PriceRecord[] {
  const j = JSON.parse(text) as { data?: FaoJsonRow[] };
  if (!Array.isArray(j.data)) return [];
  const out: PriceRecord[] = [];
  for (const row of j.data) {
    if (!row?.series) continue;
    const commodity = SERIES_TO_COMMODITY[row.series];
    if (!commodity) continue;
    const date = row.time_period.length >= 7 ? row.time_period.slice(0, 7) : row.time_period;
    out.push({
      commodity,
      price_usd: row.value,
      price_unit: 'FPI_index',
      date,
      source_id: SOURCE_ID,
      fetched_at: fetchedAt,
    });
  }
  return out;
}

function parseCsvBody(text: string, fetchedAt: string): PriceRecord[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headerLine = lines[0];
  if (!headerLine) return [];
  const header = headerLine.split(',').map((s) => s.trim());
  const col = (n: string) => header.indexOf(n);
  const out: PriceRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(',').map((s) => s.trim());
    const si = col('series');
    const series = si >= 0 ? (cols[si] ?? '') : '';
    const commodity = SERIES_TO_COMMODITY[series];
    if (!commodity) continue;
    const tpIdx = col('time_period');
    const valIdx = col('value');
    const tp = tpIdx >= 0 ? (cols[tpIdx] ?? '') : '';
    const date = tp.length >= 7 ? tp.slice(0, 7) : tp;
    const valRaw = valIdx >= 0 ? cols[valIdx] : undefined;
    const value = Number(valRaw);
    if (!Number.isFinite(value)) continue;
    out.push({
      commodity,
      price_usd: value,
      price_unit: 'FPI_index',
      date,
      source_id: SOURCE_ID,
      fetched_at: fetchedAt,
    });
  }
  return out;
}

function validateRecords(records: PriceRecord[]): PriceRecord[] {
  const valid: PriceRecord[] = [];
  for (const r of records) {
    const p = PriceRecordSchema.safeParse(r);
    if (p.success) valid.push(p.data);
  }
  return valid;
}

export function createFaoFpiAdapter(opts: FaoFpiAdapterOptions = {}): SourceAdapter {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  return {
    id: SOURCE_ID,
    tier: 1,
    name: 'FAO Food Price Index',
    covers: ['global_cereals_oils_sugar'],
    native_cadence: 'monthly',
    async fetch(params: FetchParams): Promise<AdapterResult> {
      const start = Date.now();
      const timeout_ms = params.timeout_ms ?? 30_000;
      const fetchedAt = new Date().toISOString();
      const jsonUrl = opts.jsonUrl ?? process.env.FAO_FPI_JSON_URL ?? '';
      const csvUrl = opts.csvUrl ?? process.env.FAO_FPI_CSV_URL ?? '';

      async function finishFromText(
        text: string,
        kind: 'json' | 'csv',
        etag?: string,
        lastModified?: string,
      ): Promise<AdapterResult> {
        let raw: PriceRecord[];
        try {
          raw = kind === 'json' ? parseJsonBody(text, fetchedAt) : parseCsvBody(text, fetchedAt);
        } catch (e) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'PARSE_ERROR',
              message: String(e),
              retryable: false,
            }),
          };
        }
        const valid = validateRecords(raw);
        if (valid.length === 0) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'VALIDATION_ERROR',
              message: 'No valid FPI records after parse',
              retryable: false,
            }),
          };
        }
        const hash = hashRecords(valid);
        if (params.previous?.content_hash === hash) {
          return {
            ok: true,
            changed: false,
            state: {
              content_hash: hash,
              etag: etag ?? params.previous.etag,
              last_modified: lastModified ?? params.previous.last_modified,
              fetched_at: fetchedAt,
              records: valid,
            },
            metadata: mkMeta(SOURCE_ID, 1, valid.length, params.target_date, Date.now() - start),
          };
        }
        return {
          ok: true,
          changed: true,
          records: valid,
          metadata: mkMeta(SOURCE_ID, 1, valid.length, params.target_date, Date.now() - start),
        };
      }

      const tryCsv = async (): Promise<AdapterResult | null> => {
        if (!csvUrl) return null;
        try {
          const csvRes = await fetchWithTimeout(fetchImpl, csvUrl, { method: 'GET', timeout_ms });
          if (!csvRes.ok) {
            return {
              ok: false,
              error: adapterErr(SOURCE_ID, {
                code: 'UPSTREAM_ERROR',
                message: `FAO FPI CSV fallback HTTP ${csvRes.status}`,
                retryable: csvRes.status >= 500,
                http_status: csvRes.status,
              }),
            };
          }
          const text = await csvRes.text();
          return finishFromText(text, 'csv');
        } catch (e) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'NETWORK_ERROR',
              message: `CSV fallback: ${String(e)}`,
              retryable: true,
            }),
          };
        }
      };

      if (!jsonUrl) {
        const csvOnly = await tryCsv();
        if (csvOnly) return csvOnly;
        return {
          ok: false,
          error: adapterErr(SOURCE_ID, {
            code: 'NOT_FOUND',
            message: 'Set FAO_FPI_JSON_URL or FAO_FPI_CSV_URL (or pass jsonUrl/csvUrl)',
            retryable: false,
          }),
        };
      }

      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (params.previous?.etag) headers['If-None-Match'] = params.previous.etag;
        if (params.previous?.last_modified)
          headers['If-Modified-Since'] = params.previous.last_modified;

        const res = await fetchWithTimeout(fetchImpl, jsonUrl, {
          method: 'GET',
          headers,
          timeout_ms,
        });
        const etag = res.headers.get('etag') ?? undefined;
        const lastModified = res.headers.get('last-modified') ?? undefined;

        if (res.status === 304 && params.previous) {
          return {
            ok: true,
            changed: false,
            state: {
              ...params.previous,
              etag: etag ?? params.previous.etag,
              fetched_at: fetchedAt,
            },
            metadata: mkMeta(
              SOURCE_ID,
              1,
              params.previous.records.length,
              params.target_date,
              Date.now() - start,
              true,
            ),
          };
        }

        if (!res.ok) {
          const fb = await tryCsv();
          if (fb) return fb;
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'UPSTREAM_ERROR',
              message: `FAO FPI HTTP ${res.status}`,
              retryable: res.status >= 500 || res.status === 429,
              http_status: res.status,
            }),
          };
        }

        const text = await res.text();
        const kind = text.trimStart().startsWith('{') ? 'json' : 'csv';
        return finishFromText(text, kind, etag, lastModified);
      } catch (e) {
        const fb = await tryCsv();
        if (fb) return fb;
        return {
          ok: false,
          error: adapterErr(SOURCE_ID, {
            code: 'NETWORK_ERROR',
            message: String(e),
            retryable: true,
          }),
        };
      }
    },
  };
}
