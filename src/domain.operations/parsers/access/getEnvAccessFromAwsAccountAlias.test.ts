import {
  type AwsAccountAliasMap,
  matchAliasToAccess,
} from './getEnvAccessFromAwsAccountAlias';

describe('matchAliasToAccess', () => {
  const defaultMap: AwsAccountAliasMap = {
    '*-prod': 'prod',
    '*-prep': 'prep',
    '*-test': 'test',
  };

  describe('default map', () => {
    test('foo-prod returns prod', () => {
      const result = matchAliasToAccess('foo-prod', defaultMap);
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });

    test('bar-prep returns prep', () => {
      const result = matchAliasToAccess('bar-prep', defaultMap);
      expect(result).toBe('prep');
      expect(result).toMatchSnapshot();
    });

    test('baz-test returns test', () => {
      const result = matchAliasToAccess('baz-test', defaultMap);
      expect(result).toBe('test');
      expect(result).toMatchSnapshot();
    });
  });

  describe('custom exact match', () => {
    test('org-prod returns prod', () => {
      const map: AwsAccountAliasMap = { 'org-prod': 'prod' };
      const result = matchAliasToAccess('org-prod', map);
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });
  });

  describe('custom glob match', () => {
    test('*-prod matches myorg-prod', () => {
      const map: AwsAccountAliasMap = { '*-prod': 'prod' };
      const result = matchAliasToAccess('myorg-prod', map);
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });

    test('myorg-* matches myorg-foo', () => {
      const map: AwsAccountAliasMap = { 'myorg-*': 'prod' };
      const result = matchAliasToAccess('myorg-foo', map);
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });
  });

  describe('exact wins over glob', () => {
    test('exact match takes precedence', () => {
      const map: AwsAccountAliasMap = {
        'special-prod': 'prep', // exact
        '*-prod': 'prod', // glob
      };
      const result = matchAliasToAccess('special-prod', map);
      expect(result).toBe('prep');
      expect(result).toMatchSnapshot();
    });
  });

  describe('first match wins', () => {
    test('first glob in order wins', () => {
      const map: AwsAccountAliasMap = {
        '*-prod': 'prod',
        '*-production': 'prep',
      };
      // both would match foo-prod, but first pattern wins
      const result = matchAliasToAccess('foo-prod', map);
      expect(result).toBe('prod');
      expect(result).toMatchSnapshot();
    });
  });

  describe('negative cases', () => {
    test('returns null when no match', () => {
      const result = matchAliasToAccess('foo', defaultMap);
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });

    test('returns null with empty map', () => {
      const result = matchAliasToAccess('foo-prod', {});
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });
});
