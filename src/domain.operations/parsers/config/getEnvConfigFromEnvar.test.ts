import { getEnvConfigFromEnvar } from './getEnvConfigFromEnvar';

describe('getEnvConfigFromEnvar', () => {
  const configBefore = process.env.CONFIG;

  afterEach(() => {
    if (configBefore === undefined) {
      delete process.env.CONFIG;
    } else {
      process.env.CONFIG = configBefore;
    }
  });

  describe('positive cases', () => {
    test('returns value when CONFIG is set to test', () => {
      process.env.CONFIG = 'test';
      const result = getEnvConfigFromEnvar();
      expect(result).toBe('test');
      expect(result).toMatchSnapshot();
    });

    test('returns value when CONFIG is set to prep', () => {
      process.env.CONFIG = 'prep';
      const result = getEnvConfigFromEnvar();
      expect(result).toBe('prep');
      expect(result).toMatchSnapshot();
    });

    test('returns value when CONFIG is set to prod', () => {
      process.env.CONFIG = 'prod';
      const result = getEnvConfigFromEnvar();
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });

    test('returns value when CONFIG is set to extended slug', () => {
      process.env.CONFIG = 'prod:v2023';
      const result = getEnvConfigFromEnvar();
      expect(result).toBe('prod:v2023');
      expect(result).toMatchSnapshot();
    });
  });

  describe('negative cases', () => {
    test('returns null when CONFIG is not set', () => {
      delete process.env.CONFIG;
      const result = getEnvConfigFromEnvar();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });

    test('returns null when CONFIG is empty string', () => {
      process.env.CONFIG = '';
      const result = getEnvConfigFromEnvar();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });

    test('returns null when CONFIG is invalid', () => {
      process.env.CONFIG = 'invalid';
      const result = getEnvConfigFromEnvar();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });
});
