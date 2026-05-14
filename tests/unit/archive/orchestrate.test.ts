import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GitHubReleaseClient } from '../../../src/archive/github-release.js';
import { runMonthlyArchive } from '../../../src/archive/orchestrate.js';
import type { ArchiveFetch, ArchiveLogFile } from '../../../src/archive/types.js';

describe('§3.6B.4 orchestrate', () => {
  test('isFirstMondayOfMonthUtc — first Monday 2026-05-04', async () => {
    const { isFirstMondayOfMonthUtc } = await import('../../../src/archive/orchestrate.js');
    expect(isFirstMondayOfMonthUtc(new Date(Date.UTC(2026, 4, 4)))).toBe(true);
    expect(isFirstMondayOfMonthUtc(new Date(Date.UTC(2026, 4, 11)))).toBe(false);
    expect(isFirstMondayOfMonthUtc(new Date(Date.UTC(2026, 4, 1)))).toBe(false);
  });

  test('runMonthlyArchive: GH blocking + IPFS/IA mocks + release body patch + archive-log', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kki-arch-'));
    let releaseBody = '';

    const client: GitHubReleaseClient = {
      async createRelease(i) {
        releaseBody = i.body;
        return { id: 7, html_url: 'https://gh/o/r/releases/7' };
      },
      async uploadReleaseAsset() {
        /* noop */
      },
      async updateRelease(i) {
        releaseBody = i.body;
      },
    };

    let pinCalled = false;
    const fetchFn: ArchiveFetch = async (input) => {
      const u = String(input);
      if (u.includes('pinata.cloud')) {
        pinCalled = true;
        return new Response(JSON.stringify({ IpfsHash: 'bafyORCH' }), { status: 200 });
      }
      return new Response('', { status: 200 });
    };

    const out = await runMonthlyArchive({
      owner: 'o',
      repo: 'r',
      month: '2026-04',
      jsonBody: '{"rollup":true}\n',
      csvBody: 'country_code,month\n',
      ctx: {
        month: '2026-04',
        methodologyVersion: '1.0.0',
        countryCount: 5,
        sourceStatus: { 'fao-fpi': 'up' },
      },
      pinataJwt: 'jwt',
      iaS3AccessKey: 'a',
      iaS3SecretKey: 'b',
      dataDir: dir,
      githubClient: client,
      fetchFn,
    });

    expect(out.ok).toBe(true);
    expect(out.release?.release_id).toBe(7);
    expect(pinCalled).toBe(true);
    expect(releaseBody).toContain('bafyORCH');
    expect(releaseBody).toContain('https://archive.org/details/khobz-index-2026-04');

    const log = JSON.parse(readFileSync(join(dir, 'archive-log.json'), 'utf8')) as ArchiveLogFile;
    expect(log.entries.some((e) => e.month === '2026-04')).toBe(true);
    const entry = log.entries.find((e) => e.month === '2026-04');
    expect(entry?.status).toBe('complete');

    rmSync(dir, { recursive: true, force: true });
  });

  test('runMonthlyArchive: GitHub createRelease failure skips mirrors', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kki-arch-'));
    let pinCalled = false;

    const client: GitHubReleaseClient = {
      async createRelease() {
        throw new Error('no permission');
      },
      async uploadReleaseAsset() {},
      async updateRelease() {},
    };

    const fetchFn: ArchiveFetch = async () => {
      pinCalled = true;
      return new Response('{}', { status: 200 });
    };

    const out = await runMonthlyArchive({
      owner: 'o',
      repo: 'r',
      month: '2026-04',
      jsonBody: '{}',
      csvBody: 'x\n',
      ctx: {
        month: '2026-04',
        methodologyVersion: '1.0.0',
        countryCount: 1,
        sourceStatus: {},
      },
      dataDir: dir,
      githubClient: client,
      fetchFn,
    });

    expect(out.ok).toBe(false);
    expect(out.error).toContain('no permission');
    expect(pinCalled).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });
});
