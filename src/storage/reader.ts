/**
 * Version-keyed reads (§3.4B.3 — architecture.md §3.1 paths).
 */

import type { IndexRecord } from '../shared/schema.js';
import { IndexRecordSchema } from '../shared/schema.js';
import type { StorageBackend } from './backend.js';
import { normalizeVersionPrefix } from './backend.js';
import { loadManifest } from './manifest.js';
import { countryCodeUpper, keyCountryJson } from './paths.js';
import type { CountryMonthEnvelopeJson } from './writer.js';

export async function getSnapshot(
  backend: StorageBackend,
  countryCode: string,
  monthYYYYMM: string,
  methodologyPathVersion?: string,
): Promise<IndexRecord | null> {
  const version = methodologyPathVersion ?? (await inferLatestManifestVersion(backend)) ?? 'v1.0';
  const cc = countryCodeUpper(countryCode);
  const key = keyCountryJson(version, cc, monthYYYYMM);

  const got = await backend.get(key);
  if (!got) return null;

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(got.body);
  } catch {
    return null;
  }

  const env = parsedUnknown as CountryMonthEnvelopeJson;
  if (!env?.index_record) return null;

  try {
    return IndexRecordSchema.parse(env.index_record);
  } catch {
    return null;
  }
}

export async function getLatestMonth(
  backend: StorageBackend,
  countryCode: string,
  methodologyPathVersion?: string,
): Promise<string | null> {
  const version = methodologyPathVersion ?? (await inferLatestManifestVersion(backend)) ?? 'v1.0';
  const manifest = await loadManifest(backend, normalizeVersionPrefix(version));
  const row = manifest.countries.find((c) => c.country_code === countryCodeUpper(countryCode));
  return row?.latest_month ?? null;
}

async function inferLatestManifestVersion(backend: StorageBackend): Promise<string | null> {
  const keys = await backend.list('');
  const versionPrefixes = [
    ...new Set(
      keys.map((k) => k.split('/')?.[0] ?? '').filter((v): v is string => /^v\d+\.\d+$/.test(v)),
    ),
  ].sort();

  let bestManifestVersion: string | null = null;
  let maxIso = '';

  for (const vPrefix of versionPrefixes) {
    const m = await backend.get(`${vPrefix}/manifest.json`);
    if (!m) continue;
    try {
      const envelope = JSON.parse(m.body) as { generated_at?: string };
      const iso = envelope.generated_at;
      if (typeof iso !== 'string' || iso <= maxIso) continue;
      maxIso = iso;
      bestManifestVersion = vPrefix;
    } catch {
      /* invalid manifest blob */
    }
  }

  return bestManifestVersion;
}
