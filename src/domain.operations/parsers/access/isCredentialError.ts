/**
 * .what = decide whether an aws error says the caller's credentials or config are absent or refused
 * .why = such an error means this parser cannot answer for these credentials, so the
 *        parser reads it as "skip this parser" and the next parser in the chain is tried
 * .note = matched by shape (message, name), never `instanceof`: jest runs code in another realm
 */
export const isCredentialError = (input: { error: unknown }): boolean => {
  if (!(typeof input.error === 'object' && input.error !== null)) return false;

  // a TypeError is a code defect (e.g. a property of undefined named `credentials`), never a refusal
  if ('name' in input.error && input.error.name === 'TypeError') return false;

  const message = String(
    'message' in input.error ? input.error.message : '',
  ).toLowerCase();
  const name = String(
    'name' in input.error ? input.error.name : '',
  ).toLowerCase();
  return (
    MESSAGE_SIGNS.some((sign) => message.includes(sign)) ||
    NAME_SIGNS.some((sign) => name.includes(sign))
  );
};

const MESSAGE_SIGNS: readonly string[] = [
  'region',
  'could not load credentials',
  'no credentials',
  'credential',
  'access denied',
  'not authorized',
  'security token',
  'session',
  'expired',
  'reauthenticate',
];

const NAME_SIGNS: readonly string[] = [
  'invalidclienttokenid',
  'credentialsprovider',
];
