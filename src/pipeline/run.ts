/**
 * Monthly KKI pipeline — multi-country, two-phase:
 * prefetch global cereals / Brent / gold once, then each month FX + FAOSTAT + `calculateKKI`.
 *
 * Writes rollups under `build/`, R2 mirror, pipeline summary KV-shaped JSON,
 * and `landing/src/data/fixture-snapshot.json` (full resolved history by default).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHistoricalCpiEnvelopeFromEnv } from '../adapters/historical-cpi.js';
import { createDefaultOrchestrator, type SlotResult } from '../adapters/orchestrator.js';
import { getBasketForCountry } from '../engine/basket.js';
import { computeGlobalBasketCost } from '../engine/global-track.js';
import { getCurrency } from '../engine/hybrid.js';
import { calculateKKI } from '../engine/index.js';
import { COUNTRY_TO_REGION } from '../shared/countries.js';
import type { FetchParams, GlobalTrack, IndexRecord, PriceRecord } from '../shared/schema.js';
import {
  buildCountrySnapshotMinimal,
  buildOfflineApkBundle,
  InMemoryBackend,
  persistApkBundle,
  persistCountryMonth,
} from '../storage/index.js';

import { loadMonthlyBenchmarkCsv } from './lib/benchmark-csv.js';
import { priceRecordsToBasketCommodityPrices, tierForSourceId } from './lib/commodity-prices.js';
import { buildLandingFixtureData, type CountryMonthlyPipelineRow } from './lib/fixture-builder.js';
import { writeLandingFixtureShards } from './lib/fixture-shards.js';
import {
  backfillHistoricalRecords,
  hasLocalKkiData,
  historicalTargetMonths,
} from './lib/historical-backfill.js';
import { lcuPerUsdFromFxRecords } from './lib/fx-utils.js';
import { assembleGlobalTrackForMonth } from './lib/global-track-assemble.js';
import { deriveLocalProvenanceFromCommodityPrices } from './lib/local-provenance.js';
import {
  defaultPreviousUtcMonth,
  expandInclusiveMonths,
  worldBankMonthRange,
} from './lib/month-utils.js';
import { METHODOLOGY_VERSION } from '../engine/versioning.js';
const SCHEMA_VERSION = '1.0.0';
const SCHEMA_MARKETING = '1.0';
const DEFAULT_HISTORICAL_FROM = '1990-01';

function isoWeekId(d: Date): string {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const week = 1 + Math.ceil((firstThursday - target.getTime()) / (7 * 24 * 3600 * 1000));
  const y = target.getUTCFullYear();
  return `${y}-W${String(week).padStart(2, '0')}`;
}

async function exportInMemoryToDir(
  backend: InMemoryBackend,
  baseDir: string,
): Promise<{ keys: string[] }> {
  const keys = await backend.list('');
  for (const key of keys) {
    const row = await backend.get(key);
    if (!row) continue;
    const outPath = join(baseDir, key);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, row.body, 'utf8');
  }
  return { keys };
}

function slotRecords(r: SlotResult): PriceRecord[] {
  return r.ok ? r.records : [];
}

function summarizeSlot(s: SlotResult): Record<string, unknown> {
  if (s.ok) {
    return {
      ok: true,
      slot: s.slot,
      source_id: s.source_id,
      record_count: s.records.length,
    };
  }
  return {
    ok: false,
    slot: s.slot,
    reason: s.reason,
    errors: s.errors.map((e) => ({
      source_id: e.source_id,
      code: e.code,
      message: e.message,
    })),
  };
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolveFn) => setTimeout(resolveFn, ms));
}

interface PipelineCli {
  readonly months: string[];
  readonly skipPersist: boolean;
  readonly maxCountries?: number;
  readonly frankfurterDelayMs: number;
  readonly force: boolean;
}

function readMaxCountriesEnv(): number | undefined {
  const raw = process.env.PIPELINE_MAX_COUNTRIES ?? '';
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return undefined;
}

function readFrankDelay(): number {
  const raw = process.env.PIPELINE_FRANKFURTER_DELAY_MS ?? '';
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;
  return 500;
}

function readHistoricalFrom(): string {
  const raw = (process.env.PIPELINE_HISTORICAL_FROM ?? '').trim().slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return DEFAULT_HISTORICAL_FROM;
}

function readFixtureMonthsLimit(): number | null {
  const raw = Number(process.env.PIPELINE_FIXTURE_MONTHS_LIMIT ?? '');
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return null;
}

function parseArgv(argv: string[]): PipelineCli {
  const skipPersist = argv.includes('--dry-run');
  const force = argv.includes('--force');
  let fromYm = '';
  let toYm = '';
  let explicitMonth = '';
  const backfill = argv.includes('--backfill');

  for (const arg of argv) {
    if (arg.startsWith('--from=')) fromYm = arg.slice('--from='.length).trim();
    if (arg.startsWith('--to=')) toYm = arg.slice('--to='.length).trim();
    if (arg.startsWith('--month=')) explicitMonth = arg.slice('--month='.length).trim();
  }

  if (explicitMonth) {
    const m = explicitMonth.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) {
      throw new Error(`Invalid --month (expected YYYY-MM): ${explicitMonth}`);
    }
    return {
      months: [m],
      skipPersist,
      maxCountries: readMaxCountriesEnv(),
      frankfurterDelayMs: readFrankDelay(),
      force,
    };
  }

  let fromResolved = fromYm || process.env.PIPELINE_FROM || '';
  let toResolved = toYm || process.env.PIPELINE_TO || '';

  if (!backfill && !fromResolved && !toResolved) {
    const fallback = defaultPreviousUtcMonth();
    return {
      months: [fallback],
      skipPersist,
      maxCountries: readMaxCountriesEnv(),
      frankfurterDelayMs: readFrankDelay(),
      force,
    };
  }

  if (!fromResolved) fromResolved = readHistoricalFrom();
  if (!toResolved) toResolved = defaultPreviousUtcMonth();

  let months = expandInclusiveMonths(fromResolved.slice(0, 7), toResolved.slice(0, 7));
  const cap = Number(process.env.PIPELINE_MONTHS_LIMIT ?? '');
  if (Number.isFinite(cap) && cap > 0 && months.length > cap) {
    months = months.slice(0, cap);
  }
  return {
    months,
    skipPersist,
    maxCountries: readMaxCountriesEnv(),
    frankfurterDelayMs: readFrankDelay(),
    force,
  };
}

async function main(): Promise<void> {
  const cli = parseArgv(process.argv.slice(2));
  const months = cli.months;
  if (months.length === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI
    console.error('[pipeline] no months resolved');
    process.exit(1);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const khobzRoot = resolve(here, '../..');
  const outDir = resolve(khobzRoot, 'build');
  mkdirSync(outDir, { recursive: true });

  let countryList = Object.keys(COUNTRY_TO_REGION).sort();
  if (cli.maxCountries !== undefined && countryList.length > cli.maxCountries) {
    countryList = countryList.slice(0, cli.maxCountries);
  }

  const benchPath = resolve(khobzRoot, 'data/reference/monthly-global-benchmarks.csv');
  const benchmarks = loadMonthlyBenchmarkCsv(benchPath);

  const fromYm = months[0];
  const toYm = months[months.length - 1];
  if (!fromYm || !toYm) {
    // biome-ignore lint/suspicious/noConsole: CLI
    console.error('[pipeline] internal: empty month slice');
    process.exit(1);
  }
  const wbRange = worldBankMonthRange(fromYm, toYm);
  const anchorDate = `${toYm}-15`;
  const prefetchParams: FetchParams = { target_date: anchorDate, wb_date_range: wbRange };

  const orch = createDefaultOrchestrator();

  // biome-ignore lint/suspicious/noConsole: breadcrumbs
  console.info(
    `[pipeline] ${months.length} months · ${months[0]} → ${months[months.length - 1]} · ${countryList.length} countries`,
  );

  const [slotCereals, slotCrude, slotGold] = await Promise.all([
    orch.fetchSlot(prefetchParams, 'global_cereals_oils_sugar'),
    orch.fetchSlot(prefetchParams, 'crude_oil_energy'),
    orch.fetchSlot(prefetchParams, 'gold_spot'),
  ]);

  const cerealsRecs = slotRecords(slotCereals);
  const crudeRecs = slotRecords(slotCrude);
  const goldRecs = slotRecords(slotGold);

  if (cerealsRecs.length === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI
    console.warn(
      '[pipeline] WARN: empty global cereals slot from live adapter — using bundled `monthly-global-benchmarks.csv` for FAO FPI (and gold/Brent gaps) via assembleGlobalTrackForMonth',
    );
  }

  const byCountryMonths: Record<string, IndexRecord[]> = {};
  const fixtureRows = new Map<string, Map<string, CountryMonthlyPipelineRow>>();
  const r2Smoke = new InMemoryBackend();
  const fetchIsoAnchor = new Date().toISOString();

  let lastLocalSlot: SlotResult | null = null;
  /** Last fx slot fetch for KV summary */
  let lastFxSlot: SlotResult | null = null;

  for (let mi = 0; mi < months.length; mi++) {
    const month = months[mi];
    if (month === undefined) continue;
    // biome-ignore lint/suspicious/noConsole: CLI progress (long backfills are otherwise silent)
    console.info(`[pipeline] month ${mi + 1}/${months.length} · ${month}`);
    if (mi > 0) await sleep(cli.frankfurterDelayMs);

    lastFxSlot = await orch.fetchSlot({ target_date: `${month}-15` }, 'fx_display');
    if (!lastFxSlot.ok) {
      // biome-ignore lint/suspicious/noConsole: CLI
      console.error(
        '[pipeline] FX slot failed (Frankfurter + exchangerate.host)',
        lastFxSlot.errors,
      );
      process.exit(1);
    }
    const fullFxMap = lcuPerUsdFromFxRecords(lastFxSlot.records);

    const lcuPerCountry: Record<string, number> = {};
    for (const cc of countryList) {
      const cur = getCurrency(cc).toUpperCase();
      const v = fullFxMap[cur];
      if (cur === 'USD') lcuPerCountry[cc.toUpperCase()] = 1;
      else if (typeof v === 'number' && v > 0) {
        lcuPerCountry[cc.toUpperCase()] = v;
      }
    }

    const slotLocal = await orch.fetchSlot(
      {
        target_date: `${month}-15`,
        lcu_per_usd_by_country: lcuPerCountry,
      },
      'local_market_prices',
    );
    lastLocalSlot = slotLocal;

    const localRecsAll = slotLocal.ok ? slotLocal.records : [];
    const localsByCc = new Map<string, PriceRecord[]>();
    for (const lr of localRecsAll) {
      const iso = lr.country_code?.toUpperCase();
      if (!iso || iso.length !== 2) continue;
      let arr = localsByCc.get(iso);
      if (!arr) {
        arr = [];
        localsByCc.set(iso, arr);
      }
      arr.push(lr);
    }

    const benchRow = benchmarks.get(month) ?? null;
    const globalTrack: GlobalTrack = assembleGlobalTrackForMonth({
      month,
      globalCerealRecords: cerealsRecs,
      crudeSlotRecords: crudeRecs,
      goldSlotRecords: goldRecs,
      benchmark: benchRow ?? null,
    });

    const monthIndexRecords: IndexRecord[] = [];
    const localSourceId = slotLocal.ok ? slotLocal.source_id : 'faostat';

    const cerealSid = slotCereals.ok ? slotCereals.source_id : 'fao-fpi';
    const crudeSid = slotCrude.ok ? slotCrude.source_id : 'wb-pink-sheet';
    const goldSid = slotGold.ok ? slotGold.source_id : 'benchmark-csv';

    for (const cc of countryList) {
      const ccU = cc.toUpperCase();
      try {
        getBasketForCountry(ccU, METHODOLOGY_VERSION);
      } catch {
        // biome-ignore lint/suspicious/noConsole: breadcrumbs
        console.warn(`[pipeline] skipping unknown basket country ${ccU}`);
        continue;
      }

      const basket = getBasketForCountry(ccU, METHODOLOGY_VERSION);
      const countryLocals = localsByCc.get(ccU) ?? [];

      const commodityPrices = priceRecordsToBasketCommodityPrices(
        basket,
        countryLocals,
        month,
        localSourceId,
      );

      const cur = getCurrency(ccU).toUpperCase();
      let fxRate = lcuPerCountry[ccU] ?? fullFxMap[cur] ?? (cur === 'USD' ? 1 : NaN);
      if (!Number.isFinite(fxRate) || fxRate <= 0) fxRate = 1;

      const globalCost = computeGlobalBasketCost(globalTrack, fxRate);
      const sourceSummary = compactSources({
        cereals: cerealSid,
        local: localSourceId,
        crude: crudeSid,
        gold: goldSid,
      });

      const localProv = deriveLocalProvenanceFromCommodityPrices(commodityPrices);
      const { record } = await calculateKKI({
        countryCode: ccU,
        month,
        prices: commodityPrices,
        globalTrack,
        fxRate,
        currency: cur,
        methodologyVersion: METHODOLOGY_VERSION,
        sourceSummary,
        sourcePeriodicity: localProv.sourcePeriodicity,
        estimateConfidence: localProv.estimateConfidence,
      });

      monthIndexRecords.push(record);
      let arr = byCountryMonths[ccU];
      if (!arr) {
        arr = [];
        byCountryMonths[ccU] = arr;
      }
      arr.push(record);

      let ccMap = fixtureRows.get(ccU);
      if (!ccMap) {
        ccMap = new Map<string, CountryMonthlyPipelineRow>();
        fixtureRows.set(ccU, ccMap);
      }
      ccMap.set(month, {
        record,
        commodityPrices,
        schemaGlobalTrack: globalTrack,
        staleGold: globalCost.stale_flags.stale_gold,
        staleEnergy: globalCost.stale_flags.stale_energy,
      });

      const countrySnapshot = await buildCountrySnapshotMinimal({
        country_code: ccU,
        snapshot_date: `${month}-15`,
        basket_version: record.basket_version,
        global_track: globalTrack,
        fetch_timestamp_iso: fetchIsoAnchor,
        prices: commodityPrices,
        quality_flags: {
          stale_gold: globalCost.stale_flags.stale_gold,
          global_only: record.quality === 'global_only',
          missing_sources:
            cerealsRecs.length === 0
              ? ['fao_fpi_maybe_missing']
              : globalCost.stale_flags.missing_fao,
        },
      });

      if (!cli.skipPersist) {
        const pr = await persistCountryMonth(r2Smoke, 'v1.0', month, record, countrySnapshot);
        if (!pr.ok) {
          // biome-ignore lint/suspicious/noConsole: fatal
          console.error('[pipeline] persistCountryMonth failed', ccU, month, pr);
          process.exit(1);
        }
      }
    }

    const rollupJson = {
      schema_version: SCHEMA_VERSION,
      methodology_version: METHODOLOGY_VERSION,
      month,
      countries: countryList.length,
      generated_at: new Date().toISOString(),
      index_records: monthIndexRecords,
      sources: {
        global_cereals: summarizeSlot(slotCereals),
        crude: summarizeSlot(slotCrude),
        gold: summarizeSlot(slotGold),
        local_prices: summarizeSlot(slotLocal),
      },
    };

    writeFileSync(
      resolve(outDir, `khobz-index-${month}.json`),
      `${JSON.stringify(rollupJson, null, 2)}\n`,
      'utf8',
    );

    const csvHead =
      'country_code,month,kki_value,kki_value_usd,currency,record_hash,quality,alpha,local_basket_cost,global_basket_cost\n';
    const csvBody = monthIndexRecords
      .map(
        (r) =>
          `${r.country_code},${r.month},${r.kki_value},${r.kki_value_usd},${r.currency},${r.record_hash},${r.quality},${r.alpha},${r.local_basket_cost},${r.global_basket_cost}`,
      )
      .join('\n');
    writeFileSync(resolve(outDir, `khobz-index-${month}.csv`), `${csvHead}${csvBody}\n`, 'utf8');
  }

  const latestPipelineMonth = months[months.length - 1];
  if (latestPipelineMonth) {
    let globalOnlyCount = 0;
    const degenerateUsdCounts = new Map<string, number>();
    for (const cc of countryList) {
      const row = fixtureRows.get(cc.toUpperCase())?.get(latestPipelineMonth);
      if (row?.record.quality === 'global_only') {
        globalOnlyCount += 1;
        if (row.record.local_basket_cost === 0 && Number.isFinite(row.record.kki_value_usd)) {
          const key = row.record.kki_value_usd.toFixed(3);
          degenerateUsdCounts.set(key, (degenerateUsdCounts.get(key) ?? 0) + 1);
        }
      }
    }
    const globalOnlyPct = globalOnlyCount / Math.max(countryList.length, 1);
    const dominantDegenerateCount = Math.max(0, ...degenerateUsdCounts.values());
    const dominantDegeneratePct = dominantDegenerateCount / Math.max(countryList.length, 1);
    if (dominantDegeneratePct > 0.95 && !cli.force) {
      // biome-ignore lint/suspicious/noConsole: fatal
      console.error(
        `[pipeline] FATAL: ${(dominantDegeneratePct * 100).toFixed(0)}% of countries share one global-only USD value for ${latestPipelineMonth} (${dominantDegenerateCount}/${countryList.length}). ` +
          'Local FAOSTAT prices missing — run `bun run pipeline:prefetch` or set FAOSTAT_CP_JSON_PATH. Pass --force to override.',
      );
      process.exit(1);
    }
    if (globalOnlyPct > 0.8) {
      // biome-ignore lint/suspicious/noConsole: CLI
      console.warn(
        `[pipeline] WARN: ${(globalOnlyPct * 100).toFixed(0)}% global_only for ${latestPipelineMonth}; continuing because local-price countries still have differentiated KKI values`,
      );
    }
  }

  const nowIso = new Date().toISOString();
  const cpiEnvelope = loadHistoricalCpiEnvelopeFromEnv();
  const historicalFrom = readHistoricalFrom();
  const historicalMonths = historicalTargetMonths(historicalFrom, toYm);
  let totalChained = 0;
  let totalReplaced = 0;

  if (cpiEnvelope && historicalMonths.length > 0) {
    for (const cc of countryList) {
      const ccU = cc.toUpperCase();
      const observedMap = fixtureRows.get(ccU) ?? new Map<string, CountryMonthlyPipelineRow>();
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
        const prior = observedMap.get(rec.month)?.record;
        if (prior && hasLocalKkiData(prior)) continue;
        if (
          prior &&
          prior.estimate_method === rec.estimate_method &&
          prior.kki_value === rec.kki_value &&
          prior.base_month === rec.base_month
        ) {
          continue;
        }

        const priorRow = observedMap.get(rec.month);
        const minimalRow: CountryMonthlyPipelineRow = {
          record: rec,
          commodityPrices: priorRow?.commodityPrices ?? [],
          schemaGlobalTrack: priorRow?.schemaGlobalTrack ?? ({} as GlobalTrack),
          staleGold: priorRow?.staleGold ?? false,
          staleEnergy: priorRow?.staleEnergy ?? false,
        };
        observedMap.set(rec.month, minimalRow);
        fixtureRows.set(ccU, observedMap);

        let arr = byCountryMonths[ccU];
        if (!arr) {
          arr = [];
          byCountryMonths[ccU] = arr;
        }
        const idx = arr.findIndex((r) => r.month === rec.month);
        if (idx >= 0) arr[idx] = rec;
        else arr.push(rec);

        if (!cli.skipPersist && !prior) {
          const countrySnapshot = await buildCountrySnapshotMinimal({
            country_code: ccU,
            snapshot_date: `${rec.month}-15`,
            basket_version: rec.basket_version,
            global_track: {} as GlobalTrack,
            fetch_timestamp_iso: nowIso,
            prices: [],
            quality_flags: {
              stale_gold: false,
              global_only: rec.quality === 'global_only',
              missing_sources: ['historical_cpi_backfill'],
            },
          });
          const pr = await persistCountryMonth(r2Smoke, 'v1.0', rec.month, rec, countrySnapshot);
          if (!pr.ok) {
            // biome-ignore lint/suspicious/noConsole: fatal
            console.error('[pipeline] historical persist failed', ccU, rec.month, pr);
            process.exit(1);
          }
        }
      }
    }
    // biome-ignore lint/suspicious/noConsole: breadcrumbs
    console.info(
      `[pipeline] historical CPI backfill — ${totalChained} new + ${totalReplaced} replaced (${historicalFrom} → ${toYm})`,
    );
  }

  if (!cli.skipPersist) {
    const bundleOut = buildOfflineApkBundle({
      methodology_version: METHODOLOGY_VERSION,
      generated_at_iso: fetchIsoAnchor,
      byCountryMonths,
    });
    await persistApkBundle(r2Smoke, bundleOut.bundle);
  }

  const r2MirrorDir = resolve(outDir, 'r2-mirror');
  const { keys: r2Keys } = await exportInMemoryToDir(r2Smoke, r2MirrorDir);
  writeFileSync(join(outDir, 'r2-keys.txt'), `${r2Keys.join('\n')}\n`, 'utf8');

  const nowIsoFinal = new Date().toISOString();
  const weekId = isoWeekId(new Date());
  const sourcesHealth: Record<string, 'up' | 'degraded' | 'unavailable'> = {
    'fao-fpi': cerealsRecs.length > 0 ? 'up' : 'degraded',
    faostat: lastLocalSlot?.ok ? 'up' : 'degraded',
    'wfp-vam': 'up',
    'wb-pink-sheet': crudeRecs.length > 0 ? 'up' : 'degraded',
    'goldprice-dev': goldRecs.length > 0 ? 'up' : 'degraded',
    'metals-dev': 'up',
    frankfurter: lastFxSlot?.ok && lastFxSlot.source_id === 'frankfurter' ? 'up' : 'degraded',
    'exchangerate-host':
      lastFxSlot?.ok && lastFxSlot.source_id === 'exchangerate-host' ? 'up' : 'unavailable',
  };
  const degradedCount = Object.values(sourcesHealth).filter((s) => s !== 'up').length;
  const pipelineSummary = {
    schema_version: SCHEMA_VERSION,
    generated_at: nowIsoFinal,
    months_processed: months,
    historical_from: historicalFrom,
    historical_chained_count: totalChained,
    week_id: weekId,
    slots: {
      prefetch_global_cereals: summarizeSlot(slotCereals),
      prefetch_crude: summarizeSlot(slotCrude),
      prefetch_gold: summarizeSlot(slotGold),
      last_local_month: lastLocalSlot ? summarizeSlot(lastLocalSlot) : null,
      last_fx_month: lastFxSlot ? summarizeSlot(lastFxSlot) : null,
    },
    countries: countryList,
    sources: sourcesHealth,
    degraded_source_count: degradedCount,
    r2_keys_written: r2Keys.length,
  };
  writeFileSync(
    join(outDir, 'pipeline-run-summary.json'),
    `${JSON.stringify(pipelineSummary, null, 2)}\n`,
    'utf8',
  );

  const pipelineKv = {
    last_successful_run_at: nowIsoFinal,
    last_run_week_id: weekId,
    sources: sourcesHealth,
  };
  writeFileSync(
    join(outDir, 'pipeline-kv-pipeline-status.json'),
    `${JSON.stringify(pipelineKv)}\n`,
    'utf8',
  );

  const lastRunState = {
    ...pipelineSummary,
    kv_pipeline: pipelineKv,
  };
  writeFileSync(
    join(outDir, 'last-run-state.json'),
    `${JSON.stringify(lastRunState, null, 2)}\n`,
    'utf8',
  );

  const fixtureLimit = readFixtureMonthsLimit();
  const allFixtureMonths = historicalMonths.length > 0 ? historicalMonths : months;
  const fixtureWindow =
    fixtureLimit != null
      ? allFixtureMonths.slice(Math.max(0, allFixtureMonths.length - fixtureLimit))
      : allFixtureMonths;
  const fixturePayload = buildLandingFixtureData({
    schema_version: SCHEMA_MARKETING,
    methodology_version: METHODOLOGY_VERSION,
    generated_at: nowIsoFinal,
    fixtureMonths: fixtureWindow,
    byCountryMonth: fixtureRows,
  });
  writeFileSync(
    resolve(khobzRoot, 'landing/src/data/fixture-snapshot.json'),
    `${JSON.stringify(fixturePayload, null, 2)}\n`,
    'utf8',
  );
  const { shardCount } = writeLandingFixtureShards(
    fixturePayload,
    resolve(khobzRoot, 'landing/public/data/fixture'),
  );

  // biome-ignore lint/suspicious/noConsole: breadcrumbs
  console.info(
    `[pipeline] OK — persisted ${months.length} month rollups (${countryList.length} countries/view); historical CPI ${totalChained} new + ${totalReplaced} replaced; APK ${cli.skipPersist ? 'skipped' : 'bundled'}; fixture ${fixtureWindow.length} months → landing/src/data/fixture-snapshot.json (+ ${shardCount} Pages shard(s))`,
  );
}

/** Minimal provenance footprint for `IndexRecord`. */
function compactSources(map: { cereals: string; local: string; crude: string; gold: string }) {
  return [
    {
      slot: 'global_cereals_oils_sugar' as const,
      source_ids: [map.cereals],
      tiers: [tierForSourceId(map.cereals)],
    },
    {
      slot: 'local_market_prices' as const,
      source_ids: [map.local],
      tiers: [tierForSourceId(map.local)],
    },
    {
      slot: 'crude_oil_energy' as const,
      source_ids: [map.crude],
      tiers: [tierForSourceId(map.crude)],
    },
    { slot: 'gold_spot' as const, source_ids: [map.gold], tiers: [tierForSourceId(map.gold)] },
  ];
}

await main().catch((err: unknown) => {
  // biome-ignore lint/suspicious/noConsole: fatal path
  console.error('[pipeline] fatal', err);
  process.exit(1);
});
