import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

import { sleep } from './sleep';

// .note = bare core module names and `fs.promises`: this module loads at import time
//         for every caller, so it avoids newer apis; its floor is node 14.14 (`fs.promises.rm`)
const { chmod, lstat, mkdir, readFile, rename, rm, stat, writeFile } = fs;

/**
 * .what = decide whether an error carries a given fs error code
 * .why = some fs codes carry sense of their own (EEXIST = held, ESRCH = dead)
 * .note = reads `code` by shape, never `instanceof Error`: under jest, node core
 *         errors come from another realm and fail an instanceof check
 */
const isErrnoCode = (input: { error: unknown; codes: string[] }): boolean =>
  typeof input.error === 'object' &&
  input.error !== null &&
  'code' in input.error &&
  typeof input.error.code === 'string' &&
  input.codes.includes(input.error.code);

/**
 * .what = decide whether an error is a node system error (an fs fault)
 * .why = the shared cache is an optimization: any fs fault (denied, full disk,
 *        not a dir, too many open files) degrades to a direct fetch, never fails the caller
 * .note = node system errors carry a string `code` and a string `syscall`;
 *         a code defect (TypeError, RangeError) carries neither, so it still surfaces
 */
const isFsFault = (input: { error: unknown }): boolean =>
  typeof input.error === 'object' &&
  input.error !== null &&
  'code' in input.error &&
  typeof input.error.code === 'string' &&
  'syscall' in input.error &&
  typeof input.error.syscall === 'string';

/**
 * .what = decide whether an error is a json parse failure
 * .why = a corrupt cache file reads as a cold cache
 * .note = reads `name` by shape, for the same cross-realm reason as isErrnoCode
 */
const isSyntaxError = (input: { error: unknown }): boolean =>
  typeof input.error === 'object' &&
  input.error !== null &&
  'name' in input.error &&
  input.error.name === 'SyntaxError';

/**
 * .what = decide whether this process's os account owns a file
 * .why = on a shared host another os account could plant a cache file; only our own is trusted
 * .note = hosts with no uid (windows) have a temp dir per os account, so all files pass
 */
const isOwnedByThisUser = (input: { uid: number }): boolean => {
  const uidThis = process.getuid?.();
  return uidThis === undefined || input.uid === uidThis;
};

/**
 * .what = decide whether a file or dir was last modified at least ageMs ago
 * .why = one name for the cache ttl, the lock stale bound, and the wait deadline
 */
const isOlderThan = (input: { mtimeMs: number; ageMs: number }): boolean =>
  Date.now() - input.mtimeMs >= input.ageMs;

/**
 * .what = compute one jittered wait between lock polls: 0.5x to 1.5x of pollMs
 * .why = desyncs waiters so they do not poll in lockstep
 */
const getOnePollDelayMs = (input: { pollMs: number }): number =>
  input.pollMs * (0.5 + Math.random());

/**
 * .what = cast cache file content to its entry, or null if the shape is off
 * .why = a file of the wrong shape reads as a cold cache, never as a value
 * .note = the `as T` sits at the disk boundary: disk holds no type, and only
 *         setCache writes `{ value }` from the fetch's own T. no removal path:
 *         the generic wrapper cannot validate an arbitrary T at runtime
 */
const asCacheEntry = <T>(input: { content: string }): { value: T } | null => {
  const parsed: unknown = JSON.parse(input.content);
  if (typeof parsed !== 'object' || parsed === null || !('value' in parsed))
    return null;
  return { value: parsed.value as T };
};

/**
 * .what = decide whether a file mode grants any permission to group or other
 * .why = a cache dir open to other os accounts lets them plant files or locks
 */
const isModeOpenToOthers = (input: { mode: number }): boolean =>
  (input.mode & 0o077) !== 0;

/**
 * .what = cast a file mode to its owner-only subset
 * .why = closes a dir of ours to other os accounts, and keeps the owner's own bits
 */
const asModeOwnerOnly = (input: { mode: number }): number => input.mode & 0o700;

/**
 * .what = ensure the cache dir exists, is ours, and admits no other os account
 * .why = a dir another account owns, or a symlink to one, could hold planted
 *        locks that stall us; such a dir is never used
 * .note = returns false on any fs fault or an untrusted dir, so the fetch runs direct
 */
const genCacheDirTrusted = async (input: { dir: string }): Promise<boolean> => {
  try {
    await mkdir(input.dir, { recursive: true, mode: 0o700 });
    const stats = await lstat(input.dir);
    if (stats.isSymbolicLink() || !stats.isDirectory()) return false;
    if (!isOwnedByThisUser({ uid: stats.uid })) return false;

    // drop group and other bits from a dir of ours that was made loose
    if (isModeOpenToOthers({ mode: stats.mode }))
      await chmod(input.dir, asModeOwnerOnly({ mode: stats.mode }));
    return true;
  } catch (error) {
    if (isFsFault({ error })) return false;
    throw error;
  }
};

/**
 * .what = read the cached value if its file is ours and younger than the ttl
 * .why = a fresh file answers the caller with no aws call
 * .note = a file another os account owns reads as a cold cache, so a planted name never answers
 * .note = an fs fault or a corrupt file reads as a cold cache
 */
const getOneCacheFresh = async <T>(input: {
  path: string;
  ttlMs: number;
}): Promise<{ value: T } | null> => {
  try {
    const stats = await stat(input.path);
    if (!isOwnedByThisUser({ uid: stats.uid })) return null;
    if (isOlderThan({ mtimeMs: stats.mtimeMs, ageMs: input.ttlMs }))
      return null;
    const content = await readFile(input.path, 'utf8');
    return asCacheEntry<T>({ content });
  } catch (error) {
    if (isFsFault({ error })) return null;
    if (isSyntaxError({ error })) return null;
    throw error;
  }
};

/**
 * .what = remove a file or dir of ours; an fs fault is swallowed
 * .why = cleanup must never replace the caller's value or error
 */
const delPathBestEffort = async (input: {
  path: string;
}): Promise<{ isGone: boolean }> => {
  try {
    await rm(input.path, { recursive: true, force: true });
    return { isGone: true };
  } catch (error) {
    if (!isFsFault({ error })) throw error;
    return { isGone: false };
  }
};

/**
 * .what = write the cached value atomically, best effort
 * .why = write-then-rename means a reader never sees a torn file
 * .note = an fs fault leaves the cache cold; the caller still gets its value
 */
const setCache = async <T>(input: {
  path: string;
  value: T;
}): Promise<void> => {
  const pathTemp = `${input.path}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    await writeFile(pathTemp, JSON.stringify({ value: input.value }), {
      mode: 0o600,
    });
    await rename(pathTemp, input.path);
  } catch (error) {
    if (!isFsFault({ error })) throw error;
    await delPathBestEffort({ path: pathTemp });
  }
};

/**
 * .what = try to take the lock; record this process's pid inside it
 * .why = mkdir is atomic, so exactly one process wins a cold burst
 * .note = TAKEN = this process holds it; HELD = another holder does;
 *         DENIED = an fs fault refuses the lock, so the shared cache is skipped
 */
const setLock = async (input: {
  path: string;
}): Promise<'TAKEN' | 'HELD' | 'DENIED'> => {
  try {
    await mkdir(input.path, { mode: 0o700 });
  } catch (error) {
    if (isErrnoCode({ error, codes: ['EEXIST'] })) return 'HELD';
    if (isFsFault({ error })) return 'DENIED';
    throw error;
  }

  // record the pid; a failed write must not strand an empty lock for the stale bound
  try {
    await writeFile(join(input.path, 'pid'), String(process.pid));
  } catch (error) {
    await delPathBestEffort({ path: input.path }); // the stale bound breaks it if this fails
    if (!isFsFault({ error })) throw error;
    return 'DENIED';
  }
  return 'TAKEN';
};

/**
 * .what = read the holder's pid from the lock, if readable
 * .why = a waiter checks whether the holder still lives
 * .note = an fs fault (lock gone, torn write) reads as no pid
 */
const getOneLockPid = async (input: {
  path: string;
}): Promise<number | null> => {
  try {
    const content = await readFile(join(input.path, 'pid'), 'utf8');
    const pid = Number.parseInt(content, 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (error) {
    if (isFsFault({ error })) return null;
    throw error;
  }
};

/**
 * .what = release the lock, only if it still holds the given pid; best effort
 * .why = a process must never delete a lock another process took since:
 *        the holder frees only its own, a waiter breaks only the one it judged abandoned
 * .note = pid null = the torn lock (no readable pid) that was judged abandoned
 * .note = an fs fault is swallowed, so a release never replaces the caller's value
 *         or error; the stale bound and the wait deadline cover a lock left behind
 * .note = isGone = the lock judged by that pid no longer stands (deleted, or replaced
 *         by another holder's); false only when the fs refused the delete
 */
const delLock = async (input: {
  path: string;
  pid: number | null;
}): Promise<{ isGone: boolean }> => {
  const pidNow = await getOneLockPid({ path: input.path });
  if (pidNow !== input.pid) return { isGone: true };
  return delPathBestEffort({ path: input.path });
};

/**
 * .what = record that a holder's fetch failed, and when; best effort
 * .why = tells waiters "the holder failed" apart from "the holder died": a failure
 *        frees them to fetch direct, a death leaves the next one to take the lock
 * .note = the time rides in the content, not the mtime, so no fs clock grain blurs it
 */
const setFailureMark = async (input: { path: string }): Promise<void> => {
  try {
    await writeFile(input.path, String(Date.now()), { mode: 0o600 });
  } catch (error) {
    if (!isFsFault({ error })) throw error;
  }
};

/**
 * .what = decide whether a holder marked a failure at or after a given time
 * .why = only a failure since the waiter began to wait is its holder's failure
 * .note = an absent, foreign, unreadable, or malformed mark reads as no failure;
 *         the waiter then queues for the lock, bounded by the wait deadline
 */
const isFailureMarkedSince = async (input: {
  path: string;
  sinceMs: number;
}): Promise<boolean> => {
  try {
    const stats = await stat(input.path);
    if (!isOwnedByThisUser({ uid: stats.uid })) return false;
    const markedAt = Number.parseInt(await readFile(input.path, 'utf8'), 10);
    return Number.isInteger(markedAt) && markedAt >= input.sinceMs;
  } catch (error) {
    if (isFsFault({ error })) return false;
    throw error;
  }
};

/**
 * .what = decide whether a waiter's wait is over
 * .why = a waiter ends its wait and fetches direct when its wait passed the stale bound, or when its
 *        holder marked a failure that keeps no queue since the wait began
 * .note = a caller that has not waited (waitBeganAt null) has no wait to end
 */
const isWaitOver = async (input: {
  waitBeganAt: number | null;
  staleMs: number;
  pathFail: string;
}): Promise<boolean> => {
  if (input.waitBeganAt === null) return false;
  if (isOlderThan({ mtimeMs: input.waitBeganAt, ageMs: input.staleMs }))
    return true;
  return isFailureMarkedSince({
    path: input.pathFail,
    sinceMs: input.waitBeganAt,
  });
};

/**
 * .what = decide whether a process with this pid lives on this host
 * .why = a dead holder's lock can be broken at once
 */
const isPidAlive = (input: { pid: number }): boolean => {
  try {
    process.kill(input.pid, 0); // signal 0 = probe only
    return true;
  } catch (error) {
    // ESRCH = no such process; EPERM = it lives, under another os account
    if (isErrnoCode({ error, codes: ['ESRCH'] })) return false;
    if (isErrnoCode({ error, codes: ['EPERM'] })) return true;
    throw error;
  }
};

/**
 * .what = decide whether a held lock was abandoned
 * .why = a waiter must never wait on a dead holder
 * .note = abandoned when older than the stale bound (covers torn pid and pid reuse),
 *         or when its pid is readable and dead. an fs fault reads as not abandoned;
 *         the wait deadline bounds it
 */
const isLockAbandoned = async (input: {
  path: string;
  pid: number | null;
  staleMs: number;
}): Promise<boolean> => {
  try {
    const stats = await stat(input.path);
    if (isOlderThan({ mtimeMs: stats.mtimeMs, ageMs: input.staleMs }))
      return true;
  } catch (error) {
    if (isFsFault({ error })) return false;
    throw error;
  }
  if (input.pid === null) return false;
  return !isPidAlive({ pid: input.pid });
};

/**
 * .what = break the lock if its holder abandoned it; report the outcome
 * .why = a waiter must never wait on a dead holder, and never spin on a lock it cannot break
 * .note = HELD = a live holder; BROKEN = the abandoned lock is gone; DENIED = abandoned,
 *         but the fs refused the delete
 * .note = the pid is read once: the waiter judges and deletes by that same pid,
 *         so a lock another process took since is never freed
 */
const delLockIfAbandoned = async (input: {
  path: string;
  staleMs: number;
}): Promise<'HELD' | 'BROKEN' | 'DENIED'> => {
  const pidHolder = await getOneLockPid({ path: input.path });
  const isAbandoned = await isLockAbandoned({
    path: input.path,
    pid: pidHolder,
    staleMs: input.staleMs,
  });
  if (!isAbandoned) return 'HELD';
  const { isGone } = await delLock({ path: input.path, pid: pidHolder });
  return isGone ? 'BROKEN' : 'DENIED';
};

/**
 * .what = wrap an async fetch with a file cache shared by every process on this host
 * .why = N cold processes make one fetch: one takes the lock and fetches; the rest
 *        wait, then read its file
 * .note = the caller's `isQueueKeptOnError` sorts a holder's failure. one it rejects
 *         marks the failure, and every waiter fetches direct, in parallel. one it keeps,
 *         or a holder's death, leaves the next waiter to take the lock, so the api
 *         sees one caller at a time.
 *         a wait never passes the stale bound; past it, the waiter fetches direct
 * .note = a lock is deleted only by pid match, so neither a holder nor a waiter
 *         frees a lock taken since it looked. the residual race (two waiters that
 *         break one dead lock within the same instant) costs one extra fetch,
 *         benign since the fetch is a read and the write is atomic
 * .note = any fs fault, or a cache dir that is not ours, runs the fetch direct, as before
 */
export const withCacheAcrossProcesses = <T>(
  fetch: () => Promise<T>,
  options: {
    dir: string;
    ttlMs: number;
    staleMs: number;
    pollMs: number;
    isQueueKeptOnError: (input: { error: unknown }) => boolean;
  },
): ((input: { key: string }) => Promise<T>) => {
  return async (input: { key: string }): Promise<T> => {
    const pathFile = join(options.dir, `${input.key}.json`);
    const pathLock = join(options.dir, `${input.key}.lock`);
    const pathFail = join(options.dir, `${input.key}.failed`);

    // skip the shared cache when its dir is not ours or the fs refuses it
    const isDirTrusted = await genCacheDirTrusted({ dir: options.dir });
    if (!isDirTrusted) return fetch();

    /**
     * .what = fetch with no lock, then write the cache best effort
     * .why = a waiter whose holder failed or stalled still answers, and still shares
     */
    const getOneDirectThenShare = async (): Promise<T> => {
      const value = await fetch();
      await setCache({ path: pathFile, value });
      return value;
    };

    /**
     * .what = fetch as the lock holder, write the cache, then release the lock
     * .why = one holder per cold burst answers every waiter via the cache file
     * .note = the release sits in `finally`, so a failed fetch frees the waiters too
     */
    const getOneAsHolder = async (): Promise<T> => {
      try {
        // another holder may have written just before this one took the lock
        const cachedNow = await getOneCacheFresh<T>({
          path: pathFile,
          ttlMs: options.ttlMs,
        });
        if (cachedNow) return cachedNow.value;

        // fetch, then share
        return await getOneDirectThenShare();
      } catch (error) {
        // a failure that keeps no queue frees the waiters to fetch direct, in parallel;
        // the mark lands before the release, so a waiter sees it once the lock is gone
        if (!options.isQueueKeptOnError({ error }))
          await setFailureMark({ path: pathFail });
        throw error;
      } finally {
        await delLock({ path: pathLock, pid: process.pid });
      }
    };

    /**
     * .what = read the cache, else take the lock and fetch, else wait and look again
     * .why = the one loop every caller runs; each pass ends in a value or a wait
     * .note = state.waitBeganAt = when this caller first waited; null until it waits
     */
    const getOneViaCache = async (state: {
      waitBeganAt: number | null;
    }): Promise<T> => {
      const cached = await getOneCacheFresh<T>({
        path: pathFile,
        ttlMs: options.ttlMs,
      });
      if (cached) return cached.value;

      // a waiter whose wait is over fetches direct, rather than wait or queue
      const isWaitDone = await isWaitOver({
        waitBeganAt: state.waitBeganAt,
        staleMs: options.staleMs,
        pathFail,
      });
      if (isWaitDone) return getOneDirectThenShare();

      // take the lock if free
      const lock = await setLock({ path: pathLock });
      if (lock === 'DENIED') return fetch();
      if (lock === 'TAKEN') return getOneAsHolder();

      // break a lock whose holder is gone, then try again at once; a break the fs refuses fetches direct
      const lockBreak = await delLockIfAbandoned({
        path: pathLock,
        staleMs: options.staleMs,
      });
      if (lockBreak === 'BROKEN') return getOneViaCache(state);
      if (lockBreak === 'DENIED') return fetch();

      // wait for the live holder, then look again
      await sleep(getOnePollDelayMs({ pollMs: options.pollMs }));
      return getOneViaCache({ waitBeganAt: state.waitBeganAt ?? Date.now() });
    };

    return getOneViaCache({ waitBeganAt: null });
  };
};
