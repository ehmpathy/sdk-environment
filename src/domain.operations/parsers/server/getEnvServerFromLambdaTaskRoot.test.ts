import { getEnvServerFromLambdaTaskRoot } from './getEnvServerFromLambdaTaskRoot';

describe('getEnvServerFromLambdaTaskRoot', () => {
  const lambdaTaskRootBefore = process.env.LAMBDA_TASK_ROOT;

  afterEach(() => {
    if (lambdaTaskRootBefore === undefined) {
      delete process.env.LAMBDA_TASK_ROOT;
    } else {
      process.env.LAMBDA_TASK_ROOT = lambdaTaskRootBefore;
    }
  });

  describe('positive cases', () => {
    test('returns cloud@aws.lambda when LAMBDA_TASK_ROOT is set', () => {
      process.env.LAMBDA_TASK_ROOT = '/var/task';
      const result = getEnvServerFromLambdaTaskRoot();
      expect(result).toBe('cloud@aws.lambda');
      expect(result).toMatchSnapshot();
    });
  });

  describe('negative cases', () => {
    test('returns null when LAMBDA_TASK_ROOT is not set', () => {
      delete process.env.LAMBDA_TASK_ROOT;
      const result = getEnvServerFromLambdaTaskRoot();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });
});
