// main entry

// domain objects
export type { Environment } from './domain.objects/Environment';
export type { EnvironmentAccessTier } from './domain.objects/EnvironmentAccessTier';
export type { EnvironmentCommitSlug } from './domain.objects/EnvironmentCommitSlug';
export type { EnvironmentServerTier } from './domain.objects/EnvironmentServerTier';
// parser types
export type {
  AsyncParser,
  Parser,
  SyncParser,
} from './domain.operations/getEnvironment/getEnvironment';
// main entry point
export { getEnvironment } from './domain.operations/getEnvironment/getEnvironment';
// namespaced parsers (internal API)
export { getEnvAccess } from './domain.operations/parsers/access/getEnvAccess';
// map types for custom parser config
export type { AwsAccountAliasMap } from './domain.operations/parsers/access/getEnvAccessFromAwsAccountAlias';
export type { AwsAccountPatternMap } from './domain.operations/parsers/access/getEnvAccessFromAwsAccountName';
export { getEnvCommit } from './domain.operations/parsers/commit/getEnvCommit';
export {
  fromAwsAccountAlias,
  fromAwsAccountName,
  fromCiEnvar,
  fromGit,
  fromLambdaTaskRoot,
  fromNodeEnv,
  fromUnixDesktop,
} from './domain.operations/parsers/factories';
// parser factories (README contract)
export { fromEnvar } from './domain.operations/parsers/fromEnvar';
export { getEnvServer } from './domain.operations/parsers/server/getEnvServer';
// validators
export { isEnvironmentAccessTier } from './domain.operations/validators/isEnvironmentAccessTier';
export { isEnvironmentCommitSlug } from './domain.operations/validators/isEnvironmentCommitSlug';
export { isEnvironmentServerTier } from './domain.operations/validators/isEnvironmentServerTier';
