/**
 * Monthly archive orchestrator (§3.6B.4) — GitHub Release (blocking) → IPFS + IA (parallel, best-effort) → release notes patch → `data/archive-log.json`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Octokit } from '@octokit/rest';
import { defaultArchiveDataDir } from './env-paths.js';
import {
  applyMirrorPlaceholders,
  type CreateMonthlyReleaseResult,
  createMonthlyRelease,
  type GitHubReleaseClient,
  octokitReleaseClient,
} from './github-release.js';
import { type UploadToInternetArchiveResult, uploadToInternetArchive } from './internet-archive.js';
import { type PinToIpfsResult, pinToIpfs } from './ipfs-pin.js';
import type {
  ArchiveFetch,
  ArchiveLogEntry,
  ArchiveLogFile,
  MonthlyReleaseContext,
} from './types.js';

export function isFirstMondayOfMonthUtc(d: Date): boolean {
  return d.getUTCDay() === 1 && d.getUTCDate() <= 7;
}

function readArchiveLog(absPath: string): ArchiveLogFile {
  try {
    const raw = readFileSync(absPath, 'utf8');
    const p = JSON.parse(raw) as Partial<ArchiveLogFile>;
    if (p.schema_version !== '1.0' || !Array.isArray(p.entries)) {
      return { schema_version: '1.0', updated_at: new Date().toISOString(), entries: [] };
    }
    return {
      schema_version: '1.0',
      updated_at: typeof p.updated_at === 'string' ? p.updated_at : new Date().toISOString(),
      entries: [...p.entries],
    };
  } catch {
    return { schema_version: '1.0', updated_at: new Date().toISOString(), entries: [] };
  }
}

function writeArchiveLog(absPath: string, log: ArchiveLogFile): void {
  mkdirSync(dirname(absPath), { recursive: true });
  log.updated_at = new Date().toISOString();
  writeFileSync(absPath, `${JSON.stringify(log, null, 2)}\n`, 'utf8');
}

function upsertEntry(log: ArchiveLogFile, entry: ArchiveLogEntry): void {
  const i = log.entries.findIndex((e) => e.month === entry.month);
  if (i >= 0) log.entries[i] = entry;
  else log.entries.push(entry);
  log.entries.sort((a, b) => a.month.localeCompare(b.month));
}

export interface RunMonthlyArchiveParams {
  owner: string;
  repo: string;
  /** Required unless `githubClient` is injected (e.g. tests). */
  token?: string;
  month: string;
  jsonBody: string;
  csvBody: string;
  ctx: MonthlyReleaseContext;
  pinataJwt?: string;
  iaS3AccessKey?: string;
  iaS3SecretKey?: string;
  dataDir?: string;
  octokit?: Octokit;
  githubClient?: GitHubReleaseClient;
  fetchFn?: ArchiveFetch;
}

export interface RunMonthlyArchiveResult {
  ok: boolean;
  release?: CreateMonthlyReleaseResult;
  ipfs: PinToIpfsResult;
  ia: UploadToInternetArchiveResult;
  archiveLogPath: string;
  error?: string;
}

function mirrorStatus(
  ipfsR: PinToIpfsResult,
  iaR: UploadToInternetArchiveResult,
): ArchiveLogEntry['status'] {
  if (ipfsR.ok && iaR.ok) return 'complete';
  if (!ipfsR.ok && !iaR.ok && ipfsR.cid === 'pending' && !iaR.ok) return 'partial';
  return 'partial';
}

/**
 * Full monthly archive publish. GitHub steps are blocking; IPFS and IA never throw.
 */
export async function runMonthlyArchive(
  params: RunMonthlyArchiveParams,
): Promise<RunMonthlyArchiveResult> {
  const dataDir = params.dataDir ?? defaultArchiveDataDir();
  const archiveLogPath = `${dataDir}/archive-log.json`;
  const ipfsManifestPath = `${dataDir}/ipfs-manifest.json`;

  const client =
    params.githubClient ??
    octokitReleaseClient(params.octokit ?? new Octokit({ auth: params.token ?? '' }));

  let release: CreateMonthlyReleaseResult;
  try {
    release = await createMonthlyRelease({
      owner: params.owner,
      repo: params.repo,
      client,
      month: params.month,
      jsonBody: params.jsonBody,
      csvBody: params.csvBody,
      ctx: params.ctx,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stubIa: UploadToInternetArchiveResult = {
      ok: false,
      identifier: `khobz-index-${params.month}`,
      itemUrl: `https://archive.org/details/khobz-index-${params.month}`,
      errors: [msg],
    };
    return {
      ok: false,
      error: msg,
      ipfs: { ok: false, cid: 'pending', error: msg },
      ia: stubIa,
      archiveLogPath,
    };
  }

  const [ipfsR, iaR] = await Promise.all([
    pinToIpfs({
      jwt: params.pinataJwt,
      month: params.month,
      jsonBody: params.jsonBody,
      manifestPath: ipfsManifestPath,
      fetchFn: params.fetchFn,
    }),
    uploadToInternetArchive({
      accessKey: params.iaS3AccessKey,
      secretKey: params.iaS3SecretKey,
      month: params.month,
      jsonBody: params.jsonBody,
      csvBody: params.csvBody,
      fetchFn: params.fetchFn,
    }),
  ]);

  const ipfsNote = ipfsR.ok ? ipfsR.cid : `pending (${ipfsR.error ?? 'unknown'})`;
  const iaNote = iaR.ok ? iaR.itemUrl : `pending (${iaR.errors.join('; ') || 'unknown'})`;

  const newBody = applyMirrorPlaceholders(release.body, ipfsNote, iaNote);

  await client.updateRelease({
    owner: params.owner,
    repo: params.repo,
    release_id: release.release_id,
    body: newBody,
  });

  const warnings: string[] = [];
  if (!ipfsR.ok) warnings.push(`ipfs: ${ipfsR.error ?? 'pending'}`);
  if (!iaR.ok) warnings.push(`ia: ${iaR.errors.join('; ')}`);

  const now = new Date().toISOString();
  const log = readArchiveLog(archiveLogPath);
  const previous = log.entries.find((e) => e.month === params.month);
  const entry: ArchiveLogEntry = {
    month: params.month,
    release_id: release.release_id,
    release_url: release.release_url,
    tag: release.tag,
    ipfs_cid_json: ipfsR.cid,
    ia_item_url: iaR.ok ? iaR.itemUrl : 'pending',
    json_sha256: release.jsonSha256,
    csv_sha256: release.csvSha256,
    created_at: previous?.created_at ?? now,
    updated_at: now,
    status: mirrorStatus(ipfsR, iaR),
    warnings,
  };
  upsertEntry(log, entry);
  writeArchiveLog(archiveLogPath, log);

  return {
    ok: true,
    release,
    ipfs: ipfsR,
    ia: iaR,
    archiveLogPath,
  };
}
