/**
 * .what = decide whether an error says an import could not be found
 * .why = the aws sdk is an optional peer dep; when it is absent, the parser is skipped
 * .note = matched by shape (`code`), never `instanceof`: jest runs code in another realm
 */
export const isModuleNotFoundError = (input: { error: unknown }): boolean =>
  typeof input.error === 'object' &&
  input.error !== null &&
  'code' in input.error &&
  (input.error.code === 'ERR_MODULE_NOT_FOUND' ||
    input.error.code === 'MODULE_NOT_FOUND');
