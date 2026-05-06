import {
  type AwsAccountPatternMap,
  matchNameToAccess,
} from './getEnvAccessFromAwsAccountName';

describe('matchNameToAccess', () => {
  const defaultMap: AwsAccountPatternMap = {
    '*-prod': 'prod',
    '*-prep': 'prep',
    '*-test': 'test',
  };

  describe('default map', () => {
    test('foo-prod returns prod', () => {
      const result = matchNameToAccess('foo-prod', defaultMap);
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });

    test('bar-prep returns prep', () => {
      const result = matchNameToAccess('bar-prep', defaultMap);
      expect(result).toBe('prep');
      expect(result).toMatchSnapshot();
    });

    test('baz-test returns test', () => {
      const result = matchNameToAccess('baz-test', defaultMap);
      expect(result).toBe('test');
      expect(result).toMatchSnapshot();
    });
  });

  describe('custom exact match', () => {
    test('org-prod returns prod', () => {
      const map: AwsAccountPatternMap = { 'org-prod': 'prod' };
      const result = matchNameToAccess('org-prod', map);
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });
  });

  describe('custom glob match', () => {
    test('*-prod matches myorg-prod', () => {
      const map: AwsAccountPatternMap = { '*-prod': 'prod' };
      const result = matchNameToAccess('myorg-prod', map);
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });

    test('myorg-* matches myorg-foo', () => {
      const map: AwsAccountPatternMap = { 'myorg-*': 'prod' };
      const result = matchNameToAccess('myorg-foo', map);
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });
  });

  describe('exact wins over glob', () => {
    test('exact match takes precedence', () => {
      const map: AwsAccountPatternMap = {
        'special-prod': 'prep', // exact
        '*-prod': 'prod', // glob
      };
      const result = matchNameToAccess('special-prod', map);
      expect(result).toBe('prep');
      expect(result).toMatchSnapshot();
    });
  });

  describe('first match wins', () => {
    test('first glob in order wins', () => {
      const map: AwsAccountPatternMap = {
        '*-prod': 'prod',
        '*-production': 'prep',
      };
      // both would match foo-prod, but first pattern wins
      const result = matchNameToAccess('foo-prod', map);
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });
  });

  describe('negative cases', () => {
    test('returns null when no match', () => {
      const result = matchNameToAccess('foo', defaultMap);
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });

    test('returns null with empty map', () => {
      const result = matchNameToAccess('foo-prod', {});
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });
});
