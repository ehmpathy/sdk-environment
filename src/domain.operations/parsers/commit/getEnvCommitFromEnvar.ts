import type { EnvironmentCommitSlug } from '@src/domain.objects/EnvironmentCommitSlug';
import { isEnvironmentCommitSlug } from '@src/domain.operations/validators/isEnvironmentCommitSlug';

/**
 * .what = parse commit slug from COMMIT environment variable
 * .why = explicit override via COMMIT=v1.0.0@abc123
 */
export const getEnvCommitFromEnvar = (): EnvironmentCommitSlug | null => {
  const value = process.env.COMMIT;
  if (!value || value === '') return null;
  if (!isEnvironmentCommitSlug(value)) return null;
  return value;
};
