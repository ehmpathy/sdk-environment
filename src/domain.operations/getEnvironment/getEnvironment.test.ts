import { getEnvironment } from './getEnvironment';

describe('getEnvironment', () => {
  describe('filled', () => {
    describe('parser chain', () => {
      test('first non-null parser wins', async () => {
        const result = await getEnvironment.filled({
          cache: 'skip',
          parsers: {
            access: [() => null, () => 'prod', () => 'test'],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(result.access).toBe('prod');
      });

      test('throws when all parsers return null', async () => {
        await expect(
          getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [() => null, () => null],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          }),
        ).rejects.toThrow('could not derive access');
      });

      test('throws with parser names in error', async () => {
        await expect(
          getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [() => null],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          }),
        ).rejects.toThrow('tried parsers: parser[0]');
      });

      test('validates parser output', async () => {
        await expect(
          getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [() => 'invalid' as 'test'],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          }),
        ).rejects.toThrow('invalid access value');
      });

      test('config parser chain first non-null wins', async () => {
        const result = await getEnvironment.filled({
          cache: 'skip',
          parsers: {
            access: [() => 'prep'],
            config: () => [() => null, () => 'test', () => 'prep'],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(result.config).toBe('test');
      });

      test('config defaults via NODE_ENV when no custom parsers', async () => {
        // .note = jest sets NODE_ENV=test, so default config parsers
        //         return 'test' for prep access (per design: prep + NODE_ENV=test → test)
        const result = await getEnvironment.filled({
          cache: 'skip',
          parsers: {
            access: [() => 'prep'],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(result.config).toBe('test');
      });

      test('throws on invalid config value', async () => {
        await expect(
          getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [() => 'prep'],
              config: () => [() => 'invalid' as 'test'],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          }),
        ).rejects.toThrow('invalid config value');
      });

      test('throws on config/access mismatch for prod', async () => {
        await expect(
          getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [() => 'prod'],
              config: () => [() => 'test'],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          }),
        ).rejects.toThrow("config must start with 'prod'");
      });

      test('throws on config/access mismatch for test', async () => {
        await expect(
          getEnvironment.filled({
            cache: 'skip',
            parsers: {
              access: [() => 'test'],
              config: () => [() => 'prep'],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          }),
        ).rejects.toThrow("config must start with 'test'");
      });

      test('prep access allows any config', async () => {
        const result = await getEnvironment.filled({
          cache: 'skip',
          parsers: {
            access: [() => 'prep'],
            config: () => [() => 'test'],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(result.config).toBe('test');
      });
    });

    describe('cache', () => {
      test('cache skip with custom parsers forces fresh parse', async () => {
        let callCount = 0;
        const accessParser = () => {
          callCount++;
          return 'test' as const;
        };

        // first call with custom parsers and cache skip
        await getEnvironment.filled({
          cache: 'skip',
          parsers: {
            access: [accessParser],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(callCount).toBe(1);

        // second call also computes fresh (explicit cache skip)
        await getEnvironment.filled({
          cache: 'skip',
          parsers: {
            access: [accessParser],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(callCount).toBe(2); // incremented because cache: 'skip' bypasses cache
      });

      test('cache skip forces fresh parse', async () => {
        // set envars so default parsers succeed without AWS calls
        const envBefore = {
          ACCESS: process.env.ACCESS,
          SERVER: process.env.SERVER,
          COMMIT: process.env.COMMIT,
        };
        process.env.ACCESS = 'test';
        process.env.SERVER = 'local@unix';
        process.env.COMMIT = 'main@abc123';

        try {
          // first call populates cache
          const result1 = await getEnvironment.filled();

          // second call with skip forces fresh parse but populates cache
          const result2 = await getEnvironment.filled({ cache: 'skip' });

          // results should be equivalent (same default parsers)
          expect(result1.access).toBe(result2.access);
          expect(result1.server).toBe(result2.server);
        } finally {
          // restore envars
          if (envBefore.ACCESS === undefined) delete process.env.ACCESS;
          else process.env.ACCESS = envBefore.ACCESS;
          if (envBefore.SERVER === undefined) delete process.env.SERVER;
          else process.env.SERVER = envBefore.SERVER;
          if (envBefore.COMMIT === undefined) delete process.env.COMMIT;
          else process.env.COMMIT = envBefore.COMMIT;
        }
      });
    });
  });

  describe('static', () => {
    describe('parser chain', () => {
      test('first non-null parser wins', () => {
        const result = getEnvironment.static({
          cache: 'skip',
          parsers: {
            access: [() => null, () => 'prod', () => 'test'],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(result.access).toBe('prod');
      });

      test('throws when all parsers return null', () => {
        expect(() =>
          getEnvironment.static({
            cache: 'skip',
            parsers: {
              access: [() => null],
              server: [() => 'local@unix'],
              commit: [() => 'v1.0.0@abc123'],
            },
          }),
        ).toThrow('could not derive access');
      });
    });

    describe('cache', () => {
      test('cache skip with custom parsers forces fresh parse', () => {
        let callCount = 0;
        const accessParser = () => {
          callCount++;
          return 'test' as const;
        };

        // first call with custom parsers and cache skip
        getEnvironment.static({
          cache: 'skip',
          parsers: {
            access: [accessParser],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(callCount).toBe(1);

        // second call also computes fresh (explicit cache skip)
        getEnvironment.static({
          cache: 'skip',
          parsers: {
            access: [accessParser],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(callCount).toBe(2); // incremented because cache: 'skip' bypasses cache
      });

      test('cache skip forces fresh parse', () => {
        // first call populates cache
        const result1 = getEnvironment.static();

        // second call with skip forces fresh parse but populates cache
        const result2 = getEnvironment.static({ cache: 'skip' });

        // results should be equivalent (same default parsers)
        expect(result1.access).toBe(result2.access);
        expect(result1.server).toBe(result2.server);
      });
    });
  });

  describe('cache isolation', () => {
    test('filled and static caches are independent', async () => {
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
      const filledResult = await getEnvironment.filled({
        cache: 'skip',
        parsers: {
          access: [filledAccessParser],
          server: [() => 'local@unix'],
          commit: [() => 'v1.0.0@abc123'],
        },
      });
      expect(filledResult.access).toBe('prod');
      expect(filledCallCount).toBe(1);

      // static should have its own cache
      const staticResult = getEnvironment.static({
        cache: 'skip',
        parsers: {
          access: [staticAccessParser],
          server: [() => 'local@unix'],
          commit: [() => 'v1.0.0@abc123'],
        },
      });
      expect(staticResult.access).toBe('test');
      expect(staticCallCount).toBe(1);
    });
  });
});
