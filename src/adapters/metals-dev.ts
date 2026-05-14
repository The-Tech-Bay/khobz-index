/**
 * Metals.dev — gold spot + LBMA AM/PM (stack.md §3.6). API key: query or header per provider.
 */
import type { AdapterResult, FetchParams, PriceRecord, SourceAdapter } from '../shared/schema.js';
import { PriceRecordSchema } from '../shared/schema.js';
import { adapterErr, fetchWithTimeout, hashRecords, mkMeta } from './utils.js';

const SOURCE_ID = 'metals-dev' as const;

type MetalsBody = {
  date?: string;
  metals?: {
    gold?: number;
    lbma_gold_am?: number;
    lbma_gold_pm?: number;
  };
};

export type MetalsDevAdapterOptions = {
  fetchImpl?: typeof fetch;
  /** Full URL (defaults to latest). Include `?api_key=` if your key is query-based only. */
  url?: string;
  apiKey?: string;
};

function buildUrl(base: string, apiKey: string): string {
  try {
    const u = new URL(base);
    if (!u.searchParams.has('api_key')) u.searchParams.set('api_key', apiKey);
    return u.toString();
  } catch {
    return `${base}${base.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(apiKey)}`;
  }
}

export function createMetalsDevAdapter(opts: MetalsDevAdapterOptions = {}): SourceAdapter {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  return {
    id: SOURCE_ID,
    tier: 3,
    name: 'Metals.dev',
    covers: ['gold_spot'],
    native_cadence: 'realtime',
    async fetch(params: FetchParams): Promise<AdapterResult> {
      const start = Date.now();
      const timeout_ms = params.timeout_ms ?? 30_000;
      const fetchedAt = new Date().toISOString();
      const apiKey = opts.apiKey ?? process.env.METALS_DEV_API_KEY ?? '';
      const base = opts.url ?? process.env.METALS_DEV_URL ?? 'https://api.metals.dev/v1/latest';

      if (!apiKey) {
        return {
          ok: false,
          error: adapterErr(SOURCE_ID, {
            code: 'AUTH_FAILURE',
            message: 'METALS_DEV_API_KEY not set',
            retryable: false,
          }),
        };
      }

      const url = buildUrl(base, apiKey);

      try {
        const res = await fetchWithTimeout(fetchImpl, url, {
          method: 'GET',
          timeout_ms,
          headers: {
            Accept: 'application/json',
            'x-access-token': apiKey,
          },
        });

        if (res.status === 429) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'RATE_LIMITED',
              message: 'Metals.dev rate limited',
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
              message: `Metals.dev HTTP ${res.status}`,
              retryable: res.status >= 500,
              http_status: res.status,
            }),
          };
        }

        const j = (await res.json()) as MetalsBody;
        const m = j.metals ?? {};
        const month = params.target_date.slice(0, 7);

        const records: PriceRecord[] = [];
        const add = (commodity: string, v?: number) => {
          if (v === undefined || !Number.isFinite(v)) return;
          const p = PriceRecordSchema.safeParse({
            commodity,
            price_usd: v,
            price_unit: 'USD/troy_oz',
            date: month,
            source_id: SOURCE_ID,
            fetched_at: fetchedAt,
          });
          if (p.success) records.push(p.data);
        };

        add('gold_xau_usd', m.gold);
        add('gold_lbma_am_usd', m.lbma_gold_am);
        add('gold_lbma_pm_usd', m.lbma_gold_pm);

        if (records.length === 0) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'VALIDATION_ERROR',
              message: 'No Metals.dev gold prices parsed',
              retryable: false,
            }),
          };
        }

        const hash = hashRecords(records);
        if (params.previous?.content_hash === hash) {
          return {
            ok: true,
            changed: false,
            state: {
              ...params.previous,
              content_hash: hash,
              fetched_at: fetchedAt,
              records,
            },
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
