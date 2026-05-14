/**
 * Append-only snapshots + manifest maintenance (§3.4B.2 — data-schema.md §5.6).
 */

import type { CountrySnapshot, IndexRecord } from '../shared/schema.js';
import type { StorageBackend } from './backend.js';
import { normalizeVersionPrefix } from './backend.js';
import { digestWithMetadata } from './integrity.js';
import { loadManifest, upsertCountryInManifest } from './manifest.js';
import { keyCountryCsv, keyCountryJson, keyGlobalJson, keyManifest } from './paths.js';
import {
  buildCountryMonthEnvelope,
  buildGlobalTrackFileJson,
  CSV_HEADER,
  canonicalGlobalTrackFileHash,
  formatCountryBodies,
  type GlobalTrackFileJson,
} from './writer.js';

function parseGlobalTrackFileJson(raw: string): GlobalTrackFileJson | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (typeof o !== 'object' || o === null) return null;
    const j = o as Record<string, unknown>;
    const schema = j.schema_version;
    const gt = j.global_track;
    if (
      schema !== '1.0' ||
      typeof j.month !== 'string' ||
      typeof j.methodology_version !== 'string' ||
      typeof j.computed_at !== 'string' ||
      typeof j.content_hash !== 'string' ||
      typeof gt !== 'object' ||
      gt === null
    ) {
      return null;
    }
    return o as GlobalTrackFileJson;
  } catch {
    return null;
  }
}

export type PersistCountryMonthResult =
  | {
      ok: true;
      skipped: false;
      relativePaths: string[];
      fileHashesHex: Record<string, string>;
    }
  | { ok: true; skipped: true; warnings: readonly string[]; reason: 'duplicate_country_month' }
  | {
      ok: false;
      error: string;
      warnings?: readonly string[];
    };

export async function persistCountryMonth(
  backend: StorageBackend,
  versionInput: string,
  monthYYYYMM: string,
  indexRecord: IndexRecord,
  countrySnapshot: CountrySnapshot,
): Promise<PersistCountryMonthResult> {
  const ver = normalizeVersionPrefix(versionInput);

  const jKey = keyCountryJson(ver, indexRecord.country_code, monthYYYYMM);
  const cKey = keyCountryCsv(ver, indexRecord.country_code, monthYYYYMM);
  const gKey = keyGlobalJson(ver, monthYYYYMM);

  const hj = await backend.head(jKey);
  const hc = await backend.head(cKey);
  if (hj.exists || hc.exists) {
    return {
      ok: true,
      skipped: true,
      reason: 'duplicate_country_month',
      warnings: [
        `[kki-storage] skipped duplicate snapshot for ${indexRecord.country_code}/${monthYYYYMM}; keys already exist.`,
      ],
    };
  }

  const env = buildCountryMonthEnvelope(indexRecord, countrySnapshot);
  const { jsonPretty, csvLine } = formatCountryBodies(env, env.snapshot.global_track);
  const csvBody = CSV_HEADER + csvLine;

  const gtContentHash = await canonicalGlobalTrackFileHash(
    monthYYYYMM,
    indexRecord.methodology_version,
    env.snapshot.global_track,
  );
  const gtJsonPublished = buildGlobalTrackFileJson(
    monthYYYYMM,
    indexRecord.methodology_version,
    env.snapshot.global_track,
    indexRecord.computed_at,
    gtContentHash,
  );
  const jsonGlobalBody = `${JSON.stringify(gtJsonPublished, null, 2)}\n`;

  const existingGlobal = await backend.head(gKey);
  if (existingGlobal.exists) {
    const prev = await backend.get(gKey);
    if (!prev?.body) {
      return {
        ok: false,
        error: `[kki-storage] global track unreadable at ${gKey}`,
        warnings: ['GlobalTrackIoError'],
      };
    }
    const prevParsed = parseGlobalTrackFileJson(prev.body);
    if (prevParsed === null) {
      return {
        ok: false,
        error: `[kki-storage] global track file malformed at ${gKey}`,
        warnings: ['GlobalTrackParseError'],
      };
    }
    if (
      prevParsed.month !== monthYYYYMM ||
      prevParsed.methodology_version !== indexRecord.methodology_version
    ) {
      return {
        ok: false,
        error: `[kki-storage] global track envelope mismatch for ${gKey} (month/methodology)`,
        warnings: ['GlobalTrackMismatch'],
      };
    }
    const prevCanon = await canonicalGlobalTrackFileHash(
      monthYYYYMM,
      prevParsed.methodology_version,
      prevParsed.global_track,
    );
    if (prevCanon !== gtContentHash) {
      return {
        ok: false,
        error: `[kki-storage] global track mismatch for ${gKey}`,
        warnings: ['GlobalTrackMismatch'],
      };
    }
  }

  const jDig = await digestWithMetadata(jsonPretty);
  const cDig = await digestWithMetadata(csvBody);

  await backend.put(jKey, jsonPretty, {
    contentType: 'application/json',
    customMetadata: jDig.customMetadata,
  });

  await backend.put(cKey, csvBody, {
    contentType: 'text/csv;charset=utf-8',
    customMetadata: cDig.customMetadata,
  });

  /** Global object is canonical per month — digest manifest entry from stored bytes once written */
  let gDig: Awaited<ReturnType<typeof digestWithMetadata>>;
  const globalHeadAfterCountries = await backend.head(gKey);
  if (!globalHeadAfterCountries.exists) {
    gDig = await digestWithMetadata(jsonGlobalBody);
    await backend.put(gKey, jsonGlobalBody, {
      contentType: 'application/json',
      customMetadata: gDig.customMetadata,
    });
  } else {
    const persistedGlobal = await backend.get(gKey);
    if (!persistedGlobal?.body) {
      return {
        ok: false,
        error: `[kki-storage] global track disappeared after write race at ${gKey}`,
        warnings: ['GlobalTrackIoError'],
      };
    }
    gDig = await digestWithMetadata(persistedGlobal.body);
  }

  const relJson = `${indexRecord.country_code}/${monthYYYYMM}.json`;
  const relCsv = `${indexRecord.country_code}/${monthYYYYMM}.csv`;
  const relG = `global/${monthYYYYMM}.json`;

  const manifest = await loadManifest(backend, ver);
  if (manifest.methodology_version === '0.0.0') {
    manifest.methodology_version = indexRecord.methodology_version;
    manifest.generated_at = new Date().toISOString();
    manifest.file_hashes = {};
    manifest.countries = [];
    manifest.baskets = [];
  }

  upsertCountryInManifest(manifest, indexRecord, monthYYYYMM, {
    [relJson]: jDig.hex,
    [relCsv]: cDig.hex,
    [relG]: gDig.hex,
  });

  await backend.put(keyManifest(ver), `${JSON.stringify(manifest, null, 2)}\n`, {
    contentType: 'application/json',
  });

  return {
    ok: true,
    skipped: false,
    relativePaths: [relJson, relCsv, relG],
    fileHashesHex: {
      [relJson]: jDig.hex,
      [relCsv]: cDig.hex,
      [relG]: gDig.hex,
    },
  };
}

export class AppendOnlyConflictError extends Error {
  constructor(public readonly conflictingKey: string) {
    super(`Append-only: object already exists: ${conflictingKey}`);
    this.name = 'AppendOnlyConflictError';
  }
}
