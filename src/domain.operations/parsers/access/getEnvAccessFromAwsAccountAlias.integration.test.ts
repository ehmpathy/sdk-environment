import { given, then, when } from 'test-fns';

import { getEnvAccessFromAwsAccountAlias } from './getEnvAccessFromAwsAccountAlias';

describe('getEnvAccessFromAwsAccountAlias', () => {
  given('aws environment with credentials', () => {
    when('getEnvAccessFromAwsAccountAlias is called', () => {
      then('calls real aws service and returns result', async () => {
        // this test verifies the aws call completes without error
        // null = no account alias configured (valid for this parser)
        // 'test' | 'prep' | 'prod' = alias matched in default map
        const result = await getEnvAccessFromAwsAccountAlias();

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

          const result = await getEnvAccessFromAwsAccountAlias();

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
      then('applies custom map to alias', async () => {
        // test with wildcard map that matches any alias
        const result = await getEnvAccessFromAwsAccountAlias({
          map: { '*': 'prod' },
        });

        // null = no alias configured (aws account has no alias)
        // 'prod' = alias exists and matched wildcard
        if (result !== null) {
          expect(result).toBe('prod');
        }
        expect(result).toMatchSnapshot();
      });
    });
  });
});
