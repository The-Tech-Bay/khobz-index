/**
 * GitHub Release publisher (§3.6B.1) — monthly rollup assets + release notes template.
 */

import type { Octokit } from '@octokit/rest';
import { computeSha256Hex } from '../storage/integrity.js';
import {
  type MonthlyReleaseContext,
  PLACEHOLDER_IA_ITEM_URL,
  PLACEHOLDER_IPFS_JSON_CID,
  type SourceStatusMap,
} from './types.js';

export interface GitHubReleaseClient {
  createRelease(input: {
    owner: string;
    repo: string;
    tag_name: string;
    name: string;
    body: string;
  }): Promise<{ id: number; html_url: string }>;
  uploadReleaseAsset(input: {
    owner: string;
    repo: string;
    release_id: number;
    name: string;
    data: Uint8Array;
    contentType: string;
  }): Promise<void>;
  updateRelease(input: {
    owner: string;
    repo: string;
    release_id: number;
    body: string;
  }): Promise<void>;
}

function sourceStatusMarkdown(s: SourceStatusMap): string {
  const lines = Object.entries(s)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `- \`${k}\`: ${v}`);
  return lines.length ? lines.join('\n') : '- _(no source status provided)_';
}

/**
 * Release notes body with placeholders for IPFS CID and IA URL (filled by orchestrator).
 */
export function buildReleaseNotesBody(input: {
  ctx: MonthlyReleaseContext;
  jsonSha256: string;
  csvSha256: string;
}): string {
  const { ctx, jsonSha256, csvSha256 } = input;
  const qual = ctx.qualitySummary?.trim() || '_see per-country `quality` in JSON_';
  return [
    `## Khobz Index — monthly archive (${ctx.month})`,
    '',
    `- **Methodology version:** ${ctx.methodologyVersion}`,
    `- **Countries in rollup:** ${ctx.countryCount}`,
    `- **Quality summary:** ${qual}`,
    '',
    '### Source status (pipeline)',
    sourceStatusMarkdown(ctx.sourceStatus),
    '',
    '### Integrity (SHA-256)',
    '',
    `- \`khobz-index-${ctx.month}.json\`: \`${jsonSha256}\``,
    `- \`khobz-index-${ctx.month}.csv\`: \`${csvSha256}\``,
    '',
    '### Permanent mirrors',
    '',
    `- **IPFS (JSON, Pinata):** \`${PLACEHOLDER_IPFS_JSON_CID}\``,
    `- **Internet Archive:** ${PLACEHOLDER_IA_ITEM_URL}`,
    '',
    '---',
    '',
    'Data licensed **CC BY 4.0** — see [`data/README.md`](../../data/README.md) in this repository.',
  ].join('\n');
}

export function octokitReleaseClient(octokit: Octokit): GitHubReleaseClient {
  return {
    async createRelease(i) {
      const { data } = await octokit.rest.repos.createRelease({
        owner: i.owner,
        repo: i.repo,
        tag_name: i.tag_name,
        name: i.name,
        body: i.body,
        draft: false,
        prerelease: false,
        generate_release_notes: false,
      });
      if (!data.id || !data.html_url) {
        throw new Error('createRelease: missing id or html_url');
      }
      return { id: data.id, html_url: data.html_url };
    },
    async uploadReleaseAsset(i) {
      await octokit.rest.repos.uploadReleaseAsset({
        owner: i.owner,
        repo: i.repo,
        release_id: i.release_id,
        name: i.name,
        headers: {
          'content-type': i.contentType,
          'content-length': String(i.data.byteLength),
        },
        data: Buffer.from(i.data) as unknown as string,
      });
    },
    async updateRelease(i) {
      await octokit.rest.repos.updateRelease({
        owner: i.owner,
        repo: i.repo,
        release_id: i.release_id,
        body: i.body,
      });
    },
  };
}

export interface CreateMonthlyReleaseParams {
  owner: string;
  repo: string;
  client: GitHubReleaseClient;
  month: string;
  jsonBody: string;
  csvBody: string;
  ctx: MonthlyReleaseContext;
}

export interface CreateMonthlyReleaseResult {
  release_id: number;
  release_url: string;
  tag: string;
  body: string;
  jsonSha256: string;
  csvSha256: string;
}

const textEncoder = new TextEncoder();

/**
 * Creates tag `vYYYY-MM`, uploads JSON + CSV assets, returns release metadata.
 * Blocking step for the archive pipeline.
 */
export async function createMonthlyRelease(
  params: CreateMonthlyReleaseParams,
): Promise<CreateMonthlyReleaseResult> {
  const tag = `v${params.month}`;
  const [jsonSha256, csvSha256] = await Promise.all([
    computeSha256Hex(params.jsonBody),
    computeSha256Hex(params.csvBody),
  ]);
  const body = buildReleaseNotesBody({
    ctx: params.ctx,
    jsonSha256,
    csvSha256,
  });

  const { id, html_url } = await params.client.createRelease({
    owner: params.owner,
    repo: params.repo,
    tag_name: tag,
    name: `Khobz Index ${params.month}`,
    body,
  });

  const jsonName = `khobz-index-${params.month}.json`;
  const csvName = `khobz-index-${params.month}.csv`;

  await params.client.uploadReleaseAsset({
    owner: params.owner,
    repo: params.repo,
    release_id: id,
    name: jsonName,
    data: textEncoder.encode(params.jsonBody),
    contentType: 'application/json; charset=utf-8',
  });

  await params.client.uploadReleaseAsset({
    owner: params.owner,
    repo: params.repo,
    release_id: id,
    name: csvName,
    data: textEncoder.encode(params.csvBody),
    contentType: 'text/csv; charset=utf-8',
  });

  return {
    release_id: id,
    release_url: html_url,
    tag,
    body,
    jsonSha256,
    csvSha256,
  };
}

/**
 * Replace mirror placeholders after IPFS / IA steps complete.
 */
export function applyMirrorPlaceholders(
  notesBody: string,
  ipfsCidOrPending: string,
  iaUrlOrPending: string,
): string {
  return notesBody
    .replaceAll(PLACEHOLDER_IPFS_JSON_CID, ipfsCidOrPending)
    .replaceAll(PLACEHOLDER_IA_ITEM_URL, iaUrlOrPending);
}
