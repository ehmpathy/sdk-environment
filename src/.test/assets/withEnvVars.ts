/**
 * .what = run a procedure with some env vars set or unset, then restore exactly those
 * .why = the real aws sdk reads its credentials and endpoint from env; a test that
 *        drives it must set them, and must leave every other var untouched
 * .note = null unsets a var. the restore runs in `finally`, so a throw leaves no trace
 */
export const withEnvVars = async <T>(
  input: { vars: Record<string, string | null> },
  procedure: () => Promise<T>,
): Promise<T> => {
  const keys = Object.keys(input.vars);
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    // .note = deliberate mutation: process.env is the sdk's only input for these
    for (const key of keys) setEnvVar({ key, value: input.vars[key] ?? null });
    return await procedure();
  } finally {
    for (const key of keys) setEnvVar({ key, value: before[key] ?? null });
  }
};

/**
 * .what = set one env var, or unset it on null
 * .why = `process.env[key] = undefined` writes the string "undefined"; unset needs delete
 */
const setEnvVar = (input: { key: string; value: string | null }): void => {
  // .note = deliberate mutation of process.env, scoped by withEnvVars
  if (input.value === null) {
    delete process.env[input.key];
    return;
  }
  process.env[input.key] = input.value;
};
