import type { IndexRecord } from '../../shared/schema.js';

import type { WarningBody } from '../middleware/errors.js';

export function buildIndexWarnings(
  record: IndexRecord,
  opts: { requestedMethodology?: string; manifestGeneratedAt?: string },
): WarningBody[] {
  const out: WarningBody[] = [];

  if (opts.requestedMethodology) {
    const req = opts.requestedMethodology.trim();
    if (req && req !== record.methodology_version) {
      out.push({
        code: 'version-mismatch',
        message: 'Requested methodology version does not match record',
        details: { requested: req, record: record.methodology_version },
      });
    }
  }

  if (record.quality === 'degraded' || record.quality === 'global_only') {
    out.push({
      code: 'source-degraded',
      message: 'Index quality is not full',
      details: { quality: record.quality },
    });
  }

  if (opts.manifestGeneratedAt) {
    const gen = Date.parse(opts.manifestGeneratedAt);
    if (Number.isFinite(gen) && Date.now() - gen > 14 * 24 * 60 * 60 * 1000) {
      out.push({
        code: 'stale-data',
        message: 'Manifest is older than 14 days',
        details: { manifest_generated_at: opts.manifestGeneratedAt },
      });
    }
  }

  return out;
}
