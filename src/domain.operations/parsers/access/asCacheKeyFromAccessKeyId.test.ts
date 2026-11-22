import { given, then, when } from 'test-fns';

import { asCacheKeyFromAccessKeyId } from './asCacheKeyFromAccessKeyId';

describe('asCacheKeyFromAccessKeyId', () => {
  given('[case1] one access key id', () => {
    when('[t0] the key is derived twice', () => {
      then('it yields the same key', () => {
        expect(
          asCacheKeyFromAccessKeyId({ accessKeyId: 'AKIAEXAMPLEA' }),
        ).toEqual(asCacheKeyFromAccessKeyId({ accessKeyId: 'AKIAEXAMPLEA' }));
      });
    });
  });

  given('[case2] two access key ids', () => {
    when('[t0] a key is derived for each', () => {
      then('they yield other keys', () => {
        expect(
          asCacheKeyFromAccessKeyId({ accessKeyId: 'AKIAEXAMPLEA' }),
        ).not.toEqual(
          asCacheKeyFromAccessKeyId({ accessKeyId: 'AKIAEXAMPLEB' }),
        );
      });
    });
  });

  given('[case3] an access key id bound for a file name', () => {
    when('[t0] the key is derived', () => {
      then('it is filesystem-safe and never holds the access key id', () => {
        const key = asCacheKeyFromAccessKeyId({ accessKeyId: 'AKIAEXAMPLEA' });
        expect(key).toMatch(/^[0-9a-f]{32}$/);
        expect(key).not.toContain('AKIAEXAMPLEA');
      });
    });
  });
});
