import type { EnvironmentConfigSlug } from '../../domain.objects/EnvironmentConfigSlug';
import { ACCESS_TIERS } from './isEnvironmentAccessTier';

/**
 * .what = type guard for EnvironmentConfigSlug
 * .why = validates config slug is exact tier or tier + non-alphanumeric suffix
 *        e.g., 'prod' valid, 'prod:v2023' valid, 'production' invalid
 */
export const isEnvironmentConfigSlug = (
  value: unknown,
): value is EnvironmentConfigSlug => {
  if (typeof value !== 'string') return false;

  for (const prefix of ACCESS_TIERS) {
    if (!value.startsWith(prefix)) continue;

    // exact match
    if (value === prefix) return true;

    // prefix + non-alphanumeric (e.g., 'prod:v2023', 'test:local')
    const charAfterPrefix = value[prefix.length];
    if (charAfterPrefix && !/[a-zA-Z0-9]/.test(charAfterPrefix)) return true;
  }

  return false;
};
