import { MalfunctionError } from 'helpful-errors';
import { genTempDir, given, then, useBeforeAll, when } from 'test-fns';

import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * .what = boot one child process; expose when it is ready and what it printed
 * .why = the burst must start only once every child has booted
 * .note = a spawn failure or an early exit rejects both promises at once, with stderr
 */
const genChild = (input: {
  env: Record<string, string>;
}): { ready: Promise<void>; lines: Promise<string[]> } => {
  const child = spawn(
    join(process.cwd(), 'node_modules/.bin/tsx'),
    [join(__dirname, '.test/assets/getEnvAccessInChildProcess.ts')],
    { env: { ...process.env, ...input.env } },
  );

  // .note = deliberate mutation: stream chunks accrue into these buffers
  const stdout: string[] = [];
  const stderr: string[] = [];
  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));

  // one failure for every way the child can fail: spawn error or nonzero exit
  const failed = new Promise<never>((_, onFail) => {
    child.on('error', (error) =>
      onFail(
        new MalfunctionError('child: spawn failed', {
          cause: error,
          hint: 'check node_modules/.bin/tsx exists (pnpm install)',
        }),
      ),
    );
    child.on('exit', (code) => {
      if (code !== 0)
        onFail(
          new MalfunctionError(`child: exited ${code}`, {
            stderr: stderr.join(''),
            hint: 'stderr above names the fault in the child fixture',
          }),
        );
    });
  });
  failed.catch(() => undefined); // note: each consumer below races it and surfaces it

  const ready = Promise.race([
    new Promise<void>((onReady) => {
      child.stdout.on('data', (chunk: Buffer) => {
        stdout.push(chunk.toString());
        if (stdout.join('').includes('ready\n')) onReady();
      });
    }),
    failed,
  ]);
  const lines = Promise.race([
    new Promise<string[]>((onExit) => {
      child.on('exit', (code) => {
        if (code === 0) onExit(stdout.join('').trim().split('\n'));
      });
    }),
    failed,
  ]);
  return { ready, lines };
};

/**
 * .what = cast a child's last stdout line to the access tier it printed
 * .why = a malformed line fails loud, never reads as undefined
 */
const asChildAccess = (input: { line: string | undefined }): unknown => {
  const parsed: unknown = JSON.parse(input.line ?? 'null');
  if (typeof parsed !== 'object' || parsed === null || !('access' in parsed))
    throw new MalfunctionError('child: last stdout line lacks access', {
      line: input.line,
    });
  return parsed.access;
};

/**
 * .what = run N child processes that each call getEnvAccessFromAwsAccountName at once
 * .why = reproduces issue #17: jest gives each test file its own process, so only real
 *        processes prove one GetAccountInformation call serves them all
 */
const getOneColdBurstOutcome = async (input: {
  processes: number;
  throttleFirst: boolean;
}): Promise<{ accesses: unknown[]; callerPids: string[] }> => {
  const dir = genTempDir({ slug: 'aws-account-name-burst' });
  const callsLog = join(dir, 'calls.log');
  const goFile = join(dir, 'go');
  await writeFile(callsLog, '');

  // boot every child; each waits for the go file
  const children = Array.from({ length: input.processes }, () =>
    genChild({
      env: {
        CACHE_DIR: join(dir, 'cache'),
        CALLS_LOG: callsLog,
        GO_FILE: goFile,
        ACCOUNT_NAME: 'acme-test',
        FETCH_DELAY_MS: '300',
        THROTTLE_FIRST: String(input.throttleFirst),
      },
    }),
  );
  await Promise.all(children.map((child) => child.ready));

  // fire the burst: every child calls at once
  await writeFile(goFile, 'go');
  const linesPerChild = await Promise.all(children.map((child) => child.lines));

  // collect each child's answer, and every call that reached the fake api
  const accesses = linesPerChild.map((lines) =>
    asChildAccess({ line: lines.at(-1) }),
  );
  const callerPids = (await readFile(callsLog, 'utf8'))
    .split('\n')
    .filter((line) => line.length > 0);
  return { accesses, callerPids };
};

describe('getEnvAccessFromAwsAccountName.acrossProcesses', () => {
  given('[case1] 8 processes with a cold cache and the same caller', () => {
    when('[t0] each calls getEnvAccessFromAwsAccountName at once', () => {
      const result = useBeforeAll(() =>
        getOneColdBurstOutcome({ processes: 8, throttleFirst: false }),
      );

      then('exactly one GetAccountInformation reaches the client', () => {
        expect(result.callerPids).toHaveLength(1);
      });

      then('every process returns the same access tier', () => {
        expect(result.accesses).toEqual(Array(8).fill('test'));
      });
    });
  });

  given(
    '[case2] 8 processes with a cold cache, and aws throttles the first fetch',
    () => {
      when('[t0] each calls getEnvAccessFromAwsAccountName at once', () => {
        const result = useBeforeAll(() =>
          getOneColdBurstOutcome({ processes: 8, throttleFirst: true }),
        );

        then(
          'only the lock holder calls aws: the throttled call + its retry',
          () => {
            expect(result.callerPids).toHaveLength(2);
            expect(new Set(result.callerPids).size).toEqual(1);
          },
        );

        then(
          'every process returns the same tier; none sees the throttle',
          () => {
            expect(result.accesses).toEqual(Array(8).fill('test'));
          },
        );
      });
    },
  );
});
