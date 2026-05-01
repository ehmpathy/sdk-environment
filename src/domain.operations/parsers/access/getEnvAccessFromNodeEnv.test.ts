import { getEnvAccessFromNodeEnv } from './getEnvAccessFromNodeEnv';

describe('getEnvAccessFromNodeEnv', () => {
  const nodeEnvBefore = process.env.NODE_ENV;

  afterEach(() => {
    if (nodeEnvBefore === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnvBefore;
    }
  });

  describe('positive cases', () => {
    test('returns test when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';
      const result = getEnvAccessFromNodeEnv();
      expect(result).toBe('test');
      expect(result).toMatchSnapshot();
    });

    test('returns prod when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      const result = getEnvAccessFromNodeEnv();
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });
  });

  describe('negative cases', () => {
    test('returns null when NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development';
      const result = getEnvAccessFromNodeEnv();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });

    test('returns null when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      const result = getEnvAccessFromNodeEnv();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });

    test('returns null when NODE_ENV is unknown value', () => {
      process.env.NODE_ENV = 'custom';
      const result = getEnvAccessFromNodeEnv();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });
});
