import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { genTempDir, getError, given, then, when } from 'test-fns';

import { spawn } from 'node:child_process';
import {
  chmod,
  mkdir,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { withCacheAcrossProcesses } from './withCacheAcrossProcesses';

const OPTIONS = {
  ttlMs: 60_000,
  staleMs: 60_000,
  pollMs: 10,
  isQueueKeptOnError: (input: { error: unknown }): boolean =>
    input.error instanceof Error && input.error.message === 'throttled',
};

/**
 * .what = a fake fetch that counts its calls
 * .why = each case asserts how many fetches reached "aws"
 */
const genFetchCounted = (input: {
  replies: Array<{ error: Error } | { value: string }>;
}): { fetch: () => Promise<string>; calls: () => number } => {
  const state = { calls: 0 };
  const fetch = async (): Promise<string> => {
    const reply =
      input.replies[Math.min(state.calls, input.replies.length - 1)]!;
    state.calls += 1; // .note = deliberate mutation, scoped to this fake
    if ('error' in reply) throw reply.error;
    return reply.value;
  };
  return { fetch, calls: () => state.calls };
};

/**
 * .what = get the pid of a process that has already exited
 * .why = a dead holder's pid, for the abandoned-lock cases
 */
const getOnePidDead = async (): Promise<number> => {
  const child = spawn(process.execPath, ['-e', '']);
  await new Promise((done, fail) => {
    child.on('exit', done);
    child.on('error', (error) =>
      fail(
        new MalfunctionError('could not spawn a child to get a dead pid', {
          execPath: process.execPath,
          causeMessage: error.message,
        }),
      ),
    );
  });
  return child.pid!;
};

/**
 * .what = check whether a path exists
 * .why = assert a lock was released, or no cache was written
 * .note = only ENOENT means absent; any other fs error fails the test loud
 */
const isPresent = async (input: { path: string }): Promise<boolean> => {
  try {
    await stat(input.path);
    return true;
  } catch (error) {
    const isAbsent =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT';
    if (isAbsent) return false;
    throw error;
  }
};

/**
 * .what = whether the suite runs as root
 * .why = root bypasses mode bits, so a chmod-denied dir would not deny; a case
 *        that relies on it must fail with the fix named, never pass for the wrong reason
 */
const isRootUser = (): boolean => process.getuid?.() === 0;

/**
 * .what = the error a chmod-denial case throws under root
 * .why = one message and hint for every case that relies on mode bits
 */
const genErrorRootIgnoresModes = (): Error =>
  new ConstraintError(
    'this case denies writes via chmod; root ignores mode bits',
    { hint: 'run the integration suite as a non-root os account' },
  );

const KEY = 'key-a';
const getOneDateTwoMinutesAgo = (): Date => new Date(Date.now() - 2 * 60_000);

describe('withCacheAcrossProcesses', () => {
  given('[case1] a fresh cache file for the key', () => {
    when('[t0] the value is read', () => {
      then('it returns the cached value with no fetch', async () => {
        const dir = genTempDir({ slug: 'cache-fresh' });
        await writeFile(
          join(dir, `${KEY}.json`),
          JSON.stringify({ value: 'acme-test' }),
        );
        const fake = genFetchCounted({ replies: [{ value: 'acme-prod' }] });
        const get = withCacheAcrossProcesses(fake.fetch, { dir, ...OPTIONS });
        expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
        expect(fake.calls()).toEqual(0);
      });
    });
  });

  given(
    '[case1b] a fresh cache file for the key, and a caller that skips the cache',
    () => {
      when('[t0] the value is read with cache: skip', () => {
        then(
          'it fetches fresh past the file, then rewrites the file',
          async () => {
            const dir = genTempDir({ slug: 'cache-fresh-skip' });
            const pathFile = join(dir, `${KEY}.json`);
            await writeFile(pathFile, JSON.stringify({ value: 'acme-old' }));
            const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
            const get = withCacheAcrossProcesses(fake.fetch, {
              dir,
              ...OPTIONS,
            });
            expect(await get({ key: KEY, cache: 'skip' })).toEqual('acme-test');
            expect(fake.calls()).toEqual(1);

            // a later caller with no skip reads the fresh value, with no fetch
            expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
            expect(fake.calls()).toEqual(1);
          },
        );
      });
    },
  );

  given('[case2] a stale cache file for the key', () => {
    when('[t0] the value is read', () => {
      then('it fetches again and rewrites the file', async () => {
        const dir = genTempDir({ slug: 'cache-stale' });
        const pathFile = join(dir, `${KEY}.json`);
        await writeFile(pathFile, JSON.stringify({ value: 'acme-old' }));
        await utimes(
          pathFile,
          getOneDateTwoMinutesAgo(),
          getOneDateTwoMinutesAgo(),
        );
        const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
        const get = withCacheAcrossProcesses(fake.fetch, { dir, ...OPTIONS });
        expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
        expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
        expect(fake.calls()).toEqual(1);
        expect((await stat(pathFile)).mode & 0o777).toEqual(0o600); // owner only
      });
    });
  });

  given('[case3] a lock whose holder pid is dead', () => {
    when('[t0] the value is read', () => {
      then(
        'it breaks the lock at once, fetches once, and releases',
        async () => {
          const dir = genTempDir({ slug: 'cache-dead-holder' });
          const pathLock = join(dir, `${KEY}.lock`);
          await mkdir(pathLock);
          await writeFile(join(pathLock, 'pid'), String(await getOnePidDead()));
          const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
          const get = withCacheAcrossProcesses(fake.fetch, { dir, ...OPTIONS });
          const startedAt = Date.now();
          expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
          expect(Date.now() - startedAt).toBeLessThan(OPTIONS.staleMs / 2); // not the 60s stale bound
          expect(fake.calls()).toEqual(1);
          expect(await isPresent({ path: pathLock })).toEqual(false);
        },
      );
    });
  });

  given('[case4] a lock with no readable pid (torn write)', () => {
    when('[t0] the lock is younger than the stale bound', () => {
      then(
        'the waiter keeps its wait, then reads what the holder wrote',
        async () => {
          const dir = genTempDir({ slug: 'cache-torn-young' });
          const pathLock = join(dir, `${KEY}.lock`);
          await mkdir(pathLock);
          const fake = genFetchCounted({ replies: [{ value: 'acme-prod' }] });
          const get = withCacheAcrossProcesses(fake.fetch, { dir, ...OPTIONS });
          const value = get({ key: KEY, cache: null });

          // the holder finishes: writes the cache and drops the lock
          await sleep(100);
          await writeFile(
            join(dir, `${KEY}.json`),
            JSON.stringify({ value: 'acme-test' }),
          );
          await rm(pathLock, { recursive: true, force: true });
          expect(await value).toEqual('acme-test');
          expect(fake.calls()).toEqual(0);
        },
      );
    });

    when('[t1] the lock is older than the stale bound', () => {
      then('it breaks the lock and fetches once', async () => {
        const dir = genTempDir({ slug: 'cache-torn-stale' });
        const pathLock = join(dir, `${KEY}.lock`);
        await mkdir(pathLock);
        await utimes(
          pathLock,
          getOneDateTwoMinutesAgo(),
          getOneDateTwoMinutesAgo(),
        );
        const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
        const get = withCacheAcrossProcesses(fake.fetch, { dir, ...OPTIONS });
        expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
        expect(fake.calls()).toEqual(1);
      });
    });
  });

  given('[case5] the lock holder throws', () => {
    when('[t0] the value is read, then read again', () => {
      then(
        'the error surfaces, the lock is dropped, and the next call fetches',
        async () => {
          const dir = genTempDir({ slug: 'cache-holder-throws' });
          const fake = genFetchCounted({
            replies: [
              { error: new Error('security token invalid') },
              { value: 'acme-test' },
            ],
          });
          const get = withCacheAcrossProcesses(fake.fetch, { dir, ...OPTIONS });
          const error = await getError(get({ key: KEY, cache: null }));
          expect(error.message).toEqual('security token invalid');
          expect(await isPresent({ path: join(dir, `${KEY}.lock`) })).toEqual(
            false,
          );
          expect(await isPresent({ path: join(dir, `${KEY}.json`) })).toEqual(
            false,
          );
          expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
          expect(fake.calls()).toEqual(2);
        },
      );
    });
  });

  given('[case6] the cache dir is unwritable', () => {
    when('[t0] the value is read twice', () => {
      then('each read fetches direct, as before the shared cache', async () => {
        if (isRootUser()) throw genErrorRootIgnoresModes();
        const root = genTempDir({ slug: 'cache-unwritable' });
        await chmod(root, 0o500);
        const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
        const get = withCacheAcrossProcesses(fake.fetch, {
          dir: join(root, 'cache'),
          ...OPTIONS,
        });
        try {
          expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
          expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
          expect(fake.calls()).toEqual(2);
        } finally {
          await chmod(root, 0o700);
        }
      });
    });
  });

  given('[case7] a corrupt cache file for the key', () => {
    when('[t0] the value is read twice', () => {
      then('it fetches once, then reads the rewritten file', async () => {
        const dir = genTempDir({ slug: 'cache-corrupt' });
        await writeFile(join(dir, `${KEY}.json`), '{"value": "acme-te');
        const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
        const get = withCacheAcrossProcesses(fake.fetch, { dir, ...OPTIONS });
        expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
        expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
        expect(fake.calls()).toEqual(1);
      });
    });

    when('[t1] the file is valid json of the wrong shape', () => {
      then('it reads as a cold cache and fetches', async () => {
        const dir = genTempDir({ slug: 'cache-wrong-shape' });
        await writeFile(
          join(dir, `${KEY}.json`),
          JSON.stringify({ name: 'acme-planted' }),
        );
        const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
        const get = withCacheAcrossProcesses(fake.fetch, { dir, ...OPTIONS });
        expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
        expect(fake.calls()).toEqual(1);
      });
    });
  });

  given('[case8] a fresh cache file another os account owns', () => {
    when('[t0] the value is read', () => {
      then('it ignores the planted file and fetches', async () => {
        const dir = genTempDir({ slug: 'cache-foreign' });
        await writeFile(
          join(dir, `${KEY}.json`),
          JSON.stringify({ value: 'acme-planted' }),
        );

        /**
         * .mock = process.getuid, so this process reads as another uid than the file's owner
         * .why = a file another os account owns can only be planted by root (chown); a test
         *        run never holds root, so the owner check is reachable only by a uid that differs
         * .real = every other case in this suite runs the owner check on the real uid, where
         *         the file's owner matches and the file is read
         */
        const uidOwner = (await stat(join(dir, `${KEY}.json`))).uid;
        const spy = jest.spyOn(process, 'getuid').mockReturnValue(uidOwner + 1);
        try {
          const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
          const get = withCacheAcrossProcesses(fake.fetch, {
            dir,
            ...OPTIONS,
          });
          expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
          expect(fake.calls()).toEqual(1);
        } finally {
          spy.mockRestore();
        }
      });
    });
  });

  given('[case9] the cache dir exists but denies the lock', () => {
    when('[t0] the value is read twice', () => {
      then('each read fetches direct, and no lock is left', async () => {
        if (isRootUser()) throw genErrorRootIgnoresModes();
        const dir = genTempDir({ slug: 'cache-lock-denied' });
        await chmod(dir, 0o500);
        const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
        const get = withCacheAcrossProcesses(fake.fetch, { dir, ...OPTIONS });
        try {
          expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
          expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
          expect(fake.calls()).toEqual(2);
          expect(await isPresent({ path: join(dir, `${KEY}.lock`) })).toEqual(
            false,
          );
        } finally {
          await chmod(dir, 0o700);
        }
      });
    });
  });

  given(
    '[case10] another process takes the lock while the holder fetches',
    () => {
      when('[t0] the holder finishes', () => {
        then('the holder leaves the other process lock in place', async () => {
          const dir = genTempDir({ slug: 'cache-lock-retaken' });
          const pathLock = join(dir, `${KEY}.lock`);

          /**
           * .what = a fetch that, mid-flight, swaps the lock for another process's
           * .why = stands in for a waiter that broke this lock and took it anew
           */
          const fetch = async (): Promise<string> => {
            await rm(pathLock, { recursive: true, force: true });
            await mkdir(pathLock);
            await writeFile(join(pathLock, 'pid'), String(process.ppid));
            return 'acme-test';
          };
          const get = withCacheAcrossProcesses(fetch, { dir, ...OPTIONS });
          expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
          expect(await isPresent({ path: pathLock })).toEqual(true);
        });
      });
    },
  );

  given('[case11] the cache file path is occupied by a dir', () => {
    when('[t0] the value is read', () => {
      then(
        'the fs fault degrades to a fetch, and the caller gets its value',
        async () => {
          const dir = genTempDir({ slug: 'cache-path-is-dir' });
          await mkdir(join(dir, `${KEY}.json`));
          const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
          const get = withCacheAcrossProcesses(fake.fetch, { dir, ...OPTIONS });
          expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
          expect(fake.calls()).toEqual(1);
          expect(await isPresent({ path: join(dir, `${KEY}.lock`) })).toEqual(
            false,
          );
        },
      );
    });
  });

  given('[case12] the cache dir sits under a file', () => {
    when('[t0] the value is read', () => {
      then('the fs fault degrades to a direct fetch', async () => {
        const root = genTempDir({ slug: 'cache-dir-under-file' });
        await writeFile(join(root, 'file'), 'not a dir');
        const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
        const get = withCacheAcrossProcesses(fake.fetch, {
          dir: join(root, 'file', 'cache'),
          ...OPTIONS,
        });
        expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
        expect(fake.calls()).toEqual(1);
      });
    });
  });

  given('[case13] a burst of callers whose holder fetch fails', () => {
    when('[t0] each fetch fails after 200ms', () => {
      then(
        'the waiters fetch in parallel, never in a queue behind each other',
        async () => {
          const dir = genTempDir({ slug: 'cache-holder-fails-burst' });
          const state = { calls: 0 };
          const fetch = async (): Promise<string> => {
            state.calls += 1; // .note = deliberate mutation, scoped to this fake
            await sleep(200);
            throw new Error('security token invalid');
          };
          const get = withCacheAcrossProcesses(fetch, { dir, ...OPTIONS });
          const startedAt = Date.now();
          const outcomes = await Promise.allSettled(
            Array.from({ length: 10 }, () => get({ key: KEY, cache: null })),
          );
          const elapsedMs = Date.now() - startedAt;
          expect(outcomes.map((outcome) => outcome.status)).toEqual(
            Array.from({ length: 10 }, () => 'rejected'),
          );
          expect(state.calls).toEqual(10);
          expect(elapsedMs).toBeLessThan(1_500); // a queue takes at least 10 x 200ms
        },
      );
    });
  });

  given('[case14] a live holder that never releases its lock', () => {
    when('[t0] the value is read', () => {
      then('the waiter stops at the deadline and fetches direct', async () => {
        const dir = genTempDir({ slug: 'cache-holder-never-releases' });
        const pathLock = join(dir, `${KEY}.lock`);
        await mkdir(pathLock);
        await writeFile(join(pathLock, 'pid'), String(process.pid));

        // a future mtime: the lock never reads as stale, so only the deadline ends the wait
        const inOneHour = new Date(Date.now() + 60 * 60_000);
        await utimes(pathLock, inOneHour, inOneHour);
        const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
        const get = withCacheAcrossProcesses(fake.fetch, {
          dir,
          ...OPTIONS,
          staleMs: 300,
        });
        const startedAt = Date.now();
        expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(300);
        expect(fake.calls()).toEqual(1);
      });
    });
  });

  given('[case15] the cache dir is ours but open to other os accounts', () => {
    when('[t0] the value is read', () => {
      then('the dir is closed to 0700 before use', async () => {
        const dir = genTempDir({ slug: 'cache-dir-loose' });
        await chmod(dir, 0o755);
        const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
        const get = withCacheAcrossProcesses(fake.fetch, { dir, ...OPTIONS });
        expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
        expect((await stat(dir)).mode & 0o777).toEqual(0o700);
      });
    });
  });

  given('[case16] the cache dir is a symlink', () => {
    when('[t0] the value is read twice', () => {
      then(
        'each read fetches direct, and naught is written through the link',
        async () => {
          const root = genTempDir({ slug: 'cache-dir-symlink' });
          const pathTarget = join(root, 'target');
          await mkdir(pathTarget, { mode: 0o700 });
          await symlink(pathTarget, join(root, 'link'));
          const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
          const get = withCacheAcrossProcesses(fake.fetch, {
            dir: join(root, 'link'),
            ...OPTIONS,
          });
          expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
          expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
          expect(fake.calls()).toEqual(2);
          expect(
            await isPresent({ path: join(pathTarget, `${KEY}.json`) }),
          ).toEqual(false);
        },
      );
    });
  });

  given(
    '[case17] a burst of callers wait on a holder that is then killed',
    () => {
      when('[t0] the holder dies mid-wait', () => {
        then(
          'one waiter breaks the lock and fetches; the rest read its file',
          async () => {
            const dir = genTempDir({ slug: 'cache-holder-killed' });
            const pathLock = join(dir, `${KEY}.lock`);

            // a live holder: a child process whose pid sits in the lock
            const holder = spawn(process.execPath, [
              '-e',
              'setTimeout(() => {}, 60000)',
            ]);
            await mkdir(pathLock);
            await writeFile(join(pathLock, 'pid'), String(holder.pid));
            const fake = genFetchCounted({ replies: [{ value: 'acme-test' }] });
            const get = withCacheAcrossProcesses(fake.fetch, {
              dir,
              ...OPTIONS,
            });
            const values = Promise.all(
              Array.from({ length: 10 }, () => get({ key: KEY, cache: null })),
            );

            // every caller is now a waiter; kill the holder
            await sleep(150);
            const exited = new Promise((done) => holder.on('exit', done));
            holder.kill('SIGKILL');
            await exited;
            expect(await values).toEqual(
              Array.from({ length: 10 }, () => 'acme-test'),
            );
            expect(fake.calls()).toEqual(1);
          },
        );
      });
    },
  );

  given(
    '[case18] a burst of callers whose holder is throttled past retries',
    () => {
      when('[t0] the first fetch throttles, the next one succeeds', () => {
        then(
          'the waiters keep the queue: the next one fetches once, the rest read its file',
          async () => {
            const dir = genTempDir({ slug: 'cache-holder-throttled' });
            const fake = genFetchCounted({
              replies: [
                { error: new Error('throttled') },
                { value: 'acme-test' },
              ],
            });
            const get = withCacheAcrossProcesses(fake.fetch, {
              dir,
              ...OPTIONS,
            });
            const outcomes = await Promise.allSettled(
              Array.from({ length: 10 }, () => get({ key: KEY, cache: null })),
            );
            expect(
              outcomes.filter((outcome) => outcome.status === 'rejected'),
            ).toHaveLength(1); // the throttled holder alone
            expect(fake.calls()).toEqual(2);
          },
        );
      });
    },
  );

  given(
    '[case19] a dead-pid lock in a dir the fs will not let us delete from',
    () => {
      when('[t0] a fresh caller reads the value', () => {
        then(
          'it fetches direct at once, rather than spin on the break',
          async () => {
            if (isRootUser()) throw genErrorRootIgnoresModes();
            const dir = genTempDir({ slug: 'cache-lock-undeletable' });
            const pathLock = join(dir, `${KEY}.lock`);
            await mkdir(pathLock);
            await writeFile(
              join(pathLock, 'pid'),
              String(await getOnePidDead()),
            );
            await chmod(dir, 0o500); // the lock can no longer be removed from the dir
            try {
              const fake = genFetchCounted({
                replies: [{ value: 'acme-test' }],
              });
              const get = withCacheAcrossProcesses(fake.fetch, {
                dir,
                ...OPTIONS,
                staleMs: 1_500,
              });
              const startedAt = Date.now();
              expect(await get({ key: KEY, cache: null })).toEqual('acme-test');
              expect(Date.now() - startedAt).toBeLessThan(1_000); // no spin, no wait to the deadline
              expect(fake.calls()).toEqual(1);
            } finally {
              await chmod(dir, 0o700);
            }
          },
        );
      });
    },
  );
});
