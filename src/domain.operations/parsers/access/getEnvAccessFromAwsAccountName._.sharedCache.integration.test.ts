import { genTempDir, given, then, when } from 'test-fns';

import { withEnvVars } from '@src/.test/assets/withEnvVars';

import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { asCacheKeyFromAccessKeyId } from './asCacheKeyFromAccessKeyId';
import {
  getEnvAccessFromAwsAccountName,
  type SdkAwsAccount,
} from './getEnvAccessFromAwsAccountName';

/**
 * .what = a fake aws account sdk for one caller
 * .why = pins which access key a process holds and what aws answers it
 */
const genSdkAwsAccountFake = (input: {
  accessKeyId: string;
  reply: { error: Error } | { accountName: string };
}): SdkAwsAccount & { calls: () => number } => {
  const state = { calls: 0 };
  return {
    getAccessKeyId: async () => input.accessKeyId,
    getAccountName: async () => {
      state.calls += 1; // .note = deliberate mutation, scoped to this fake
      if ('error' in input.reply) throw input.reply.error;
      return input.reply.accountName;
    },
    calls: () => state.calls,
  };
};

describe('getEnvAccessFromAwsAccountName.sharedCache', () => {
  given('[case1] a fresh cache written under access key A', () => {
    when('[t0] a process with access key B reads the account name', () => {
      then("it asks aws itself and returns B's tier, never A's", async () => {
        const cacheDir = genTempDir({ slug: 'aws-name-isolation' });
        const sdkA = genSdkAwsAccountFake({
          accessKeyId: 'AKIAEXAMPLEA',
          reply: { accountName: 'acme-test' },
        });
        const sdkB = genSdkAwsAccountFake({
          accessKeyId: 'AKIAEXAMPLEB',
          reply: { accountName: 'acme-prod' },
        });
        expect(
          await getEnvAccessFromAwsAccountName(undefined, {
            sdkAwsAccount: sdkA,
            cacheDir,
          }),
        ).toEqual('test');
        expect(
          await getEnvAccessFromAwsAccountName(undefined, {
            sdkAwsAccount: sdkB,
            cacheDir,
          }),
        ).toEqual('prod');
        expect(sdkA.calls()).toEqual(1);
        expect(sdkB.calls()).toEqual(1);
      });
    });
  });

  given("[case2] aws rejects the caller's credentials", () => {
    when('[t0] getEnvAccessFromAwsAccountName is called', () => {
      then('it returns null, and no cache file is written', async () => {
        const cacheDir = genTempDir({ slug: 'aws-name-credential-error' });
        const sdk = genSdkAwsAccountFake({
          accessKeyId: 'AKIAEXAMPLEBAD',
          reply: {
            error: new Error(
              'The security token included in the request is invalid.',
            ),
          },
        });
        const result = await getEnvAccessFromAwsAccountName(undefined, {
          sdkAwsAccount: sdk,
          cacheDir,
        });
        expect(result).toBeNull();
        expect(
          (await readdir(cacheDir)).filter((name) => name.endsWith('.json')),
        ).toEqual([]);
      });
    });
  });

  given('[case3] the same caller reads twice with different maps', () => {
    when('[t0] each read applies its own map', () => {
      then(
        'aws is asked once; each map reads the one cached name',
        async () => {
          const cacheDir = genTempDir({ slug: 'aws-name-maps' });
          const sdk = genSdkAwsAccountFake({
            accessKeyId: 'AKIAEXAMPLEA',
            reply: { accountName: 'acme-test' },
          });
          expect(
            await getEnvAccessFromAwsAccountName(undefined, {
              sdkAwsAccount: sdk,
              cacheDir,
            }),
          ).toEqual('test');
          expect(
            await getEnvAccessFromAwsAccountName(
              { map: { '*': 'prod' } },
              { sdkAwsAccount: sdk, cacheDir },
            ),
          ).toEqual('prod');
          expect(sdk.calls()).toEqual(1);
        },
      );
    });
  });

  given('[case4] the real aws sdk seam, with env credentials', () => {
    when('[t0] a fresh cache holds a name under the env access key', () => {
      then(
        'the default seam keys the cache by that access key id, with no aws call',
        async () => {
          const cacheDir = genTempDir({ slug: 'aws-name-default-seam' });
          const accessKeyId = 'AKIAEXAMPLESEAM';
          await writeFile(
            join(
              cacheDir,
              `${asCacheKeyFromAccessKeyId({ accessKeyId })}.json`,
            ),
            JSON.stringify({ value: 'acme-test' }),
          );

          // env credentials win the sdk's credential chain
          const result = await withEnvVars(
            {
              vars: {
                AWS_ACCESS_KEY_ID: accessKeyId,
                AWS_SECRET_ACCESS_KEY: 'example-secret',
                AWS_REGION: 'us-east-1',
                AWS_SESSION_TOKEN: null,
                AWS_PROFILE: null,
              },
            },
            () => getEnvAccessFromAwsAccountName(undefined, { cacheDir }),
          );
          expect(result).toEqual('test');
        },
      );
    });
  });

  given('[case5] a cold burst whose holder gets a transient 5xx', () => {
    when(
      '[t0] 10 callers read at once; the first call fails, the next succeeds',
      () => {
        then(
          'the waiters keep the queue: one more call answers them all, never a stampede',
          async () => {
            const cacheDir = genTempDir({ slug: 'aws-name-holder-5xx' });
            const state = { calls: 0 };
            const sdk: SdkAwsAccount = {
              getAccessKeyId: async () => 'AKIAEXAMPLE5XX',
              getAccountName: async () => {
                state.calls += 1; // .note = deliberate mutation, scoped to this fake
                await sleep(100); // long enough that every other caller waits on the lock
                if (state.calls === 1)
                  throw Object.assign(new Error('Internal Server Error'), {
                    name: 'InternalServerException',
                    $fault: 'server', // as the aws sdk marks a 5xx
                    $metadata: { httpStatusCode: 500 },
                  });
                return 'acme-test';
              },
            };
            const outcomes = await Promise.allSettled(
              Array.from({ length: 10 }, () =>
                getEnvAccessFromAwsAccountName(undefined, {
                  sdkAwsAccount: sdk,
                  cacheDir,
                }),
              ),
            );
            expect(
              outcomes.filter((outcome) => outcome.status === 'rejected'),
            ).toHaveLength(1); // the holder that got the 5xx
            expect(state.calls).toEqual(2);
          },
        );
      },
    );
  });

  given('[case6] a cold burst whose aws host cannot be reached', () => {
    when('[t0] 10 callers read at once; every call fails the same way', () => {
      then(
        'the waiters are freed: each sees its own error at once, not one after another',
        async () => {
          const cacheDir = genTempDir({ slug: 'aws-name-host-unknown' });
          const sdk: SdkAwsAccount = {
            getAccessKeyId: async () => 'AKIAEXAMPLENOHOST',
            getAccountName: async () => {
              await sleep(300);
              throw Object.assign(
                new Error(
                  'getaddrinfo ENOTFOUND account.us-east-1.amazonaws.com',
                ),
                { code: 'ENOTFOUND' },
              );
            },
          };
          const startedAt = Date.now();
          const outcomes = await Promise.allSettled(
            Array.from({ length: 10 }, () =>
              getEnvAccessFromAwsAccountName(undefined, {
                sdkAwsAccount: sdk,
                cacheDir,
              }),
            ),
          );
          expect(
            outcomes.filter((outcome) => outcome.status === 'rejected'),
          ).toHaveLength(10);
          expect(Date.now() - startedAt).toBeLessThan(1_500); // one after another would take ~3s
        },
      );
    });
  });
});
