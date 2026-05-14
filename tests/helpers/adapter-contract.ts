/**
 * Reusable checks for §3.2B adapter contract.
 */
import { expect } from 'bun:test';
import type { FetchParams, SourceAdapter } from '../../src/shared/schema.js';
import { PriceRecordSchema } from '../../src/shared/schema.js';

export async function assertAdapterResultShape(
  adapter: SourceAdapter,
  params: FetchParams,
): Promise<void> {
  const r = await adapter.fetch(params);
  if (r.ok) {
    expect(r.metadata.source_id).toBe(adapter.id);
    expect(r.metadata.tier).toBe(adapter.tier);
    expect(typeof r.metadata.response_time_ms).toBe('number');
    expect(r.changed === true || r.changed === false).toBe(true);
    if (r.changed) {
      expect(Array.isArray(r.records)).toBe(true);
      for (const rec of r.records) {
        const p = PriceRecordSchema.safeParse(rec);
        expect(p.success).toBe(true);
      }
    } else {
      expect(r.state.content_hash).toMatch(/^[a-f0-9]{64}$/);
    }
  } else {
    expect(r.error.source_id).toBe(adapter.id);
    expect(r.error.timestamp.length).toBeGreaterThan(10);
  }
}
