import { isThrottleError } from './isThrottleError';

/**
 * .what = decide whether an aws error says the service is briefly unable to answer
 * .why = such an error may clear for the next caller, so the shared cache keeps its
 *        waiters in a queue, one call at a time; any other error (a credential refusal,
 *        an unknown host, a refused connection) fails each caller the same way, so the
 *        waiters are freed to see their own error at once
 * .note = a throttle, or a server fault: the sdk marks a 5xx with `$fault: 'server'`
 */
export const isServerTransientError = (input: { error: unknown }): boolean => {
  if (isThrottleError(input)) return true;
  return (
    typeof input.error === 'object' &&
    input.error !== null &&
    '$fault' in input.error &&
    input.error.$fault === 'server'
  );
};
