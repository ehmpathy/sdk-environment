import { getEnvAccessFromEnvar } from './getEnvAccessFromEnvar';

describe('getEnvAccessFromEnvar', () => {
  const accessBefore = process.env.ACCESS;

  afterEach(() => {
    if (accessBefore === undefined) {
      delete process.env.ACCESS;
    } else {
      process.env.ACCESS = accessBefore;
    }
  });

  describe('positive cases', () => {
    test('returns value when ACCESS is set to test', () => {
      process.env.ACCESS = 'test';
      const result = getEnvAccessFromEnvar();
      expect(result).toBe('test');
      expect(result).toMatchSnapshot();
    });

    test('returns value when ACCESS is set to prep', () => {
      process.env.ACCESS = 'prep';
      const result = getEnvAccessFromEnvar();
      expect(result).toBe('prep');
      expect(result).toMatchSnapshot();
    });

    test('returns value when ACCESS is set to prod', () => {
      process.env.ACCESS = 'prod';
      const result = getEnvAccessFromEnvar();
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });
  });

  describe('negative cases', () => {
    test('returns null when ACCESS is not set', () => {
      delete process.env.ACCESS;
      const result = getEnvAccessFromEnvar();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });

    test('returns null when ACCESS is empty string', () => {
      process.env.ACCESS = '';
      const result = getEnvAccessFromEnvar();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });
});
