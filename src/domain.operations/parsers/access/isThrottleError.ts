/**
 * .what = decide whether an error is an aws throttle reply
 * .why = only a throttle earns a retry; all other errors surface at once
 * .note = reads `name` and the http status by shape, never `instanceof Error`: errors may
 *         cross realms. the name is what the account api sends; a 429 status covers a
 *         throttle that arrives under another name
 */
export const isThrottleError = (input: { error: unknown }): boolean => {
  if (!(typeof input.error === 'object' && input.error !== null)) return false;
  if ('name' in input.error && input.error.name === 'TooManyRequestsException')
    return true;
  return getHttpStatusCode({ error: input.error }) === 429;
};

/**
 * .what = read the http status an aws sdk v3 error carries, if any
 * .why = the sdk sets `$metadata.httpStatusCode` on every service error
 */
const getHttpStatusCode = (input: { error: object }): number | null => {
  const metadata = '$metadata' in input.error ? input.error.$metadata : null;
  if (!(typeof metadata === 'object' && metadata !== null)) return null;
  const status = 'httpStatusCode' in metadata ? metadata.httpStatusCode : null;
  return typeof status === 'number' ? status : null;
};
