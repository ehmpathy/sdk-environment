import type { EnvironmentServerTier } from '../../../domain.objects/EnvironmentServerTier';

/**
 * .what = detect unix desktop from XDG_SESSION_TYPE or TERM_PROGRAM
 * .why = these envars indicate a desktop terminal session
 */
export const getEnvServerFromUnixDesktop = (): EnvironmentServerTier | null => {
  const xdgSessionType = process.env.XDG_SESSION_TYPE;
  const termProgram = process.env.TERM_PROGRAM;
  if (xdgSessionType || termProgram) return 'local@unix';
  return null;
};
