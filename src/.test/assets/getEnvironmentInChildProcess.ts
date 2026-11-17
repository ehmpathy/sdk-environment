/**
 * .what = one child process of the cold-start acceptance burst
 * .why = jest gives each test file its own process; only real processes, each with a
 *        cold module registry, prove one GetAccountInformation serves them all
 *
 * env in (set by the parent, beside the aws env that points the sdk at a fake api):
 *   - GO_FILE = file whose presence starts the burst (all children fire at once)
 *
 * stdout out: `ready` once booted, then one json line `{ "access": ... }`
 */
import { ConstraintError, MalfunctionError } from 'helpful-errors';

import { stat } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

import type { EnvironmentCommitSlug } from '../../domain.objects/EnvironmentCommitSlug';
import type { EnvironmentServerTier } from '../../domain.objects/EnvironmentServerTier';
import { fromAwsAccountName, getEnvironment } from '../../index';

/**
 * .what = how long a child waits for the go file before it fails loud
 * .why = a parent that never fires the burst must not hang the child forever
 */
const GO_FILE_DEADLINE_MS = 30_000;

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
 * .what = boot one child: await the go file, then call the public getEnvironment
 * .why = each child is a real process, as each jest worker is
 */
const main = async (): Promise<void> => {
  const goFile = process.env.GO_FILE;
  if (!goFile)
    throw new ConstraintError('child env GO_FILE absent', {
      hint: 'the parent test must set it in the child env',
    });

  // signal ready, then wait for the burst to start
  process.stdout.write('ready\n');
  await getOneGoFile({ path: goFile, deadlineAt: Date.now() + GO_FILE_DEADLINE_MS });

  // the access tier comes from the aws account name alone; server and commit are fixed
  const server: EnvironmentServerTier = 'local@unix';
  const commit: EnvironmentCommitSlug = 'v1.0.0@abc123';
  const environment = await getEnvironment.filled({
    cache: 'skip',
    parsers: {
      access: [fromAwsAccountName()],
      server: [() => server],
      commit: [() => commit],
    },
  });
  process.stdout.write(`${JSON.stringify({ access: environment.access })}\n`);
};

// exit 2 when the parent must fix its setup; exit 1 on any other fault
void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(error instanceof ConstraintError ? 2 : 1);
});
