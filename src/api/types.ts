/**
 * Cloudflare Workers bindings + optional test hooks (§3.5B — api-contract.md).
 */

import type { StorageBackend } from '../storage/backend.js';

export type Env = {
  KKI_DATA: R2Bucket;
  KKI_KV: KVNamespace;
  /** e.g. `abcdxyz` from `https://abcdxyz.supabase.co` */
  SUPABASE_PROJECT_REF: string;
  /** Override default `https://<ref>.supabase.co/auth/v1` */
  SUPABASE_JWT_ISSUER?: string;
  /** Default `authenticated` (Supabase JWT `aud`) */
  SUPABASE_JWT_AUDIENCE?: string;
  /**
   * Unit tests only: use in-memory storage instead of R2 (never set in production Worker).
   */
  TEST_STORAGE_BACKEND?: StorageBackend;
  /**
   * Unit tests only: override `fetch` used for JWKS HTTP GET (production uses global `fetch`).
   */
  TEST_JWKS_FETCH?: typeof fetch;
};

export type ApiVariables = {
  requestId: string;
  /** Raw opaque access token from `Authorization` (DATA routes). */
  kkiAccessToken?: string;
  /** Resolved session after KV lookup. */
  kkiSession?: KkiTokenSession;
};

/** Stored JSON at `kki:tok:<suffix>` (opaque token payload). */
export type KkiTokenSession = {
  sub: string;
  scope: 'kki:read';
  /** Unix seconds */
  exp: number;
};
