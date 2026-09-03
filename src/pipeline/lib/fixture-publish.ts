/**
 * Publish policy for the landing fixture: loud previous-load, required merge
 * baseline, collapse guard, density guard, then honest `months` rewrite.
 *
 * A green weekly run must never ship 439 advertised months with 6 records.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { LandingFixturePayload } from './fixture-builder.js';
import {
  COLLAPSE_RATIO,
  countFixtureRecords,
  fixtureFailsDensityGuard,
  medianRecordsPerCountry,
  mergeLandingFixturePayloads,
  withHonestMonths,
} from './fixture-merge.js';
import { readLandingFixtureShards } from './fixture-shards.js';

export type PreviousFixtureSource = 'snapshot' | 'shards' | 'none';

export type PreviousFixtureLoad = {
  payload: LandingFixturePayload | null;
  error: string | null;
  source: PreviousFixtureSource;
  bytes: number;
  path: string;
};

export function isLandingFixturePayload(raw: unknown): raw is LandingFixturePayload {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Partial<LandingFixturePayload>;
  return Array.isArray(p.months) && p.countries !== null && typeof p.countries === 'object';
}

export function loadSnapshotFixture(path: string): PreviousFixtureLoad {
  try {
    if (!existsSync(path)) {
      return { payload: null, error: `snapshot missing: ${path}`, source: 'none', bytes: 0, path };
    }
    const bytes = statSync(path).size;
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!isLandingFixturePayload(parsed)) {
      return {
        payload: null,
        error: `snapshot invalid shape: ${path} (${bytes} bytes)`,
        source: 'none',
        bytes,
        path,
      };
    }
    return { payload: parsed, error: null, source: 'snapshot', bytes, path };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      payload: null,
      error: `snapshot load failed: ${path}: ${message}`,
      source: 'none',
      bytes: 0,
      path,
    };
  }
}

export function loadShardsFixture(dir: string): PreviousFixtureLoad {
  const manifestPath = join(dir, 'manifest.json');
  try {
    const payload = readLandingFixtureShards(dir);
    const bytes = existsSync(manifestPath) ? statSync(manifestPath).size : 0;
    return { payload, error: null, source: 'shards', bytes, path: dir };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      payload: null,
      error: `shards load failed: ${dir}: ${message}`,
      source: 'none',
      bytes: 0,
      path: dir,
    };
  }
}

/**
 * Prefer the pretty-printed snapshot; fall back to Pages shards if the snapshot
 * is missing, unparsable, or the wrong shape (the 45 MB JSON.parse hole).
 */
export function loadPreviousPublishedFixture(
  snapshotPath: string,
  shardsDir: string,
): PreviousFixtureLoad {
  const snap = loadSnapshotFixture(snapshotPath);
  if (snap.payload) return snap;
  const shards = loadShardsFixture(shardsDir);
  if (shards.payload) {
    return {
      ...shards,
      error: snap.error ? `${snap.error}; recovered from shards` : shards.error,
    };
  }
  return {
    payload: null,
    error: [snap.error, shards.error].filter(Boolean).join(' | ') || 'no previous fixture',
    source: 'none',
    bytes: 0,
    path: snapshotPath,
  };
}

export function logPreviousFixtureLoad(load: PreviousFixtureLoad): void {
  if (load.payload) {
    const records = countFixtureRecords(load.payload);
    // biome-ignore lint/suspicious/noConsole: breadcrumbs
    console.info(
      `[pipeline] previous fixture — source=${load.source} path=${load.path} bytes=${load.bytes} ` +
        `months=${load.payload.months.length} records=${records}` +
        (load.error ? ` note=${load.error}` : ''),
    );
    return;
  }
  // biome-ignore lint/suspicious/noConsole: breadcrumbs
  console.error(`[pipeline] previous fixture unavailable — ${load.error ?? 'unknown'}`);
}

export type PublishPrepareArgs = {
  fresh: LandingFixturePayload;
  previous: LandingFixturePayload | null;
  mergeFixture: boolean;
  force: boolean;
};

export type PublishPrepareOk = {
  ok: true;
  payload: LandingFixturePayload;
  merged: boolean;
};

export type PublishPrepareFail = {
  ok: false;
  reason: string;
};

export type PublishPrepareResult = PublishPrepareOk | PublishPrepareFail;

export type FixturePublishSummary = {
  merged: boolean;
  force: boolean;
  months: number;
  records: number;
  median_records_per_country: number;
  advertised_months_before_honest: number;
};

export function prepareFixtureForPublish(args: PublishPrepareArgs): PublishPrepareResult {
  let payload = args.fresh;
  let merged = false;

  if (args.mergeFixture) {
    if (!args.previous) {
      if (!args.force) {
        return {
          ok: false,
          reason:
            '[pipeline] FATAL: merge is on but no previous fixture loaded. ' +
            'Refusing to publish a rolling window without prior history. ' +
            'Restore landing/src/data/fixture-snapshot.json or landing/public/data/fixture/, ' +
            'run `bun run pipeline:backfill`, or pass --force to override.',
        };
      }
    } else {
      payload = mergeLandingFixturePayloads(args.previous, args.fresh);
      merged = true;
    }
  }

  if (args.previous && !args.force) {
    const prevRecords = countFixtureRecords(args.previous);
    const nextRecords = countFixtureRecords(payload);
    if (prevRecords > 0 && nextRecords < prevRecords * COLLAPSE_RATIO) {
      return {
        ok: false,
        reason:
          `[pipeline] FATAL: published fixture would collapse from ${prevRecords} to ${nextRecords} records ` +
          `(< ${COLLAPSE_RATIO * 100}% of prior history; months ${args.previous.months.length} → ${payload.months.length}). ` +
          'Likely the CPI backfill found no chainable base (annual CPI dataset trails the processed window). ' +
          'Refusing to overwrite history. Run `bun run pipeline:backfill` to rebuild, or pass --force to override.',
      };
    }
  }

  // Density uses the advertised month list (the 439-vs-6 failure). Honest rewrite comes after.
  const densitySubject = merged ? payload : args.fresh;
  if (!args.force && fixtureFailsDensityGuard(densitySubject)) {
    const median = medianRecordsPerCountry(densitySubject);
    return {
      ok: false,
      reason:
        `[pipeline] FATAL: fixture density collapse — median ${median} records/country vs ` +
        `${densitySubject.months.length} advertised months ` +
        `(< ${Math.round(0.5 * 100)}%). Refusing to publish empty history. ` +
        'Restore the previous fixture and merge, or pass --force to override.',
    };
  }

  payload = withHonestMonths(payload);
  return { ok: true, payload, merged };
}

export function fixturePublishSummary(
  payload: LandingFixturePayload,
  opts: { merged: boolean; force: boolean; advertisedMonthsBeforeHonest: number },
): FixturePublishSummary {
  return {
    merged: opts.merged,
    force: opts.force,
    months: payload.months.length,
    records: countFixtureRecords(payload),
    median_records_per_country: medianRecordsPerCountry(payload),
    advertised_months_before_honest: opts.advertisedMonthsBeforeHonest,
  };
}
