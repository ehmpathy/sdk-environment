import type { EnvironmentServerTier } from '../../../domain.objects/EnvironmentServerTier';

/**
 * .what = detect CI environment from CI=true
 * .why = CI=true is set by github actions, circleci, etc.
 */
export const getEnvServerFromCiEnvar = (): EnvironmentServerTier | null => {
  const value = process.env.CI;
  if (value === 'true') return 'local@cicd';
  return null;
};
