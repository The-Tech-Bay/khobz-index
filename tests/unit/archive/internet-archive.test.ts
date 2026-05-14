import { describe, expect, test } from 'bun:test';
import { uploadToInternetArchive } from '../../../src/archive/internet-archive.js';
import type { ArchiveFetch } from '../../../src/archive/types.js';

describe('§3.6B.3 internet-archive', () => {
  test('missing credentials returns ok false', async () => {
    const r = await uploadToInternetArchive({
      accessKey: '',
      secretKey: '',
      month: '2026-04',
      jsonBody: '{}',
      csvBody: 'h\n',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  test('successful PUTs for json and csv', async () => {
    const calls: string[] = [];
    const fetchFn: ArchiveFetch = async (input) => {
      calls.push(String(input));
      return new Response('', { status: 200 });
    };

    const r = await uploadToInternetArchive({
      accessKey: 'acc',
      secretKey: 'sec',
      month: '2026-04',
      jsonBody: '{}',
      csvBody: 'x\n',
      fetchFn,
    });
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('khobz-index-2026-04.json');
    expect(calls[1]).toContain('khobz-index-2026-04.csv');
    expect(calls[0]).toContain('/khobz-index-2026-04/');
  });

  test('non-OK response collects errors', async () => {
    const fetchFn: ArchiveFetch = async () => new Response('bad', { status: 403 });
    const r = await uploadToInternetArchive({
      accessKey: 'a',
      secretKey: 'b',
      month: '2026-04',
      jsonBody: '{}',
      csvBody: 'x\n',
      fetchFn,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBe(2);
  });
});
