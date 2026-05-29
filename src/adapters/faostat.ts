/**
 * FAOSTAT consumer prices (domain CP) — country-level staples (stack.md §3.2).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AdapterResult, FetchParams, PriceRecord, SourceAdapter } from '../shared/schema.js';
import { PriceRecordSchema } from '../shared/schema.js';
import { adapterErr, FAOSTAT_ITEM_TO_CPC, fetchWithTimeout, hashRecords, mkMeta } from './utils.js';

const SOURCE_ID = 'faostat' as const;

const BUNDLED_FAOSTAT_JSON = 'data/reference/faostat-pp-backfill.json';
const AREA_MAP_PATH = resolve(import.meta.dir, '../../data/reference/faostat-area-to-iso2.json');

/** Resolve FAOSTAT bulk JSON path: explicit env/opt, else bundled backfill when present. */
export function resolveFaostatJsonPath(optsPath?: string): string | null {
  const pathRaw = (optsPath ?? process.env.FAOSTAT_CP_JSON_PATH ?? '').trim();
  if (pathRaw) return pathRaw;
  const bundledAbs = resolve(process.cwd(), BUNDLED_FAOSTAT_JSON);
  if (existsSync(bundledAbs)) return BUNDLED_FAOSTAT_JSON;
  return null;
}

type FaostatJsonRow = {
  area_code: string;
  area?: string;
  item_code: string;
  item?: string;
  year: string;
  months: string;
  value: number;
  unit?: string;
  currency?: string;
  fill_kind?: 'observed' | 'interpolated' | 'forward_filled';
  last_observation?: string;
};

/** Lazy-loaded FAOSTAT / UN numeric area code → ISO 3166-1 alpha-2. */
let _areaMap: Record<string, string> | null = null;

function loadAreaMap(): Record<string, string> {
  if (!_areaMap) {
    const raw = readFileSync(AREA_MAP_PATH, 'utf8');
    _areaMap = JSON.parse(raw) as Record<string, string>;
  }
  return _areaMap;
}

/** Resolve FAOSTAT `area_code` (often UN M49, with a few FAOSTAT-specific exceptions). */
export function faostatAreaToIso2(areaCode: string): string | undefined {
  const k = String(Number.parseInt(String(areaCode).trim(), 10));
  if (!Number.isFinite(Number(k)) || k === 'NaN') return undefined;
  const map = loadAreaMap();
  return map[k];
}

export type FaostatAdapterOptions = {
  fetchImpl?: typeof fetch;
  /** Remote FAOSTAT CP `{ data: [...] }` bulk URL */
  jsonUrl?: string;
  /** Local bundled bulk JSON — path relative to `process.cwd()`, or absolute */
  jsonPath?: string;
};

function monthFromYearMonths(year: string, months: string): string {
  const mm = months.padStart(2, '0').slice(0, 2);
  return `${year}-${mm}`;
}

export type FaostatPriceEnvelope = { data?: FaostatJsonRow[] };

/**
 * Parse FAOSTAT CP `{ data: [...] }` envelope into validated `PriceRecord`s.
 * Used by the bulk multi-country pipeline (single HTTP fetch → many month/country parses).
 */
export function extractFaostatPriceRecordsFromEnvelope(
  envelope: FaostatPriceEnvelope,
  params: Pick<FetchParams, 'countries' | 'lcu_per_usd_by_country'> & { filter_month?: string },
  fetchedAt: string,
): PriceRecord[] {
  const j = envelope;
  if (!Array.isArray(j.data)) return [];

  const wantCountries = params.countries?.map((c) => c.toUpperCase());
  const filterYm = params.filter_month?.slice(0, 7);

  const raw: PriceRecord[] = [];
  const fxByCc = params.lcu_per_usd_by_country ?? {};

  for (const row of j.data) {
    const cpc = FAOSTAT_ITEM_TO_CPC[row.item_code];
    if (!cpc) continue;
    const iso2 = faostatAreaToIso2(row.area_code);
    if (!iso2) continue;
    if (wantCountries && !wantCountries.includes(iso2)) continue;

    const cur = (row.currency ?? 'USD').slice(0, 3).toUpperCase();
    const price_local = row.value;
    const ext = row as FaostatJsonRow & { value_usd?: number };
    let price_usd = ext.value_usd;
    if (!Number.isFinite(price_usd) || !price_usd || price_usd <= 0) {
      const lcuPerUsd = fxByCc[iso2];
      if (lcuPerUsd && lcuPerUsd > 0) {
        price_usd = price_local / lcuPerUsd;
      } else if (cur === 'USD') {
        price_usd = price_local;
      } else {
        continue;
      }
    }

    const date = monthFromYearMonths(row.year, row.months);
    if (filterYm && date.slice(0, 7) !== filterYm) continue;

    raw.push({
      commodity: `${cpc}`,
      price_usd,
      price_local,
      currency: cur,
      price_unit: row.unit ?? 'LCU',
      date,
      source_id: SOURCE_ID,
      fetched_at: fetchedAt,
      country_code: iso2,
      ...(row.fill_kind ? { fill_kind: row.fill_kind } : {}),
      ...(row.last_observation ? { last_observation_month: row.last_observation } : {}),
    });
  }

  const valid: PriceRecord[] = [];
  for (const r of raw) {
    const p = PriceRecordSchema.safeParse(r);
    if (p.success) valid.push(p.data);
  }
  return valid;
}

export function createFaostatAdapter(opts: FaostatAdapterOptions = {}): SourceAdapter {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  return {
    id: SOURCE_ID,
    tier: 1,
    name: 'FAOSTAT consumer prices',
    covers: ['local_market_prices'],
    native_cadence: 'monthly',
    async fetch(params: FetchParams): Promise<AdapterResult> {
      const start = Date.now();
      const timeout_ms = params.timeout_ms ?? 30_000;
      const fetchedAt = new Date().toISOString();

      const pathRaw = resolveFaostatJsonPath(opts.jsonPath);
      const url = (opts.jsonUrl ?? process.env.FAOSTAT_CP_JSON_URL ?? '').trim();

      let j: FaostatPriceEnvelope;

      try {
        if (pathRaw) {
          const abs = resolve(process.cwd(), pathRaw);
          if (!existsSync(abs)) {
            return {
              ok: false,
              error: adapterErr(SOURCE_ID, {
                code: 'NOT_FOUND',
                message: `FAOSTAT_CP_JSON_PATH not found: ${abs}`,
                retryable: false,
              }),
            };
          }
          try {
            j = JSON.parse(readFileSync(abs, 'utf8')) as FaostatPriceEnvelope;
          } catch (parseErr) {
            return {
              ok: false,
              error: adapterErr(SOURCE_ID, {
                code: 'PARSE_ERROR',
                message: `Cannot read FAOSTAT JSON from disk: ${String(parseErr)}`,
                retryable: false,
              }),
            };
          }
        } else if (url) {
          const res = await fetchWithTimeout(fetchImpl, url, { method: 'GET', timeout_ms });
          if (!res.ok) {
            return {
              ok: false,
              error: adapterErr(SOURCE_ID, {
                code: 'UPSTREAM_ERROR',
                message: `FAOSTAT HTTP ${res.status}`,
                retryable: res.status >= 500,
                http_status: res.status,
              }),
            };
          }
          j = (await res.json()) as FaostatPriceEnvelope;
        } else {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'NOT_FOUND',
              message: `Set FAOSTAT_CP_JSON_URL or FAOSTAT_CP_JSON_PATH, or run pipeline:prefetch to create ${BUNDLED_FAOSTAT_JSON}`,
              retryable: false,
            }),
          };
        }

        if (!Array.isArray(j.data)) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'PARSE_ERROR',
              message: 'Expected { data: array }',
              retryable: false,
            }),
          };
        }

        const valid = extractFaostatPriceRecordsFromEnvelope(j, params, fetchedAt);

        if (valid.length === 0) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'VALIDATION_ERROR',
              message: 'No FAOSTAT rows matched basket item codes / filters',
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
              ...params.previous,
              content_hash: hash,
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
      } catch (e) {
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
