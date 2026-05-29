#!/usr/bin/env bun
/**
 * Patch landing fixture snapshots with local_coverage metadata
 * without a full pipeline rebuild.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getBasketForCountry } from '../src/engine/basket.js';
import { computeLocalCoverageSummary } from '../src/engine/local-coverage.js';
import type { LandingFixturePayload } from '../src/pipeline/lib/fixture-builder.js';
import { writeLandingFixtureShards } from '../src/pipeline/lib/fixture-shards.js';

const khobzRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const fixturePath = resolve(khobzRoot, 'landing/src/data/fixture-snapshot.json');
const METHODOLOGY_VERSION = '1.0.0';

function main(): void {
  const payload = JSON.parse(readFileSync(fixturePath, 'utf8')) as LandingFixturePayload;
  let patched = 0;

  for (const [cc, country] of Object.entries(payload.countries)) {
    try {
      const basket = getBasketForCountry(cc, METHODOLOGY_VERSION);
      const prices = country.latest_snapshot.prices.map((p) => ({
        commodity_code: p.commodity_code,
        commodity_name: p.commodity_name,
        price_local: p.price_local,
        currency: p.currency,
        price_usd: p.price_usd,
        source_id: p.source_id,
        source_tier: p.source_tier,
      }));
      country.latest_snapshot.local_coverage = computeLocalCoverageSummary(basket, prices);
      patched += 1;
    } catch {
      country.latest_snapshot.local_coverage = {
        items_expected: 0,
        items_priced: 0,
        weight_covered: 0,
        threshold: 0.6,
        local_leg_accepted: false,
        missing_high_weight: [],
      };
    }
  }

  writeFileSync(fixturePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  const { shardCount } = writeLandingFixtureShards(
    payload,
    resolve(khobzRoot, 'landing/public/data/fixture'),
  );

  // biome-ignore lint/suspicious/noConsole: CLI
  console.info(
    `[enrich-fixture-local-coverage] patched ${patched} countries → ${fixturePath} (+ ${shardCount} shards)`,
  );
}

main();
