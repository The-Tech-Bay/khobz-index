/**
 * Test doubles for §3.5B.7 KKI API integration tests.
 */

import { exportJWK, generateKeyPair, SignJWT } from 'jose';

import type { Env } from '../../../src/api/types.js';

type KvRow = { value: string; expiresAtSec?: number };

export function createMemoryKv(): KVNamespace {
  const data = new Map<string, KvRow>();
  const nowSec = () => Math.floor(Date.now() / 1000);

  return {
    async get(key: string) {
      const row = data.get(key);
      if (!row) return null;
      if (row.expiresAtSec !== undefined && row.expiresAtSec <= nowSec()) {
        data.delete(key);
        return null;
      }
      return row.value;
    },
    async put(key: string, value: string, opts?: KVNamespacePutOptions) {
      const ttl = opts?.expirationTtl;
      const exp = ttl !== undefined ? nowSec() + ttl : undefined;
      data.set(key, { value, expiresAtSec: exp });
    },
    async delete(key: string): Promise<void> {
      data.delete(key);
    },
    async getWithMetadata() {
      throw new Error('getWithMetadata not implemented in MemoryKV');
    },
    async list() {
      throw new Error('list not implemented in MemoryKV');
    },
  } as unknown as KVNamespace;
}

export const TEST_ISSUER = 'https://test.supabase.co/auth/v1';
export const TEST_AUDIENCE = 'authenticated';
export const TEST_SUB = '11111111-1111-4111-8111-111111111111';

/** RSA keypair + JWKS JSON string + `kid` for Supabase-shaped JWTs. */
export async function createTestJwksAndKeys(): Promise<{
  jwksJson: string;
  jwk: Awaited<ReturnType<typeof exportJWK>>;
  privateKey: CryptoKey;
  kid: string;
}> {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(publicKey);
  const kid = 'test-kid-1';
  jwk.kid = kid;
  jwk.alg = 'RS256';
  const jwksJson = JSON.stringify({ keys: [jwk] });
  return { jwksJson, jwk, privateKey, kid };
}

export function jwksFetchFor(jwksJson: string): typeof fetch {
  const handler = async (input: RequestInfo | URL) => {
    const u = String(input);
    if (u.includes('/.well-known/jwks.json')) {
      return new Response(jwksJson, {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    return new Response('not found', { status: 404 });
  };
  return Object.assign(handler, { preconnect: fetch.preconnect }) as typeof fetch;
}

export async function mintSupabaseLikeJwt(args: {
  privateKey: CryptoKey;
  kid: string;
  sub?: string;
  expiresIn?: string;
}): Promise<string> {
  const { privateKey, kid, sub = TEST_SUB, expiresIn = '2h' } = args;
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(TEST_ISSUER)
    .setAudience(TEST_AUDIENCE)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

export function testApiEnv(partial: Pick<Env, 'KKI_DATA' | 'KKI_KV'> & Partial<Env>): Env {
  return {
    SUPABASE_PROJECT_REF: 'test',
    SUPABASE_JWT_AUDIENCE: TEST_AUDIENCE,
    SUPABASE_JWT_ISSUER: TEST_ISSUER,
    ...partial,
  } as Env;
}
