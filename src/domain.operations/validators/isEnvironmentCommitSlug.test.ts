import { isEnvironmentCommitSlug } from './isEnvironmentCommitSlug';

describe('isEnvironmentCommitSlug', () => {
  describe('positive cases', () => {
    test.each([
      'v1.0.0@abc123',
      'main@abc123',
      'feat/auth@e4f5g6h',
      'v1.2.3@i7j8k9l+', // dirty flag
      'main@abc123+', // dirty flag
    ])('returns true for %s', (value) => {
      expect(isEnvironmentCommitSlug(value)).toBe(true);
    });
  });

  describe('negative cases', () => {
    test.each([
      '',
      'abc123', // no @ separator
      'abc123+', // no @ separator
      'foobar', // no @ separator
      null,
      undefined,
      123,
      {},
      [],
    ])('returns false for %p', (value) => {
      expect(isEnvironmentCommitSlug(value)).toBe(false);
    });
  });
});
