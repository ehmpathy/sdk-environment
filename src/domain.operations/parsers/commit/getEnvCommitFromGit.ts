import { exec } from 'child_process';
import { promisify } from 'util';

import type { EnvironmentCommitSlug } from '../../../domain.objects/EnvironmentCommitSlug';

const execAsync = promisify(exec);

/**
 * .what = run git command and return stdout
 * .why = abstracts shell exec for git commands
 *
 * .note = returns null only for expected git failures (not a repo, no tag, etc.)
 *         rethrows unexpected errors
 */
const runGit = async (command: string): Promise<string | null> => {
  try {
    const { stdout } = await execAsync(command);
    return stdout.trim();
  } catch (error) {
    // allowlist: expected git/exec failures return null
    // parsers should fail gracefully and let the next parser try

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

    if (isGitError || isCommandFailure) {
      return null;
    }

    // rethrow unexpected errors (non-git, non-command errors)
    throw error;
  }
};

/**
 * .what = parse commit slug from git repository
 * .why = format: '$gitref@$hash' or '$gitref@$hash+' if dirty
 */
export const getEnvCommitFromGit =
  async (): Promise<EnvironmentCommitSlug | null> => {
    // get exact tag (if HEAD is tagged)
    const tag = await runGit('git describe --tags --exact-match 2>/dev/null');

    // get branch name (fallback if no tag)
    const branch = await runGit('git rev-parse --abbrev-ref HEAD 2>/dev/null');

    // prefer tag over branch
    const ref = tag || branch;
    if (!ref) return null;

    // get short hash
    const hash = await runGit('git rev-parse --short HEAD 2>/dev/null');
    if (!hash) return null;

    // check if dirty
    const status = await runGit('git status --porcelain 2>/dev/null');
    const dirty = status && status.length > 0;

    // format: ref@hash or ref@hash+
    const slug = `${ref}@${hash}${dirty ? '+' : ''}`;
    return slug;
  };
