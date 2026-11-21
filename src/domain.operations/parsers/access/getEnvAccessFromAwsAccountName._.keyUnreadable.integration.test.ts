import { genTempDir, given, then, when } from 'test-fns';

import { readdir } from 'node:fs/promises';
import { getEnvAccessFromAwsAccountName } from './getEnvAccessFromAwsAccountName';

describe('getEnvAccessFromAwsAccountName.keyUnreadable', () => {
  given(
    '[case1] a client that holds no key, as a module-level mock of the sdk builds',
    () => {
      // fake account api, injected: no key names the caller (see getAccessKeyIdFromAccountClient.test.ts [case2])
      const sdkAwsAccount = {
        getAccessKeyId: async (): Promise<string | null> => null,
        getAccountName: async (): Promise<string | null> => 'acme-prod',
      };

      when('[t0] the parser reads the account name', () => {
        then(
          'it answers from aws direct, and caches naught under a key it could not read',
          async () => {
            const cacheDir = genTempDir({ slug: 'aws-name-key-unreadable' });
            const result = await getEnvAccessFromAwsAccountName(undefined, {
              sdkAwsAccount,
              cacheDir,
            });
            expect(result).toEqual('prod');
            expect(
              (await readdir(cacheDir)).filter((name) =>
                name.endsWith('.json'),
              ),
            ).toEqual([]);
          },
        );
      });
    },
  );
});
