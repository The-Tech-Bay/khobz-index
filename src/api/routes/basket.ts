/**
 * Basket definitions by methodology semver (api-contract.md §2.4).
 */

import type { Context } from 'hono';

import { type BasketVersion, BasketVersionSchema } from '../../shared/schema.js';
import { getStorageBackend } from '../lib/storage-binding.js';
import { pathVersionFromSemver } from '../lib/validate.js';
import { ApiHttpError } from '../middleware/errors.js';
import type { ApiVariables, Env } from '../types.js';

export async function getBasketByVersionHandler(
  c: Context<{ Bindings: Env; Variables: ApiVariables }>,
): Promise<Response> {
  const version = (c.req.param('version') ?? '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new ApiHttpError(400, 'validation-error', 'version must be MAJOR.MINOR.PATCH', {
      version,
    });
  }

  const prefix = pathVersionFromSemver(version);
  const backend = getStorageBackend(c);
  const mergedKey = `${prefix}/baskets.json`;
  const merged = await backend.get(mergedKey);

  const baskets: BasketVersion[] = [];

  if (merged?.body) {
    try {
      const doc = JSON.parse(merged.body) as { baskets?: unknown };
      const rawList = Array.isArray(doc.baskets) ? doc.baskets : [];
      for (const item of rawList) {
        const p = BasketVersionSchema.safeParse(item);
        if (p.success && p.data.methodology_version === version) {
          baskets.push(p.data);
        }
      }
    } catch {
      /* fall through to per-file */
    }
  }

  if (!baskets.length) {
    const keys = await backend.list(`${prefix}/baskets/`);
    for (const key of keys) {
      if (!key.endsWith('.json')) continue;
      const obj = await backend.get(key);
      if (!obj?.body) continue;
      try {
        const p = BasketVersionSchema.safeParse(JSON.parse(obj.body));
        if (p.success && p.data.methodology_version === version) {
          baskets.push(p.data);
        }
      } catch {
        /* skip */
      }
    }
  }

  if (!baskets.length) {
    throw new ApiHttpError(404, 'not-found', 'No basket definitions for methodology version', {
      version,
    });
  }

  baskets.sort((a, b) => a.basket_id.localeCompare(b.basket_id));

  return c.json({
    methodology_version: version,
    baskets,
  });
}
