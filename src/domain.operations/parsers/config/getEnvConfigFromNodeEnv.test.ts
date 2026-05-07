import { getEnvConfigFromNodeEnv } from './getEnvConfigFromNodeEnv';

describe('getEnvConfigFromNodeEnv', () => {
  const nodeEnvBefore = process.env.NODE_ENV;

  afterEach(() => {
    if (nodeEnvBefore === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnvBefore;
    }
  });

  describe('prep access', () => {
    test('returns test when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';
      const parser = getEnvConfigFromNodeEnv('prep');
      const result = parser();
      expect(result).toBe('test');
      expect(result).toMatchSnapshot();
    });

    test('returns null when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      const parser = getEnvConfigFromNodeEnv('prep');
      const result = parser();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });

    test('returns null when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      const parser = getEnvConfigFromNodeEnv('prep');
      const result = parser();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });

  describe('prod access', () => {
    test('returns null even when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';
      const parser = getEnvConfigFromNodeEnv('prod');
      const result = parser();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });

  describe('test access', () => {
    test('returns null even when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';
      const parser = getEnvConfigFromNodeEnv('test');
      const result = parser();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });

  describe('parser name', () => {
    test('has correct function name', () => {
      const parser = getEnvConfigFromNodeEnv('prep');
      expect(parser.name).toBe('fromNodeEnv()');
    });
  });
});
