import type { EnvironmentAccessTier } from './EnvironmentAccessTier';

/**
 * .what = which config/secrets to load
 * .why = enables test config while authenticated to prep account
 */
export type EnvironmentConfigSlug = `${EnvironmentAccessTier}${string}`;
