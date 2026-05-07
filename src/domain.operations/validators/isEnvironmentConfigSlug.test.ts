import { isEnvironmentConfigSlug } from './isEnvironmentConfigSlug';

describe('isEnvironmentConfigSlug', () => {
  describe('positive cases', () => {
    test.each([
      'test',
      'prep',
      'prod',
      'prod:v2023',
      'test:local',
      'prep:canary',
    ])('returns true for %s', (value) => {
      expect(isEnvironmentConfigSlug(value)).toBe(true);
    });
  });

  describe('negative cases', () => {
    test.each([
      'invalid',
      'production',
      'development',
      'dev',
      '',
      null,
      undefined,
      123,
      {},
      [],
    ])('returns false for %p', (value) => {
      expect(isEnvironmentConfigSlug(value)).toBe(false);
    });
  });
});
