import { given, then, useBeforeAll, when } from 'test-fns';

import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * .what = invoke the CLI via tsx for integration test
 * .why = tests CLI contract without compiled binary
 */
const invokeCli = (input: {
  args: string[];
  cwd?: string;
}): { stdout: string; stderr: string; exitCode: number } => {
  const invokeTs = path.join(__dirname, './invoke.ts');
  const result = spawnSync('npx', ['tsx', invokeTs, ...input.args], {
    cwd: input.cwd ?? process.cwd(),
    encoding: 'utf-8',
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.status ?? 1,
  };
};

describe('getCommit (cli)', () => {
  given('[case1] a git repository', () => {
    when('[t0] `get commit` is invoked', () => {
      const result = useBeforeAll(async () =>
        invokeCli({ args: ['get', 'commit'] }),
      );

      then('exit code is 0', () => {
        expect(result.exitCode).toBe(0);
      });

      then('stdout contains commit slug in $ref@$hash format', () => {
        const stdout = result.stdout.trim();
        expect(stdout).toContain('@');

        // verify format: ref@hash or ref@hash+ (dirty)
        const pattern = /^.+@[a-z0-9]+\+?$/i;
        expect(pattern.test(stdout)).toBe(true);
      });

      then('stderr is empty', () => {
        expect(result.stderr).toBe('');
      });

      then('output matches snapshot (hash stripped)', () => {
        const stdout = result.stdout.trim();
        // strip hash for snapshot stability
        const snapshotSafe = stdout.replace(/@[a-z0-9]+(\+?)$/i, '@<hash>$1');
        expect(snapshotSafe).toMatchSnapshot();
      });
    });
  });

  given('[case2] unknown command', () => {
    when('[t0] `foo bar` is invoked', () => {
      const result = useBeforeAll(async () =>
        invokeCli({ args: ['foo', 'bar'] }),
      );

      then('exit code is 2 (constraint)', () => {
        expect(result.exitCode).toBe(2);
      });

      then('stderr contains error message', () => {
        expect(result.stderr).toContain('unknown command');
      });

      then('stdout is empty', () => {
        expect(result.stdout).toBe('');
      });
    });
  });
});
