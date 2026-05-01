import type { EnvironmentServerTier } from '../../domain.objects/EnvironmentServerTier';

const SERVER_TIER_PATTERN = /^(local|cloud)@.+$/;

/**
 * .what = type guard for EnvironmentServerTier
 * .why = validates parser output at runtime
 *
 * format: `$tier@$platform` where tier is 'local' or 'cloud'
 * - rejects bare values like 'local' or 'cloud'
 * - requires platform suffix after '@'
 */
export const isEnvironmentServerTier = (
  value: unknown,
): value is EnvironmentServerTier => {
  return typeof value === 'string' && SERVER_TIER_PATTERN.test(value);
};
