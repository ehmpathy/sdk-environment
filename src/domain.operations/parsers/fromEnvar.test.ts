import { fromEnvar } from './fromEnvar';

describe('fromEnvar', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('factory behavior', () => {
    test.each([
      { envar: 'ACCESS', value: 'prod', expected: 'prod' },
      {
        envar: 'SERVER',
        value: 'cloud@aws.lambda',
        expected: 'cloud@aws.lambda',
      },
      { envar: 'CUSTOM_VAR', value: 'custom-value', expected: 'custom-value' },
    ])('returns $expected when $envar is set to $value', ({
      envar,
      value,
      expected,
    }) => {
      process.env[envar] = value;
      const parser = fromEnvar(envar);
      const result = parser();
      expect(result).toBe(expected);
      expect(result).toMatchSnapshot();
    });

    test.each([
      { envar: 'ACCESS', description: 'not set' },
      { envar: 'UNSET_VAR', description: 'never defined' },
    ])('returns null when $envar is $description', ({ envar }) => {
      delete process.env[envar];
      const parser = fromEnvar(envar);
      const result = parser();
      expect(result).toBeNull();
      expect(result).toMatchSnapshot();
    });

    test('returns null when envar is empty string', () => {
      process.env.ACCESS = '';
      const parser = fromEnvar('ACCESS');
      const result = parser();
      expect(result).toBeNull();
      expect(result).toMatchSnapshot();
    });

    test('creates independent parsers for different envars', () => {
      process.env.ACCESS = 'prod';
      process.env.SERVER = 'local@unix';

      const accessParser = fromEnvar('ACCESS');
      const serverParser = fromEnvar('SERVER');

      const accessResult = accessParser();
      const serverResult = serverParser();
      expect(accessResult).toBe('prod');
      expect(serverResult).toBe('local@unix');
      expect({ access: accessResult, server: serverResult }).toMatchSnapshot();
    });
  });
});
