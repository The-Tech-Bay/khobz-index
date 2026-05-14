/**
 * Opaque KKI access tokens (api-contract.md §3.3).
 */

import type { KkiTokenSession } from '../types.js';

export const KKI_TOKEN_PREFIX = 'kki_at_';

export function mintOpaqueToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${KKI_TOKEN_PREFIX}${hex}`;
}

export function tokenStorageKey(accessToken: string): string {
  if (accessToken.startsWith(KKI_TOKEN_PREFIX)) {
    return `kki:tok:${accessToken.slice(KKI_TOKEN_PREFIX.length)}`;
  }
  return `kki:tok:${accessToken}`;
}

export async function storeTokenSession(
  kv: KVNamespace,
  accessToken: string,
  session: KkiTokenSession,
): Promise<void> {
  await kv.put(tokenStorageKey(accessToken), JSON.stringify(session), { expirationTtl: 900 });
}

export async function readTokenSession(
  kv: KVNamespace,
  accessToken: string,
): Promise<KkiTokenSession | null> {
  const raw = await kv.get(tokenStorageKey(accessToken));
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as KkiTokenSession;
    if (s.scope !== 'kki:read') return null;
    if (!s.sub) return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof s.exp !== 'number' || s.exp <= now) return null;
    return s;
  } catch {
    return null;
  }
}
