import type { EnvironmentAccessTier } from './EnvironmentAccessTier';
import type { EnvironmentCommitSlug } from './EnvironmentCommitSlug';
import type { EnvironmentServerTier } from './EnvironmentServerTier';

/**
 * .what = the environment your code runs in
 * .why = enables environment-aware behavior without env var soup
 */
export interface Environment {
  /**
   * which tier of resources this process can access
   */
  access: EnvironmentAccessTier;

  /**
   * where this process executes
   */
  server: EnvironmentServerTier;

  /**
   * what code this process runs
   */
  commit: EnvironmentCommitSlug;
}
