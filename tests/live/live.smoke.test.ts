/**
 * Live / integration tests — excluded from default `bun run test` (CI runs only tests/unit).
 * Opt-in with LIVE_API=1 when exercising real upstream APIs (§3.2B+).
 */
import { describe, expect, test } from 'bun:test';

const liveEnabled = process.env.LIVE_API === '1';

describe('@live', () => {
  test.skipIf(!liveEnabled)('placeholder — hits real APIs when LIVE_API=1', async () => {
    // §3.2B: wire adapter integration tests here (FAO, WFP, etc.).
    expect(liveEnabled).toBe(true);
  });
});
