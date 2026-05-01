import { getEnvServerFromEnvar } from './getEnvServerFromEnvar';

describe('getEnvServerFromEnvar', () => {
  const serverBefore = process.env.SERVER;

  afterEach(() => {
    if (serverBefore === undefined) {
      delete process.env.SERVER;
    } else {
      process.env.SERVER = serverBefore;
    }
  });

  describe('positive cases', () => {
    test('returns value when SERVER is set', () => {
      process.env.SERVER = 'cloud@aws.lambda';
      const result = getEnvServerFromEnvar();
      expect(result).toBe('cloud@aws.lambda');
      expect(result).toMatchSnapshot();
    });

    test('returns value for local@unix', () => {
      process.env.SERVER = 'local@unix';
      const result = getEnvServerFromEnvar();
      expect(result).toBe('local@unix');
      expect(result).toMatchSnapshot();
    });
  });

  describe('negative cases', () => {
    test('returns null when SERVER is not set', () => {
      delete process.env.SERVER;
      const result = getEnvServerFromEnvar();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });

    test('returns null when SERVER is empty string', () => {
      process.env.SERVER = '';
      const result = getEnvServerFromEnvar();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });
});
