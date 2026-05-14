/**
 * Read-only R2 ↔ StorageBackend adapter (architecture.md §3.1).
 */

import type { PutOpts, StorageBackend } from '../../storage/backend.js';

export class R2StorageBackend implements StorageBackend {
  constructor(private readonly bucket: R2Bucket) {}

  async put(_key: string, _body: string, _opts?: PutOpts): Promise<void> {
    throw new Error('[kki-api] R2 bucket is read-only from the API worker');
  }

  async get(
    key: string,
  ): Promise<{ body: string; customMetadata?: Record<string, string> } | null> {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    const body = await obj.text();
    const m = obj.customMetadata;
    const customMetadata =
      m && typeof m === 'object'
        ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v)]))
        : undefined;
    return { body, customMetadata };
  }

  async head(key: string): Promise<{ exists: boolean; customMetadata?: Record<string, string> }> {
    const h = await this.bucket.head(key);
    if (!h) return { exists: false };
    const m = h.customMetadata;
    const customMetadata =
      m && typeof m === 'object'
        ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v)]))
        : undefined;
    return { exists: true, customMetadata };
  }

  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await this.bucket.list({ prefix, cursor });
      for (const o of page.objects) {
        out.push(o.key);
      }
      if (!page.truncated) break;
      cursor = page.cursor;
    }
    out.sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
    return out;
  }
}
