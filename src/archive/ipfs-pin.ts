/**
 * IPFS pinning via Pinata (§3.6B.2) — non-blocking; updates `data/ipfs-manifest.json`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { defaultArchiveDataDir } from './env-paths.js';
import type { ArchiveFetch, IpfsManifestFile } from './types.js';

const PINATA_PIN_FILE = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

function emptyManifest(): IpfsManifestFile {
  return {
    schema_version: '1.0',
    updated_at: new Date().toISOString(),
    pins: {},
  };
}

export function readIpfsManifestFile(absPath: string): IpfsManifestFile {
  try {
    const raw = readFileSync(absPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<IpfsManifestFile>;
    if (parsed.schema_version !== '1.0' || typeof parsed.pins !== 'object' || !parsed.pins) {
      return emptyManifest();
    }
    return {
      schema_version: '1.0',
      updated_at:
        typeof parsed.updated_at === 'string' ? parsed.updated_at : new Date().toISOString(),
      pins: { ...parsed.pins },
    };
  } catch {
    return emptyManifest();
  }
}

export function writeIpfsManifestFile(absPath: string, manifest: IpfsManifestFile): void {
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export interface PinToIpfsParams {
  /** Pinata JWT (`Authorization: Bearer`) */
  jwt: string | undefined;
  month: string;
  jsonBody: string;
  /** Absolute path to `ipfs-manifest.json` */
  manifestPath?: string;
  /** Injected fetch for tests */
  fetchFn?: ArchiveFetch;
}

export interface PinToIpfsResult {
  ok: boolean;
  cid: string;
  error?: string;
}

/**
 * Pin rollup JSON bytes to IPFS. Never throws; returns `cid: "pending"` on failure.
 */
export async function pinToIpfs(params: PinToIpfsParams): Promise<PinToIpfsResult> {
  const manifestPath = params.manifestPath ?? `${defaultArchiveDataDir()}/ipfs-manifest.json`;
  const fetchFn: ArchiveFetch = params.fetchFn ?? ((input, init) => globalThis.fetch(input, init));

  const manifest = readIpfsManifestFile(manifestPath);
  manifest.updated_at = new Date().toISOString();

  if (!params.jwt?.trim()) {
    manifest.pins[params.month] = 'pending';
    writeIpfsManifestFile(manifestPath, manifest);
    return { ok: false, cid: 'pending', error: 'PINATA_JWT missing' };
  }

  try {
    const blob = new Blob([params.jsonBody], { type: 'application/json' });
    const form = new FormData();
    form.append('file', blob, `khobz-index-${params.month}.json`);

    const res = await fetchFn(PINATA_PIN_FILE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.jwt.trim()}`,
      },
      body: form,
    });

    const text = await res.text();
    if (!res.ok) {
      manifest.pins[params.month] = 'pending';
      writeIpfsManifestFile(manifestPath, manifest);
      return {
        ok: false,
        cid: 'pending',
        error: `Pinata HTTP ${res.status}: ${text.slice(0, 500)}`,
      };
    }

    let ipfsHash: string | undefined;
    try {
      const j = JSON.parse(text) as { IpfsHash?: string; ipfsPinHash?: string };
      ipfsHash = j.IpfsHash ?? j.ipfsPinHash;
    } catch {
      /* ignore */
    }
    if (!ipfsHash) {
      manifest.pins[params.month] = 'pending';
      writeIpfsManifestFile(manifestPath, manifest);
      return { ok: false, cid: 'pending', error: 'Pinata: no IpfsHash in response' };
    }

    manifest.pins[params.month] = ipfsHash;
    writeIpfsManifestFile(manifestPath, manifest);
    return { ok: true, cid: ipfsHash };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    manifest.pins[params.month] = 'pending';
    writeIpfsManifestFile(manifestPath, manifest);
    return { ok: false, cid: 'pending', error: msg };
  }
}
