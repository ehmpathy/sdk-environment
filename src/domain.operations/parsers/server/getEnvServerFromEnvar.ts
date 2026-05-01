import type { EnvironmentServerTier } from '../../../domain.objects/EnvironmentServerTier';
import { isEnvironmentServerTier } from '../../validators/isEnvironmentServerTier';

/**
 * .what = parse server tier from SERVER environment variable
 * .why = explicit override via SERVER=cloud@aws.lambda
 */
export const getEnvServerFromEnvar = (): EnvironmentServerTier | null => {
  const value = process.env.SERVER;
  if (!value || value === '') return null;
  if (!isEnvironmentServerTier(value)) return null;
  return value;
};
