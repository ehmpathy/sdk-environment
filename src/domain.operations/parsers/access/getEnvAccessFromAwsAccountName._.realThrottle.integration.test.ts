import {
  genTempDir,
  getError,
  given,
  then,
  useBeforeAll,
  when,
} from 'test-fns';

import { genAwsAccountApiFake } from '@src/.test/assets/genAwsAccountApiFake';
import { withEnvVars } from '@src/.test/assets/withEnvVars';

import { getEnvAccessFromAwsAccountName } from './getEnvAccessFromAwsAccountName';

describe('getEnvAccessFromAwsAccountName.realThrottle', () => {
  given('[case1] the account api throttles 4 times, then answers', () => {
    const scene = useBeforeAll(async () => {
      const api = await genAwsAccountApiFake({
        throttles: 4,
        accountName: 'acme-test',
        delayMs: 0,
      });

      // env credentials win the sdk's chain; the endpoint env points the real sdk at the fake
      try {
        const cacheDir = genTempDir({ slug: 'aws-name-real-throttle' });
        const outcomes = await withEnvVars(
          {
            vars: {
              AWS_ACCESS_KEY_ID: 'AKIAEXAMPLETHROTTLE',
              AWS_SECRET_ACCESS_KEY: 'example-secret',
              AWS_REGION: 'us-east-1',
              AWS_ENDPOINT_URL_ACCOUNT: api.url,
              AWS_SESSION_TOKEN: null,
              AWS_PROFILE: null,
              AWS_MAX_ATTEMPTS: null, // the call count below rests on the sdk's default 3 attempts
              AWS_RETRY_MODE: null,
              AWS_CONFIG_FILE: '/dev/null', // no host config may tune retries
            },
          },
          () =>
            Promise.allSettled(
              Array.from({ length: 8 }, () =>
                getEnvAccessFromAwsAccountName(undefined, { cacheDir }),
              ),
            ),
        );
        return { outcomes, calls: api.calls() };
      } finally {
        await new Promise((done) => api.server.close(done));
      }
    });

    when('[t0] 8 cold callers read the account name at once', () => {
      then('every caller gets its tier; none fails', () => {
        expect(scene.outcomes).toEqual(
          Array.from({ length: 8 }, () => ({
            status: 'fulfilled',
            value: 'test',
          })),
        );
      });

      then(
        'only the holder calls aws: past the sdk own 3 attempts, then once more to succeed',
        () => {
          expect(scene.calls).toEqual(5);
        },
      );
    });
  });

  given('[case2] the account api throttles every call', () => {
    const scene = useBeforeAll(async () => {
      const api = await genAwsAccountApiFake({
        throttles: Number.POSITIVE_INFINITY,
        accountName: 'acme-test',
        delayMs: 0,
      });
      try {
        const cacheDir = genTempDir({ slug: 'aws-name-real-throttle-endless' });
        const error = await withEnvVars(
          {
            vars: {
              AWS_ACCESS_KEY_ID: 'AKIAEXAMPLEENDLESS',
              AWS_SECRET_ACCESS_KEY: 'example-secret',
              AWS_REGION: 'us-east-1',
              AWS_ENDPOINT_URL_ACCOUNT: api.url,
              AWS_SESSION_TOKEN: null,
              AWS_PROFILE: null,
              AWS_MAX_ATTEMPTS: null, // the call count below rests on the sdk's default 3 attempts
              AWS_RETRY_MODE: null,
              AWS_CONFIG_FILE: '/dev/null', // no host config may tune retries
            },
          },
          () =>
            getError(getEnvAccessFromAwsAccountName(undefined, { cacheDir })),
        );
        return { error, calls: api.calls() };
      } finally {
        await new Promise((done) => api.server.close(done));
      }
    });

    when('[t0] one cold caller reads the account name', () => {
      then('the caller sees the throttle error, by name', () => {
        expect(scene.error.name).toEqual('TooManyRequestsException');
        expect({
          name: scene.error.name,
          message: scene.error.message,
          callsToAws: scene.calls,
        }).toMatchSnapshot();
      });

      then(
        'aws sees a bounded count: 6 attempts here, each over the sdk own 3',
        () => {
          expect(scene.calls).toEqual(18);
        },
      );
    });
  });
});
