import { given, then, when } from 'test-fns';

import { isExpectedGitError } from './getEnvCommitFromGit';

describe('isExpectedGitError', () => {
  given('isExpectedGitError', () => {
    when('error is "not a git repository"', () => {
      then('returns true', () => {
        const error = new Error(
          'fatal: not a git repository (or any of the parent directories): .git',
        );
        expect(isExpectedGitError(error)).toBe(true);
      });
    });

    when('error starts with "fatal:"', () => {
      then('returns true', () => {
        const error = new Error('fatal: ambiguous argument');
        expect(isExpectedGitError(error)).toBe(true);
      });
    });

    when('error is "command not found"', () => {
      then('returns true', () => {
        const error = new Error('git: command not found');
        expect(isExpectedGitError(error)).toBe(true);
      });
    });

    when('error is "enoent"', () => {
      then('returns true', () => {
        const error = new Error('ENOENT: no such file or directory');
        expect(isExpectedGitError(error)).toBe(true);
      });
    });

    when('error is "command failed" with "git"', () => {
      then('returns true', () => {
        const error = new Error(
          'Command failed: git describe --tags --exact-match',
        );
        expect(isExpectedGitError(error)).toBe(true);
      });
    });

    when('error is unrelated', () => {
      then('returns false', () => {
        const error = new Error('network timeout');
        expect(isExpectedGitError(error)).toBe(false);
      });
    });

    when('error is string', () => {
      then('handles string error', () => {
        expect(isExpectedGitError('fatal: bad revision')).toBe(true);
        expect(isExpectedGitError('random error')).toBe(false);
      });
    });

    when('error is error-like object', () => {
      then('handles error-like object', () => {
        const errorLike = { message: 'not a git repository' };
        expect(isExpectedGitError(errorLike)).toBe(true);
      });
    });
  });
});
