import { given, then, when } from 'test-fns';

import { getAccessKeyIdFromAccountClient } from './getAccessKeyIdFromAccountClient';

describe('getAccessKeyIdFromAccountClient', () => {
  given('[case1] a client with a credential provider', () => {
    const client = {
      config: {
        credentials: async () => ({ accessKeyId: 'AKIAEXAMPLEREADKEY' }),
      },
    };
    when('[t0] the key is read', () => {
      then('it returns the provider access key id', async () => {
        expect(await getAccessKeyIdFromAccountClient({ client })).toEqual(
          'AKIAEXAMPLEREADKEY',
        );
      });
    });
  });

  given(
    '[case2] a client a module-level mock of the sdk built, with no config',
    () => {
      const client = {};
      when('[t0] the key is read', () => {
        then('it returns null, so no key names the caller', async () => {
          expect(await getAccessKeyIdFromAccountClient({ client })).toBeNull();
        });
      });
    },
  );
});
