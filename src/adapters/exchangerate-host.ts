/**
 * exchangerate.host — FX fallback (stack.md §3.7). Response shape varies; parser supports quotes map.
 */
import type { AdapterResult, FetchParams, PriceRecord, SourceAdapter } from '../shared/schema.js';
import { PriceRecordSchema } from '../shared/schema.js';
import { adapterErr, fetchWithTimeout, hashRecords, mkMeta } from './utils.js';

const SOURCE_ID = 'exchangerate-host' as const;

type ErhBody = {
  success?: boolean;
  source?: string;
  quotes?: Record<string, number>;
};

export type ExchangeRateHostAdapterOptions = {
  fetchImpl?: typeof fetch;
  liveUrl?: string;
  apiKey?: string;
};

export function createExchangeRateHostAdapter(
  opts: ExchangeRateHostAdapterOptions = {},
): SourceAdapter {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  return {
    id: SOURCE_ID,
    tier: 3,
    name: 'exchangerate.host',
    covers: ['fx_display'],
    native_cadence: 'daily',
    async fetch(params: FetchParams): Promise<AdapterResult> {
      const start = Date.now();
      const timeout_ms = params.timeout_ms ?? 30_000;
      const fetchedAt = new Date().toISOString();
      const key = opts.apiKey ?? process.env.EXCHANGERATE_HOST_API_KEY ?? '';
      const base =
        opts.liveUrl ??
        (key
          ? `https://api.exchangerate.host/live?access_key=${encodeURIComponent(key)}`
          : (process.env.EXCHANGERATE_HOST_URL ?? ''));

      if (!base) {
        return {
          ok: false,
          error: adapterErr(SOURCE_ID, {
            code: 'AUTH_FAILURE',
            message: 'Set EXCHANGERATE_HOST_URL or EXCHANGERATE_HOST_API_KEY',
            retryable: false,
          }),
        };
      }

      try {
        const res = await fetchWithTimeout(fetchImpl, base, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          timeout_ms,
        });
        if (!res.ok) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'UPSTREAM_ERROR',
              message: `exchangerate.host HTTP ${res.status}`,
              retryable: res.status >= 500,
              http_status: res.status,
            }),
          };
        }
        const j = (await res.json()) as ErhBody;
        if (j.success === false) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'UPSTREAM_ERROR',
              message: 'exchangerate.host success:false',
              retryable: false,
            }),
          };
        }
        const quotes = j.quotes ?? {};
        const month = params.target_date.slice(0, 7);
        const records: PriceRecord[] = [];
        for (const [pair, rate] of Object.entries(quotes)) {
          const rec = PriceRecordSchema.safeParse({
            commodity: `fx_${pair}`,
            price_usd: rate,
            price_unit: 'pair_ratio',
            date: month,
            source_id: SOURCE_ID,
            fetched_at: fetchedAt,
          });
          if (rec.success) records.push(rec.data);
        }
        if (records.length === 0) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'VALIDATION_ERROR',
              message: 'No quotes parsed',
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
