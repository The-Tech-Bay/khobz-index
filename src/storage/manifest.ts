/**
 * Snapshot manifest load/merge (extracted to avoid import cycles with integrity.ts).
 */

import type { IndexRecord, SnapshotManifest } from '../shared/schema.js';
import { SnapshotManifestSchema } from '../shared/schema.js';
import type { StorageBackend } from './backend.js';
import { keyManifest } from './paths.js';

function toManifestHash(hex: string): string {
  return `sha256:${hex}`;
}

function sortYm(a: readonly string[]): string[] {
  return [...new Set(a)].sort((x, y) => (x === y ? 0 : x < y ? -1 : 1));
}

function ymMax(months: string[]): string | null {
  const s = sortYm(months);
  return s.at(-1) ?? null;
}

function emptyManifest(methodologySemver: string, generatedIso: string): SnapshotManifest {
  return {
    schema_version: '1.0',
    methodology_version: methodologySemver,
    generated_at: generatedIso,
    baskets: [],
    countries: [],
    file_hashes: {},
  };
}

export async function loadManifest(
  backend: StorageBackend,
  versionPrefix: string,
): Promise<SnapshotManifest> {
  const mKey = keyManifest(versionPrefix);
  const raw = await backend.get(mKey);
  if (!raw) return emptyManifest('0.0.0', new Date().toISOString());
  try {
    const parsed = SnapshotManifestSchema.safeParse(JSON.parse(raw.body));
    if (parsed.success) return parsed.data;
  } catch {
    /* corrupted manifest */
  }
  return emptyManifest('0.0.0', new Date().toISOString());
}

function mergeBasketList(manifest: SnapshotManifest, basketIds: Iterable<string>): void {
  const s = new Set(manifest.baskets);
  for (const b of basketIds) {
    if (b) s.add(b);
  }
  manifest.baskets = [...s].sort();
}

/** Merge/update country row + hashes in-place. */
export function upsertCountryInManifest(
  manifest: SnapshotManifest,
  record: IndexRecord,
  month: string,
  fileHashesRelative: Record<string, string>,
): void {
  mergeBasketList(manifest, [record.basket_version]);
  manifest.methodology_version = record.methodology_version;
  manifest.generated_at = new Date().toISOString();

  let row = manifest.countries.find((c) => c.country_code === record.country_code);
  if (!row) {
    row = {
      country_code: record.country_code,
      basket_version: record.basket_version,
      alpha: record.alpha,
      months_available: [],
      latest_month: null,
      latest_quality: null,
    };
    manifest.countries.push(row);
  }
  row.basket_version = record.basket_version;
  row.alpha = record.alpha;
  row.months_available = sortYm([...row.months_available, month]);
  row.latest_month = ymMax(row.months_available);
  row.latest_quality = record.quality;

  for (const [relPath, hex] of Object.entries(fileHashesRelative)) {
    manifest.file_hashes[relPath] = toManifestHash(hex);
  }

  manifest.countries.sort((a, b) => a.country_code.localeCompare(b.country_code));
}
