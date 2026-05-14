import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resolve `khobz-index/` package root from this module (`src/archive/`). */
export function khobzIndexPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}

export function defaultArchiveDataDir(): string {
  return resolve(khobzIndexPackageRoot(), 'data');
}
