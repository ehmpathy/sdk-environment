import type { EnvironmentAccessTier } from '../../../domain.objects/EnvironmentAccessTier';

/**
 * .what = parse access tier from NODE_ENV environment variable
 * .why = fallback: NODE_ENV=test → 'test', NODE_ENV=production → 'prod'
 *
 * mappings:
 * - NODE_ENV=test → 'test'
 * - NODE_ENV=production → 'prod'
 * - NODE_ENV=development → null (no default)
 * - other values → null
 */
export const getEnvAccessFromNodeEnv = (): EnvironmentAccessTier | null => {
  const value = process.env.NODE_ENV;
  if (value === 'test') return 'test';
  if (value === 'production') return 'prod';
  return null;
};
