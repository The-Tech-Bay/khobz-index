/**
 * EIA STEO — Brent / energy series fallback (stack.md §3.7).
 * Uses v2 API: https://api.eia.gov/v2/ — STEO table (facets vary; parser accepts fixture envelope).
 */
import type { AdapterResult, FetchParams, PriceRecord, SourceAdapter } from '../shared/schema.js';
import { PriceRecordSchema } from '../shared/schema.js';
import { adapterErr, fetchWithTimeout, hashRecords, mkMeta } from './utils.js';

const SOURCE_ID = 'eia-steo' as const;

type EiaRow = { period?: string; value?: string; 'series-description'?: string; product?: string };

type EiaResponse = {
  response?: {
    data?: EiaRow[];
  };
};

export type EiaSteoAdapterOptions = {
  fetchImpl?: typeof fetch;
  dataUrl?: string;
  apiKey?: string;
};

export function createEiaSteoAdapter(opts: EiaSteoAdapterOptions = {}): SourceAdapter {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  return {
    id: SOURCE_ID,
    tier: 1,
    name: 'EIA STEO',
    covers: ['crude_oil_energy'],
    native_cadence: 'monthly',
    async fetch(params: FetchParams): Promise<AdapterResult> {
      const start = Date.now();
      const timeout_ms = params.timeout_ms ?? 30_000;
      const fetchedAt = new Date().toISOString();
      const apiKey = opts.apiKey ?? process.env.EIA_API_KEY ?? '';
      const url =
        opts.dataUrl ??
        (apiKey
          ? `https://api.eia.gov/v2/steo/data/?api_key=${encodeURIComponent(apiKey)}&frequency=monthly&data[0]=value&facets[series][]=RBC&sort[0][column]=period&sort[0][direction]=desc&length=5`
          : '');

      if (!url) {
        return {
          ok: false,
          error: adapterErr(SOURCE_ID, {
            code: 'AUTH_FAILURE',
            message: 'Set EIA_API_KEY or pass dataUrl',
            retryable: false,
          }),
        };
      }

      try {
        const res = await fetchWithTimeout(fetchImpl, url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          timeout_ms,
        });
        if (!res.ok) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'UPSTREAM_ERROR',
              message: `EIA HTTP ${res.status}`,
              retryable: res.status >= 500,
              http_status: res.status,
            }),
          };
        }
        const j = (await res.json()) as EiaResponse;
        const rows = j.response?.data ?? [];
        const candidates: PriceRecord[] = [];
        for (const row of rows) {
          const v = Number(row.value);
          if (!Number.isFinite(v)) continue;
          const per = row.period ?? '';
          const date = per.length >= 7 ? per.slice(0, 7) : params.target_date.slice(0, 7);
          const p = PriceRecordSchema.safeParse({
            commodity: 'brent_crude_usd',
            price_usd: v,
            price_unit: 'USD/barrel',
            date,
            source_id: SOURCE_ID,
            fetched_at: fetchedAt,
          });
          if (p.success) candidates.push(p.data);
        }
        if (candidates.length === 0) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'VALIDATION_ERROR',
              message: 'No EIA STEO rows parsed',
              retryable: false,
            }),
          };
        }
        const sorted = [...candidates].sort((a, b) => b.date.localeCompare(a.date));
        const best = sorted[0];
        if (!best) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'VALIDATION_ERROR',
              message: 'No EIA STEO rows parsed',
              retryable: false,
            }),
          };
        }
        const single = [best];
        const hash = hashRecords(single);
        if (params.previous?.content_hash === hash) {
          return {
            ok: true,
            changed: false,
            state: {
              ...params.previous,
              content_hash: hash,
              fetched_at: fetchedAt,
              records: single,
            },
            metadata: mkMeta(SOURCE_ID, 1, 1, params.target_date, Date.now() - start),
          };
        }
        return {
          ok: true,
          changed: true,
          records: single,
          metadata: mkMeta(SOURCE_ID, 1, 1, params.target_date, Date.now() - start),
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
