/**
 * .what = factory to create envar parser for any environment variable
 * .why = enables fromEnvar('ACCESS'), fromEnvar('SERVER'), etc.
 */
export const fromEnvar = <T extends string>(
  envarName: string,
): (() => T | null) => {
  const parser = (): T | null => {
    const value = process.env[envarName];
    if (!value || value === '') return null;
    return value as T;
  };
  Object.defineProperty(parser, 'name', { value: `fromEnvar(${envarName})` });
  return parser;
};
