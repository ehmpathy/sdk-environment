import { tmpdir } from 'os';
import { join } from 'path';

import type { EnvironmentAccessTier } from '@src/domain.objects/EnvironmentAccessTier';

import { asCacheKeyFromAccessKeyId } from './asCacheKeyFromAccessKeyId';
import { getAccessKeyIdFromAccountClient } from './getAccessKeyIdFromAccountClient';
import { isCredentialError } from './isCredentialError';
import { isModuleNotFoundError } from './isModuleNotFoundError';
import { isServerTransientError } from './isServerTransientError';
import { withCacheAcrossProcesses } from './withCacheAcrossProcesses';
import { withRetryOnThrottle } from './withRetryOnThrottle';

/**
 * .what = account name pattern to access tier map
 * .why = enables glob and exact pattern match
 * .note = canonical name, reused by alias parser
 */
export interface AwsAccountPatternMap {
  [pattern: string]: EnvironmentAccessTier;
}

const DEFAULT_MAP: AwsAccountPatternMap = {
  '*-prod': 'prod',
  '*-prep': 'prep',
  '*-test': 'test',
};

/**
 * .what = match name against pattern map
 * .why = exact match wins, then glob match in order
 */
export const matchNameToAccess = (
  name: string,
  map: AwsAccountPatternMap,
): EnvironmentAccessTier | null => {
  // exact match first
  if (map[name]) return map[name]!;

  // glob match in order
  for (const pattern of Object.keys(map)) {
    if (pattern.includes('*')) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      if (regex.test(name)) return map[pattern]!;
    }
  }

  return null;
};

/**
 * .what = the aws account calls this parser needs
 * .why = one seam for the real sdk and for a test double
 */
export interface SdkAwsAccount {
  /**
   * reads the caller's access key id from its loaded credentials. no aws api call
   * for static (env) credentials; a profile provider (sso, assume-role, instance role)
   * loads them from its own source, once per process
   * null = the client holds no credential provider (e.g. a module-level mock), so no key names the caller
   */
  getAccessKeyId: () => Promise<string | null>;
  /** calls GetAccountInformation */
  getAccountName: () => Promise<string | null>;
}

/**
 * .what = build the real aws account sdk
 * .why = dynamic import keeps the optional peer dep out of the bundle when unused
 */
const getSdkAwsAccountDefault = async (): Promise<SdkAwsAccount> => {
  const { AccountClient, GetAccountInformationCommand } = await import(
    '@aws-sdk/client-account'
  );
  const client = new AccountClient({});
  return {
    getAccessKeyId: () => getAccessKeyIdFromAccountClient({ client }),
    getAccountName: async () =>
      (await client.send(new GetAccountInformationCommand({}))).AccountName ??
      null,
  };
};

/**
 * .what = where the shared account-name cache lives on this host
 * .why = one dir per os account (uid) under the os temp dir, so accounts never share or block each other
 */
const getCacheDirDefault = (): string =>
  join(
    tmpdir(),
    `sdk-environment.uid=${process.getuid?.() ?? 'na'}`,
    'aws-account-name',
  );

/**
 * .what = shared cache + throttle retry tune
 * .why = ttl bounds how long a rename takes to show; retry outlasts the sdk's own 3 attempts;
 *        a live holder's lock is never broken before the stale bound
 */
const CACHE_TTL_MS = 15 * 60 * 1000;
const LOCK_STALE_MS = 60 * 1000;
const LOCK_POLL_MS = 75;
const RETRY = { attempts: 6, baseMs: 250, capMs: 4000 };

/**
 * .what = parse access tier from aws account name
 * .why = fallback when alias not set (name is always present)
 * .note = the name is shared across processes via a file cache keyed by the
 *         caller's access key id, so N cold processes make one aws call;
 *         a throttle reply backs off and retries
 */
export const getEnvAccessFromAwsAccountName = async (
  input?: {
    map?: AwsAccountPatternMap;
  },
  context?: {
    sdkAwsAccount?: SdkAwsAccount;
    cacheDir?: string;
  },
): Promise<EnvironmentAccessTier | null> => {
  const map = input?.map ?? DEFAULT_MAP;

  try {
    const sdkAwsAccount =
      context?.sdkAwsAccount ?? (await getSdkAwsAccountDefault());

    // fetch once per host per caller; retry on throttle
    const getAccountNameDirect = withRetryOnThrottle(
      () => sdkAwsAccount.getAccountName(), // bound at the seam, so a class-based double keeps its `this`
      RETRY,
    );
    const getAccountNameShared = withCacheAcrossProcesses(
      getAccountNameDirect,
      {
        dir: context?.cacheDir ?? getCacheDirDefault(),
        ttlMs: CACHE_TTL_MS,
        staleMs: LOCK_STALE_MS,
        pollMs: LOCK_POLL_MS,
        isQueueKeptOnError: isServerTransientError, // a throttle or a 5xx keeps one caller at a time; any other error frees the waiters to see it at once
      },
    );
    // with no key to name the caller, ask direct and share naught
    const accessKeyId = await sdkAwsAccount.getAccessKeyId();
    const accountName =
      accessKeyId === null
        ? await getAccountNameDirect()
        : await getAccountNameShared({
            key: asCacheKeyFromAccessKeyId({ accessKeyId }),
          });

    if (!accountName) return null;
    return matchNameToAccess(accountName, map);
  } catch (error) {
    // allowlist: sdk not installed, or config/credential/auth errors, skip this parser
    if (isModuleNotFoundError({ error })) return null;
    if (isCredentialError({ error })) return null;

    // rethrow unexpected errors
    throw error;
  }
};
