import { getEnvConfigFromAccess } from './getEnvConfigFromAccess';
import { getEnvConfigFromEnvar } from './getEnvConfigFromEnvar';
import { getEnvConfigFromNodeEnv } from './getEnvConfigFromNodeEnv';

/**
 * .what = namespace for config parsers
 * .why = enables getEnvConfig.fromEnvar, getEnvConfig.fromNodeEnv(access), etc.
 */
export const getEnvConfig = {
  fromEnvar: getEnvConfigFromEnvar,
  fromNodeEnv: getEnvConfigFromNodeEnv,
  fromAccess: getEnvConfigFromAccess,
};
