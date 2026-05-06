import type { EnvironmentAccessTier } from '../../../domain.objects/EnvironmentAccessTier';

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
 * .what = parse access tier from aws account name
 * .why = fallback when alias not set (name is always present)
 */
export const getEnvAccessFromAwsAccountName = async (input?: {
  map?: AwsAccountPatternMap;
}): Promise<EnvironmentAccessTier | null> => {
  const map = input?.map ?? DEFAULT_MAP;

  try {
    // dynamic import to avoid bundle size when not used
    const { AccountClient, GetAccountInformationCommand } = await import(
      '@aws-sdk/client-account'
    );

    const client = new AccountClient({});
    const response = await client.send(new GetAccountInformationCommand({}));
    const accountName = response.AccountName;

    if (!accountName) return null;
    return matchNameToAccess(accountName, map);
  } catch (error) {
    // allowlist: config/credential/auth errors return null (parser should be skipped)
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const errorName = error.name.toLowerCase();
      if (
        message.includes('region') ||
        message.includes('could not load credentials') ||
        message.includes('no credentials') ||
        message.includes('credential') ||
        message.includes('access denied') ||
        message.includes('not authorized') ||
        message.includes('security token') ||
        message.includes('session') ||
        message.includes('expired') ||
        message.includes('reauthenticate') ||
        errorName.includes('invalidclienttokenid') ||
        errorName.includes('credentialsprovider')
      ) {
        return null;
      }
    }
    // rethrow unexpected errors
    throw error;
  }
};
