import { ConstraintError } from 'helpful-errors';
import { genTempDir, given, then, useBeforeAll, when } from 'test-fns';

import type { EnvironmentAccessTier } from '@src/domain.objects/EnvironmentAccessTier';

import {
  getEnvAccessFromAwsAccountName,
  type SdkAwsAccount,
} from './getEnvAccessFromAwsAccountName';
import { isCredentialError } from './isCredentialError';

/**
 * .what = ask aws direct whether this runner may read its account name
 * .why = a wildcard or forced map yields its tier only for a runner that can read the
 *        name, and null for one that cannot (no creds, or creds refused the read); the
 *        real-aws cases assert the one outcome each runner earns
 * .note = off ci, keyrack must supply creds, so absent creds fail loud with the unlock
 *         command. ci holds no aws creds unless the repo sets its oidc role var; there
 *         each real-aws case runs credential-less and asserts the null a caller with no
 *         creds gets, a real outcome of the contract
 */
const getIsAccountNameReadable = async (): Promise<boolean> => {
  const { AccountClient, GetAccountInformationCommand } = await import(
    '@aws-sdk/client-account'
  );
  const client = new AccountClient({});

  // halt off ci when no creds load: the real-aws cases would read naught real
  const credentials = await client.config.credentials().catch(() => null);
  if (!credentials && !process.env.CI)
    throw new ConstraintError('aws creds required for real-aws cases', {
      hint: 'run: rhx keyrack unlock --owner ehmpath --env test',
    });
  if (!credentials) return false;

  // a refusal of the read itself marks a name-blind identity
  try {
    await client.send(new GetAccountInformationCommand({}));
    return true;
  } catch (error) {
    if (isCredentialError({ error })) return false;
    throw error;
  }
};

/**
 * .what = a snapshot mask for a tier that only a name-readable identity earns
 * .why = the live value differs by who runs the suite; the mask checks the exact value
 *        each runner earns, and prints one constant, so the live snapshot holds on every runner
 * .note = jest prints an asymmetric matcher by its `toAsymmetricMatcher()`, as it prints `Any<Date>`
 */
const asTierIfNameReadable = (input: {
  tier: EnvironmentAccessTier;
  isReadable: boolean;
}): {
  $$typeof: symbol;
  asymmetricMatch: (actual: unknown) => boolean;
  toAsymmetricMatcher: () => string;
} => ({
  $$typeof: Symbol.for('jest.asymmetricMatcher'),
  asymmetricMatch: (actual: unknown): boolean =>
    actual === (input.isReadable ? input.tier : null),
  toAsymmetricMatcher: (): string => `TierIfNameReadable<${input.tier}>`,
});

describe('getEnvAccessFromAwsAccountName', () => {
  given('aws environment with credentials', () => {
    when('getEnvAccessFromAwsAccountName is called', () => {
      then('calls real aws service and returns result', async () => {
        // the call completes without error; the test account's name fits no default
        // pattern, and an identity that cannot read the name yields null too
        const result = await getEnvAccessFromAwsAccountName();
        expect(result).toBeNull();
        expect(result).toMatchSnapshot();
      });
    });

    when('invalid credentials provided', () => {
      then('returns null without error', async () => {
        // this test verifies credential errors are handled gracefully
        // save and clear credentials
        const accessKeyBefore = process.env.AWS_ACCESS_KEY_ID;
        const secretKeyBefore = process.env.AWS_SECRET_ACCESS_KEY;

        try {
          process.env.AWS_ACCESS_KEY_ID = 'INVALID_KEY';
          process.env.AWS_SECRET_ACCESS_KEY = 'INVALID_SECRET';

          const result = await getEnvAccessFromAwsAccountName();

          // invalid credentials should return null, not throw
          expect(result).toBeNull();
          expect(result).toMatchSnapshot();
        } finally {
          // restore credentials
          if (accessKeyBefore) process.env.AWS_ACCESS_KEY_ID = accessKeyBefore;
          else delete process.env.AWS_ACCESS_KEY_ID;
          if (secretKeyBefore)
            process.env.AWS_SECRET_ACCESS_KEY = secretKeyBefore;
          else delete process.env.AWS_SECRET_ACCESS_KEY;
        }
      });
    });

    when('custom map provided', () => {
      // probed only where a case reads it, so the other real-aws cases run as main runs them
      const identity = useBeforeAll(async () => ({
        isReadable: await getIsAccountNameReadable(),
      }));

      then('applies custom map to name', async () => {
        // test with wildcard map that matches any name
        const result = await getEnvAccessFromAwsAccountName({
          map: { '*': 'prod' },
        });

        // 'prod' = name matched wildcard; null = identity cannot read the name
        expect(result).toBe(identity.isReadable ? 'prod' : null);
        expect({ result }).toMatchSnapshot({
          result: asTierIfNameReadable({
            tier: 'prod',
            isReadable: identity.isReadable,
          }),
        });
      });

      then('returns null when custom map has no match', async () => {
        // test with map that won't match any real account name
        const result = await getEnvAccessFromAwsAccountName({
          map: { 'nonexistent-account-name-that-will-never-match': 'prod' },
        });

        // should return null since map has no pattern that fits
        expect(result).toBeNull();
        expect(result).toMatchSnapshot();
      });
    });

    when('forced output variants via custom maps', () => {
      const identity = useBeforeAll(async () => ({
        isReadable: await getIsAccountNameReadable(),
      }));
      const tiers: EnvironmentAccessTier[] = ['test', 'prep', 'prod'];

      tiers.map((tier) =>
        then(`forces ${tier} tier output`, async () => {
          const result = await getEnvAccessFromAwsAccountName({
            map: { '*': tier },
          });
          expect(result).toBe(identity.isReadable ? tier : null);
          expect({ result }).toMatchSnapshot({
            result: asTierIfNameReadable({
              tier,
              isReadable: identity.isReadable,
            }),
          });
        }),
      );

      then('forces null output via no-match map', async () => {
        const result = await getEnvAccessFromAwsAccountName({
          map: { 'will-never-match-any-real-account': 'prod' },
        });
        expect(result).toBeNull();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case2] an account whose name is known: acme-prod', () => {
    // fake account api, injected: the name is fixed, so each tier variant is the
    // same on every runner and its snapshot holds
    const sdkAwsAccount: SdkAwsAccount = {
      getAccessKeyId: async () => 'AKIAEXAMPLEKNOWNNAME',
      getAccountName: async () => 'acme-prod',
    };
    const getAccessViaKnownName = (
      input?: Parameters<typeof getEnvAccessFromAwsAccountName>[0],
    ): ReturnType<typeof getEnvAccessFromAwsAccountName> =>
      getEnvAccessFromAwsAccountName(input, {
        sdkAwsAccount,
        cacheDir: genTempDir({ slug: 'aws-name-known' }),
      });

    when('[t0] the default map is used', () => {
      then('the name matches *-prod: prod', async () => {
        const result = await getAccessViaKnownName();
        expect(result).toBe('prod');
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] a custom map names the account exactly', () => {
      then('the exact match wins: prep', async () => {
        const result = await getAccessViaKnownName({
          map: { '*-prod': 'prod', 'acme-prod': 'prep' },
        });
        expect(result).toBe('prep');
        expect(result).toMatchSnapshot();
      });
    });

    when('[t2] forced output variants via custom maps', () => {
      // exhaustive output variant coverage: each tier, and null
      then('forces test tier output', async () => {
        const result = await getAccessViaKnownName({ map: { '*': 'test' } });
        expect(result).toBe('test');
        expect(result).toMatchSnapshot();
      });

      then('forces prep tier output', async () => {
        const result = await getAccessViaKnownName({ map: { '*': 'prep' } });
        expect(result).toBe('prep');
        expect(result).toMatchSnapshot();
      });

      then('forces prod tier output', async () => {
        const result = await getAccessViaKnownName({ map: { '*': 'prod' } });
        expect(result).toBe('prod');
        expect(result).toMatchSnapshot();
      });

      then('forces null output via no-match map', async () => {
        const result = await getAccessViaKnownName({
          map: { 'will-never-match-any-real-account': 'prod' },
        });
        expect(result).toBeNull();
        expect(result).toMatchSnapshot();
      });
    });
  });
});
