/**
 * .what = one child process of the cross-process burst test
 * .why = jest workers are separate processes; only real processes prove the cache spans them
 *
 * env in:
 *   - CACHE_DIR      = shared cache dir for this test
 *   - CALLS_LOG      = file this child appends to on each GetAccountInformation call
 *   - GO_FILE        = file whose presence starts the burst (all children fire at once)
 *   - ACCOUNT_NAME   = name the fake account api returns
 *   - FETCH_DELAY_MS = latency of the fake account api
 *   - THROTTLE_FIRST = 'true' → this process's first call throws TooManyRequestsException
 *
 * stdout out: `ready` once booted, then one json line `{ "access": ... }`
 */
import { ConstraintError, MalfunctionError } from 'helpful-errors';

import { appendFile, stat } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

import { getEnvAccessFromAwsAccountName } from '../../getEnvAccessFromAwsAccountName';

/**
 * .what = how long a child waits for the go file before it fails loud
 * .why = a parent that never fires the burst must not hang the child forever
 */
const GO_FILE_DEADLINE_MS = 30_000;

/**
 * .what = read one env var the parent test set for this child
 * .why = fail loud, with the fix, if the parent forgot one
 */
const getOneEnvVar = (input: { name: string }): string => {
  const value = process.env[input.name];
  if (value === undefined)
    throw new ConstraintError(`child env ${input.name} absent`, {
      hint: 'the parent test must set it in genChild env',
    });
  return value;
};

/**
 * .what = decide whether a path exists
 * .why = only ENOENT means absent; any other fs error surfaces
 */
const isPresent = async (input: { path: string }): Promise<boolean> => {
  try {
    await stat(input.path);
    return true;
  } catch (error) {
    // absent = ENOENT, read by shape
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
 * .what = get the go file once it exists
 * .why = every child fires at once, only after all have booted
 */
const getOneGoFile = async (input: {
  path: string;
  deadlineAt: number;
}): Promise<void> => {
  if (await isPresent({ path: input.path })) return;
  if (Date.now() >= input.deadlineAt)
    throw new MalfunctionError('child: go file never appeared', {
      path: input.path,
      hint: 'the parent test writes the go file once every child prints ready',
    });
  await sleep(5);
  return getOneGoFile(input);
};

/**
 * .what = boot one child of the burst: fake the account api, await the go file, call the parser
 * .why = each child is a real process, as each jest worker is
 */
const main = async (): Promise<void> => {
  const callsByThisProcess = { count: 0 };

  // fake account api: logs each call that reaches it
  const sdkAwsAccount = {
    getAccessKeyId: async () => 'AKIAEXAMPLESHAREDKEY',
    getAccountName: async () => {
      callsByThisProcess.count += 1; // .note = deliberate mutation, scoped to this fake
      await appendFile(getOneEnvVar({ name: 'CALLS_LOG' }), `${process.pid}\n`);
      await sleep(Number(getOneEnvVar({ name: 'FETCH_DELAY_MS' })));
      if (
        getOneEnvVar({ name: 'THROTTLE_FIRST' }) === 'true' &&
        callsByThisProcess.count === 1
      ) {
        // the shape aws sends on a throttle
        throw Object.assign(new Error('Too Many Requests'), {
          name: 'TooManyRequestsException',
        });
      }
      return getOneEnvVar({ name: 'ACCOUNT_NAME' });
    },
  };

  // signal ready, then wait for the burst to start
  process.stdout.write('ready\n');
  await getOneGoFile({
    path: getOneEnvVar({ name: 'GO_FILE' }),
    deadlineAt: Date.now() + GO_FILE_DEADLINE_MS,
  });

  // call the parser under test; print its answer for the parent
  const access = await getEnvAccessFromAwsAccountName(undefined, {
    sdkAwsAccount,
    cacheDir: getOneEnvVar({ name: 'CACHE_DIR' }),
  });
  process.stdout.write(`${JSON.stringify({ access })}\n`);
};

// exit 2 when the parent must fix its setup; exit 1 on any other fault
void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(error instanceof ConstraintError ? 2 : 1);
});
