/**
 * APK / offline bundle (§3.4B.5 — docs/kki/kki_research.md §4.3 ~24 KB gzip).
 */

import type { IndexRecord, KkiApkBundle } from '../shared/schema.js';
import {
  ApkMonthRecordSchema,
  KkiApkBundleSchema,
  SlimIndexRecordSchema,
} from '../shared/schema.js';
import type { StorageBackend } from './backend.js';
import { digestWithMetadata } from './integrity.js';
import { keyApkBundle } from './paths.js';

export const APK_BUNDLE_GZIP_BUDGET_BYTES = 24 * 1024;

function toSlim(record: IndexRecord): Omit<IndexRecord, 'source_summary'> {
  const { source_summary: _s, ...rest } = record;
  void _s;
  return SlimIndexRecordSchema.parse(rest);
}

/** Most recent `n` months first (YYYY-MM lexical works for ISO months). */
function takeRecentMonths(monthsSortedAsc: IndexRecord[], n: number): IndexRecord[] {
  const uniq = [...new Map(monthsSortedAsc.map((r) => [r.month, r])).values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  return uniq.slice(-n);
}

export type BundleBuildPhase = 'months_12' | 'months_6' | 'costs_stripped';

export interface OfflineBundleBuildOutput {
  bundle: KkiApkBundle;
  gzipBytes: number;
  phase: BundleBuildPhase;
  warnings: string[];
}

/**
 * Produce an offline-first JSON bundle sized for gzip APK embedding.
 *
 * Fallback order matches masterTODO-trackB §3.4B.5 DoD: 12→6 months→drop cost breakdown.
 */
export function buildOfflineApkBundle(inputs: {
  methodology_version: string;
  generated_at_iso?: string;
  /** Months per country — may be sparse; duplicated months last-write-wins inside same input. */
  byCountryMonths: Record<string, IndexRecord[]>;
}): OfflineBundleBuildOutput {
  const warnings: string[] = [];

  function assemble(
    horizon: number,
    stripCosts: boolean,
  ): { bundle: KkiApkBundle; gzipBytes: number } {
    const countries: KkiApkBundle['countries'] = {};
    for (const [ccRaw, months] of Object.entries(inputs.byCountryMonths)) {
      const cc = ccRaw.toUpperCase().slice(0, 2);
      const picked = takeRecentMonths(months, horizon).map((r) => {
        const slim = toSlim(r);
        if (!stripCosts) return ApkMonthRecordSchema.parse(slim);
        const { local_basket_cost: _l, global_basket_cost: _g, ...rest } = slim;
        void _l;
        void _g;
        return ApkMonthRecordSchema.parse(rest);
      });
      countries[cc] = { months: picked };
    }

    const bundleCandidate: KkiApkBundle = {
      generated_at: inputs.generated_at_iso ?? new Date().toISOString(),
      methodology_version: inputs.methodology_version,
      countries,
    };

    const bundle = KkiApkBundleSchema.parse(bundleCandidate);
    const json = `${JSON.stringify(bundle)}\n`;
    const gzipBytes = Bun.gzipSync(json).byteLength;
    return { bundle, gzipBytes };
  }

  let phase: BundleBuildPhase = 'months_12';
  let { bundle, gzipBytes } = assemble(12, false);

  if (gzipBytes > APK_BUNDLE_GZIP_BUDGET_BYTES) {
    warnings.push(
      `[kki-bundle] gzip ${gzipBytes}B exceeds ${APK_BUNDLE_GZIP_BUDGET_BYTES}B — narrowing to last 6 months.`,
    );
    phase = 'months_6';
    ({ bundle, gzipBytes } = assemble(6, false));
  }

  if (gzipBytes > APK_BUNDLE_GZIP_BUDGET_BYTES) {
    warnings.push(
      `[kki-bundle] gzip ${gzipBytes}B exceeds budget after 6‑month trim — stripping local/global basket costs.`,
    );
    phase = 'costs_stripped';
    ({ bundle, gzipBytes } = assemble(6, true));
  }

  if (gzipBytes > APK_BUNDLE_GZIP_BUDGET_BYTES) {
    warnings.push(
      `[kki-bundle] gzip ${gzipBytes}B still exceeds ${APK_BUNDLE_GZIP_BUDGET_BYTES}B after fallbacks.`,
    );
  }

  return { bundle, gzipBytes, phase, warnings };
}

export async function persistApkBundle(
  backend: StorageBackend,
  bundle: KkiApkBundle,
): Promise<void> {
  const body = `${JSON.stringify(bundle, null, 2)}\n`;
  const d = await digestWithMetadata(body);
  await backend.put(keyApkBundle(), body, {
    contentType: 'application/json',
    customMetadata: d.customMetadata,
  });
}

export function gzipSizeJson(obj: unknown): number {
  return Bun.gzipSync(`${JSON.stringify(obj)}\n`).byteLength;
}
