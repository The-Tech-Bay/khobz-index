/**
 * Storage backends for R2 / tests (architecture.md §3.1 — S3 API vs Worker binding abstraction).
 */

export type PutOpts = {
  contentType?: string;
  /** R2/S3-compatible custom metadata (stored per object). */
  customMetadata?: Record<string, string>;
};

/** Abstract object storage used by snapshot writer, reader, and integrity checks. */
export interface StorageBackend {
  put(key: string, body: string, opts?: PutOpts): Promise<void>;
  get(key: string): Promise<{ body: string; customMetadata?: Record<string, string> } | null>;
  head(key: string): Promise<{ exists: boolean; customMetadata?: Record<string, string> }>;
  /** Sorted object keys matching prefix (for optional discovery / tests). */
  list(prefix: string): Promise<string[]>;
}

type Stored = { body: string; meta: Record<string, string>; contentType?: string };

export class InMemoryBackend implements StorageBackend {
  private readonly store = new Map<string, Stored>();

  async put(key: string, body: string, opts?: PutOpts): Promise<void> {
    this.store.set(key, {
      body,
      meta: opts?.customMetadata ? { ...opts.customMetadata } : {},
      contentType: opts?.contentType,
    });
  }

  async get(
    key: string,
  ): Promise<{ body: string; customMetadata?: Record<string, string> } | null> {
    const row = this.store.get(key);
    if (!row) return null;
    return { body: row.body, customMetadata: row.meta };
  }

  async head(key: string): Promise<{ exists: boolean; customMetadata?: Record<string, string> }> {
    const row = this.store.get(key);
    if (!row) return { exists: false };
    return { exists: true, customMetadata: row.meta };
  }

  async list(prefix: string): Promise<string[]> {
    const keys = [...this.store.keys()].filter((k) => k.startsWith(prefix));
    keys.sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
    return keys;
  }

  /** Test helper: mutate body to simulate corruption. */
  _unsafeSetBody(key: string, body: string): void {
    const row = this.store.get(key);
    if (!row) return;
    this.store.set(key, { ...row, body });
  }
}

/** Normalize `{version}` to `v1.0` style (architecture.md §3 — major.minor paths). */
export function normalizeVersionPrefix(versionInput: string): string {
  const t = versionInput.trim();
  const inner = t.toLowerCase().startsWith('v') ? t.slice(1).trim() : t;
  if (!/^\d+\.\d+$/.test(inner)) {
    throw new Error(
      `Invalid methodology path version "${versionInput}" — expected \`vM.m\` or \`M.m\` (e.g. v1.0).`,
    );
  }
  return `v${inner}`;
}
