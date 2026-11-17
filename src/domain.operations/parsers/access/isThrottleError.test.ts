import { isThrottleError } from './isThrottleError';

const asNamedError = (input: { name: string }): Error =>
  Object.assign(new Error(input.name), { name: input.name });

const TEST_CASES = [
  {
    description: 'TooManyRequestsException is a throttle',
    given: { error: asNamedError({ name: 'TooManyRequestsException' }) },
    expect: { output: true },
  },
  {
    description: 'a throttle shape from another realm is still a throttle',
    given: { error: { name: 'TooManyRequestsException' } },
    expect: { output: true },
  },
  {
    description: 'a 429 under another name is still a throttle',
    given: {
      error: Object.assign(asNamedError({ name: 'SlowDown' }), {
        $metadata: { httpStatusCode: 429 },
      }),
    },
    expect: { output: true },
  },
  {
    description: 'a 500 is not a throttle',
    given: { error: asNamedError({ name: 'InternalServerException' }) },
    expect: { output: false },
  },
  {
    description: 'a credential error is not a throttle',
    given: {
      error: new Error('Could not load credentials from any providers'),
    },
    expect: { output: false },
  },
  {
    description: 'a non-error value is not a throttle',
    given: { error: 'TooManyRequestsException' },
    expect: { output: false },
  },
];

describe('isThrottleError', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isThrottleError({ error: thisCase.given.error })).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
