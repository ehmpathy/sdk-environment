import { isModuleNotFoundError } from './isModuleNotFoundError';

const asCodedError = (input: { code: string }): Error =>
  Object.assign(new Error(`module fault: ${input.code}`), { code: input.code });

const TEST_CASES = [
  {
    description: 'an esm module not found is a module not found',
    given: { error: asCodedError({ code: 'ERR_MODULE_NOT_FOUND' }) },
    expect: { output: true },
  },
  {
    description: 'a cjs module not found is a module not found',
    given: { error: asCodedError({ code: 'MODULE_NOT_FOUND' }) },
    expect: { output: true },
  },
  {
    description: 'a coded shape from another realm is still a module not found',
    given: { error: { code: 'MODULE_NOT_FOUND' } },
    expect: { output: true },
  },
  {
    description: 'another code is not a module not found',
    given: { error: asCodedError({ code: 'ENOENT' }) },
    expect: { output: false },
  },
  {
    description: 'an error with no code is not a module not found',
    given: { error: new Error("Cannot find module '@aws-sdk/client-account'") },
    expect: { output: false },
  },
  {
    description: 'a null value is not a module not found',
    given: { error: null },
    expect: { output: false },
  },
  {
    description: 'a non-object value is not a module not found',
    given: { error: 'MODULE_NOT_FOUND' },
    expect: { output: false },
  },
];

describe('isModuleNotFoundError', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isModuleNotFoundError({ error: thisCase.given.error })).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
