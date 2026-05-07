import { BadRequestError } from 'helpful-errors';

import type { EnvironmentAccessTier } from '../../domain.objects/EnvironmentAccessTier';
import type { EnvironmentConfigSlug } from '../../domain.objects/EnvironmentConfigSlug';

/**
 * .what = validate config matches access tier constraints
 * .why = prod/test access force config to match. prep allows any config.
 */
export const isValidConfigForAccess = (input: {
  config: EnvironmentConfigSlug;
  access: EnvironmentAccessTier;
}): boolean => {
  // prep allows any config
  if (input.access === 'prep') return true;

  // prod/test: config must start with access tier
  if (!input.config.startsWith(input.access)) {
    throw new BadRequestError(
      `config must start with '${input.access}' when access is '${input.access}'. got: ${JSON.stringify(input.config)}`,
      { access: input.access, config: input.config },
    );
  }

  return true;
};
