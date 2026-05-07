import { getEnvConfigFromAccess } from './getEnvConfigFromAccess';

describe('getEnvConfigFromAccess', () => {
  test('returns test for test access', () => {
    const parser = getEnvConfigFromAccess('test');
    const result = parser();
    expect(result).toBe('test');
    expect(result).toMatchSnapshot();
  });

  test('returns prep for prep access', () => {
    const parser = getEnvConfigFromAccess('prep');
    const result = parser();
    expect(result).toBe('prep');
    expect(result).toMatchSnapshot();
  });

  test('returns prod for prod access', () => {
    const parser = getEnvConfigFromAccess('prod');
    const result = parser();
    expect(result).toBe('prod');
    expect(result).toMatchSnapshot();
  });

  describe('parser name', () => {
    test('has correct function name', () => {
      const parser = getEnvConfigFromAccess('prep');
      expect(parser.name).toBe('fromAccess()');
    });
  });
});
