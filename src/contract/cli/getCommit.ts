import { getEnvCommitFromGit } from '../../domain.operations/parsers/commit/getEnvCommitFromGit';

/**
 * .what = outputs commit slug to stdout for cli capture
 * .why = consumers need canonical commit format at deploy time
 */
export const getCommit = (): void => {
  try {
    const slug = getEnvCommitFromGit.sync();
    if (!slug) {
      process.stderr.write(
        'error: could not determine commit (not a git repo or no ref found)\n',
      );
      process.exit(2);
    }
    process.stdout.write(`${slug}\n`);
    process.exit(0);
  } catch (error) {
    process.stderr.write(
      `error: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
};
