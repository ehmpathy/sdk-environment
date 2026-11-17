/**
 * .what = read the caller's access key id from an aws account client
 * .why = names the caller for the shared cache with no aws api call; a client
 *        built by a module-level mock of the sdk holds no config, so no key names
 *        the caller and the parser asks aws direct
 */
export const getAccessKeyIdFromAccountClient = async (input: {
  client: {
    config?: { credentials?: () => Promise<{ accessKeyId: string }> };
  };
}): Promise<string | null> => {
  // a module-level mock of the sdk builds a client with no config; it holds no key
  const credentials = input.client.config?.credentials;
  if (typeof credentials !== 'function') return null;
  return (await credentials()).accessKeyId;
};
