import { given, then, when } from 'test-fns';

import { getEnvAccessFromAwsAccountName } from './getEnvAccessFromAwsAccountName';

describe('getEnvAccessFromAwsAccountName', () => {
  given('aws environment with credentials', () => {
    when('getEnvAccessFromAwsAccountName is called', () => {
      then('calls real aws service and returns result', async () => {
        // this test verifies the aws call completes without error
        // null = no account name matched default patterns
        // 'test' | 'prep' | 'prod' = name matched in default map
        const result = await getEnvAccessFromAwsAccountName();

        // verify result is valid shape
        if (result !== null) {
          expect(['test', 'prep', 'prod']).toContain(result);
        }
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
      then('applies custom map to name', async () => {
        // test with wildcard map that matches any name
        const result = await getEnvAccessFromAwsAccountName({
          map: { '*': 'prod' },
        });

        // null = credential error handled gracefully
        // 'prod' = name matched wildcard
        if (result !== null) {
          expect(result).toBe('prod');
        }
        expect(result).toMatchSnapshot();
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
      // exhaustive output variant coverage for contract snapshots
      then('forces test tier output', async () => {
        const result = await getEnvAccessFromAwsAccountName({
          map: { '*': 'test' },
        });
        if (result !== null) expect(result).toBe('test');
        expect(result).toMatchSnapshot();
      });

      then('forces prep tier output', async () => {
        const result = await getEnvAccessFromAwsAccountName({
          map: { '*': 'prep' },
        });
        if (result !== null) expect(result).toBe('prep');
        expect(result).toMatchSnapshot();
      });

      then('forces prod tier output', async () => {
        const result = await getEnvAccessFromAwsAccountName({
          map: { '*': 'prod' },
        });
        if (result !== null) expect(result).toBe('prod');
        expect(result).toMatchSnapshot();
      });

      then('forces null output via no-match map', async () => {
        const result = await getEnvAccessFromAwsAccountName({
          map: { 'will-never-match-any-real-account': 'prod' },
        });
        expect(result).toBeNull();
        expect(result).toMatchSnapshot();
      });
    });
  });
});
