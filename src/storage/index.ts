/**
 * KKI snapshot storage — R2-compatible dual-publish + manifest + offline bundle (§3.4B).
 */

export type { PutOpts, StorageBackend } from './backend.js';
export { InMemoryBackend, normalizeVersionPrefix } from './backend.js';
export type { BundleBuildPhase, OfflineBundleBuildOutput } from './bundle.js';
export {
  APK_BUNDLE_GZIP_BUDGET_BYTES,
  buildOfflineApkBundle,
  gzipSizeJson,
  persistApkBundle,
} from './bundle.js';
export type { PersistCountryMonthResult } from './history.js';
export { AppendOnlyConflictError, persistCountryMonth } from './history.js';
export {
  computeSha256Hex,
  computeSnapshotPayloadHash,
  digestWithMetadata,
  manifestHash,
  parseManifestHash,
  R2_SHA256_METADATA_KEY,
  verifyIntegrity,
} from './integrity.js';
export { loadManifest, upsertCountryInManifest } from './manifest.js';
export type { ManifestMeta, SnapshotPaths } from './manifest-types.js';
export {
  countryCodeUpper,
  keyApkBundle,
  keyCountryCsv,
  keyCountryJson,
  keyGlobalJson,
  keyManifest,
  versionDir,
} from './paths.js';

export { getLatestMonth, getSnapshot } from './reader.js';
export { buildCountrySnapshotMinimal } from './snapshot-helpers.js';
export {
  buildCountryMonthEnvelope,
  buildGlobalTrackFileJson,
  type CountryMonthEnvelopeJson,
  CSV_HEADER,
  canonicalGlobalTrackFileHash,
  escapeCsvCell,
  formatCountryBodies,
  type GlobalTrackFileJson,
  serializeIndexCsvRow,
} from './writer.js';

import type { ManifestMeta, SnapshotPaths } from './manifest-types.js';

/** @deprecated Prefer `persistCountryMonth` — no-op placeholder for callers not yet migrated. */
export async function writeSnapshot(
  _paths: SnapshotPaths,
  _jsonBody: string,
  _csvBody: string,
): Promise<void> {
  /* transitional stub */
}

/** @deprecated Prefer `persistCountryMonth` — no-op placeholder only. */
export async function writeManifest(_pathKey: string, _meta: ManifestMeta): Promise<void> {
  /* transitional stub */
}

export async function readSnapshot(
  _paths: SnapshotPaths,
): Promise<{ json: string; csv: string } | null> {
  void _paths;
  return null;
}

export async function readManifest(_pathKey: string): Promise<ManifestMeta | null> {
  void _pathKey;
  return null;
}
