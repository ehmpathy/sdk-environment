import { given, then, when } from 'test-fns';

import type {
  EnvironmentAccessTier,
  EnvironmentCommitSlug,
  EnvironmentServerTier,
} from './index';
import {
  fromAwsAccountAlias,
  fromEnvar,
  fromNodeEnv,
  getEnvironment,
} from './index';

describe('getEnvironment', () => {
  // save and restore env
  const envBefore = {
    ACCESS: process.env.ACCESS,
    SERVER: process.env.SERVER,
    COMMIT: process.env.COMMIT,
    NODE_ENV: process.env.NODE_ENV,
    LAMBDA_TASK_ROOT: process.env.LAMBDA_TASK_ROOT,
    CI: process.env.CI,
    XDG_SESSION_TYPE: process.env.XDG_SESSION_TYPE,
    TERM_PROGRAM: process.env.TERM_PROGRAM,
    MY_ACCESS: process.env.MY_ACCESS,
    MY_SERVER: process.env.MY_SERVER,
    MY_COMMIT: process.env.MY_COMMIT,
  };

  const clearEnv = () => {
    delete process.env.ACCESS;
    delete process.env.SERVER;
    delete process.env.COMMIT;
    delete process.env.NODE_ENV;
    delete process.env.LAMBDA_TASK_ROOT;
    delete process.env.CI;
    delete process.env.XDG_SESSION_TYPE;
    delete process.env.TERM_PROGRAM;
    delete process.env.MY_ACCESS;
    delete process.env.MY_SERVER;
    delete process.env.MY_COMMIT;
  };

  const restoreEnv = () => {
    Object.entries(envBefore).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  };

  afterEach(() => restoreEnv());

  // isolated scenario tests
  describe('isolated scenarios', () => {
    given('detectable signals', () => {
      beforeEach(() => {
        clearEnv();
        process.env.ACCESS = 'prod';
        process.env.SERVER = 'cloud@aws.lambda';
        process.env.COMMIT = 'v1.2.3@abc123';
      });

      when('getEnvironment() is called directly', () => {
        then('returns Environment (README contract)', async () => {
          const result = await getEnvironment({ cache: 'skip' });
          expect(result.access).toBe('prod');
          expect(result.server).toBe('cloud@aws.lambda');
          expect(result.commit).toBe('v1.2.3@abc123');
          expect(result).toMatchSnapshot();
        });
      });

      when('filled() is called', () => {
        then('returns Environment and matches snapshot', async () => {
          const result = await getEnvironment.filled({ cache: 'skip' });
          expect(result.access).toBe('prod');
          expect(result.server).toBe('cloud@aws.lambda');
          expect(result.commit).toBe('v1.2.3@abc123');
          expect(result).toMatchSnapshot();
        });
      });

      when('static() is called', () => {
        then('returns Environment and matches snapshot', () => {
          const result = getEnvironment.static({ cache: 'skip' });
          expect(result.access).toBe('prod');
          expect(result.server).toBe('cloud@aws.lambda');
          expect(result.commit).toBe('v1.2.3@abc123');
          expect(result).toMatchSnapshot();
        });
      });
    });

    given('no signals', () => {
      beforeEach(() => {
        clearEnv();
      });

      when('filled() is called with empty parsers', () => {
        then('throws error with snapshot message', async () => {
          try {
            await getEnvironment.filled({
              cache: 'skip',
              parsers: {
                access: [() => null],
                server: [() => null],
                commit: [() => null],
              },
            });
            fail('expected error');
          } catch (error) {
            expect((error as Error).message).toMatchSnapshot();
          }
        });
      });

      when('static() is called with empty parsers', () => {
        then('throws error with snapshot message', () => {
          try {
            getEnvironment.static({
              cache: 'skip',
              parsers: {
                access: [() => null],
                server: [() => null],
                commit: [() => null],
              },
            });
            fail('expected error');
          } catch (error) {
            expect((error as Error).message).toMatchSnapshot();
          }
        });
      });
    });

    given('invalid parser output', () => {
      beforeEach(() => {
        clearEnv();
      });

      when('filled() returns invalid access', () => {
        then('throws validation error with snapshot', async () => {
          try {
            await getEnvironment.filled({
              cache: 'skip',
              parsers: {
                access: [() => 'invalid' as 'test'],
                server: [() => 'local@unix'],
                commit: [() => 'v1.0.0@abc123'],
              },
            });
            fail('expected error');
          } catch (error) {
            expect((error as Error).message).toMatchSnapshot();
          }
        });
      });

      when('static() returns invalid server', () => {
        then('throws validation error with snapshot', () => {
          try {
            getEnvironment.static({
              cache: 'skip',
              parsers: {
                access: [() => 'test'],
                server: [() => 'local' as `local@${string}`], // bare local without platform
                commit: [() => 'v1.0.0@abc123'],
              },
            });
            fail('expected error');
          } catch (error) {
            expect((error as Error).message).toMatchSnapshot();
          }
        });
      });
    });
  });

  // journey test: developer integration workflow
  describe('journey: developer integration workflow', () => {
    given('[case1] developer integrates sdk-environment', () => {
      beforeEach(() => {
        clearEnv();
      });

      when('[t0] app starts without environment configured', () => {
        then('filled() throws descriptive error', async () => {
          try {
            await getEnvironment.filled({
              cache: 'skip',
              parsers: {
                access: [() => null],
                server: [() => null],
                commit: [() => null],
              },
            });
            fail('expected error');
          } catch (error) {
            expect((error as Error).message).toMatchSnapshot();
          }
        });
      });

      when('[t1] developer sets ACCESS=prod envar', () => {
        beforeEach(() => {
          process.env.ACCESS = 'prod';
          process.env.SERVER = 'local@unix';
          process.env.COMMIT = 'main@abc123';
        });

        then('filled() succeeds with Environment', async () => {
          const result = await getEnvironment.filled({ cache: 'skip' });
          expect(result.access).toBe('prod');
          expect(result.server).toBe('local@unix');
          expect(result.commit).toBe('main@abc123');
          expect(result).toMatchSnapshot();
        });
      });

      when('[t2] developer calls filled() again', () => {
        then('returns cached result (same object)', async () => {
          let callCount = 0;
          const accessParser = () => {
            callCount++;
            return 'test' as const;
          };

          // first call populates cache
          const first = await getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [accessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(callCount).toBe(1);

          // second call uses cache
          const second = await getEnvironment.filled({
            parsers: {
              access: [accessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(callCount).toBe(1);
          expect(first).toBe(second);
        });
      });

      when('[t3] developer forces fresh parse { cache: skip }', () => {
        beforeEach(() => {
          process.env.ACCESS = 'prep';
          process.env.SERVER = 'local@cicd';
          process.env.COMMIT = 'feat/auth@def456';
        });

        then('returns fresh Environment', async () => {
          const result = await getEnvironment.filled({ cache: 'skip' });
          expect(result.access).toBe('prep');
          expect(result.server).toBe('local@cicd');
          expect(result.commit).toBe('feat/auth@def456');
          expect(result).toMatchSnapshot();
        });
      });

      when('[t4] developer uses static() for sync context', () => {
        beforeEach(() => {
          process.env.ACCESS = 'test';
          process.env.SERVER = 'local@unix';
          process.env.COMMIT = 'main@ghi789';
        });

        then('returns sync-parsed Environment', () => {
          const result = getEnvironment.static({ cache: 'skip' });
          expect(result.access).toBe('test');
          expect(result.server).toBe('local@unix');
          expect(result.commit).toBe('main@ghi789');
          expect(result).toMatchSnapshot();
        });
      });

      when('[t5] verify cache isolation', () => {
        then('filled() and static() caches are independent', async () => {
          const filledResult = await getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [() => 'prod'],
              server: [() => 'cloud@aws.lambda'],
              commit: [() => 'v2.0.0@111111'],
            },
          });

          const staticResult = getEnvironment.static({
            cache: 'skip',
            parsers: {
              access: [() => 'test'],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@222222'],
            },
          });

          expect(filledResult.access).toBe('prod');
          expect(staticResult.access).toBe('test');
        });
      });

      when('[t6] developer forces fresh static parse { cache: skip }', () => {
        then('static() returns fresh Environment', () => {
          let callCount = 0;
          const accessParser = () => {
            callCount++;
            return 'test' as const;
          };

          // first call
          getEnvironment.static({
            cache: 'skip',
            parsers: {
              access: [accessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(callCount).toBe(1);

          // second call with cache skip
          getEnvironment.static({
            cache: 'skip',
            parsers: {
              access: [accessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(callCount).toBe(2);
        });
      });
    });
  });

  // journey test: custom parser configuration
  describe('journey: custom parser configuration', () => {
    given('[case2] developer uses custom parsers', () => {
      beforeEach(() => {
        clearEnv();
      });

      when('[t0] custom access parser provided', () => {
        then('custom parser runs instead of defaults', async () => {
          const customParser = () => 'prep' as const;
          const result = await getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [customParser],
              server: [() => 'cloud@aws.ecs'],
              commit: [() => 'deploy@xyz789'],
            },
          });
          expect(result.access).toBe('prep');
          expect(result.server).toBe('cloud@aws.ecs');
          expect(result.commit).toBe('deploy@xyz789');
          expect(result).toMatchSnapshot();
        });
      });

      when('[t1] custom parser returns null', () => {
        then('next custom parser in chain runs', async () => {
          const result = await getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [() => null, () => 'test'],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(result.access).toBe('test');
        });
      });

      when('[t2] only access parser customized', () => {
        beforeEach(() => {
          process.env.SERVER = 'local@cicd';
          process.env.COMMIT = 'ci@build123';
        });

        then('server uses default parsers', async () => {
          const result = await getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [() => 'test'],
            },
          });
          expect(result.access).toBe('test');
          expect(result.server).toBe('local@cicd');
          expect(result.commit).toBe('ci@build123');
          expect(result).toMatchSnapshot();
        });
      });

      when('[t3] all custom parsers return null', () => {
        then('throws with parser names in error', async () => {
          try {
            await getEnvironment.filled({
              cache: 'skip',
              parsers: {
                access: [() => null, () => null, () => null],
                server: [() => 'local@unix'],
                commit: [() => 'v1.0.0@abc123'],
              },
            });
            fail('expected error');
          } catch (error) {
            expect((error as Error).message).toMatchSnapshot();
          }
        });
      });

      when('[t4] fromEnvar factory used in custom parsers', () => {
        beforeEach(() => {
          process.env.MY_ACCESS = 'prod';
          process.env.MY_SERVER = 'cloud@aws.lambda';
          process.env.MY_COMMIT = 'v3.0.0@custom123';
        });

        then('fromEnvar reads custom envar names', async () => {
          const result = await getEnvironment({
            cache: 'skip',
            parsers: {
              access: [fromEnvar<EnvironmentAccessTier>('MY_ACCESS')],
              server: [fromEnvar<EnvironmentServerTier>('MY_SERVER')],
              commit: [fromEnvar<EnvironmentCommitSlug>('MY_COMMIT')],
            },
          });
          expect(result.access).toBe('prod');
          expect(result.server).toBe('cloud@aws.lambda');
          expect(result.commit).toBe('v3.0.0@custom123');
          expect(result).toMatchSnapshot();
        });
      });

      when('[t5] factory parsers fail with named error messages', () => {
        then('error includes factory parser names', async () => {
          try {
            await getEnvironment.filled({
              cache: 'skip',
              parsers: {
                access: [
                  fromEnvar<EnvironmentAccessTier>('NONEXISTENT_ACCESS'),
                  fromAwsAccountAlias(),
                  fromNodeEnv(),
                ],
                server: [() => 'local@unix' as EnvironmentServerTier],
                commit: [() => 'v1.0.0@abc123' as EnvironmentCommitSlug],
              },
            });
            fail('expected error');
          } catch (error) {
            expect((error as Error).message).toMatchSnapshot();
          }
        });
      });
    });
  });
});
