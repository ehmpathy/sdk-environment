import { isThrottleError } from './isThrottleError';
import { sleep } from './sleep';

/**
 * .what = compute a full-jitter backoff delay for one attempt
 * .why = spreads concurrent retries apart so they do not collide again
 */
const getOneBackoffMs = (input: {
  attempt: number;
  baseMs: number;
  capMs: number;
}): number =>
  Math.random() * Math.min(input.capMs, input.baseMs * 2 ** input.attempt);

/**
 * .what = wrap an async fetch so an aws throttle reply backs off and retries
 * .why = a TooManyRequestsException must not fail the caller; the sdk's own
 *        3 attempts are not enough under a burst, so this layer is more patient
 * .note = non-throttle errors surface at once, with no retry
 */
export const withRetryOnThrottle = <T>(
  fetch: () => Promise<T>,
  options: { attempts: number; baseMs: number; capMs: number },
): (() => Promise<T>) => {
  /**
   * .what = run one attempt; on a throttle, back off and run the next
   * .why = the recursion carries the attempt count, so no counter is mutated
   */
  const getOneWithRetry = async (input: { attempt: number }): Promise<T> => {
    try {
      return await fetch();
    } catch (error) {
      // rethrow non-throttle errors and the final throttle as-is
      if (!isThrottleError({ error })) throw error;
      if (input.attempt + 1 >= options.attempts) throw error;

      // back off, then try again
      await sleep(
        getOneBackoffMs({
          attempt: input.attempt,
          baseMs: options.baseMs,
          capMs: options.capMs,
        }),
      );
      return getOneWithRetry({ attempt: input.attempt + 1 });
    }
  };
  return () => getOneWithRetry({ attempt: 0 });
};
