import type { EnvironmentAccessTier } from '../../../domain.objects/EnvironmentAccessTier';
import type { EnvironmentConfigSlug } from '../../../domain.objects/EnvironmentConfigSlug';

/**
 * .what = factory to create default config parser from access
 * .why = config defaults to access when no explicit signal
 */
export const getEnvConfigFromAccess = (
  access: EnvironmentAccessTier,
): (() => EnvironmentConfigSlug) => {
  const parser = (): EnvironmentConfigSlug => access;
  Object.defineProperty(parser, 'name', { value: 'fromAccess()' });
  return parser;
};
