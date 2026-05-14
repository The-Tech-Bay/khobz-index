/**
 * Supabase Auth JWKS load + JWT verify (api-contract.md §3.2).
 */

import { createLocalJWKSet, type JSONWebKeySet, jwtVerify } from 'jose';

import type { Env } from '../types.js';

const JWKS_CACHE_KV_KEY = 'cache:supabase-jwks';

type CachedJwks = {
  jwks: string;
  fetchedAtMs: number;
};

function issuerFromEnv(env: Env): string {
  const explicit = env.SUPABASE_JWT_ISSUER?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return `https://${env.SUPABASE_PROJECT_REF}.supabase.co/auth/v1`;
}

async function loadJwksBody(env: Env, kv: KVNamespace, fetcher: typeof fetch): Promise<string> {
  const now = Date.now();
  let cached: CachedJwks | null = null;
  const raw = await kv.get(JWKS_CACHE_KV_KEY);
  if (raw) {
    try {
      cached = JSON.parse(raw) as CachedJwks;
    } catch {
      cached = null;
    }
  }
  if (cached !== null && now - cached.fetchedAtMs < 60 * 60 * 1000) {
    return cached.jwks;
  }

  const url = `https://${env.SUPABASE_PROJECT_REF}.supabase.co/auth/v1/.well-known/jwks.json`;
  try {
    const res = await fetcher(url);
    if (!res.ok) {
      throw new Error(`JWKS fetch failed: HTTP ${res.status}`);
    }
    const jwks = await res.text();
    const row: CachedJwks = { jwks, fetchedAtMs: now };
    await kv.put(JWKS_CACHE_KV_KEY, JSON.stringify(row));
    return jwks;
  } catch {
    if (cached !== null && now - cached.fetchedAtMs < 24 * 60 * 60 * 1000) {
      return cached.jwks;
    }
    throw new Error('JWKS unavailable and no stale cache');
  }
}

export type VerifiedSupabaseJwt = {
  sub: string;
};

/**
 * Verifies a Supabase-issued access token (RS256, iss, aud, exp/nbf ±30s).
 */
export async function verifySupabaseJwt(
  token: string,
  env: Env,
  kv: KVNamespace,
  fetcher: typeof fetch = fetch,
): Promise<VerifiedSupabaseJwt> {
  const issuer = issuerFromEnv(env);
  const audience = env.SUPABASE_JWT_AUDIENCE?.trim() || 'authenticated';
  const jwksRaw = await loadJwksBody(env, kv, fetcher);
  const jwks = JSON.parse(jwksRaw) as JSONWebKeySet;
  const keyset = createLocalJWKSet(jwks);

  const { payload } = await jwtVerify(token, keyset, {
    issuer,
    audience,
    algorithms: ['RS256'],
    clockTolerance: '30s',
  });

  const sub = payload.sub;
  if (!sub) {
    throw new Error('Missing sub');
  }
  return { sub };
}
