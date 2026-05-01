import { getEnvCommitFromEnvar } from './getEnvCommitFromEnvar';

describe('getEnvCommitFromEnvar', () => {
  const commitBefore = process.env.COMMIT;

  afterEach(() => {
    if (commitBefore === undefined) {
      delete process.env.COMMIT;
    } else {
      process.env.COMMIT = commitBefore;
    }
  });

  describe('positive cases', () => {
    test('returns value when COMMIT is set', () => {
      process.env.COMMIT = 'v1.0.0@abc123';
      const result = getEnvCommitFromEnvar();
      expect(result).toBe('v1.0.0@abc123');
      expect(result).toMatchSnapshot();
    });

    test('returns value with dirty flag', () => {
      process.env.COMMIT = 'main@abc123+';
      const result = getEnvCommitFromEnvar();
      expect(result).toBe('main@abc123+');
      expect(result).toMatchSnapshot();
    });
  });

  describe('negative cases', () => {
    test('returns null when COMMIT is not set', () => {
      delete process.env.COMMIT;
      const result = getEnvCommitFromEnvar();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });

    test('returns null when COMMIT is empty string', () => {
      process.env.COMMIT = '';
      const result = getEnvCommitFromEnvar();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });
});
