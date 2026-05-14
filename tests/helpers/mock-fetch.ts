/**
 * Intercept `globalThis.fetch` for adapter unit tests (§3.2B.1).
 */
import { readFileSync } from 'node:fs';

export type MockFetchRule = {
  /** Return true when this rule should serve the response */
  test: (url: string) => boolean;
  /** Absolute path to fixture file */
  fixturePath: string;
  contentType?: string;
  status?: number;
  headers?: Record<string, string>;
};

export function createMockFetch(
  rules: MockFetchRule[],
  fallback?: typeof fetch,
): typeof globalThis.fetch {
  const fn = async (input: Request | string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    for (const r of rules) {
      if (r.test(url)) {
        const body = readFileSync(r.fixturePath, 'utf8');
        return new Response(body, {
          status: r.status ?? 200,
          headers: new Headers({
            'content-type': r.contentType ?? 'application/json',
            ...r.headers,
          }),
        });
      }
    }
    if (fallback) {
      return fallback(input as Parameters<typeof fetch>[0], init);
    }
    return new Response(`mock-fetch: no rule for ${url}`, { status: 404 });
  };
  return fn as typeof globalThis.fetch;
}
