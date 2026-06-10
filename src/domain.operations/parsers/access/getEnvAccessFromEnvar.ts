import type { EnvironmentAccessTier } from '@src/domain.objects/EnvironmentAccessTier';
import { isEnvironmentAccessTier } from '@src/domain.operations/validators/isEnvironmentAccessTier';

/**
 * .what = parse access tier from ACCESS environment variable
 * .why = explicit override via ACCESS=prod
 */
export const getEnvAccessFromEnvar = (): EnvironmentAccessTier | null => {
  const value = process.env.ACCESS;
  if (!value || value === '') return null;
  if (!isEnvironmentAccessTier(value)) return null;
  return value;
};
