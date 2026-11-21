import { isCredentialError } from './isCredentialError';

const asNamedError = (input: { name: string; message: string }): Error =>
  Object.assign(new Error(input.message), { name: input.name });

const TEST_CASES: Array<{
  description: string;
  given: { error: unknown };
  expect: { output: boolean };
}> = [
  {
    description: 'absent credentials are a credential error',
    given: {
      error: new Error('Could not load credentials from any providers'),
    },
    expect: { output: true },
  },
  {
    description: 'an expired sso session is a credential error',
    given: {
      error: new Error(
        'The SSO session associated with this profile has expired',
      ),
    },
    expect: { output: true },
  },
  {
    description: 'an invalid client token is a credential error, by name',
    given: {
      error: asNamedError({
        name: 'InvalidClientTokenId',
        message: 'The security token included in the request is invalid',
      }),
    },
    expect: { output: true },
  },
  {
    description:
      'a credential shape from another realm is still a credential error',
    given: { error: { name: 'Error', message: 'no credentials found' } },
    expect: { output: true },
  },
  {
    description: 'a throttle is not a credential error',
    given: {
      error: asNamedError({
        name: 'TooManyRequestsException',
        message: 'Too Many Requests',
      }),
    },
    expect: { output: false },
  },
  {
    description: 'a 5xx is not a credential error',
    given: {
      error: asNamedError({
        name: 'InternalServerException',
        message: 'Internal Server Error',
      }),
    },
    expect: { output: false },
  },
  {
    description: 'a connection reset is not a credential error',
    given: {
      error: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
    },
    expect: { output: false },
  },
  {
    description:
      'a code defect that names credentials is not a credential error',
    given: {
      error: new TypeError("Cannot read property 'credentials' of undefined"),
    },
    expect: { output: false },
  },
  {
    description: 'a non-object value is not a credential error',
    given: { error: 'no credentials' },
    expect: { output: false },
  },
];

describe('isCredentialError', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isCredentialError({ error: thisCase.given.error })).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
