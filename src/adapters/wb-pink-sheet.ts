/**
 * World Bank Pink Sheet — Indicators API v2 + CSV fallback (stack.md §3.4).
 */
import type { AdapterResult, FetchParams, PriceRecord, SourceAdapter } from '../shared/schema.js';
import { PriceRecordSchema } from '../shared/schema.js';
import { adapterErr, fetchWithTimeout, hashRecords, mkMeta } from './utils.js';

const SOURCE_ID = 'wb-pink-sheet' as const;

type WbRow = {
  indicator?: { id?: string; value?: string };
  date?: string;
  value?: number | string | null;
};

/** Map indicator id → normalized commodity key */
const INDICATOR_KEY: Record<string, string> = {
  CRUDE_PETRO: 'brent_crude_usd',
  CRUDE_BRENT: 'brent_crude_usd',
  MAIZE: 'maize_world_usd_mt',
  RICE_INDICA: 'rice_indica_usd_mt',
  SUGAR_ISO: 'sugar_world_usd_kg',
};

function wbPeriodToMonth(period: string | undefined): string {
  if (!period) return '';
  if (/^\d{4}M\d{2}$/.test(period)) {
    const parts = period.split('M');
    const y = parts[0];
    const mm = parts[1];
    if (!y || !mm) return period.slice(0, 7);
    return `${y}-${mm.padStart(2, '0')}`;
  }
  return period.slice(0, 7);
}

const DEFAULT_INDICATORS = ['CRUDE_PETRO', 'MAIZE', 'RICE_INDICA'];

export type WbPinkSheetAdapterOptions = {
  fetchImpl?: typeof fetch;
  /** e.g. https://api.worldbank.org/v2/country/WLD/indicator/CRUDE_PETRO;MAIZE?format=json&per_page=500 */
  indicatorsUrl?: string;
  csvUrl?: string;
};

function parseWbJson(text: string, fetchedAt: string): PriceRecord[] {
  const j = JSON.parse(text) as unknown[];
  if (!Array.isArray(j) || j.length < 2 || !Array.isArray(j[1])) return [];
  const obs = j[1] as WbRow[];
  const out: PriceRecord[] = [];
  for (const row of obs) {
    const id = row.indicator?.id;
    if (!id) continue;
    const key = INDICATOR_KEY[id];
    if (!key) continue;
    const v = row.value;
    const num = v === null || v === undefined ? NaN : Number(v);
    if (!Number.isFinite(num)) continue;
    const date = wbPeriodToMonth(row.date);
    if (!date) continue;
    let unit = 'wb_units';
    if (key === 'brent_crude_usd') unit = 'USD/barrel';
    else if (key.includes('mt')) unit = 'USD/mt';
    out.push({
      commodity: key,
      price_usd: num,
      price_unit: unit,
      date,
      source_id: SOURCE_ID,
      fetched_at: fetchedAt,
    });
  }
  return out;
}

function parsePinkCsv(text: string, fetchedAt: string): PriceRecord[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headLine = lines[0];
  if (!headLine) return [];
  const h = headLine.split(',').map((s) => s.trim().toLowerCase());
  const col = (name: string) => h.indexOf(name);
  const iName = col('indicator');
  const iDate = col('date');
  const iVal = col('value');
  if (iName < 0 || iDate < 0 || iVal < 0) return [];
  const out: PriceRecord[] = [];
  for (let n = 1; n < lines.length; n++) {
    const lineStr = lines[n];
    if (!lineStr) continue;
    const c = lineStr.split(',').map((s) => s.trim());
    const ind = (c[iName] ?? '').toLowerCase();
    if (ind.includes('brent')) {
      const date = (c[iDate] ?? '').slice(0, 7);
      const num = Number(c[iVal]);
      if (!Number.isFinite(num) || !date) continue;
      out.push({
        commodity: 'brent_crude_usd',
        price_usd: num,
        price_unit: 'USD/barrel',
        date,
        source_id: SOURCE_ID,
        fetched_at: fetchedAt,
      });
    }
  }
  return out;
}

export function createWbPinkSheetAdapter(opts: WbPinkSheetAdapterOptions = {}): SourceAdapter {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  function buildJsonUrl(params: FetchParams): string {
    const ind = process.env.WB_PINK_INDICATORS ?? DEFAULT_INDICATORS.join(';');
    const base = `https://api.worldbank.org/v2/country/WLD/indicator/${ind}`;
    const q = new URLSearchParams({ format: 'json', per_page: '25000' });
    if (params.wb_date_range) {
      q.set('date', params.wb_date_range);
    } else {
      q.set('MRV', '36');
    }
    return `${base}?${q}`;
  }

  return {
    id: SOURCE_ID,
    tier: 1,
    name: 'World Bank Pink Sheet (Indicators API)',
    covers: ['global_cereals_oils_sugar', 'crude_oil_energy'],
    native_cadence: 'monthly',
    async fetch(params: FetchParams): Promise<AdapterResult> {
      const start = Date.now();
      const timeout_ms = params.timeout_ms ?? 30_000;
      const fetchedAt = new Date().toISOString();
      const jsonUrl = opts.indicatorsUrl ?? process.env.WB_PINK_JSON_URL ?? buildJsonUrl(params);
      const csvUrl = opts.csvUrl ?? process.env.WB_PINK_CSV_URL ?? '';

      const validate = (raw: PriceRecord[]): AdapterResult => {
        const valid: PriceRecord[] = [];
        for (const r of raw) {
          const p = PriceRecordSchema.safeParse(r);
          if (p.success) valid.push(p.data);
        }
        if (valid.length === 0) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'VALIDATION_ERROR',
              message: 'No valid WB Pink Sheet records',
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
      };

      try {
        const res = await fetchWithTimeout(fetchImpl, jsonUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          timeout_ms,
        });

        let jsonRecords: PriceRecord[] = [];
        if (res.ok) {
          jsonRecords = parseWbJson(await res.text(), fetchedAt);
        } else if (!csvUrl) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'UPSTREAM_ERROR',
              message: `WB Pink Sheet HTTP ${res.status}`,
              retryable: res.status >= 500,
              http_status: res.status,
            }),
          };
        }

        if (jsonRecords.length > 0) {
          const vr = validate(jsonRecords);
          return vr;
        }

        if (csvUrl) {
          const csvRes = await fetchWithTimeout(fetchImpl, csvUrl, { method: 'GET', timeout_ms });
          if (csvRes.ok) {
            const csvText = await csvRes.text();
            return validate(parsePinkCsv(csvText, fetchedAt));
          }
        }

        return {
          ok: false,
          error: adapterErr(SOURCE_ID, {
            code: 'UPSTREAM_ERROR',
            message: `WB Pink Sheet: no usable JSON or CSV (${res.status})`,
            retryable: true,
            http_status: res.ok ? undefined : res.status,
          }),
        };
      } catch (e) {
        if (csvUrl) {
          try {
            const csvRes = await fetchWithTimeout(fetchImpl, csvUrl, { method: 'GET', timeout_ms });
            if (csvRes.ok) {
              const csvText = await csvRes.text();
              return validate(parsePinkCsv(csvText, fetchedAt));
            }
          } catch {
            /* fall through */
          }
        }
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
