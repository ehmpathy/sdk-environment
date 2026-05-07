import type { EnvironmentAccessTier } from '../../../domain.objects/EnvironmentAccessTier';
import type { EnvironmentConfigSlug } from '../../../domain.objects/EnvironmentConfigSlug';

/**
 * .what = factory to create NODE_ENV parser for given access
 * .why = NODE_ENV=test signals test config only for prep access.
 *        prod/test access ignore NODE_ENV (it's a signal, not an override).
 */
export const getEnvConfigFromNodeEnv = (
  access: EnvironmentAccessTier,
): (() => EnvironmentConfigSlug | null) => {
  const parser = (): EnvironmentConfigSlug | null => {
    // NODE_ENV only signals config for prep access
    if (access !== 'prep') return null;
    if (process.env.NODE_ENV === 'test') return 'test';
    return null;
  };
  Object.defineProperty(parser, 'name', { value: 'fromNodeEnv()' });
  return parser;
};
