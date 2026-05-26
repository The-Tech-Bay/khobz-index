/**
 * Split landing fixture JSON into Cloudflare Pages–safe shards (< 25 MiB each).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { LandingFixturePayload } from './fixture-builder.js';

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

  return { shardCount: shardNames.length, shardNames };
}
