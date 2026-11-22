import { MalfunctionError } from 'helpful-errors';
import {
  genTempDir,
  getError,
  given,
  then,
  useBeforeAll,
  when,
} from 'test-fns';

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { genAwsAccountApiFake } from './.test/assets/genAwsAccountApiFake';
import { withEnvVars } from './.test/assets/withEnvVars';
import type { EnvironmentCommitSlug } from './domain.objects/EnvironmentCommitSlug';
import type { EnvironmentServerTier } from './domain.objects/EnvironmentServerTier';
import { fromAwsAccountName, getEnvironment } from './index';

/**
 * .what = the aws env that points the real sdk at a fake account api, with fake creds
 * .mock = the aws account api, a local fake in its wire shape (`genAwsAccountApiFake`);
 *         the sdk, the parser, the lock, and the disk cache all run for real
 * .why = real aws cannot be made to throttle on cue, nor to count the calls a burst
 *        makes, and those two facts are the claim under test. the creds are dummy
 *        input the fake never checks; env creds win the sdk's chain, so no real
 *        session or profile on the host can leak in, and no host config tunes retries
 * .real = `getEnvAccessFromAwsAccountName.integration.test.ts`, the real-aws given,
 *         runs the same sdk call against aws with real keyrack creds
 * .note = null unsets a var. each call mints a fresh access key id, and the cache is
 *         keyed by it, so no prior run's file can answer: cold by construction. TMPDIR
 *         moves the cache dir only for a child process; in-process, jest sandboxes
 *         process.env and `os.tmpdir()` reads the worker's real env
 */
const asAwsEnvForFakeApi = (input: {
  url: string;
  tmpDir: string;
}): Record<string, string | null> => ({
  AWS_ACCESS_KEY_ID: `AKIAEXAMPLE${randomUUID().replace(/-/g, '').slice(0, 9).toUpperCase()}`,
  AWS_SECRET_ACCESS_KEY: 'example-secret',
  AWS_REGION: 'us-east-1',
  AWS_ENDPOINT_URL_ACCOUNT: input.url,
  AWS_SESSION_TOKEN: null,
  AWS_PROFILE: null,
  AWS_MAX_ATTEMPTS: null, // the call counts below rest on the sdk's default 3 attempts
  AWS_RETRY_MODE: null,
  AWS_CONFIG_FILE: '/dev/null',
  AWS_SHARED_CREDENTIALS_FILE: '/dev/null',
  TMPDIR: input.tmpDir,
});

/**
 * .what = merge env overrides into the parent env, where null drops a var
 * .why = a child must not inherit the parent's real aws session or profile
 */
const asChildEnv = (input: {
  overrides: Record<string, string | null>;
}): Record<string, string> => {
  const merged = { ...process.env, ...input.overrides };
  return Object.fromEntries(
    Object.entries(merged).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
};

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
    [join(__dirname, '.test/assets/getEnvironmentInChildProcess.ts')],
    { env: input.env },
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

describe('getEnvironment.coldStart', () => {
  given(
    '[case1] 8 cold processes, one machine, and an account api that answers acme-test',
    () => {
      when('[t0] each process calls getEnvironment() at once', () => {
        const result = useBeforeAll(async () => {
          const api = await genAwsAccountApiFake({
            throttles: 0,
            accountName: 'acme-test',
            delayMs: 300, // long enough that every child arrives while the first fetch is in flight
          });
          try {
            const dir = genTempDir({ slug: 'get-environment-cold-start' });
            const goFile = join(dir, 'go');

            // a short TMPDIR: tsx opens its ipc socket there, and a unix socket path caps near 108 bytes
            const tmpDirShort = await mkdtemp(join(tmpdir(), 'sdkenv-'));
            const env = asChildEnv({
              overrides: {
                ...asAwsEnvForFakeApi({ url: api.url, tmpDir: tmpDirShort }),
                GO_FILE: goFile,
              },
            });

            // boot every child; each waits for the go file
            const children = Array.from({ length: 8 }, () => genChild({ env }));
            await Promise.all(children.map((child) => child.ready));

            // fire the burst: every child calls at once
            await writeFile(goFile, 'go');
            const linesPerChild = await Promise.all(
              children.map((child) => child.lines),
            );
            const accesses = linesPerChild.map((lines) =>
              asChildAccess({ line: lines.at(-1) }),
            );
            return { accesses, callsToAws: api.calls() };
          } finally {
            await new Promise((done) => api.server.close(done));
          }
        });

        then('exactly one GetAccountInformation reaches aws', () => {
          expect(result.callsToAws).toEqual(1);
        });

        then('every process gets the test tier', () => {
          expect(result.accesses).toEqual(Array(8).fill('test'));
          expect(result).toMatchSnapshot();
        });
      });
    },
  );

  given('[case2] an account api that throttles every call', () => {
    when('[t0] one cold process calls getEnvironment()', () => {
      const result = useBeforeAll(async () => {
        const api = await genAwsAccountApiFake({
          throttles: Number.POSITIVE_INFINITY,
          accountName: 'acme-test',
          delayMs: 0,
        });
        try {
          const server: EnvironmentServerTier = 'local@unix';
          const commit: EnvironmentCommitSlug = 'v1.0.0@abc123';
          const error = await withEnvVars(
            {
              vars: asAwsEnvForFakeApi({
                url: api.url,
                tmpDir: genTempDir({ slug: 'get-environment-cold-throttle' }),
              }),
            },
            () =>
              getError(
                getEnvironment.filled({
                  cache: 'skip',
                  parsers: {
                    access: [fromAwsAccountName()],
                    server: [() => server],
                    commit: [() => commit],
                  },
                }),
              ),
          );
          return { error, callsToAws: api.calls() };
        } finally {
          await new Promise((done) => api.server.close(done));
        }
      });

      then('the caller sees the throttle error, by name', () => {
        expect(result.error.name).toEqual('TooManyRequestsException');
        expect({
          name: result.error.name,
          message: result.error.message,
          callsToAws: result.callsToAws,
        }).toMatchSnapshot();
      });

      then(
        'aws sees a bounded count: 6 attempts, each over the sdk own 3',
        () => {
          expect(result.callsToAws).toEqual(18);
        },
      );
    });
  });

  given('[case3] an account api that throttles 4 calls, then answers', () => {
    when('[t0] one cold process calls getEnvironment()', () => {
      const result = useBeforeAll(async () => {
        const api = await genAwsAccountApiFake({
          throttles: 4,
          accountName: 'acme-test',
          delayMs: 0,
        });
        try {
          const server: EnvironmentServerTier = 'local@unix';
          const commit: EnvironmentCommitSlug = 'v1.0.0@abc123';
          const environment = await withEnvVars(
            {
              vars: asAwsEnvForFakeApi({
                url: api.url,
                tmpDir: genTempDir({ slug: 'get-environment-cold-recover' }),
              }),
            },
            () =>
              getEnvironment.filled({
                cache: 'skip',
                parsers: {
                  access: [fromAwsAccountName()],
                  server: [() => server],
                  commit: [() => commit],
                },
              }),
          );
          return { access: environment.access, callsToAws: api.calls() };
        } finally {
          await new Promise((done) => api.server.close(done));
        }
      });

      then('the caller gets its tier, never the throttle', () => {
        expect(result.access).toEqual('test');
        expect(result).toMatchSnapshot();
      });

      then(
        'aws sees 5 calls: the sdk own 3, then our one retry, whose second call answers',
        () => {
          expect(result.callsToAws).toEqual(5);
        },
      );
    });
  });
});
