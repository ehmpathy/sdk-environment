import { getEnvCommitFromEnvar } from './getEnvCommitFromEnvar';
import { getEnvCommitFromGit } from './getEnvCommitFromGit';

/**
 * .what = namespace for commit slug parsers
 * .why = enables dot notation: getEnvCommit.fromEnvar()
 */
export const getEnvCommit = {
  fromEnvar: getEnvCommitFromEnvar,
  fromGit: getEnvCommitFromGit,
};
