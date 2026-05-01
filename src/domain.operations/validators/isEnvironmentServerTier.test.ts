import { isEnvironmentServerTier } from './isEnvironmentServerTier';

describe('isEnvironmentServerTier', () => {
  describe('positive cases', () => {
    test.each([
      'local@unix',
      'local@cicd',
      'local@docker',
      'cloud@aws.lambda',
      'cloud@aws.ecs',
      'cloud@aws.ec2',
      'cloud@gcp.cloudrun',
    ])('returns true for %s', (value) => {
      expect(isEnvironmentServerTier(value)).toBe(true);
    });
  });

  describe('negative cases', () => {
    test.each([
      'local', // bare tier without platform
      'cloud', // bare tier without platform
      'local@', // absent platform
      'cloud@', // absent platform
      'production',
      'foo',
      '',
      null,
      undefined,
      123,
      {},
      [],
    ])('returns false for %p', (value) => {
      expect(isEnvironmentServerTier(value)).toBe(false);
    });
  });
});
