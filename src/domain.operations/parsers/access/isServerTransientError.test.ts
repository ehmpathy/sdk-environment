import { isServerTransientError } from './isServerTransientError';

const asAwsError = (input: {
  name: string;
  fault: 'client' | 'server';
  status: number;
}): Error =>
  Object.assign(new Error(input.name), {
    name: input.name,
    $fault: input.fault,
    $metadata: { httpStatusCode: input.status },
  });

const TEST_CASES: Array<{
  description: string;
  given: { error: unknown };
  expect: { output: boolean };
}> = [
  {
    description: 'a throttle is transient',
    given: {
      error: asAwsError({
        name: 'TooManyRequestsException',
        fault: 'client',
        status: 429,
      }),
    },
    expect: { output: true },
  },
  {
    description: 'a 5xx server fault is transient',
    given: {
      error: asAwsError({
        name: 'InternalServerException',
        fault: 'server',
        status: 500,
      }),
    },
    expect: { output: true },
  },
  {
    description: 'a credential refusal is not transient',
    given: {
      error: asAwsError({
        name: 'UnrecognizedClientException',
        fault: 'client',
        status: 403,
      }),
    },
    expect: { output: false },
  },
  {
    description: 'an unknown host is not transient',
    given: {
      error: Object.assign(new Error('getaddrinfo ENOTFOUND account.aws'), {
        code: 'ENOTFOUND',
      }),
    },
    expect: { output: false },
  },
  {
    description: 'a non-object value is not transient',
    given: { error: 'InternalServerException' },
    expect: { output: false },
  },
];

describe('isServerTransientError', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isServerTransientError({ error: thisCase.given.error })).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
