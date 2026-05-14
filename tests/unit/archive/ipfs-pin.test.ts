import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pinToIpfs } from '../../../src/archive/ipfs-pin.js';
import type { ArchiveFetch } from '../../../src/archive/types.js';

describe('§3.6B.2 ipfs-pin', () => {
  test('missing JWT yields pending and writes manifest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kki-ipfs-'));
    try {
      const manifestPath = join(dir, 'ipfs-manifest.json');
      const r = await pinToIpfs({
        jwt: undefined,
        month: '2026-04',
        jsonBody: '{}',
        manifestPath,
      });
      expect(r.ok).toBe(false);
      expect(r.cid).toBe('pending');
      const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as { pins: Record<string, string> };
      expect(m.pins['2026-04']).toBe('pending');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('success extracts IpfsHash', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kki-ipfs-'));
    try {
      const manifestPath = join(dir, 'ipfs-manifest.json');
      const fetchFn: ArchiveFetch = async () =>
        new Response(JSON.stringify({ IpfsHash: 'bafybeiSUCCESS' }), { status: 200 });

      const r = await pinToIpfs({
        jwt: 'test-jwt',
        month: '2026-05',
        jsonBody: '{"a":1}',
        manifestPath,
        fetchFn,
      });
      expect(r.ok).toBe(true);
      expect(r.cid).toBe('bafybeiSUCCESS');
      const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as { pins: Record<string, string> };
      expect(m.pins['2026-05']).toBe('bafybeiSUCCESS');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('HTTP error does not throw; cid pending', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kki-ipfs-'));
    try {
      const manifestPath = join(dir, 'ipfs-manifest.json');
      const fetchFn: ArchiveFetch = async () => new Response('no', { status: 502 });

      const r = await pinToIpfs({
        jwt: 'x',
        month: '2026-06',
        jsonBody: '{}',
        manifestPath,
        fetchFn,
      });
      expect(r.ok).toBe(false);
      expect(r.cid).toBe('pending');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
