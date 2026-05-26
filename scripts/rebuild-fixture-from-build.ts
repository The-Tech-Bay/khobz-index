#!/usr/bin/env bun
/**
 * Rebuild landing fixture from all `build/khobz-index-YYYY-MM.json` rollups.
 * Use after partial pipeline runs to merge month files into one fixture + shards.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadHistoricalCpiEnvelopeFromEnv } from '../src/adapters/historical-cpi.js';
import {
  buildLandingFixtureData,
  type CountryMonthlyPipelineRow,
} from '../src/pipeline/lib/fixture-builder.js';
import { writeLandingFixtureShards } from '../src/pipeline/lib/fixture-shards.js';
import {
  backfillHistoricalRecords,
  historicalTargetMonths,
} from '../src/pipeline/lib/historical-backfill.js';
import { enrichLatestSnapshotRows } from '../src/pipeline/lib/snapshot-enrichment.js';
import type { GlobalTrack, IndexRecord } from '../src/shared/schema.js';

const khobzRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const buildDir = resolve(khobzRoot, 'build');
const SCHEMA_MARKETING = '1.0';
const METHODOLOGY_VERSION = '1.0.0';
const EMPTY_GT = {} as GlobalTrack;

function monthFiles(): string[] {
  return readdirSync(buildDir)
    .filter((f) => /^khobz-index-\d{4}-\d{2}\.json$/.test(f))
    .sort();
}

async function main(): Promise<void> {
  const files = monthFiles();
  if (files.length === 0) {
    throw new Error(`No khobz-index-YYYY-MM.json files in ${buildDir}`);
  }

  const fixtureRows = new Map<string, Map<string, CountryMonthlyPipelineRow>>();
  const monthsSet = new Set<string>();

  for (const file of files) {
    const month = file.slice('khobz-index-'.length, -'.json'.length);
    monthsSet.add(month);
    const body = JSON.parse(readFileSync(resolve(buildDir, file), 'utf8')) as {
      index_records?: IndexRecord[];
    };
    for (const record of body.index_records ?? []) {
      const ccU = record.country_code.toUpperCase();
      let inner = fixtureRows.get(ccU);
      if (!inner) {
        inner = new Map();
        fixtureRows.set(ccU, inner);
      }
      inner.set(month, {
        record,
        commodityPrices: [],
        schemaGlobalTrack: EMPTY_GT,
        staleGold: false,
        staleEnergy: false,
      });
    }
  }

  const months = [...monthsSet].sort();
  const historicalFrom = months[0] ?? '1990-01';
  const toYm = months[months.length - 1] ?? '2026-04';
  const latestRows = new Map<string, CountryMonthlyPipelineRow>();
  for (const [ccU, observedMap] of fixtureRows) {
    const row = observedMap.get(toYm);
    if (row) latestRows.set(ccU, row);
  }
  const enrichment = enrichLatestSnapshotRows({
    khobzRoot,
    month: toYm,
    rowsByCountry: latestRows,
    methodologyVersion: METHODOLOGY_VERSION,
  });
  // biome-ignore lint/suspicious/noConsole: CLI
  console.info(
    `[rebuild-fixture] latest snapshot enrichment — ${enrichment.enrichedCountries}/${latestRows.size} countries with basket rows (${enrichment.faostatRows} FAOSTAT rows)`,
  );

  const cpiEnvelope = loadHistoricalCpiEnvelopeFromEnv();
  const historicalMonths = historicalTargetMonths(historicalFrom, toYm);
  const nowIso = new Date().toISOString();
  let totalChained = 0;
  let totalReplaced = 0;

  if (cpiEnvelope) {
    for (const [ccU, observedMap] of fixtureRows) {
      const backfill = await backfillHistoricalRecords({
        countryCode: ccU,
        observedByMonth: new Map([...observedMap.entries()].map(([m, row]) => [m, row.record])),
        targetMonths: historicalMonths,
        cpiEnvelope,
        computedAt: nowIso,
      });
      totalChained += backfill.chainedCount;
      totalReplaced += backfill.replacedCount;
      for (const rec of backfill.records) {
        const prior = observedMap.get(rec.month);
        if (prior?.record === rec) continue;
        observedMap.set(rec.month, {
          record: rec,
          commodityPrices: prior?.commodityPrices ?? [],
          schemaGlobalTrack: prior?.schemaGlobalTrack ?? EMPTY_GT,
          staleGold: prior?.staleGold ?? false,
          staleEnergy: prior?.staleEnergy ?? false,
        });
      }
    }
    // biome-ignore lint/suspicious/noConsole: CLI
    console.info(
      `[rebuild-fixture] CPI pass — ${totalChained} new + ${totalReplaced} replaced (${historicalFrom} → ${toYm})`,
    );
  }

  const fixturePayload = buildLandingFixtureData({
    schema_version: SCHEMA_MARKETING,
    methodology_version: METHODOLOGY_VERSION,
    generated_at: nowIso,
    fixtureMonths: months,
    byCountryMonth: fixtureRows,
  });

  const fixturePath = resolve(khobzRoot, 'landing/src/data/fixture-snapshot.json');
  writeFileSync(fixturePath, `${JSON.stringify(fixturePayload, null, 2)}\n`, 'utf8');
  const { shardCount } = writeLandingFixtureShards(
    fixturePayload,
    resolve(khobzRoot, 'landing/public/data/fixture'),
  );

  // biome-ignore lint/suspicious/noConsole: CLI
  console.info(
    `[rebuild-fixture] wrote ${months.length} months · ${Object.keys(fixturePayload.countries).length} countries → ${fixturePath} (+ ${shardCount} shards)`,
  );
}

main().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: CLI
  console.error('[rebuild-fixture] failed', err);
  process.exit(1);
});
