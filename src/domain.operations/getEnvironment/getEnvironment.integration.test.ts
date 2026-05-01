import { getError, given, then, when } from 'test-fns';

import { getEnvironment } from './getEnvironment';

describe('getEnvironment', () => {
  describe('filled', () => {
    given('runtime with detectable signals', () => {
      // set up environment variables for test
      const envBefore = {
        ACCESS: process.env.ACCESS,
        SERVER: process.env.SERVER,
        COMMIT: process.env.COMMIT,
      };

      beforeEach(() => {
        process.env.ACCESS = 'test';
        process.env.SERVER = 'local@unix';
        process.env.COMMIT = 'v1.0.0@abc123';
      });

      afterEach(() => {
        if (envBefore.ACCESS === undefined) delete process.env.ACCESS;
        else process.env.ACCESS = envBefore.ACCESS;
        if (envBefore.SERVER === undefined) delete process.env.SERVER;
        else process.env.SERVER = envBefore.SERVER;
        if (envBefore.COMMIT === undefined) delete process.env.COMMIT;
        else process.env.COMMIT = envBefore.COMMIT;
      });

      when('filled() is called', () => {
        then('returns Environment object', async () => {
          const result = await getEnvironment.filled({ cache: 'skip' });
          expect(result).toEqual({
            access: 'test',
            server: 'local@unix',
            commit: 'v1.0.0@abc123',
          });
          expect(result).toMatchSnapshot();
        });
      });
    });

    given('invalid access value from custom parser', () => {
      when('filled() is called with parser that returns invalid value', () => {
        then('throws BadRequestError with snapshot', async () => {
          const error = await getError(
            getEnvironment.filled({
              cache: 'skip',
              parsers: {
                access: [() => 'invalid-access' as never],
                server: [() => 'local@unix'],
                commit: [() => 'main@abc123'],
              },
            }),
          );
          expect(error.message).toContain('invalid access value');
          expect(error.message).toMatchSnapshot();
        });
      });
    });

    given('no parsers return a value', () => {
      when('filled() is called with empty parsers', () => {
        then('throws UnexpectedCodePathError with snapshot', async () => {
          const error = await getError(
            getEnvironment.filled({
              cache: 'skip',
              parsers: {
                access: [() => null],
                server: [() => 'local@unix'],
                commit: [() => 'main@abc123'],
              },
            }),
          );
          expect(error.message).toContain('could not derive access');
          expect(error.message).toMatchSnapshot();
        });
      });
    });

    given('invalid server value from custom parser', () => {
      when('filled() is called with parser that returns invalid value', () => {
        then('throws BadRequestError with snapshot', async () => {
          const error = await getError(
            getEnvironment.filled({
              cache: 'skip',
              parsers: {
                access: [() => 'test'],
                server: [() => 'invalid-server' as never],
                commit: [() => 'main@abc123'],
              },
            }),
          );
          expect(error.message).toContain('invalid server value');
          expect(error.message).toMatchSnapshot();
        });
      });
    });

    given('invalid commit value from custom parser', () => {
      when('filled() is called with parser that returns invalid value', () => {
        then('throws BadRequestError with snapshot', async () => {
          const error = await getError(
            getEnvironment.filled({
              cache: 'skip',
              parsers: {
                access: [() => 'test'],
                server: [() => 'local@unix'],
                commit: [() => 'invalid-commit' as never],
              },
            }),
          );
          expect(error.message).toContain('invalid commit value');
          expect(error.message).toMatchSnapshot();
        });
      });
    });

    given('no server parsers return a value', () => {
      when('filled() is called with empty server parsers', () => {
        then('throws UnexpectedCodePathError with snapshot', async () => {
          const error = await getError(
            getEnvironment.filled({
              cache: 'skip',
              parsers: {
                access: [() => 'test'],
                server: [() => null],
                commit: [() => 'main@abc123'],
              },
            }),
          );
          expect(error.message).toContain('could not derive server');
          expect(error.message).toMatchSnapshot();
        });
      });
    });

    given('no commit parsers return a value', () => {
      when('filled() is called with empty commit parsers', () => {
        then('throws UnexpectedCodePathError with snapshot', async () => {
          const error = await getError(
            getEnvironment.filled({
              cache: 'skip',
              parsers: {
                access: [() => 'test'],
                server: [() => 'local@unix'],
                commit: [() => null],
              },
            }),
          );
          expect(error.message).toContain('could not derive commit');
          expect(error.message).toMatchSnapshot();
        });
      });
    });
  });

  describe('static', () => {
    given('runtime with detectable signals', () => {
      const envBefore = {
        ACCESS: process.env.ACCESS,
        SERVER: process.env.SERVER,
        COMMIT: process.env.COMMIT,
      };

      beforeEach(() => {
        process.env.ACCESS = 'prod';
        process.env.SERVER = 'cloud@aws.lambda';
        process.env.COMMIT = 'main@def456';
      });

      afterEach(() => {
        if (envBefore.ACCESS === undefined) delete process.env.ACCESS;
        else process.env.ACCESS = envBefore.ACCESS;
        if (envBefore.SERVER === undefined) delete process.env.SERVER;
        else process.env.SERVER = envBefore.SERVER;
        if (envBefore.COMMIT === undefined) delete process.env.COMMIT;
        else process.env.COMMIT = envBefore.COMMIT;
      });

      when('static() is called', () => {
        then('returns Environment object', () => {
          const result = getEnvironment.static({ cache: 'skip' });
          expect(result).toEqual({
            access: 'prod',
            server: 'cloud@aws.lambda',
            commit: 'main@def456',
          });
          expect(result).toMatchSnapshot();
        });
      });
    });

    given('invalid server value from custom parser', () => {
      when('static() is called with parser that returns invalid value', () => {
        then('throws BadRequestError with snapshot', () => {
          const error = getError(() =>
            getEnvironment.static({
              cache: 'skip',
              parsers: {
                access: [() => 'test'],
                server: [() => 'invalid-server' as never],
                commit: [() => 'main@abc123'],
              },
            }),
          );
          expect(error.message).toContain('invalid server value');
          expect(error.message).toMatchSnapshot();
        });
      });
    });

    given('no commit parsers return a value', () => {
      when('static() is called with empty commit parsers', () => {
        then('throws UnexpectedCodePathError with snapshot', () => {
          const error = getError(() =>
            getEnvironment.static({
              cache: 'skip',
              parsers: {
                access: [() => 'test'],
                server: [() => 'local@unix'],
                commit: [() => null],
              },
            }),
          );
          expect(error.message).toContain('could not derive commit');
          expect(error.message).toMatchSnapshot();
        });
      });
    });

    given('invalid access value from custom parser', () => {
      when('static() is called with parser that returns invalid value', () => {
        then('throws BadRequestError with snapshot', () => {
          const error = getError(() =>
            getEnvironment.static({
              cache: 'skip',
              parsers: {
                access: [() => 'invalid-access' as never],
                server: [() => 'local@unix'],
                commit: [() => 'main@abc123'],
              },
            }),
          );
          expect(error.message).toContain('invalid access value');
          expect(error.message).toMatchSnapshot();
        });
      });
    });

    given('invalid commit value from custom parser', () => {
      when('static() is called with parser that returns invalid value', () => {
        then('throws BadRequestError with snapshot', () => {
          const error = getError(() =>
            getEnvironment.static({
              cache: 'skip',
              parsers: {
                access: [() => 'test'],
                server: [() => 'local@unix'],
                commit: [() => 'invalid-commit' as never],
              },
            }),
          );
          expect(error.message).toContain('invalid commit value');
          expect(error.message).toMatchSnapshot();
        });
      });
    });

    given('no access parsers return a value', () => {
      when('static() is called with empty access parsers', () => {
        then('throws UnexpectedCodePathError with snapshot', () => {
          const error = getError(() =>
            getEnvironment.static({
              cache: 'skip',
              parsers: {
                access: [() => null],
                server: [() => 'local@unix'],
                commit: [() => 'main@abc123'],
              },
            }),
          );
          expect(error.message).toContain('could not derive access');
          expect(error.message).toMatchSnapshot();
        });
      });
    });

    given('no server parsers return a value', () => {
      when('static() is called with empty server parsers', () => {
        then('throws UnexpectedCodePathError with snapshot', () => {
          const error = getError(() =>
            getEnvironment.static({
              cache: 'skip',
              parsers: {
                access: [() => 'test'],
                server: [() => null],
                commit: [() => 'main@abc123'],
              },
            }),
          );
          expect(error.message).toContain('could not derive server');
          expect(error.message).toMatchSnapshot();
        });
      });
    });
  });
});
