import { MalfunctionError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { withRetryOnThrottle } from './withRetryOnThrottle';

const asThrottleError = (): Error =>
  Object.assign(new Error('Too Many Requests'), {
    name: 'TooManyRequestsException',
  });

/**
 * .what = a fake fetch that replays a scripted list of replies, one per call
 * .why = lets each case pin exactly what aws says on each attempt
 */
const genFetchScripted = (input: {
  replies: Array<{ error: Error } | { value: string }>;
}): { fetch: () => Promise<string>; calls: () => number } => {
  const state = { calls: 0 };
  const fetch = async (): Promise<string> => {
    const reply = input.replies[state.calls];
    state.calls += 1; // .note = deliberate mutation, scoped to this fake
    if (!reply)
      throw new MalfunctionError('fake fetch: no scripted reply left', {
        calls: state.calls,
        replies: input.replies.length,
        hint: 'the case scripted fewer replies than the retry attempts',
      });
    if ('error' in reply) throw reply.error;
    return reply.value;
  };
  return { fetch, calls: () => state.calls };
};

const OPTIONS = { attempts: 4, baseMs: 1, capMs: 2 };

describe('withRetryOnThrottle', () => {
  given('[case1] aws throttles twice, then replies ok', () => {
    when('[t0] the wrapped fetch runs', () => {
      then('it retries and returns the value', async () => {
        const fake = genFetchScripted({
          replies: [
            { error: asThrottleError() },
            { error: asThrottleError() },
            { value: 'acme-test' },
          ],
        });
        const result = await withRetryOnThrottle(fake.fetch, OPTIONS)();
        expect(result).toEqual('acme-test');
        expect(fake.calls()).toEqual(3);
      });
    });
  });

  given('[case2] aws replies a non-throttle error', () => {
    when('[t0] the wrapped fetch runs', () => {
      then('the error surfaces at once, with no retry', async () => {
        const fake = genFetchScripted({
          replies: [
            { error: new Error('InternalServerException') },
            { value: 'acme-test' },
          ],
        });
        const error = await getError(
          withRetryOnThrottle(fake.fetch, OPTIONS)(),
        );
        expect(error.message).toEqual('InternalServerException');
        expect(fake.calls()).toEqual(1);
      });
    });
  });

  given('[case3] aws throttles past every attempt', () => {
    when('[t0] the wrapped fetch runs', () => {
      then('the final throttle error surfaces as-is', async () => {
        const fake = genFetchScripted({
          replies: Array.from({ length: 4 }, () => ({
            error: asThrottleError(),
          })),
        });
        const error = await getError(
          withRetryOnThrottle(fake.fetch, OPTIONS)(),
        );
        expect(error.name).toEqual('TooManyRequestsException');
        expect(fake.calls()).toEqual(4);
      });
    });
  });
});
