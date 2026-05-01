import { given, then, when } from 'test-fns';

import { getEnvCommitFromGit } from './getEnvCommitFromGit';

describe('getEnvCommitFromGit', () => {
  given('a git repository', () => {
    when('commit info is requested', () => {
      then('returns commit slug in $ref@$hash format', async () => {
        const result = await getEnvCommitFromGit();

        // verify not null
        expect(result).not.toBe(null);

        // verify contains @ separator
        expect(result).toContain('@');

        // verify matches expected format: ref@hash or ref@hash+ (dirty)
        const pattern = /^.+@[a-z0-9]+\+?$/i;
        expect(pattern.test(result!)).toBe(true);

        // snapshot format structure (ref@hash pattern, not exact value)
        expect(result?.replace(/@[a-z0-9]+\+?$/i, '@<hash>')).toMatchSnapshot();
      });
    });
  });
});
