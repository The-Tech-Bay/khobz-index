import { describe, expect, test } from 'bun:test';
import {
  applyMirrorPlaceholders,
  buildReleaseNotesBody,
  createMonthlyRelease,
  type GitHubReleaseClient,
} from '../../../src/archive/github-release.js';
import { PLACEHOLDER_IA_ITEM_URL, PLACEHOLDER_IPFS_JSON_CID } from '../../../src/archive/types.js';

describe('§3.6B.1 github-release', () => {
  test('buildReleaseNotesBody includes methodology, hashes, placeholders', () => {
    const body = buildReleaseNotesBody({
      ctx: {
        month: '2026-04',
        methodologyVersion: '1.0.0',
        countryCount: 12,
        sourceStatus: { 'fao-fpi': 'up', 'wfp-vam': 'degraded' },
        qualitySummary: 'mostly full',
      },
      jsonSha256: 'a'.repeat(64),
      csvSha256: 'b'.repeat(64),
    });
    expect(body).toContain('2026-04');
    expect(body).toContain('1.0.0');
    expect(body).toContain('12');
    expect(body).toContain('`fao-fpi`');
    expect(body).toContain(PLACEHOLDER_IPFS_JSON_CID);
    expect(body).toContain(PLACEHOLDER_IA_ITEM_URL);
  });

  test('applyMirrorPlaceholders replaces tokens', () => {
    const raw = `ipfs ${PLACEHOLDER_IPFS_JSON_CID} ia ${PLACEHOLDER_IA_ITEM_URL}`;
    expect(applyMirrorPlaceholders(raw, 'bafyTEST', 'https://archive.org/details/x')).toBe(
      'ipfs bafyTEST ia https://archive.org/details/x',
    );
  });

  test('createMonthlyRelease creates release + uploads both assets', async () => {
    const uploads: { name: string; size: number }[] = [];
    let updatedBody = '';

    const client: GitHubReleaseClient = {
      async createRelease(i) {
        expect(i.tag_name).toBe('v2026-04');
        expect(i.name).toContain('2026-04');
        expect(i.body).toContain(PLACEHOLDER_IPFS_JSON_CID);
        return { id: 99, html_url: 'https://example.com/release/99' };
      },
      async uploadReleaseAsset(i) {
        uploads.push({ name: i.name, size: i.data.byteLength });
      },
      async updateRelease(i) {
        updatedBody = i.body;
      },
    };

    const res = await createMonthlyRelease({
      owner: 'o',
      repo: 'r',
      client,
      month: '2026-04',
      jsonBody: '{"x":1}\n',
      csvBody: 'a,b\n',
      ctx: {
        month: '2026-04',
        methodologyVersion: '1.0.0',
        countryCount: 3,
        sourceStatus: {},
      },
    });

    expect(res.release_id).toBe(99);
    expect(res.release_url).toContain('99');
    expect(res.tag).toBe('v2026-04');
    expect(uploads.map((u) => u.name).sort()).toEqual([
      'khobz-index-2026-04.csv',
      'khobz-index-2026-04.json',
    ]);
    expect(uploads.every((u) => u.size > 0)).toBe(true);
    expect(res.jsonSha256).toHaveLength(64);
    expect(res.csvSha256).toHaveLength(64);
    void updatedBody;
  });
});
