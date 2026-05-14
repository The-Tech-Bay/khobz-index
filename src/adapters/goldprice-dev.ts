/**
 * Goldprice.dev — XAU spot (stack.md §3.5). Free tier: 30 rpm, 1000/mo; honor 429 + Retry-After.
 */
import type { AdapterResult, FetchParams, SourceAdapter } from '../shared/schema.js';
import { PriceRecordSchema } from '../shared/schema.js';
import { adapterErr, fetchWithTimeout, hashRecords, mkMeta } from './utils.js';

const SOURCE_ID = 'goldprice-dev' as const;

type GoldpriceResponse = {
  prices?: { gold?: number; xau?: number };
  gold?: number;
};

function extractXauUsd(j: GoldpriceResponse): number | undefined {
  if (typeof j.gold === 'number') return j.gold;
  const p = j.prices;
  if (p && typeof p.gold === 'number') return p.gold;
  if (p && typeof p.xau === 'number') return p.xau;
  return undefined;
}

export type GoldpriceDevAdapterOptions = {
  fetchImpl?: typeof fetch;
  /** Default GET https://api.goldprice.dev/v1/prices */
  pricesUrl?: string;
  apiKey?: string;
};

export function createGoldpriceDevAdapter(opts: GoldpriceDevAdapterOptions = {}): SourceAdapter {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  return {
    id: SOURCE_ID,
    tier: 3,
    name: 'Goldprice.dev',
    covers: ['gold_spot'],
    native_cadence: 'realtime',
    async fetch(params: FetchParams): Promise<AdapterResult> {
      const start = Date.now();
      const timeout_ms = params.timeout_ms ?? 30_000;
      const fetchedAt = new Date().toISOString();
      const url =
        opts.pricesUrl ?? process.env.GOLDPRICE_DEV_URL ?? 'https://api.goldprice.dev/v1/prices';
      const apiKey = opts.apiKey ?? process.env.GOLDPRICE_DEV_API_KEY ?? '';

      if (!apiKey) {
        return {
          ok: false,
          error: adapterErr(SOURCE_ID, {
            code: 'AUTH_FAILURE',
            message: 'GOLDPRICE_DEV_API_KEY not set',
            retryable: false,
          }),
        };
      }

      try {
        const res = await fetchWithTimeout(fetchImpl, url, {
          method: 'GET',
          timeout_ms,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        });

        if (res.status === 429) {
          const ra = res.headers.get('retry-after') ?? '';
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'RATE_LIMITED',
              message: `Goldprice.dev rate limited${ra ? `; retry-after: ${ra}` : ''}`,
              retryable: true,
              http_status: 429,
            }),
          };
        }

        if (!res.ok) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'UPSTREAM_ERROR',
              message: `Goldprice.dev HTTP ${res.status}`,
              retryable: res.status >= 500,
              http_status: res.status,
            }),
          };
        }

        const j = (await res.json()) as GoldpriceResponse;
        const xau = extractXauUsd(j);
        if (xau === undefined || !Number.isFinite(xau)) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'PARSE_ERROR',
              message: 'Could not parse XAU USD from Goldprice.dev response',
              retryable: false,
            }),
          };
        }

        const month = params.target_date.slice(0, 7);
        const record = PriceRecordSchema.parse({
          commodity: 'gold_xau_usd',
          price_usd: xau,
          price_unit: 'USD/troy_oz',
          date: `${month}-01`,
          source_id: SOURCE_ID,
          fetched_at: fetchedAt,
        });

        const valid = [record];
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
            metadata: mkMeta(SOURCE_ID, 3, 1, params.target_date, Date.now() - start),
          };
        }

        return {
          ok: true,
          changed: true,
          records: valid,
          metadata: mkMeta(SOURCE_ID, 3, 1, params.target_date, Date.now() - start),
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
