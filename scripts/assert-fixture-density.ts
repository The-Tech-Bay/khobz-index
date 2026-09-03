#!/usr/bin/env bun
/**
 * Fail CI / weekly publish when the landing fixture advertises history it does not have.
 *
 * Usage: bun run scripts/assert-fixture-density.ts [fixtureDir]
 * Default fixtureDir: landing/public/data/fixture
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  countFixtureRecords,
  fixtureFailsDensityGuard,
  medianRecordsPerCountry,
} from '../src/pipeline/lib/fixture-merge.js';
import { readLandingFixtureShards } from '../src/pipeline/lib/fixture-shards.js';

const fixtureDir = resolve(process.argv[2] ?? 'landing/public/data/fixture');
const summaryPath = resolve('build/fixture-publish.json');

const payload = readLandingFixtureShards(fixtureDir);
const records = countFixtureRecords(payload);
const median = medianRecordsPerCountry(payload);

console.info(
  `[assert-fixture-density] ${fixtureDir} months=${payload.months.length} records=${records} ` +
    `median/country=${median} countries=${Object.keys(payload.countries).length}`,
);

if (fixtureFailsDensityGuard(payload)) {
  console.error(
    `[assert-fixture-density] FATAL: density collapse — median ${median} records/country vs ` +
      `${payload.months.length} advertised months. Refusing to deploy.`,
  );
  process.exit(1);
}

if (existsSync(summaryPath)) {
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as {
    merged?: boolean;
    force?: boolean;
  };
  if (summary.merged !== true && summary.force !== true) {
    console.error(
      '[assert-fixture-density] FATAL: build/fixture-publish.json has no fixture merge breadcrumb. ' +
        'Weekly publish must union the rolling window onto prior history.',
    );
    process.exit(1);
  }
  console.info(
    `[assert-fixture-density] fixture-publish.json merged=${summary.merged} force=${summary.force}`,
  );
}

if (median < 100) {
  console.error(
    `[assert-fixture-density] FATAL: median ${median} records/country is below the 100-month history floor.`,
  );
  process.exit(1);
}

console.info('[assert-fixture-density] OK');
