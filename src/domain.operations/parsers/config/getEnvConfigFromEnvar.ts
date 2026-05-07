import type { EnvironmentConfigSlug } from '../../../domain.objects/EnvironmentConfigSlug';
import { isEnvironmentConfigSlug } from '../../validators/isEnvironmentConfigSlug';

/**
 * .what = parse config from CONFIG environment variable
 * .why = explicit config override
 */
export const getEnvConfigFromEnvar = (): EnvironmentConfigSlug | null => {
  const value = process.env.CONFIG;
  if (!value || value === '') return null;
  if (!isEnvironmentConfigSlug(value)) return null;
  return value;
};
