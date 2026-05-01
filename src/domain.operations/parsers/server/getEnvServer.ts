import { getEnvServerFromCiEnvar } from './getEnvServerFromCiEnvar';
import { getEnvServerFromEnvar } from './getEnvServerFromEnvar';
import { getEnvServerFromLambdaTaskRoot } from './getEnvServerFromLambdaTaskRoot';
import { getEnvServerFromUnixDesktop } from './getEnvServerFromUnixDesktop';

/**
 * .what = namespace for server tier parsers
 * .why = enables dot notation: getEnvServer.fromEnvar()
 */
export const getEnvServer = {
  fromEnvar: getEnvServerFromEnvar,
  fromLambdaTaskRoot: getEnvServerFromLambdaTaskRoot,
  fromCiEnvar: getEnvServerFromCiEnvar,
  fromUnixDesktop: getEnvServerFromUnixDesktop,
};
