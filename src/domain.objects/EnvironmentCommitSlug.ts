/**
 * .what = what code this process runs
 * .why = enables traceability and debug
 *
 * format: `$gitref@$hash` or `$gitref@$hash+` if dirty
 * - gitref: tag or branch name
 * - hash: short commit hash
 * - '+' suffix: uncommitted changes exist
 */
export type EnvironmentCommitSlug = string;
