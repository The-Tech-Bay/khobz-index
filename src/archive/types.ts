/**
 * Shared types for §3.6B static archive pipeline (GitHub Releases, IPFS, Internet Archive).
 */

/** Placeholders in release notes; orchestrator replaces after mirrors complete. */
export const PLACEHOLDER_IPFS_JSON_CID = '__KKI_IPFS_JSON_CID__';
export const PLACEHOLDER_IA_ITEM_URL = '__KKI_IA_ITEM_URL__';

/** Narrow fetch surface for archive clients + tests (avoids Bun `fetch.preconnect` typing mismatch). */
export type ArchiveFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type SourceStatusMap = Record<string, string>;

export interface MonthlyReleaseContext {
  month: string;
  methodologyVersion: string;
  countryCount: number;
  sourceStatus: SourceStatusMap;
  /** Optional one-line quality rollup for release notes */
  qualitySummary?: string;
}

export interface IpfsManifestFile {
  schema_version: '1.0';
  updated_at: string;
  /** Month YYYY-MM → IPFS CID (v1) or `"pending"` if pin did not succeed */
  pins: Record<string, string>;
}

export type ArchiveLogStatus = 'complete' | 'partial' | 'failed';

export interface ArchiveLogEntry {
  month: string;
  release_id?: number;
  release_url: string;
  tag: string;
  ipfs_cid_json: string;
  ia_item_url: string;
  json_sha256: string;
  csv_sha256: string;
  created_at: string;
  updated_at: string;
  status: ArchiveLogStatus;
  warnings: string[];
}

export interface ArchiveLogFile {
  schema_version: '1.0';
  updated_at: string;
  entries: ArchiveLogEntry[];
}
