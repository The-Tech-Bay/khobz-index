/**
 * WFP VAM DataBridges — OAuth2 client credentials + retail food prices (stack.md §3.3).
 */
import type { AdapterResult, FetchParams, PriceRecord, SourceAdapter } from '../shared/schema.js';
import { PriceRecordSchema } from '../shared/schema.js';
import { adapterErr, fetchWithTimeout, hashRecords, mkMeta } from './utils.js';

const SOURCE_ID = 'wfp-vam' as const;

type WfpRow = {
  country_iso2?: string;
  adm0_code?: string;
  commodity: string;
  price: number;
  currency_code: string;
  date: string;
  price_usd?: number;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

/** Lower-case commodity phrase → CPC code (extend as new staples appear). */
const PHRASE_TO_CPC: Record<string, string> = {
  'wheat flour': '23112',
  'sunflower oil': '21531',
  rice: '23161',
  sugar: '23511',
  lentils: '01342',
};

function commodityToCpc(name: string): string | undefined {
  const k = name.trim().toLowerCase();
  return PHRASE_TO_CPC[k];
}

export type WfpVamAdapterOptions = {
  fetchImpl?: typeof fetch;
  tokenUrl?: string;
  dataUrl?: string;
  clientId?: string;
  clientSecret?: string;
};

export function createWfpVamAdapter(opts: WfpVamAdapterOptions = {}): SourceAdapter {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  let cachedToken: { token: string; expires: number } | undefined;

  return {
    id: SOURCE_ID,
    tier: 1,
    name: 'WFP VAM DataBridges',
    covers: ['local_market_prices'],
    native_cadence: 'weekly',
    async fetch(params: FetchParams): Promise<AdapterResult> {
      const start = Date.now();
      const timeout_ms = params.timeout_ms ?? 30_000;
      const fetchedAt = new Date().toISOString();
      const tokenUrl = opts.tokenUrl ?? process.env.WFP_TOKEN_URL ?? 'https://api.wfp.org/token';
      const dataUrl = opts.dataUrl ?? process.env.WFP_VAM_DATA_URL ?? '';
      const clientId = opts.clientId ?? process.env.WFP_CLIENT_ID ?? '';
      const clientSecret = opts.clientSecret ?? process.env.WFP_CLIENT_SECRET ?? '';

      async function getToken(): Promise<AdapterResult | string> {
        const now = Date.now();
        if (cachedToken && cachedToken.expires > now + 60_000) return cachedToken.token;

        if (!clientId || !clientSecret) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'AUTH_FAILURE',
              message: 'WFP_CLIENT_ID / WFP_CLIENT_SECRET not set',
              retryable: false,
            }),
          };
        }

        const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
        const res = await fetchWithTimeout(fetchImpl, tokenUrl, {
          method: 'POST',
          timeout_ms,
          headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: 'grant_type=client_credentials',
        });

        if (!res.ok) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: res.status === 401 ? 'AUTH_FAILURE' : 'UPSTREAM_ERROR',
              message: `WFP token HTTP ${res.status}`,
              retryable: res.status >= 500 || res.status === 503,
              http_status: res.status,
            }),
          };
        }

        const tr = (await res.json()) as TokenResponse;
        if (!tr.access_token) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'PARSE_ERROR',
              message: 'Token response missing access_token',
              retryable: false,
            }),
          };
        }
        const ttl = (tr.expires_in ?? 3600) * 1000;
        cachedToken = { token: tr.access_token, expires: now + ttl };
        return tr.access_token;
      }

      if (!dataUrl) {
        return {
          ok: false,
          error: adapterErr(SOURCE_ID, {
            code: 'NOT_FOUND',
            message: 'Set WFP_VAM_DATA_URL or pass dataUrl',
            retryable: false,
          }),
        };
      }

      try {
        let tokenOrErr = await getToken();
        if (typeof tokenOrErr !== 'string') return tokenOrErr;

        const fetchData = async (bearer: string): Promise<Response> => {
          return fetchWithTimeout(fetchImpl, dataUrl, {
            method: 'GET',
            timeout_ms,
            headers: {
              Authorization: `Bearer ${bearer}`,
              Accept: 'application/json',
            },
          });
        };

        let res = await fetchData(tokenOrErr);
        if (res.status === 401) {
          cachedToken = undefined;
          tokenOrErr = await getToken();
          if (typeof tokenOrErr !== 'string') return tokenOrErr;
          res = await fetchData(tokenOrErr);
        }

        if (res.status === 503 || res.status === 502) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'UPSTREAM_ERROR',
              message: 'WFP temporary unavailable (ingestion)',
              retryable: true,
              http_status: res.status,
            }),
          };
        }

        if (!res.ok) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'UPSTREAM_ERROR',
              message: `WFP data HTTP ${res.status}`,
              retryable: res.status >= 500 || res.status === 429,
              http_status: res.status,
            }),
          };
        }

        const j = (await res.json()) as { items?: WfpRow[] };
        if (!Array.isArray(j.items)) {
          return {
            ok: false,
            error: adapterErr(SOURCE_ID, {
              code: 'PARSE_ERROR',
              message: 'Expected { items: array }',
              retryable: false,
            }),
          };
        }

        const want = params.countries?.map((c) => c.toUpperCase());
        const raw: PriceRecord[] = [];

        for (const row of j.items) {
          const iso = (row.country_iso2 ?? '').toUpperCase();
          if (want && iso && !want.includes(iso)) continue;
          const cpc = commodityToCpc(row.commodity);
          if (!cpc) continue;

          const price_usd = row.price_usd ?? row.price * 0.1;
          const date = row.date.slice(0, 7);

          raw.push({
            commodity: cpc,
            price_usd,
            price_local: row.price,
            currency: row.currency_code.slice(0, 3),
            price_unit: 'market',
            date,
            source_id: SOURCE_ID,
            fetched_at: fetchedAt,
            country_code: iso || undefined,
          });
        }

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
              message: 'No WFP price rows after filter/map',
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
