import type { EnvironmentCommitSlug } from '../../domain.objects/EnvironmentCommitSlug';

/**
 * .what = type guard for EnvironmentCommitSlug
 * .why = validates parser output at runtime
 *
 * format: '$gitref@$hash' or '$gitref@$hash+'
 * - gitref: branch name, tag, or version (1+ chars)
 * - hash: short commit hash (alphanumeric chars)
 * - '+' suffix indicates dirty work tree
 */
const COMMIT_SLUG_PATTERN = /^.+@[a-z0-9]+\+?$/i;

export const isEnvironmentCommitSlug = (
  value: unknown,
): value is EnvironmentCommitSlug => {
  return typeof value === 'string' && COMMIT_SLUG_PATTERN.test(value);
};
