import { createCache } from 'simple-in-memory-cache';
import { given, then, when } from 'test-fns';

import { getEnvironment } from './index';

describe('getEnvironment cache behavior', () => {
  // helper to clear relevant envars
  const clearEnv = () => {
    delete process.env.ACCESS;
    delete process.env.SERVER;
    delete process.env.COMMIT;
    delete process.env.NODE_ENV;
  };

  // helper to set envars for test isolation
  const setTestEnv = () => {
    process.env.ACCESS = 'test';
    process.env.SERVER = 'local@unix';
    process.env.COMMIT = 'main@abc123';
  };

  beforeEach(() => {
    clearEnv();
    setTestEnv();
  });

  afterEach(() => {
    clearEnv();
  });

  describe('filled() cache', () => {
    given('[case1] default cache behavior', () => {
      when('[t0] called twice with no cache input', () => {
        then('second call returns cached result (same object)', async () => {
          const result1 = await getEnvironment.filled({ cache: 'skip' }); // fresh start
          const result2 = await getEnvironment.filled(); // uses cache populated by skip

          expect(result1).toBe(result2); // same reference
        });
      });
    });

    given('[case2] custom parsers use default cache', () => {
      when('[t0] custom parsers called twice without cache skip', () => {
        then(
          'second call returns cached result (parser not called)',
          async () => {
            let callCount = 0;
            const accessParser = () => {
              callCount++;
              return 'test' as const;
            };

            // first call with custom parsers
            await getEnvironment.filled({
              cache: 'skip', // ensure fresh start
              parsers: {
                access: [accessParser],
                server: [() => 'local@unix'],
                commit: [() => 'v1.0.0@abc123'],
              },
            });
            expect(callCount).toBe(1);

            // second call without cache skip returns cached (parser not called)
            await getEnvironment.filled({
              parsers: {
                access: [accessParser],
                server: [() => 'local@unix'],
                commit: [() => 'v1.0.0@abc123'],
              },
            });
            expect(callCount).toBe(1); // NOT incremented
          },
        );
      });

      when('[t1] custom parsers called with cache skip', () => {
        then('parser runs each time', async () => {
          let callCount = 0;
          const accessParser = () => {
            callCount++;
            return 'test' as const;
          };

          // first call
          await getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [accessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(callCount).toBe(1);

          // second call with skip
          await getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [accessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(callCount).toBe(2); // incremented
        });
      });
    });

    given('[case3] caller-supplied cache', () => {
      when('[t0] custom cache provided', () => {
        then('uses caller cache instead of default', async () => {
          const customCache =
            createCache<ReturnType<typeof getEnvironment.filled>>();
          let callCount = 0;
          const accessParser = () => {
            callCount++;
            return 'prod' as const;
          };

          // first call with custom cache
          const result1 = await getEnvironment.filled({
            cache: customCache,
            parsers: {
              access: [accessParser],
              server: [() => 'cloud@aws'],
              commit: [() => 'v2.0.0@def456'],
            },
          });
          expect(callCount).toBe(1);

          // second call with same custom cache
          const result2 = await getEnvironment.filled({
            cache: customCache,
            parsers: {
              access: [accessParser],
              server: [() => 'cloud@aws'],
              commit: [() => 'v2.0.0@def456'],
            },
          });
          expect(callCount).toBe(1); // NOT incremented
          expect(result1).toBe(result2); // same reference
        });
      });

      when('[t1] different custom caches', () => {
        then('each cache is independent', async () => {
          const cacheA =
            createCache<ReturnType<typeof getEnvironment.filled>>();
          const cacheB =
            createCache<ReturnType<typeof getEnvironment.filled>>();
          let callCount = 0;
          const accessParser = () => {
            callCount++;
            return 'test' as const;
          };

          // call with cache A
          await getEnvironment.filled({
            cache: cacheA,
            parsers: {
              access: [accessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(callCount).toBe(1);

          // call with cache B (different cache, computes fresh)
          await getEnvironment.filled({
            cache: cacheB,
            parsers: {
              access: [accessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(callCount).toBe(2); // incremented because different cache
        });
      });
    });
  });

  describe('static() cache', () => {
    given('[case4] default cache behavior', () => {
      when('[t0] called twice with no cache input', () => {
        then('second call returns cached result (same object)', () => {
          const result1 = getEnvironment.static({ cache: 'skip' }); // fresh start
          const result2 = getEnvironment.static(); // uses cache populated by skip

          expect(result1).toBe(result2); // same reference
        });
      });
    });

    given('[case5] custom parsers use default cache', () => {
      when('[t0] custom parsers called twice without cache skip', () => {
        then('second call returns cached result (parser not called)', () => {
          let callCount = 0;
          const accessParser = () => {
            callCount++;
            return 'test' as const;
          };

          // first call with custom parsers
          getEnvironment.static({
            cache: 'skip', // ensure fresh start
            parsers: {
              access: [accessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(callCount).toBe(1);

          // second call without cache skip returns cached (parser not called)
          getEnvironment.static({
            parsers: {
              access: [accessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(callCount).toBe(1); // NOT incremented
        });
      });

      when('[t1] custom parsers called with cache skip', () => {
        then('parser runs each time', () => {
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

          // second call with skip
          getEnvironment.static({
            cache: 'skip',
            parsers: {
              access: [accessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          });
          expect(callCount).toBe(2); // incremented
        });
      });
    });

    given('[case6] caller-supplied cache', () => {
      when('[t0] custom cache provided', () => {
        then('uses caller cache instead of default', () => {
          const customCache =
            createCache<ReturnType<typeof getEnvironment.static>>();
          let callCount = 0;
          const accessParser = () => {
            callCount++;
            return 'prod' as const;
          };

          // first call with custom cache
          const result1 = getEnvironment.static({
            cache: customCache,
            parsers: {
              access: [accessParser],
              server: [() => 'cloud@aws'],
              commit: [() => 'v2.0.0@def456'],
            },
          });
          expect(callCount).toBe(1);

          // second call with same custom cache
          const result2 = getEnvironment.static({
            cache: customCache,
            parsers: {
              access: [accessParser],
              server: [() => 'cloud@aws'],
              commit: [() => 'v2.0.0@def456'],
            },
          });
          expect(callCount).toBe(1); // NOT incremented
          expect(result1).toBe(result2); // same reference
        });
      });
    });
  });

  describe('cache isolation', () => {
    given('[case7] filled and static caches are independent', () => {
      when('[t0] filled and static called in sequence', () => {
        then('each uses its own cache', async () => {
          let filledCallCount = 0;
          let staticCallCount = 0;

          const filledAccessParser = () => {
            filledCallCount++;
            return 'prod' as const;
          };
          const staticAccessParser = () => {
            staticCallCount++;
            return 'test' as const;
          };

          // populate filled cache
          await getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [filledAccessParser],
              server: [() => 'cloud@aws'],
              commit: [() => 'v1.0.0@filled'],
            },
          });
          expect(filledCallCount).toBe(1);

          // populate static cache (independent)
          getEnvironment.static({
            cache: 'skip',
            parsers: {
              access: [staticAccessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@static'],
            },
          });
          expect(staticCallCount).toBe(1);

          // verify filled cache hit (parser not called)
          await getEnvironment.filled({
            parsers: {
              access: [filledAccessParser],
              server: [() => 'cloud@aws'],
              commit: [() => 'v1.0.0@filled'],
            },
          });
          expect(filledCallCount).toBe(1); // NOT incremented

          // verify static cache hit (parser not called)
          getEnvironment.static({
            parsers: {
              access: [staticAccessParser],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@static'],
            },
          });
          expect(staticCallCount).toBe(1); // NOT incremented
        });
      });
    });
  });
});
