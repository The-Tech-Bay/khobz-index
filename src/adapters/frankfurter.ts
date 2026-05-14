/**
 * Frankfurter (multi-provider FX) — display-only rates (stack.md §3.7).
 *
 * Upstream v2 contract (2025+): `GET /v2/rates?base=USD&date=YYYY-MM-DD` returns a JSON **array**
 * of `{ date, base, quote, rate }`. Legacy `{ base, date, rates: {…} }` envelopes are still parsed
 * for fixtures / older mirrors.
 */

import type { AdapterResult, FetchParams, PriceRecord, SourceAdapter } from '../shared/schema.js';
import { PriceRecordSchema } from '../shared/schema.js';
import { adapterErr, fetchWithTimeout, hashRecords, mkMeta } from './utils.js';

const SOURCE_ID = 'frankfurter' as const;

type FrankfurterLegacyEnvelope = {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
};

type FrankfurterV2Row = {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
};

export type FrankfurterAdapterOptions = {
  fetchImpl?: typeof fetch;
  /** Overrides automatic `/v2/rates` builder (fixtures / mocks). */
  latestUrl?: string;
  /** ISO 4217 base (default USD) */
  base?: string;
};

function parseLegacyEnvelope(
  env: FrankfurterLegacyEnvelope,
  fallbackBase: string,
  fetchedAt: string,
): PriceRecord[] {
  const b = env.base ?? fallbackBase;
  const rates = env.rates ?? {};
  const isoDay = env.date ?? '1970-01-01';
  const month = isoDay.slice(0, 7);
  const records: PriceRecord[] = [];
  for (const [ccy, rate] of Object.entries(rates)) {
    if (ccy === b) continue;
    const rec = PriceRecordSchema.safeParse({
      commodity: `fx_${b}_${ccy}`,
      price_usd: rate,
      price_unit: `${ccy}_per_${b}`,
      date: month,
      source_id: SOURCE_ID,
      fetched_at: fetchedAt,
    });
    if (rec.success) records.push(rec.data);
  }
  return records;
}

function parseV2Rows(
  rows: FrankfurterV2Row[],
  fallbackBase: string,
  fetchedAt: string,
): PriceRecord[] {
  const records: PriceRecord[] = [];
  const headerYm = rows[0]?.date?.slice(0, 7);
  const monthYm = headerYm && /^\d{4}-\d{2}$/.test(headerYm) ? headerYm : '1970-01';

  for (const row of rows) {
    const b = row.base ?? fallbackBase;
    const q = row.quote;
    const rate = row.rate;
    if (!q || q === b) continue;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) continue;
    const ym = row.date?.slice(0, 7) ?? monthYm;
    const rec = PriceRecordSchema.safeParse({
      commodity: `fx_${b}_${q}`,
      price_usd: rate,
      price_unit: `${q}_per_${b}`,
      date: ym,
      source_id: SOURCE_ID,
      fetched_at: fetchedAt,
    });
    if (rec.success) records.push(rec.data);
  }
  return records;
}

export function createFrankfurterAdapter(opts: FrankfurterAdapterOptions = {}): SourceAdapter {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const base = opts.base ?? 'USD';

  /** YYYY-MM-DD for Frankfurter `date=` query parameter. */
  function pickDateParam(targetOrMonth: string): string {
    const t = targetOrMonth.trim();
    let baseDay: Date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const [y0, mo0, d0] = t.split('-').map(Number);
      baseDay = new Date(Date.UTC(y0!, mo0! - 1, d0!));
    } else if (/^\d{4}-\d{2}$/.test(t.slice(0, 7))) {
      const ym = t.slice(0, 7);
      const [y1, mo1] = ym.split('-').map(Number);
      baseDay = new Date(Date.UTC(y1!, mo1! - 1, 15));
    } else {
      const [y2, mo2, d2] = t.slice(0, 10).split('-').map(Number);
      baseDay = new Date(Date.UTC(y2!, mo2! - 1, d2!));
    }

    /** Spot rates update on business days — weekend ISO dates often 404. */
    const d = new Date(baseDay.getTime());
    let guard = 0;
    while (guard++ < 8) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) break;
      d.setUTCDate(d.getUTCDate() - 1);
    }
    const ys = d.getUTCFullYear();
    const ms = String(d.getUTCMonth() + 1).padStart(2, '0');
    const ds = String(d.getUTCDate()).padStart(2, '0');
    return `${ys}-${ms}-${ds}`;
  }

  function buildUrl(params: FetchParams): string {
    if (opts.latestUrl) return opts.latestUrl;
    const preset = process.env.FRANKFURTER_URL ?? '';
    if (preset) return preset;
    const fixingDay = pickDateParam(params.target_date);
    const u = new URL('https://api.frankfurter.dev/v2/rates');
    u.searchParams.set('base', base);
    u.searchParams.set('date', fixingDay);
    return u.toString();
  }

  return {
    id: SOURCE_ID,
    tier: 3,
    name: 'Frankfurter',
    covers: ['fx_display'],
    native_cadence: 'daily',
    async fetch(params: FetchParams): Promise<AdapterResult> {
      const start = Date.now();
      const timeout_ms = params.timeout_ms ?? 30_000;
      const fetchedAt = new Date().toISOString();
      const u = buildUrl(params);

      try {
        const res = await fetchWithTimeout(fetchImpl, u, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          timeout_ms,
        });
        if (!res.ok) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'UPSTREAM_ERROR',
              message: `Frankfurter HTTP ${res.status}`,
              retryable: res.status >= 500,
              http_status: res.status,
            }),
          };
        }
        const junknown = (await res.json()) as unknown;

        let records: PriceRecord[] = [];
        if (Array.isArray(junknown)) {
          records = parseV2Rows(junknown as FrankfurterV2Row[], base, fetchedAt);
        } else if (
          typeof junknown === 'object' &&
          junknown !== null &&
          'rates' in junknown &&
          typeof (junknown as FrankfurterLegacyEnvelope).rates === 'object'
        ) {
          records = parseLegacyEnvelope(junknown as FrankfurterLegacyEnvelope, base, fetchedAt);
        }

        if (records.length === 0) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'VALIDATION_ERROR',
              message: 'No FX rates parsed (unknown Frankfurter JSON shape)',
              retryable: false,
            }),
          };
        }

        const hash = hashRecords(records);
        if (params.previous?.content_hash === hash) {
          return {
            ok: true,
            changed: false,
            state: { ...params.previous, content_hash: hash, fetched_at: fetchedAt, records },
            metadata: mkMeta(SOURCE_ID, 3, records.length, params.target_date, Date.now() - start),
          };
        }
        return {
          ok: true,
          changed: true,
          records,
          metadata: mkMeta(SOURCE_ID, 3, records.length, params.target_date, Date.now() - start),
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
