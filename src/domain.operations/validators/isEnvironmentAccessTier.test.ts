import { isEnvironmentAccessTier } from './isEnvironmentAccessTier';

describe('isEnvironmentAccessTier', () => {
  describe('positive cases', () => {
    test.each(['test', 'prep', 'prod'])('returns true for %s', (value) => {
      expect(isEnvironmentAccessTier(value)).toBe(true);
    });
  });

  describe('negative cases', () => {
    test.each([
      'development',
      'dev',
      'production',
      'local',
      '',
      null,
      undefined,
      123,
      {},
      [],
    ])('returns false for %p', (value) => {
      expect(isEnvironmentAccessTier(value)).toBe(false);
    });
  });
});
