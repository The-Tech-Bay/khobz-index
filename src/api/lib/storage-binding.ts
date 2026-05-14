import type { Context } from 'hono';

import type { StorageBackend } from '../../storage/backend.js';
import type { ApiVariables, Env } from '../types.js';
import { R2StorageBackend } from './r2-backend.js';

export function getStorageBackend(
  c: Context<{ Bindings: Env; Variables: ApiVariables }>,
): StorageBackend {
  if (c.env.TEST_STORAGE_BACKEND) {
    return c.env.TEST_STORAGE_BACKEND;
  }
  return new R2StorageBackend(c.env.KKI_DATA);
}
