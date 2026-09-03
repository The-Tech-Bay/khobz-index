/**
 * Split landing fixture JSON into Cloudflare Pages–safe shards (< 25 MiB each).
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import type { LandingFixtureCountryData, LandingFixturePayload } from './fixture-builder.js';

/** Stay under Cloudflare Pages 25 MiB upload cap (minified UTF-8 bytes). */
const MAX_SHARD_BYTES = 18 * 1024 * 1024;

export function writeLandingFixtureShards(
  payload: LandingFixturePayload,
  outDir: string,
): { shardCount: number; shardNames: string[] } {
  mkdirSync(outDir, { recursive: true });

  const codes = Object.keys(payload.countries).sort();
  const shards: Array<Record<string, LandingFixturePayload['countries'][string]>> = [];
  let current: Record<string, LandingFixturePayload['countries'][string]> = {};
  let currentBytes = 2;

  for (const code of codes) {
    const country = payload.countries[code];
    if (!country) continue;
    const entry = JSON.stringify({ [code]: country });
    const entryBytes = Buffer.byteLength(entry, 'utf8') - 2;

    if (Object.keys(current).length > 0 && currentBytes + entryBytes > MAX_SHARD_BYTES) {
      shards.push(current);
      current = {};
      currentBytes = 2;
    }

    current[code] = country;
    currentBytes += entryBytes + (Object.keys(current).length > 1 ? 1 : 0);
  }

  if (Object.keys(current).length > 0) {
    shards.push(current);
  }

  const shardNames: string[] = [];
  for (let i = 0; i < shards.length; i++) {
    const name = `shard-${i}.json`;
    shardNames.push(name);
    writeFileSync(join(outDir, name), `${JSON.stringify({ countries: shards[i] })}\n`, 'utf8');
  }

  const manifest = {
    schema_version: payload.schema_version,
    methodology_version: payload.methodology_version,
    generated_at: payload.generated_at,
    months: payload.months,
    shards: shardNames,
  };
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest)}\n`, 'utf8');

  // Drop leftover shards the new manifest no longer lists (e.g. stale shard-1).
  for (const name of readdirSync(outDir)) {
    if (!/^shard-\d+\.json$/.test(name)) continue;
    if (shardNames.includes(name)) continue;
    unlinkSync(join(outDir, name));
  }

  return { shardCount: shardNames.length, shardNames };
}

type ShardFile = {
  countries?: Record<string, LandingFixtureCountryData>;
};

type ManifestFile = {
  schema_version?: string;
  methodology_version?: string;
  generated_at?: string;
  months?: string[];
  shards?: string[];
};

/** Reconstruct a landing payload from manifest.json + shard-*.json. */
export function readLandingFixtureShards(dir: string): LandingFixturePayload {
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`fixture manifest missing: ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestFile;
  const shardNames = Array.isArray(manifest.shards) ? manifest.shards : [];
  if (shardNames.length === 0) {
    throw new Error(`fixture manifest lists no shards: ${manifestPath}`);
  }

  const countries: Record<string, LandingFixtureCountryData> = {};
  for (const name of shardNames) {
    const shardPath = join(dir, name);
    if (!existsSync(shardPath)) {
      throw new Error(`fixture shard missing: ${shardPath}`);
    }
    const shard = JSON.parse(readFileSync(shardPath, 'utf8')) as ShardFile;
    if (!shard.countries || typeof shard.countries !== 'object') {
      throw new Error(`fixture shard invalid shape: ${shardPath}`);
    }
    Object.assign(countries, shard.countries);
  }

  if (Object.keys(countries).length === 0) {
    throw new Error(`fixture shards contained no countries: ${dir}`);
  }

  return {
    schema_version: manifest.schema_version ?? '1.0',
    methodology_version: manifest.methodology_version ?? '1.0.0',
    generated_at: manifest.generated_at ?? new Date().toISOString(),
    months: Array.isArray(manifest.months) ? manifest.months : [],
    countries,
  };
}
