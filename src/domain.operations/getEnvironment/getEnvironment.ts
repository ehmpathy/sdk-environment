import { BadRequestError, UnexpectedCodePathError } from 'helpful-errors';
import { createCache, type SimpleInMemoryCache } from 'simple-in-memory-cache';
import { withSimpleCache } from 'with-simple-cache';

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
 * .what = compute display name for a parser function
 * .why = use function.name if available, fallback to index-based name
 */
const computeParserName = (input: {
  parser: () => unknown;
  index: number;
}): string => input.parser.name || `parser[${input.index}]`;

/**
 * .what = pair parsers with their display names
 * .why = enables iteration without positional array access
 */
const asParsersNamed = <T>(
  parsers: Array<() => T>,
): Array<{ parser: () => T; name: string }> =>
  parsers.map((parser, index) => ({
    parser,
    name: computeParserName({ parser, index }),
  }));

/**
 * .what = extract names from named parsers
 * .why = format parser names for error messages
 */
const asParserNames = <T>(
  parsers: Array<{ parser: () => T; name: string }>,
): string[] => parsers.map((p) => p.name);

// default parsers
const DEFAULT_ACCESS_PARSERS: AsyncParser<EnvironmentAccessTier>[] = [
  getEnvAccess.fromEnvar,
  getEnvAccess.fromAwsAccountAlias,
  getEnvAccess.fromAwsAccountName,
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
  getEnvCommit.fromGit.sync,
];

/**
 * .what = module-level default caches for environment results
 * .why = avoid repeated parser invocations within same process
 *        callers can supply their own cache to override
 */
const defaultFilledCache = createCache<Promise<Environment>>();
const defaultStaticCache = createCache<Environment>();

/**
 * .what = create cache that skips reads but writes to target
 * .why = used when callers pass 'skip' to bypass cache lookup
 *        but still populate cache for subsequent calls
 */
const createCacheSkipRead = <T>(target: SimpleInMemoryCache<T>) => ({
  get: () => undefined,
  set: (key: string, value: T) => target.set(key, value),
});

/**
 * .what = run parser chain until first non-null result
 * .why = first-wins precedence
 */
const getOneFromParsersAsync = async <T>(
  parsers: Array<{ parser: AsyncParser<T>; name: string }>,
  validate: (value: unknown) => value is T,
  attributeName: string,
): Promise<T> => {
  for (const { parser, name } of parsers) {
    const result = await parser();
    if (result !== null) {
      if (!validate(result)) {
        throw new BadRequestError(
          `invalid ${attributeName} value: ${JSON.stringify(result)}. parser: ${name}`,
        );
      }
      return result;
    }
  }
  throw new UnexpectedCodePathError(
    `could not derive ${attributeName}. tried parsers: ${asParserNames(parsers).join(', ')}`,
  );
};

/**
 * .what = run sync parser chain until first non-null result
 * .why = first-wins precedence, sync only
 */
const getOneFromParsersSync = <T>(
  parsers: Array<{ parser: SyncParser<T>; name: string }>,
  validate: (value: unknown) => value is T,
  attributeName: string,
): T => {
  for (const { parser, name } of parsers) {
    const result = parser();
    if (result !== null) {
      if (!validate(result)) {
        throw new BadRequestError(
          `invalid ${attributeName} value: ${JSON.stringify(result)}. parser: ${name}`,
        );
      }
      return result;
    }
  }
  throw new UnexpectedCodePathError(
    `could not derive ${attributeName}. tried parsers: ${asParserNames(parsers).join(', ')}`,
  );
};

/**
 * .what = internal async environment parser
 * .why = separated to enable cache wrapper
 */
const computeFilledEnvironment = async (input: {
  accessParsers: AsyncParser<EnvironmentAccessTier>[];
  serverParsers: AsyncParser<EnvironmentServerTier>[];
  commitParsers: AsyncParser<EnvironmentCommitSlug>[];
}): Promise<Environment> => {
  const access = await getOneFromParsersAsync(
    asParsersNamed(input.accessParsers),
    isEnvironmentAccessTier,
    'access',
  );
  const server = await getOneFromParsersAsync(
    asParsersNamed(input.serverParsers),
    isEnvironmentServerTier,
    'server',
  );
  const commit = await getOneFromParsersAsync(
    asParsersNamed(input.commitParsers),
    isEnvironmentCommitSlug,
    'commit',
  );

  return { access, server, commit };
};

/**
 * .what = async environment parser - runs all parsers with aws and git
 * .why = complete environment detection with full parser chain
 */
const _filled = async (
  input?: {
    parsers?: {
      access?: AsyncParser<EnvironmentAccessTier>[] | null;
      server?: AsyncParser<EnvironmentServerTier>[] | null;
      commit?: AsyncParser<EnvironmentCommitSlug>[] | null;
    } | null;
    cache?: SimpleInMemoryCache<Promise<Environment>> | 'skip' | null;
  } | null,
): Promise<Environment> => {
  const config = {
    accessParsers: input?.parsers?.access ?? DEFAULT_ACCESS_PARSERS,
    serverParsers: input?.parsers?.server ?? DEFAULT_SERVER_PARSERS,
    commitParsers: input?.parsers?.commit ?? DEFAULT_COMMIT_PARSERS,
  };
  return computeFilledEnvironment(config);
};

/**
 * .what = cached version of _filled
 * .why = avoid repeated parser invocations
 * .note = callers can supply their own cache via input
 */
const filled = withSimpleCache(_filled, {
  cache: ({ fromInput }) => {
    const inputCache = fromInput[0]?.cache;
    if (inputCache === 'skip') return createCacheSkipRead(defaultFilledCache);
    return inputCache ?? defaultFilledCache;
  },
  serialize: { key: () => 'filled' },
});

/**
 * .what = internal sync environment parser
 * .why = separated to enable cache wrapper
 */
const computeStaticEnvironment = (input: {
  accessParsers: SyncParser<EnvironmentAccessTier>[];
  serverParsers: SyncParser<EnvironmentServerTier>[];
  commitParsers: SyncParser<EnvironmentCommitSlug>[];
}): Environment => {
  const access = getOneFromParsersSync(
    asParsersNamed(input.accessParsers),
    isEnvironmentAccessTier,
    'access',
  );
  const server = getOneFromParsersSync(
    asParsersNamed(input.serverParsers),
    isEnvironmentServerTier,
    'server',
  );
  const commit = getOneFromParsersSync(
    asParsersNamed(input.commitParsers),
    isEnvironmentCommitSlug,
    'commit',
  );

  return { access, server, commit };
};

/**
 * .what = sync environment parser - skips async parsers
 * .why = sync access without await for contexts that need it
 */
const _staticEnv = (
  input?: {
    parsers?: {
      access?: SyncParser<EnvironmentAccessTier>[] | null;
      server?: SyncParser<EnvironmentServerTier>[] | null;
      commit?: SyncParser<EnvironmentCommitSlug>[] | null;
    } | null;
    cache?: SimpleInMemoryCache<Environment> | 'skip' | null;
  } | null,
): Environment => {
  const config = {
    accessParsers: input?.parsers?.access ?? DEFAULT_ACCESS_PARSERS_SYNC,
    serverParsers: input?.parsers?.server ?? DEFAULT_SERVER_PARSERS,
    commitParsers: input?.parsers?.commit ?? DEFAULT_COMMIT_PARSERS_SYNC,
  };
  return computeStaticEnvironment(config);
};

/**
 * .what = cached version of _staticEnv
 * .why = avoid repeated parser invocations
 * .note = callers can supply their own cache via input
 */
const staticEnv = withSimpleCache(_staticEnv, {
  cache: ({ fromInput }) => {
    const inputCache = fromInput[0]?.cache;
    if (inputCache === 'skip') return createCacheSkipRead(defaultStaticCache);
    return inputCache ?? defaultStaticCache;
  },
  serialize: { key: () => 'static' },
});

/**
 * .what = get environment - callable directly or via .filled()/.static()
 * .why = main entry point for sdk-environment
 */
interface GetEnvironment {
  (input?: Parameters<typeof filled>[0]): Promise<Environment>;
  filled: typeof filled;
  static: typeof staticEnv;
}

const getEnvironmentFn: GetEnvironment = Object.assign(
  // direct call delegates to filled
  (input?: Parameters<typeof filled>[0]): Promise<Environment> => filled(input),
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
