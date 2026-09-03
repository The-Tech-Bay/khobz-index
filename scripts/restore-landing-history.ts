#!/usr/bin/env bun
/**
 * Restore published landing history: merge the git full-history snapshot with
 * the live 6-month shard (or a local fresh fixture), write honest shards.
 *
 * bun run scripts/restore-landing-history.ts
 *   [--live=https://khobz-index.thebay.ma]
 *   [--snapshot=landing/src/data/fixture-snapshot.json]
 *   [--out=landing/public/data/fixture]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  countFixtureRecords,
  mergeLandingFixturePayloads,
  withHonestMonths,
} from '../src/pipeline/lib/fixture-merge.js';
import { isLandingFixturePayload } from '../src/pipeline/lib/fixture-publish.js';
import { writeLandingFixtureShards } from '../src/pipeline/lib/fixture-shards.js';

function argValue(prefix: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const snapshotPath = resolve(argValue('--snapshot=', 'landing/src/data/fixture-snapshot.json'));
const outDir = resolve(argValue('--out=', 'landing/public/data/fixture'));
const liveBase = argValue('--live=', 'https://khobz-index.thebay.ma').replace(/\/$/, '');

const snapshotRaw: unknown = JSON.parse(await Bun.file(snapshotPath).text());
if (!isLandingFixturePayload(snapshotRaw)) {
  throw new Error(`invalid snapshot: ${snapshotPath}`);
}
const previous = withHonestMonths(snapshotRaw);

const manifestRes = await fetch(`${liveBase}/data/fixture/manifest.json`);
if (!manifestRes.ok) {
  throw new Error(`live manifest ${manifestRes.status} ${manifestRes.url}`);
}
const manifest = (await manifestRes.json()) as { shards?: string[]; generated_at?: string };
const shardNames = manifest.shards ?? ['shard-0.json'];
const countries: Record<string, (typeof previous.countries)[string]> = {};
for (const name of shardNames) {
  const res = await fetch(`${liveBase}/data/fixture/${name}`);
  if (!res.ok) {
    console.warn(`[restore] skip ${name} HTTP ${res.status}`);
    continue;
  }
  const shard = (await res.json()) as { countries?: typeof countries };
  Object.assign(countries, shard.countries ?? {});
}

const fresh = withHonestMonths({
  schema_version: previous.schema_version,
  methodology_version: previous.methodology_version,
  generated_at: new Date().toISOString(),
  months: [],
  countries,
});

const merged = mergeLandingFixturePayloads(previous, fresh);
writeFileSync(snapshotPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
const { shardCount, shardNames: written } = writeLandingFixtureShards(merged, outDir);

console.info(
  `[restore] ${countFixtureRecords(previous)} → ${countFixtureRecords(merged)} records · ` +
    `${merged.months[0]} … ${merged.months.at(-1)} · ${shardCount} shard(s): ${written.join(', ')}`,
);
