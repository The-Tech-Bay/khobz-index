import { normalizeVersionPrefix } from './backend.js';

export function versionDir(versionInput: string): string {
  return normalizeVersionPrefix(versionInput);
}

export function countryCodeUpper(cc: string): string {
  return cc.trim().toUpperCase().slice(0, 2);
}

export function keyCountryJson(
  versionInput: string,
  countryCode: string,
  monthYYYYMM: string,
): string {
  const v = versionDir(versionInput);
  const cc = countryCodeUpper(countryCode);
  return `${v}/${cc}/${monthYYYYMM}.json`;
}

export function keyCountryCsv(
  versionInput: string,
  countryCode: string,
  monthYYYYMM: string,
): string {
  const v = versionDir(versionInput);
  const cc = countryCodeUpper(countryCode);
  return `${v}/${cc}/${monthYYYYMM}.csv`;
}

export function keyGlobalJson(versionInput: string, monthYYYYMM: string): string {
  return `${versionDir(versionInput)}/global/${monthYYYYMM}.json`;
}

export function keyManifest(versionInput: string): string {
  return `${versionDir(versionInput)}/manifest.json`;
}

export function keyApkBundle(): string {
  return 'bundle/karama-kki-bundle.json';
}
