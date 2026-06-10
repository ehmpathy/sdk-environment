import type { EnvironmentAccessTier } from '@src/domain.objects/EnvironmentAccessTier';

import type { AwsAccountPatternMap } from './getEnvAccessFromAwsAccountName';

/**
 * .what = alias for canonical pattern map type
 * .why = backwards compat for extant code
 */
export type AwsAccountAliasMap = AwsAccountPatternMap;

const DEFAULT_MAP: AwsAccountAliasMap = {
  '*-prod': 'prod',
  '*-prep': 'prep',
  '*-test': 'test',
};

/**
 * .what = match alias against pattern map
 * .why = exact match wins, then glob match in order
 */
export const matchAliasToAccess = (
  alias: string,
  map: AwsAccountAliasMap,
): EnvironmentAccessTier | null => {
  // exact match first
  if (map[alias]) return map[alias]!;

  // glob match in order
  for (const pattern of Object.keys(map)) {
    if (pattern.includes('*')) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      if (regex.test(alias)) return map[pattern]!;
    }
  }

  return null;
};

/**
 * .what = parse access tier from aws account alias
 * .why = infer from aws account alias (e.g., 'myorg-prod' → prod)
 */
export const getEnvAccessFromAwsAccountAlias = async (input?: {
  map?: AwsAccountAliasMap;
}): Promise<EnvironmentAccessTier | null> => {
  const map = input?.map ?? DEFAULT_MAP;

  try {
    // dynamic import to avoid bundle size when not used
    const { IAMClient, ListAccountAliasesCommand } = await import(
      '@aws-sdk/client-iam'
    );

    const client = new IAMClient({});
    const response = await client.send(new ListAccountAliasesCommand({}));
    const alias = response.AccountAliases?.[0];

    if (!alias) return null;
    return matchAliasToAccess(alias, map);
  } catch (error) {
    // allowlist: config/credential/auth errors return null (parser should be skipped)
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const name = error.name.toLowerCase();
      const code = (error as NodeJS.ErrnoException).code;

      // sdk not installed — gracefully skip
      if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
        return null;
      }

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
        name.includes('invalidclienttokenid') ||
        name.includes('credentialsprovider')
      ) {
        return null;
      }
    }
    // rethrow unexpected errors
    throw error;
  }
};
