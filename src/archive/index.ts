/**
 * §3.6B static archive — GitHub Releases, Pinata IPFS, Internet Archive.
 */

export { defaultArchiveDataDir, khobzIndexPackageRoot } from './env-paths.js';
export {
  applyMirrorPlaceholders,
  buildReleaseNotesBody,
  type CreateMonthlyReleaseParams,
  type CreateMonthlyReleaseResult,
  createMonthlyRelease,
  type GitHubReleaseClient,
  octokitReleaseClient,
} from './github-release.js';
export {
  type UploadToInternetArchiveParams,
  type UploadToInternetArchiveResult,
  uploadToInternetArchive,
} from './internet-archive.js';
export {
  type PinToIpfsParams,
  pinToIpfs,
  readIpfsManifestFile,
  writeIpfsManifestFile,
} from './ipfs-pin.js';
export {
  isFirstMondayOfMonthUtc,
  type RunMonthlyArchiveParams,
  type RunMonthlyArchiveResult,
  runMonthlyArchive,
} from './orchestrate.js';
export {
  type ArchiveFetch,
  type ArchiveLogEntry,
  type ArchiveLogFile,
  type ArchiveLogStatus,
  type IpfsManifestFile,
  type MonthlyReleaseContext,
  PLACEHOLDER_IA_ITEM_URL,
  PLACEHOLDER_IPFS_JSON_CID,
  type SourceStatusMap,
} from './types.js';
