import type { EnvironmentAccessTier } from '../../domain.objects/EnvironmentAccessTier';
import type { EnvironmentCommitSlug } from '../../domain.objects/EnvironmentCommitSlug';
import type { EnvironmentServerTier } from '../../domain.objects/EnvironmentServerTier';
import {
  type AwsAccountAliasMap,
  getEnvAccessFromAwsAccountAlias,
} from './access/getEnvAccessFromAwsAccountAlias';
import {
  type AwsAccountPatternMap,
  getEnvAccessFromAwsAccountName,
} from './access/getEnvAccessFromAwsAccountName';
import { getEnvAccessFromNodeEnv } from './access/getEnvAccessFromNodeEnv';
import { getEnvCommitFromGit } from './commit/getEnvCommitFromGit';
import { getEnvServerFromCiEnvar } from './server/getEnvServerFromCiEnvar';
import { getEnvServerFromLambdaTaskRoot } from './server/getEnvServerFromLambdaTaskRoot';
import { getEnvServerFromUnixDesktop } from './server/getEnvServerFromUnixDesktop';

/**
 * .what = factory for fromAwsAccountAlias parser
 * .why = README contract: fromAwsAccountAlias() returns a parser
 */
export const fromAwsAccountAlias = (input?: {
  map?: AwsAccountAliasMap;
}): (() => Promise<EnvironmentAccessTier | null>) => {
  const parser = (): Promise<EnvironmentAccessTier | null> =>
    getEnvAccessFromAwsAccountAlias(input);
  Object.defineProperty(parser, 'name', { value: 'fromAwsAccountAlias' });
  return parser;
};

/**
 * .what = factory for fromAwsAccountName parser
 * .why = README contract: fromAwsAccountName() returns a parser
 */
export const fromAwsAccountName = (input?: {
  map?: AwsAccountPatternMap;
}): (() => Promise<EnvironmentAccessTier | null>) => {
  const parser = (): Promise<EnvironmentAccessTier | null> =>
    getEnvAccessFromAwsAccountName(input);
  Object.defineProperty(parser, 'name', { value: 'fromAwsAccountName' });
  return parser;
};

/**
 * .what = factory for fromNodeEnv parser
 * .why = README contract: fromNodeEnv() returns a parser
 */
export const fromNodeEnv = (): (() => EnvironmentAccessTier | null) => {
  const parser = (): EnvironmentAccessTier | null => getEnvAccessFromNodeEnv();
  Object.defineProperty(parser, 'name', { value: 'fromNodeEnv' });
  return parser;
};

/**
 * .what = factory for fromLambdaTaskRoot parser
 * .why = README contract: fromLambdaTaskRoot() returns a parser
 */
export const fromLambdaTaskRoot = (): (() => EnvironmentServerTier | null) => {
  const parser = (): EnvironmentServerTier | null =>
    getEnvServerFromLambdaTaskRoot();
  Object.defineProperty(parser, 'name', { value: 'fromLambdaTaskRoot' });
  return parser;
};

/**
 * .what = factory for fromCiEnvar parser
 * .why = README contract: fromCiEnvar() returns a parser
 */
export const fromCiEnvar = (): (() => EnvironmentServerTier | null) => {
  const parser = (): EnvironmentServerTier | null => getEnvServerFromCiEnvar();
  Object.defineProperty(parser, 'name', { value: 'fromCiEnvar' });
  return parser;
};

/**
 * .what = factory for fromUnixDesktop parser
 * .why = README contract: fromUnixDesktop() returns a parser
 */
export const fromUnixDesktop = (): (() => EnvironmentServerTier | null) => {
  const parser = (): EnvironmentServerTier | null =>
    getEnvServerFromUnixDesktop();
  Object.defineProperty(parser, 'name', { value: 'fromUnixDesktop' });
  return parser;
};

/**
 * .what = factory for fromGit parser
 * .why = README contract: fromGit() returns a parser
 */
export const fromGit = (): (() => Promise<EnvironmentCommitSlug | null>) => {
  const parser = (): Promise<EnvironmentCommitSlug | null> =>
    getEnvCommitFromGit();
  Object.defineProperty(parser, 'name', { value: 'fromGit' });
  return parser;
};
