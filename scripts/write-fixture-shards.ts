/**
 * CLI: reads `landing/src/data/fixture-snapshot.json`, writes `landing/public/data/fixture/`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { LandingFixturePayload } from '../src/pipeline/lib/fixture-builder.js';
import { writeLandingFixtureShards } from '../src/pipeline/lib/fixture-shards.js';

const khobzRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = join(khobzRoot, 'landing/src/data/fixture-snapshot.json');
const outDir = join(khobzRoot, 'landing/public/data/fixture');

const raw = readFileSync(fixturePath, 'utf8');
const payload = JSON.parse(raw) as LandingFixturePayload;
const { shardCount, shardNames } = writeLandingFixtureShards(payload, outDir);

for (const name of ['manifest.json', ...shardNames]) {
  const bytes = readFileSync(join(outDir, name)).length;
  // biome-ignore lint/suspicious/noConsole: CLI
  console.info(`[fixture-shards] ${name} — ${(bytes / (1024 * 1024)).toFixed(2)} MiB`);
}
// biome-ignore lint/suspicious/noConsole: CLI
console.info(`[fixture-shards] wrote ${shardCount} shard(s) → ${outDir}`);
