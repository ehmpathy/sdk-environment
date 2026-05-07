import type { EnvironmentAccessTier } from '../../domain.objects/EnvironmentAccessTier';
import type { EnvironmentConfigSlug } from '../../domain.objects/EnvironmentConfigSlug';
import { isValidConfigForAccess } from './isValidConfigForAccess';

describe('isValidConfigForAccess', () => {
  describe('positive cases', () => {
    test.each<[EnvironmentConfigSlug, EnvironmentAccessTier]>([
      ['prod', 'prod'],
      ['prod:v2023', 'prod'],
      ['test', 'test'],
      ['test:local', 'test'],
      ['prep', 'prep'],
      ['prep:canary', 'prep'],
      ['test', 'prep'], // prep allows any config
      ['prod', 'prep'], // prep allows any config
    ])('returns true for config=%s, access=%s', (config, access) => {
      expect(isValidConfigForAccess({ config, access })).toBe(true);
    });
  });

  describe('negative cases', () => {
    test('throws when prod access has test config', () => {
      expect(() =>
        isValidConfigForAccess({ config: 'test', access: 'prod' }),
      ).toThrow("config must start with 'prod' when access is 'prod'");
    });

    test('throws when prod access has prep config', () => {
      expect(() =>
        isValidConfigForAccess({ config: 'prep', access: 'prod' }),
      ).toThrow("config must start with 'prod' when access is 'prod'");
    });

    test('throws when test access has prod config', () => {
      expect(() =>
        isValidConfigForAccess({ config: 'prod', access: 'test' }),
      ).toThrow("config must start with 'test' when access is 'test'");
    });

    test('throws when test access has prep config', () => {
      expect(() =>
        isValidConfigForAccess({ config: 'prep', access: 'test' }),
      ).toThrow("config must start with 'test' when access is 'test'");
    });
  });
});
