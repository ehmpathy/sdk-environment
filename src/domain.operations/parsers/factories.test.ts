import { given, then, when } from 'test-fns';

import { fromGit } from './factories';

describe('fromGit', () => {
  given('fromGit factory', () => {
    when('fromGit() is called', () => {
      then('returns async parser', () => {
        const parser = fromGit();

        // verify returns function
        expect(typeof parser).toBe('function');

        // verify parser returns promise
        const result = parser();
        expect(result).toBeInstanceOf(Promise);
      });

      then('parser.name is "fromGit.async"', () => {
        const parser = fromGit();
        expect(parser.name).toBe('fromGit.async');
      });
    });

    when('fromGit.sync() is called', () => {
      then('returns sync parser', () => {
        const parser = fromGit.sync();

        // verify returns function
        expect(typeof parser).toBe('function');

        // verify parser returns value (not promise)
        const result = parser();
        expect(result).not.toBeInstanceOf(Promise);
      });

      then('parser.name is "fromGit.sync"', () => {
        const parser = fromGit.sync();
        expect(parser.name).toBe('fromGit.sync');
      });
    });

    when('fromGit.async() is called', () => {
      then('returns async parser', () => {
        const parser = fromGit.async();

        // verify returns function
        expect(typeof parser).toBe('function');

        // verify parser returns promise
        const result = parser();
        expect(result).toBeInstanceOf(Promise);
      });

      then('parser.name is "fromGit.async"', () => {
        const parser = fromGit.async();
        expect(parser.name).toBe('fromGit.async');
      });
    });

    when('fromGit() vs fromGit.async() are compared', () => {
      then('both return equivalent parsers', async () => {
        const parserDefault = fromGit();
        const parserAsync = fromGit.async();

        // both should have same name
        expect(parserDefault.name).toBe(parserAsync.name);

        // both should return promises
        expect(parserDefault()).toBeInstanceOf(Promise);
        expect(parserAsync()).toBeInstanceOf(Promise);
      });
    });
  });
});
