import { BadRequestError, UnexpectedCodePathError } from 'helpful-errors';

import type { Environment } from '../../domain.objects/Environment';
import type { EnvironmentAccessTier } from '../../domain.objects/EnvironmentAccessTier';
import type { EnvironmentCommitSlug } from '../../domain.objects/EnvironmentCommitSlug';
import type { EnvironmentServerTier } from '../../domain.objects/EnvironmentServerTier';
import { getEnvAccess } from '../parsers/access/getEnvAccess';
import { getEnvCommit } from '../parsers/commit/getEnvCommit';
import { getEnvServer } from '../parsers/server/getEnvServer';
import { isEnvironmentAccessTier } from '../validators/isEnvironmentAccessTier';
import { isEnvironmentCommitSlug } from '../validators/isEnvironmentCommitSlug';
import { isEnvironmentServerTier } from '../validators/isEnvironmentServerTier';

/**
 * .what = parser function type
 * .why = enables custom parser configuration
 */
export type SyncParser<T> = () => T | null;
export type AsyncParser<T> = () => T | null | Promise<T | null>;

/**
 * .what = union parser type for public API
 * .why = matches README: type Parser<T> = () => T | null | Promise<T | null>
 */
export type Parser<T> = () => T | null | Promise<T | null>;

/**
 * .what = input for getEnvironment methods
 * .why = allows custom parsers and cache control
 */
interface GetEnvironmentInput {
  parsers?: {
    access?: AsyncParser<EnvironmentAccessTier>[];
    server?: AsyncParser<EnvironmentServerTier>[];
    commit?: AsyncParser<EnvironmentCommitSlug>[];
  };
  cache?: 'skip';
}

/**
 * .what = input for getEnvironment.static
 * .why = sync parsers only
 */
interface GetEnvironmentStaticInput {
  parsers?: {
    access?: SyncParser<EnvironmentAccessTier>[];
    server?: SyncParser<EnvironmentServerTier>[];
    commit?: SyncParser<EnvironmentCommitSlug>[];
  };
  cache?: 'skip';
}

// default parsers
const DEFAULT_ACCESS_PARSERS: AsyncParser<EnvironmentAccessTier>[] = [
  getEnvAccess.fromEnvar,
  getEnvAccess.fromAwsAccountAlias,
  getEnvAccess.fromNodeEnv,
];

const DEFAULT_SERVER_PARSERS: SyncParser<EnvironmentServerTier>[] = [
  getEnvServer.fromEnvar,
  getEnvServer.fromLambdaTaskRoot,
  getEnvServer.fromCiEnvar,
  getEnvServer.fromUnixDesktop,
];

const DEFAULT_COMMIT_PARSERS: AsyncParser<EnvironmentCommitSlug>[] = [
  getEnvCommit.fromEnvar,
  getEnvCommit.fromGit,
];

// sync-only default parsers (skip async)
const DEFAULT_ACCESS_PARSERS_SYNC: SyncParser<EnvironmentAccessTier>[] = [
  getEnvAccess.fromEnvar,
  getEnvAccess.fromNodeEnv,
];

const DEFAULT_COMMIT_PARSERS_SYNC: SyncParser<EnvironmentCommitSlug>[] = [
  getEnvCommit.fromEnvar,
];

// cache
let filledCache: Environment | null = null;
let staticCache: Environment | null = null;

/**
 * .what = run parser chain until first non-null result
 * .why = first-wins precedence
 */
const runParsers = async <T>(
  parsers: AsyncParser<T>[],
  parserNames: string[],
  validate: (value: unknown) => value is T,
  attributeName: string,
): Promise<T> => {
  for (let i = 0; i < parsers.length; i++) {
    const parser = parsers[i]!;
    const result = await parser();
    if (result !== null) {
      if (!validate(result)) {
        throw new BadRequestError(
          `invalid ${attributeName} value: ${JSON.stringify(result)}. parser: ${parserNames[i]}`,
        );
      }
      return result;
    }
  }
  throw new UnexpectedCodePathError(
    `could not derive ${attributeName}. tried parsers: ${parserNames.join(', ')}`,
  );
};

/**
 * .what = run sync parser chain until first non-null result
 * .why = first-wins precedence, sync only
 */
const runParsersSync = <T>(
  parsers: SyncParser<T>[],
  parserNames: string[],
  validate: (value: unknown) => value is T,
  attributeName: string,
): T => {
  for (let i = 0; i < parsers.length; i++) {
    const parser = parsers[i]!;
    const result = parser();
    if (result !== null) {
      if (!validate(result)) {
        throw new BadRequestError(
          `invalid ${attributeName} value: ${JSON.stringify(result)}. parser: ${parserNames[i]}`,
        );
      }
      return result;
    }
  }
  throw new UnexpectedCodePathError(
    `could not derive ${attributeName}. tried parsers: ${parserNames.join(', ')}`,
  );
};

/**
 * .what = async environment parser - runs all parsers with aws and git
 * .why = complete environment detection with full parser chain
 */
const filled = async (input?: GetEnvironmentInput): Promise<Environment> => {
  // check cache
  if (input?.cache !== 'skip' && filledCache) return filledCache;

  const accessParsers = input?.parsers?.access ?? DEFAULT_ACCESS_PARSERS;
  const serverParsers = input?.parsers?.server ?? DEFAULT_SERVER_PARSERS;
  const commitParsers = input?.parsers?.commit ?? DEFAULT_COMMIT_PARSERS;

  const accessParserNames = accessParsers.map(
    (p, i) => p.name || `parser[${i}]`,
  );
  const serverParserNames = serverParsers.map(
    (p, i) => p.name || `parser[${i}]`,
  );
  const commitParserNames = commitParsers.map(
    (p, i) => p.name || `parser[${i}]`,
  );

  const access = await runParsers(
    accessParsers,
    accessParserNames,
    isEnvironmentAccessTier,
    'access',
  );
  const server = await runParsers(
    serverParsers,
    serverParserNames,
    isEnvironmentServerTier,
    'server',
  );
  const commit = await runParsers(
    commitParsers,
    commitParserNames,
    isEnvironmentCommitSlug,
    'commit',
  );

  const environment: Environment = { access, server, commit };
  filledCache = environment;
  return environment;
};

/**
 * .what = sync environment parser - skips async parsers
 * .why = sync access without await for contexts that need it
 */
const staticEnv = (input?: GetEnvironmentStaticInput): Environment => {
  // check cache
  if (input?.cache !== 'skip' && staticCache) return staticCache;

  const accessParsers = input?.parsers?.access ?? DEFAULT_ACCESS_PARSERS_SYNC;
  const serverParsers = input?.parsers?.server ?? DEFAULT_SERVER_PARSERS;
  const commitParsers = input?.parsers?.commit ?? DEFAULT_COMMIT_PARSERS_SYNC;

  const accessParserNames = accessParsers.map(
    (p, i) => p.name || `parser[${i}]`,
  );
  const serverParserNames = serverParsers.map(
    (p, i) => p.name || `parser[${i}]`,
  );
  const commitParserNames = commitParsers.map(
    (p, i) => p.name || `parser[${i}]`,
  );

  const access = runParsersSync(
    accessParsers,
    accessParserNames,
    isEnvironmentAccessTier,
    'access',
  );
  const server = runParsersSync(
    serverParsers,
    serverParserNames,
    isEnvironmentServerTier,
    'server',
  );
  const commit = runParsersSync(
    commitParsers,
    commitParserNames,
    isEnvironmentCommitSlug,
    'commit',
  );

  const environment: Environment = { access, server, commit };
  staticCache = environment;
  return environment;
};

/**
 * .what = get environment - callable directly or via .filled()/.static()
 * .why = main entry point for sdk-environment
 */
interface GetEnvironment {
  (input?: GetEnvironmentInput): Promise<Environment>;
  filled: typeof filled;
  static: typeof staticEnv;
}

const getEnvironmentFn: GetEnvironment = Object.assign(
  // direct call delegates to filled
  (input?: GetEnvironmentInput): Promise<Environment> => filled(input),
  {
    /**
     * async, runs all parsers (aws and git), cached
     */
    filled,

    /**
     * sync, skips async parsers, cached independently
     */
    static: staticEnv,
  },
);

export const getEnvironment = getEnvironmentFn;
