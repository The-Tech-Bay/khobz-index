/**
 * SHA-256 for snapshot bodies + verification (§3.4B.4).
 * Uses Web Crypto (same primitive as calculate.ts record_hash path).
 */

import type { StorageBackend } from './backend.js';
import { normalizeVersionPrefix } from './backend.js';
import { loadManifest } from './manifest.js';
import { keyCountryJson } from './paths.js';

const META_KEY = 'x-kki-sha256';

export function manifestHash(hex: string): string {
  return `sha256:${hex}`;
}

export async function computeSha256Hex(content: string): Promise<string> {
  const encoded = new TextEncoder().encode(content);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Per data-schema.md §2.2 rule 5 — deterministic hash over sorted prices + global_track.
 */
export async function computeSnapshotPayloadHash(parts: {
  prices: readonly { commodity_code: string }[];
  global_track: unknown;
}): Promise<string> {
  const sortedPrices = [...parts.prices].sort((a, b) =>
    a.commodity_code.localeCompare(b.commodity_code),
  );
  const payload = JSON.stringify({ prices: sortedPrices, global_track: parts.global_track });
  return computeSha256Hex(payload);
}

export function parseManifestHash(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/^sha256:([a-f0-9]{64})$/i);
  return m?.[1]?.toLowerCase() ?? null;
}

export async function verifyIntegrity(
  backend: StorageBackend,
  countryCode: string,
  monthYYYYMM: string,
  methodologyPathVersion?: string,
): Promise<
  | { ok: true; hex: string; manifestHex: string }
  | { ok: false; reason: string; hex?: string; manifestHex?: string | null }
> {
  const ver = methodologyPathVersion ? normalizeVersionPrefix(methodologyPathVersion) : 'v1.0';

  const cc = countryCode.trim().toUpperCase().slice(0, 2);
  const relJson = `${cc}/${monthYYYYMM}.json`;
  const manifest = await loadManifest(backend, ver);
  const mh = manifest.file_hashes[relJson];
  const manifestHexExpected = mh ? parseManifestHash(mh) : null;

  const key = keyCountryJson(ver, cc, monthYYYYMM);
  const got = await backend.get(key);
  if (!got) {
    return { ok: false, reason: 'missing_object', manifestHex: manifestHexExpected };
  }

  const computed = await computeSha256Hex(got.body);
  if (manifestHexExpected && computed !== manifestHexExpected) {
    return {
      ok: false,
      reason: 'manifest_hash_mismatch',
      hex: computed,
      manifestHex: manifestHexExpected,
    };
  }

  const metaHex = parseManifestHash(got.customMetadata?.[META_KEY]);
  if (metaHex && metaHex !== computed) {
    return { ok: false, reason: 'metadata_hash_mismatch', hex: computed, manifestHex: metaHex };
  }

  const manifestHexOutput = manifestHexExpected
    ? manifestHash(manifestHexExpected)
    : manifestHash(computed);
  return { ok: true, hex: computed, manifestHex: manifestHexOutput };
}

export async function digestWithMetadata(body: string): Promise<{
  hex: string;
  customMetadata: Record<string, string>;
}> {
  const hex = await computeSha256Hex(body);
  return { hex, customMetadata: { [META_KEY]: hex } };
}

export { META_KEY as R2_SHA256_METADATA_KEY };
