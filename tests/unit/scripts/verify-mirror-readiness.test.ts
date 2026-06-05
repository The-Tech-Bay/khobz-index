import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  isDuplicateClutterFilename,
  scanTextForViolations,
  verifyMirrorReadiness,
} from '../../../scripts/verify-mirror-readiness.js';

describe('verify-mirror-readiness', () => {
  test('detects duplicate clutter filenames', () => {
    expect(isDuplicateClutterFilename('README 2.md')).toBe(true);
    expect(isDuplicateClutterFilename('.gitignore 2')).toBe(true);
    expect(isDuplicateClutterFilename('README.md')).toBe(false);
  });

  test('flags stale domain on consumer surfaces', () => {
    const { stale } = scanTextForViolations(
      'README.md',
      'Visit https://karama.thebay.ma/khobz for data',
    );
    expect(stale.length).toBeGreaterThan(0);
  });

  test('allows stale domain in shipping history paths', () => {
    const { stale } = scanTextForViolations(
      'docs/shipping v1/phase4-domain-wiring.md',
      'legacy https://karama.thebay.ma/khobz',
    );
    expect(stale).toHaveLength(0);
  });

  test('verifyMirrorReadiness fails when duplicate file present', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kki-mirror-'));
    try {
      await writeFile(join(dir, 'README.md'), '# KKI\n');
      await writeFile(join(dir, 'README 2.md'), '# stale\n');
      const result = await verifyMirrorReadiness(dir);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('README 2.md'))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
