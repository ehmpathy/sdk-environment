import { exec, execSync } from 'child_process';
import { UnexpectedCodePathError } from 'helpful-errors';
import { promisify } from 'util';

import type { EnvironmentCommitSlug } from '../../../domain.objects/EnvironmentCommitSlug';

/**
 * .what = default exec implementations
 * .why = enables dependency injection for testability with sensible defaults
 */
const defaultExecAsync = promisify(exec);
const defaultExecSync = execSync;

/**
 * .what = check if error is expected git failure
 * .why = enables reuse in both sync and async variants
 *
 * .note = expected errors: not a repo, no tag, command not found, etc.
 */
export const isExpectedGitError = (error: unknown): boolean => {
  // extract message from error (handles both Error instances and error-like objects)
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : String(error);
  const message = errorMessage.toLowerCase();

  // check for git-specific errors
  const isGitError =
    message.includes('not a git repository') ||
    message.includes('fatal:') ||
    message.includes('command not found') ||
    message.includes('enoent');

  // check for generic command failure (exit code non-zero)
  // this is expected for commands like `git describe --exact-match` when no tag exists
  const isCommandFailure =
    message.includes('command failed') && message.includes('git');

  return isGitError || isCommandFailure;
};

/**
 * .what = exec function type for async git commands
 * .why = enables dependency injection for testability
 */
type ExecAsyncFn = (
  command: string,
) => Promise<{ stdout: string; stderr: string }>;

/**
 * .what = run git command async and return stdout
 * .why = abstracts shell exec for git commands
 *
 * .note = returns null only for expected git failures (not a repo, no tag, etc.)
 *         rethrows unexpected errors
 */
const runGit = async (
  command: string,
  execFn: ExecAsyncFn = defaultExecAsync,
): Promise<string | null> => {
  try {
    const { stdout } = await execFn(command);
    return stdout.trim();
  } catch (error) {
    // allowlist: expected git/exec failures return null
    if (isExpectedGitError(error)) return null;

    // wrap unexpected errors with context
    throw new UnexpectedCodePathError('unexpected git command error', {
      command,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * .what = exec function type for sync git commands
 * .why = enables dependency injection for testability
 */
type ExecSyncFn = (command: string, options: { encoding: 'utf8' }) => string;

/**
 * .what = run git command sync and return stdout
 * .why = enables sync commit resolver for static() contexts
 *
 * .note = returns null only for expected git failures (not a repo, no tag, etc.)
 *         rethrows unexpected errors
 */
const runGitSync = (
  command: string,
  execFn: ExecSyncFn = defaultExecSync,
): string | null => {
  try {
    const stdout = execFn(command, { encoding: 'utf8' });
    return stdout.trim();
  } catch (error) {
    // allowlist: expected git/exec failures return null
    if (isExpectedGitError(error)) return null;

    // wrap unexpected errors with context
    throw new UnexpectedCodePathError('unexpected git command error', {
      command,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * .what = pick git ref from tag or branch
 * .why = tag takes precedence over branch for commit slug
 */
const computeGitRef = (input: {
  tag: string | null;
  branch: string | null;
}): string | null => input.tag ?? input.branch ?? null;

/**
 * .what = determine if working tree has uncommitted changes
 * .why = dirty state affects commit slug format
 */
const computeIsDirty = (input: { status: string | null }): boolean =>
  input.status !== null && input.status.length > 0;

/**
 * .what = format commit slug from ref, hash, and dirty state
 * .why = consistent format: '$gitref@$hash' or '$gitref@$hash+' if dirty
 */
const computeCommitSlug = (input: {
  ref: string;
  hash: string;
  dirty: boolean;
}): EnvironmentCommitSlug =>
  `${input.ref}@${input.hash}${input.dirty ? '+' : ''}`;

/**
 * .what = parse commit slug from git repository
 * .why = format: '$gitref@$hash' or '$gitref@$hash+' if dirty
 */
const _getEnvCommitFromGit =
  async (): Promise<EnvironmentCommitSlug | null> => {
    // get exact tag (if HEAD is tagged)
    const tag = await runGit('git describe --tags --exact-match 2>/dev/null');

    // get branch name (fallback if no tag)
    const branch = await runGit('git rev-parse --abbrev-ref HEAD 2>/dev/null');

    // pick ref (tag or branch)
    const ref = computeGitRef({ tag, branch });
    if (!ref) return null;

    // get short hash
    const hash = await runGit('git rev-parse --short HEAD 2>/dev/null');
    if (!hash) return null;

    // check if dirty
    const status = await runGit('git status --porcelain 2>/dev/null');
    const dirty = computeIsDirty({ status });

    // format slug
    return computeCommitSlug({ ref, hash, dirty });
  };

/**
 * .what = parse commit slug from git repository (sync)
 * .why = format: '$gitref@$hash' or '$gitref@$hash+' if dirty
 */
const getEnvCommitFromGitSync = (): EnvironmentCommitSlug | null => {
  // get exact tag (if HEAD is tagged)
  const tag = runGitSync('git describe --tags --exact-match 2>/dev/null');

  // get branch name (fallback if no tag)
  const branch = runGitSync('git rev-parse --abbrev-ref HEAD 2>/dev/null');

  // pick ref (tag or branch)
  const ref = computeGitRef({ tag, branch });
  if (!ref) return null;

  // get short hash
  const hash = runGitSync('git rev-parse --short HEAD 2>/dev/null');
  if (!hash) return null;

  // check if dirty
  const status = runGitSync('git status --porcelain 2>/dev/null');
  const dirty = computeIsDirty({ status });

  // format slug
  return computeCommitSlug({ ref, hash, dirty });
};

/**
 * .what = getEnvCommitFromGit with .sync and .async methods
 * .why = enables symmetric API: fromGit(), fromGit.sync(), fromGit.async()
 */
const getEnvCommitFromGitWithMethods = Object.assign(_getEnvCommitFromGit, {
  sync: getEnvCommitFromGitSync,
  async: _getEnvCommitFromGit,
});

export { getEnvCommitFromGitWithMethods as getEnvCommitFromGit };
