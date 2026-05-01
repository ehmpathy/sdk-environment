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
    });

    describe('cache', () => {
      test('returns cached result on second call', async () => {
        let callCount = 0;
        const accessParser = () => {
          callCount++;
          return 'test' as const;
        };

        // first call
        await getEnvironment.filled({
          cache: 'skip', // skip to ensure we start fresh
          parsers: {
            access: [accessParser],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(callCount).toBe(1);

        // second call uses cache
        await getEnvironment.filled({
          parsers: {
            access: [accessParser],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(callCount).toBe(1); // not incremented
      });

      test('cache skip forces fresh parse', async () => {
        let callCount = 0;
        const accessParser = () => {
          callCount++;
          return 'test' as const;
        };

        await getEnvironment.filled({
          cache: 'skip',
          parsers: {
            access: [accessParser],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(callCount).toBe(1);

        await getEnvironment.filled({
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
      test('returns cached result on second call', () => {
        let callCount = 0;
        const accessParser = () => {
          callCount++;
          return 'test' as const;
        };

        // first call
        getEnvironment.static({
          cache: 'skip', // skip to ensure we start fresh
          parsers: {
            access: [accessParser],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(callCount).toBe(1);

        // second call uses cache
        getEnvironment.static({
          parsers: {
            access: [accessParser],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(callCount).toBe(1); // not incremented
      });

      test('cache skip forces fresh parse', () => {
        let callCount = 0;
        const accessParser = () => {
          callCount++;
          return 'test' as const;
        };

        getEnvironment.static({
          cache: 'skip',
          parsers: {
            access: [accessParser],
            server: [() => 'local@unix'],
            commit: [() => 'v1.0.0@abc123'],
          },
        });
        expect(callCount).toBe(1);

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
