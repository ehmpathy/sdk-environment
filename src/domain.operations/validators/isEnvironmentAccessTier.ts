import type { EnvironmentAccessTier } from '../../domain.objects/EnvironmentAccessTier';

const ACCESS_TIERS: readonly EnvironmentAccessTier[] = ['test', 'prep', 'prod'];

/**
 * .what = type guard for EnvironmentAccessTier
 * .why = validates parser output at runtime
 */
export const isEnvironmentAccessTier = (
  value: unknown,
): value is EnvironmentAccessTier => {
  return (
    typeof value === 'string' &&
    ACCESS_TIERS.includes(value as EnvironmentAccessTier)
  );
};
