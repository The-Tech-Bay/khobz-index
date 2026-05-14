/** Legacy transitional types for incremental pipeline migration. */
export type SnapshotPaths = {
  version: string;
  countryCode: string;
  month: string;
};

export type ManifestMeta = {
  version: string;
  updated_at: string;
  files: Record<string, string>;
};
