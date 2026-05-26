#!/usr/bin/env bun
/**
 * Fetch World Bank WDI CPI indicators and write `data/reference/historical-cpi-envelope.json`.
 *
 * Indicators:
 *   FP.CPI.TOTL — headline CPI (fallback)
 *   FP.CPI.FOOD — food CPI (preferred for KKI backcast)
 *
 * Usage:
 *   bun run scripts/fetch-historical-cpi.ts [--output data/reference/historical-cpi-envelope.json]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HistoricalCpiObservationSchema,
  type HistoricalCpiEnvelope,
} from '../src/adapters/historical-cpi.js';
import { COUNTRY_TO_REGION } from '../src/shared/countries.js';

const khobzRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = resolve(khobzRoot, 'data/reference/historical-cpi-envelope.json');
const MIN_YEAR = 1990;
const SOURCE_ID = 'world-bank-wdi-cpi';

type WbCountryRow = {
  id?: string;
  iso2Code?: string;
  name?: string;
};

type WbIndicatorRow = {
  countryiso3code?: string;
  date?: string;
  value?: number | null;
};

const INDICATORS = [
  { id: 'FP.CPI.FOOD', kind: 'food_cpi' as const },
  { id: 'FP.CPI.TOTL', kind: 'headline_cpi' as const },
];

export interface CpiCoverageSummary {
  readonly countries: number;
  readonly observations: number;
  readonly foodCountries: number;
  readonly headlineCountries: number;
  readonly headlineOnlyCountries: number;
  readonly latestFoodPeriod: string | null;
  readonly latestHeadlinePeriod: string | null;
}

function parseArgs(): { outputPath: string } {
  let outputPath = DEFAULT_OUT;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--output=')) {
      outputPath = resolve(process.cwd(), arg.slice('--output='.length));
    }
  }
  return { outputPath };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`World Bank HTTP ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

async function loadIso3ToIso2(): Promise<Map<string, string>> {
  const url = 'https://api.worldbank.org/v2/country?format=json&per_page=400';
  const body = await fetchJson<[unknown, WbCountryRow[]]>(url);
  const rows = body[1] ?? [];
  const map = new Map<string, string>();
  for (const row of rows) {
    const iso3 = row.id?.toUpperCase();
    const iso2 = row.iso2Code?.toUpperCase();
    if (!iso3 || !iso2 || iso2.length !== 2 || iso3.length !== 3) continue;
    map.set(iso3, iso2);
  }
  return map;
}

async function fetchIndicatorRows(indicatorId: string): Promise<WbIndicatorRow[]> {
  const all: WbIndicatorRow[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const url =
      `https://api.worldbank.org/v2/country/all/indicator/${indicatorId}` +
      `?format=json&per_page=20000&page=${page}&date=${MIN_YEAR}:${new Date().getUTCFullYear()}`;
    const body = await fetchJson<[{ pages?: number }, WbIndicatorRow[]]>(url);
    totalPages = body[0]?.pages ?? 1;
    all.push(...(body[1] ?? []));
    page += 1;
  }
  return all;
}

export function buildHistoricalCpiEnvelope(args: {
  iso3ToIso2: Map<string, string>;
  allowedIso2: ReadonlySet<string>;
  indicatorRows: ReadonlyArray<{
    kind: 'food_cpi' | 'headline_cpi';
    rows: readonly WbIndicatorRow[];
  }>;
  generatedAt?: string;
}): HistoricalCpiEnvelope {
  const observations: HistoricalCpiEnvelope['observations'] = [];

  for (const { kind, rows } of args.indicatorRows) {
    for (const row of rows) {
      const iso3 = row.countryiso3code?.toUpperCase();
      const year = row.date?.trim();
      const value = row.value;
      if (!iso3 || !year || !/^\d{4}$/.test(year)) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
      const iso2 = args.iso3ToIso2.get(iso3);
      if (!iso2 || !args.allowedIso2.has(iso2)) continue;

      const parsed = HistoricalCpiObservationSchema.safeParse({
        country_code: iso2,
        period: year,
        value,
        kind,
        source_id: SOURCE_ID,
        periodicity: 'annual',
      });
      if (parsed.success) observations.push(parsed.data);
    }
  }

  observations.sort((a, b) => {
    const byCountry = a.country_code.localeCompare(b.country_code);
    if (byCountry !== 0) return byCountry;
    const byKind = a.kind.localeCompare(b.kind);
    if (byKind !== 0) return byKind;
    return a.period.localeCompare(b.period);
  });

  return {
    generated_at: args.generatedAt ?? new Date().toISOString(),
    observations,
  };
}

export function summarizeCpiCoverage(envelope: HistoricalCpiEnvelope): CpiCoverageSummary {
  const countries = new Set<string>();
  const foodCountries = new Set<string>();
  const headlineCountries = new Set<string>();
  let latestFoodPeriod: string | null = null;
  let latestHeadlinePeriod: string | null = null;

  for (const obs of envelope.observations) {
    countries.add(obs.country_code);
    if (obs.kind === 'food_cpi') {
      foodCountries.add(obs.country_code);
      if (!latestFoodPeriod || obs.period > latestFoodPeriod) latestFoodPeriod = obs.period;
    }
    if (obs.kind === 'headline_cpi') {
      headlineCountries.add(obs.country_code);
      if (!latestHeadlinePeriod || obs.period > latestHeadlinePeriod) {
        latestHeadlinePeriod = obs.period;
      }
    }
  }

  let headlineOnlyCountries = 0;
  for (const cc of headlineCountries) {
    if (!foodCountries.has(cc)) headlineOnlyCountries += 1;
  }

  return {
    countries: countries.size,
    observations: envelope.observations.length,
    foodCountries: foodCountries.size,
    headlineCountries: headlineCountries.size,
    headlineOnlyCountries,
    latestFoodPeriod,
    latestHeadlinePeriod,
  };
}

async function main(): Promise<void> {
  const { outputPath } = parseArgs();
  const allowedIso2 = new Set(Object.keys(COUNTRY_TO_REGION).map((c) => c.toUpperCase()));
  const iso3ToIso2 = await loadIso3ToIso2();

  const indicatorRows: Array<{
    kind: 'food_cpi' | 'headline_cpi';
    rows: WbIndicatorRow[];
  }> = [];
  for (const ind of INDICATORS) {
    // biome-ignore lint/suspicious/noConsole: CLI
    console.info(`[fetch-historical-cpi] downloading ${ind.id}…`);
    const rows = await fetchIndicatorRows(ind.id);
    indicatorRows.push({ kind: ind.kind, rows });
  }

  const envelope = buildHistoricalCpiEnvelope({
    iso3ToIso2,
    allowedIso2,
    indicatorRows,
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');

  const countries = new Set(envelope.observations.map((o) => o.country_code));
  const coverage = summarizeCpiCoverage(envelope);
  // biome-ignore lint/suspicious/noConsole: CLI
  console.info(
    `[fetch-historical-cpi] wrote ${envelope.observations.length} observations · ${countries.size} countries → ${outputPath}`,
  );
  // biome-ignore lint/suspicious/noConsole: CLI
  console.info(
    `[fetch-historical-cpi] coverage — food CPI: ${coverage.foodCountries} countries (latest ${coverage.latestFoodPeriod ?? 'n/a'}), ` +
      `headline CPI: ${coverage.headlineCountries} countries (latest ${coverage.latestHeadlinePeriod ?? 'n/a'}), ` +
      `headline-only: ${coverage.headlineOnlyCountries}`,
  );
}

if (import.meta.main) {
  main().catch((err) => {
    // biome-ignore lint/suspicious/noConsole: CLI
    console.error('[fetch-historical-cpi] failed', err);
    process.exit(1);
  });
}
