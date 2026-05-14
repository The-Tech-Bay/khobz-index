/**
 * §3.5B.7 — KKI API contract smoke (Hono + in-memory KV/R2-backed storage).
 */

import { describe, expect, test } from 'bun:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

import app from '../../../src/api/index.js';
import type { Env } from '../../../src/api/types.js';
import { calculateKKI } from '../../../src/engine/calculate.js';
import type { CountrySnapshot, GlobalTrack, IndexRecord } from '../../../src/shared/schema.js';
import {
  buildCountrySnapshotMinimal,
  InMemoryBackend,
  persistCountryMonth,
} from '../../../src/storage/index.js';
import {
  createMemoryKv,
  createTestJwksAndKeys,
  jwksFetchFor,
  mintSupabaseLikeJwt,
  TEST_AUDIENCE,
  TEST_ISSUER,
  TEST_SUB,
  testApiEnv,
} from './helpers.js';

const SHARED_GT: GlobalTrack = {
  fao_fpi_cereals: 100,
  fao_fpi_oils: 100,
  fao_fpi_sugar: 100,
  brent_crude_usd: 65,
  gold_xau_usd: 1200,
  source_ids: ['fao-fpi', 'wb-pink-sheet'],
};

async function indexFor(
  isoMonth: string,
  country: string,
  currency: string,
  fx: number,
): Promise<IndexRecord> {
  const { record } = await calculateKKI({
    countryCode: country,
    month: isoMonth,
    prices: [],
    globalTrack: SHARED_GT,
    fxRate: fx,
    currency,
  });
  return record;
}

async function snapshotFor(record: IndexRecord, fetchIso: string): Promise<CountrySnapshot> {
  return buildCountrySnapshotMinimal({
    country_code: record.country_code,
    snapshot_date: `${record.month}-20`,
    basket_version: record.basket_version,
    global_track: SHARED_GT,
    fetch_timestamp_iso: fetchIso,
    prices: [],
    quality_flags: { global_only: record.quality === 'global_only' },
  });
}

async function seedMaMonth(backend: InMemoryBackend, month: string): Promise<IndexRecord> {
  const r = await indexFor(month, 'MA', 'MAD', 10);
  const snap = await snapshotFor(r, `${month}-05T06:00:00.000Z`);
  const res = await persistCountryMonth(backend, 'v1.0', month, r, snap);
  expect(res.ok).toBe(true);
  return r;
}

function envWith(kv: KVNamespace, backend: InMemoryBackend, jwksFetch: typeof fetch): Env {
  return testApiEnv({
    KKI_DATA: {} as R2Bucket,
    KKI_KV: kv,
    TEST_STORAGE_BACKEND: backend,
    TEST_JWKS_FETCH: jwksFetch,
  });
}

describe('§3.5B KKI API integration', () => {
  test('health: 200 without auth; unknown when KV empty', async () => {
    const kv = createMemoryKv();
    const backend = new InMemoryBackend();
    const { jwksJson } = await createTestJwksAndKeys();
    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    const res = await app.request('http://local/health', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; service: string; pipeline: { status: string } };
    expect(j.ok).toBe(true);
    expect(j.service).toBe('khobz-index-api');
    expect(j.pipeline.status).toBe('unknown');
  });

  test('health: pipeline healthy when last_successful_run_at recent', async () => {
    const kv = createMemoryKv();
    await kv.put(
      'pipeline:status',
      JSON.stringify({
        last_successful_run_at: new Date().toISOString(),
        last_run_week_id: '2026-W19',
        sources: { 'wfp-vam': 'degraded' },
      }),
    );
    const backend = new InMemoryBackend();
    const { jwksJson } = await createTestJwksAndKeys();
    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    const res = await app.request('http://local/health', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      pipeline: { status: string };
      sources: Record<string, string>;
    };
    expect(j.pipeline.status).toBe('healthy');
    expect(j.sources['wfp-vam']).toBe('degraded');
  });

  test('health: pipeline degraded when last_successful_run_at > 14 days', async () => {
    const kv = createMemoryKv();
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    await kv.put(
      'pipeline:status',
      JSON.stringify({
        last_successful_run_at: old,
        last_run_week_id: '2026-W01',
      }),
    );
    const backend = new InMemoryBackend();
    const { jwksJson } = await createTestJwksAndKeys();
    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    const res = await app.request('http://local/health', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { pipeline: { status: string } };
    expect(j.pipeline.status).toBe('degraded');
  });

  test('GET /kki/latest unknown country → 404', async () => {
    const kv = createMemoryKv();
    const backend = new InMemoryBackend();
    const { jwksJson, privateKey, kid } = await createTestJwksAndKeys();
    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    const supabaseJwt = await mintSupabaseLikeJwt({ privateKey, kid });
    const ex = await app.request(
      'http://local/auth/exchange',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${supabaseJwt}`,
        },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(ex.status).toBe(200);
    const { access_token } = (await ex.json()) as { access_token: string };
    const res = await app.request(
      'http://local/kki/latest/ZZ',
      {
        method: 'GET',
        headers: { authorization: `Bearer ${access_token}` },
      },
      env,
    );
    expect(res.status).toBe(404);
    const j = (await res.json()) as { error: { code: string } };
    expect(j.error.code).toBe('not-found');
  });

  test('data route without bearer → 401', async () => {
    const kv = createMemoryKv();
    const backend = new InMemoryBackend();
    const { jwksJson } = await createTestJwksAndKeys();
    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    await seedMaMonth(backend, '2026-04');
    const res = await app.request('http://local/kki/latest/MA', { method: 'GET' }, env);
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error: { code: string } };
    expect(j.error.code).toBe('unauthorized');
  });

  test('exchange → latest KKI → shape; removed token → 401', async () => {
    const kv = createMemoryKv();
    const backend = new InMemoryBackend();
    const { jwksJson, privateKey, kid } = await createTestJwksAndKeys();
    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    await seedMaMonth(backend, '2026-04');

    const supabaseJwt = await mintSupabaseLikeJwt({ privateKey, kid });
    const ex = await app.request(
      'http://local/auth/exchange',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${supabaseJwt}`,
        },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(ex.status).toBe(200);
    const tokPack = (await ex.json()) as {
      access_token: string;
      expires_in: number;
      scope: string;
    };
    expect(tokPack.expires_in).toBe(900);
    expect(tokPack.scope).toBe('kki:read');
    expect(tokPack.access_token.startsWith('kki_at_')).toBe(true);

    const ok = await app.request(
      'http://local/kki/latest/MA',
      {
        method: 'GET',
        headers: { authorization: `Bearer ${tokPack.access_token}` },
      },
      env,
    );
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { data: IndexRecord; warnings?: unknown[] };
    expect(typeof body.data.kki_value).toBe('number');
    expect(Array.isArray(body.data.source_summary)).toBe(true);
    expect(body.data.country_code).toBe('MA');

    const suffix = tokPack.access_token.slice('kki_at_'.length);
    await kv.delete(`kki:tok:${suffix}`);

    const denied = await app.request(
      'http://local/kki/latest/MA',
      {
        method: 'GET',
        headers: { authorization: `Bearer ${tokPack.access_token}` },
      },
      env,
    );
    expect(denied.status).toBe(401);
  });

  test('expired Supabase JWT → 401', async () => {
    const kv = createMemoryKv();
    const backend = new InMemoryBackend();
    const { jwksJson, privateKey, kid } = await createTestJwksAndKeys();
    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    const jwt = await mintSupabaseLikeJwt({ privateKey, kid, expiresIn: '-60s' });
    const res = await app.request(
      'http://local/auth/exchange',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  test('wrong RSA key vs JWKS → 401', async () => {
    const kv = createMemoryKv();
    const backend = new InMemoryBackend();
    const { jwksJson } = await createTestJwksAndKeys();
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const wrongJwk = await exportJWK(publicKey);
    wrongJwk.kid = 'wrong';
    wrongJwk.alg = 'RS256';
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'wrong' })
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setSubject(TEST_SUB)
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    const res = await app.request(
      'http://local/auth/exchange',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  test('exchange rate limit: 11th request in window → 429 + Retry-After', async () => {
    const kv = createMemoryKv();
    const backend = new InMemoryBackend();
    const { jwksJson, privateKey, kid } = await createTestJwksAndKeys();
    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    const jwt = await mintSupabaseLikeJwt({ privateKey, kid });

    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const res = await app.request(
        'http://local/auth/exchange',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({}),
        },
        env,
      );
      lastStatus = res.status;
      if (i < 10) {
        expect(res.status).toBe(200);
      }
    }
    expect(lastStatus).toBe(429);
    const res429 = await app.request(
      'http://local/auth/exchange',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res429.status).toBe(429);
    const ra = res429.headers.get('retry-after');
    expect(ra).toBeTruthy();
    expect(Number(ra)).toBeGreaterThan(0);
  });

  test('methodology_version mismatch → 200 + version-mismatch warning', async () => {
    const kv = createMemoryKv();
    const backend = new InMemoryBackend();
    const { jwksJson, privateKey, kid } = await createTestJwksAndKeys();
    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    await seedMaMonth(backend, '2026-04');
    const supabaseJwt = await mintSupabaseLikeJwt({ privateKey, kid });
    const ex = await app.request(
      'http://local/auth/exchange',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${supabaseJwt}`,
        },
        body: JSON.stringify({}),
      },
      env,
    );
    const { access_token } = (await ex.json()) as { access_token: string };

    const res = await app.request(
      'http://local/kki/latest/MA?methodology_version=9.9.9',
      {
        method: 'GET',
        headers: { authorization: `Bearer ${access_token}` },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { warnings: { code: string }[] };
    expect(body.warnings.some((w) => w.code === 'version-mismatch')).toBe(true);
  });

  test('GET /basket/1.0.0 returns baskets when objects exist under v1.0/baskets/', async () => {
    const kv = createMemoryKv();
    const backend = new InMemoryBackend();
    const { jwksJson, privateKey, kid } = await createTestJwksAndKeys();
    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    const raw = await Bun.file(
      new URL('../../../data/baskets/mena-v1.0.json', import.meta.url),
    ).text();
    await backend.put('v1.0/baskets/mena-v1.0.json', raw);

    const supabaseJwt = await mintSupabaseLikeJwt({ privateKey, kid });
    const ex = await app.request(
      'http://local/auth/exchange',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${supabaseJwt}`,
        },
        body: JSON.stringify({}),
      },
      env,
    );
    const { access_token } = (await ex.json()) as { access_token: string };

    const res = await app.request(
      'http://local/basket/1.0.0',
      {
        method: 'GET',
        headers: { authorization: `Bearer ${access_token}` },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      methodology_version: string;
      baskets: { basket_id: string }[];
    };
    expect(body.methodology_version).toBe('1.0.0');
    expect(body.baskets.some((b) => b.basket_id === 'mena-v1.0')).toBe(true);
  });

  test('DATA rate limit: 61st KKI request → 429', async () => {
    const kv = createMemoryKv();
    const backend = new InMemoryBackend();
    const { jwksJson, privateKey, kid } = await createTestJwksAndKeys();
    const env = envWith(kv, backend, jwksFetchFor(jwksJson));
    await seedMaMonth(backend, '2026-04');
    const supabaseJwt = await mintSupabaseLikeJwt({ privateKey, kid });
    const ex = await app.request(
      'http://local/auth/exchange',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${supabaseJwt}`,
        },
        body: JSON.stringify({}),
      },
      env,
    );
    const { access_token } = (await ex.json()) as { access_token: string };

    let last = 200;
    for (let i = 0; i < 61; i++) {
      const res = await app.request(
        'http://local/kki/latest/MA',
        {
          method: 'GET',
          headers: { authorization: `Bearer ${access_token}` },
        },
        env,
      );
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
