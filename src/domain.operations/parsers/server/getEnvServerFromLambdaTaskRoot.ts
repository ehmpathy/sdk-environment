import type { EnvironmentServerTier } from '../../../domain.objects/EnvironmentServerTier';

/**
 * .what = detect aws lambda from LAMBDA_TASK_ROOT
 * .why = LAMBDA_TASK_ROOT is present in all lambda runtimes
 */
export const getEnvServerFromLambdaTaskRoot =
  (): EnvironmentServerTier | null => {
    const value = process.env.LAMBDA_TASK_ROOT;
    if (value) return 'cloud@aws.lambda';
    return null;
  };
