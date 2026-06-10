import type { EnvironmentConfigSlug } from '@src/domain.objects/EnvironmentConfigSlug';
import { isEnvironmentConfigSlug } from '@src/domain.operations/validators/isEnvironmentConfigSlug';

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
