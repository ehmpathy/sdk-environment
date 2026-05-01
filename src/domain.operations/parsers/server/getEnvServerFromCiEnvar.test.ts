import { getEnvServerFromCiEnvar } from './getEnvServerFromCiEnvar';

describe('getEnvServerFromCiEnvar', () => {
  const ciBefore = process.env.CI;

  afterEach(() => {
    if (ciBefore === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = ciBefore;
    }
  });

  describe('positive cases', () => {
    test('returns local@cicd when CI=true', () => {
      process.env.CI = 'true';
      const result = getEnvServerFromCiEnvar();
      expect(result).toBe('local@cicd');
      expect(result).toMatchSnapshot();
    });
  });

  describe('negative cases', () => {
    test('returns null when CI is not set', () => {
      delete process.env.CI;
      const result = getEnvServerFromCiEnvar();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });

    test('returns null when CI=false', () => {
      process.env.CI = 'false';
      const result = getEnvServerFromCiEnvar();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });
});
