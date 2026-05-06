import { getEnvAccessFromAwsAccountAlias } from './getEnvAccessFromAwsAccountAlias';
import { getEnvAccessFromAwsAccountName } from './getEnvAccessFromAwsAccountName';
import { getEnvAccessFromEnvar } from './getEnvAccessFromEnvar';
import { getEnvAccessFromNodeEnv } from './getEnvAccessFromNodeEnv';

/**
 * .what = namespace for access tier parsers
 * .why = enables dot notation: getEnvAccess.fromEnvar()
 */
export const getEnvAccess = {
  fromEnvar: getEnvAccessFromEnvar,
  fromAwsAccountAlias: getEnvAccessFromAwsAccountAlias,
  fromAwsAccountName: getEnvAccessFromAwsAccountName,
  fromNodeEnv: getEnvAccessFromNodeEnv,
};
