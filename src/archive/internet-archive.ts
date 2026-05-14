/**
 * Internet Archive uploads (§3.6B.3) — S3-like PUT; non-blocking for callers that catch result.
 */

import type { ArchiveFetch } from './types.js';

export interface UploadToInternetArchiveParams {
  accessKey: string | undefined;
  secretKey: string | undefined;
  month: string;
  jsonBody: string;
  csvBody: string;
  /** IA item identifier (must be unique; URL-safe) */
  identifier?: string;
  fetchFn?: ArchiveFetch;
}

export interface UploadToInternetArchiveResult {
  ok: boolean;
  itemUrl: string;
  identifier: string;
  errors: string[];
}

function basicAuthHeader(access: string, secret: string): string {
  const token = Buffer.from(`${access}:${secret}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

/**
 * Upload JSON then CSV to archive.org via `https://s3.us.archive.org/{identifier}/{filename}`.
 * Never throws — returns `ok: false` with errors populated.
 */
export async function uploadToInternetArchive(
  params: UploadToInternetArchiveParams,
): Promise<UploadToInternetArchiveResult> {
  const identifier = (params.identifier ?? `khobz-index-${params.month}`).trim();
  const itemUrl = `https://archive.org/details/${identifier}`;
  const errors: string[] = [];
  const fetchFn: ArchiveFetch = params.fetchFn ?? ((input, init) => globalThis.fetch(input, init));

  if (!params.accessKey?.trim() || !params.secretKey?.trim()) {
    return { ok: false, itemUrl, identifier, errors: ['IA_ACCESS_KEY or IA_SECRET_KEY missing'] };
  }

  const auth = basicAuthHeader(params.accessKey.trim(), params.secretKey.trim());

  const files: { name: string; body: string; contentType: string }[] = [
    {
      name: `khobz-index-${params.month}.json`,
      body: params.jsonBody,
      contentType: 'application/json; charset=utf-8',
    },
    {
      name: `khobz-index-${params.month}.csv`,
      body: params.csvBody,
      contentType: 'text/csv; charset=utf-8',
    },
  ];

  try {
    for (const [i, f] of files.entries()) {
      const url = `https://s3.us.archive.org/${encodeURIComponent(identifier)}/${encodeURIComponent(f.name)}`;
      const headers: Record<string, string> = {
        Authorization: auth,
        'Content-Type': f.contentType,
        'x-amz-auto-make-bucket': '1',
        'x-archive-queue-derive': '0',
        'x-archive-meta-mediatype': 'data',
        'x-archive-meta-title': `Khobz Index ${params.month}`,
        'x-archive-meta-creator': 'Karama Khobz Index',
        'x-archive-meta-date': `${params.month}-01`,
        'x-archive-meta-licenseurl': 'https://creativecommons.org/licenses/by/4.0/',
        'x-archive-meta-collection': 'opensource',
      };
      if (i === 0) {
        headers['x-archive-meta-description'] =
          `Monthly KKI (Khobz Index) rollup for ${params.month}. See https://github.com/ (Karama Khobz Index).`;
      }

      const res = await fetchFn(url, {
        method: 'PUT',
        headers,
        body: f.body,
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        errors.push(`IA ${f.name} HTTP ${res.status}: ${t.slice(0, 400)}`);
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return {
    ok: errors.length === 0,
    itemUrl,
    identifier,
    errors,
  };
}
