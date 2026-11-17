import { createHash } from 'node:crypto';

/**
 * .what = derive a filesystem-safe cache key from an aws access key id
 * .why = names the caller with no network call; the hash keeps the key id off disk,
 *        and other credentials always map to another key, so no caller reads another's name
 */
export const asCacheKeyFromAccessKeyId = (input: {
  accessKeyId: string;
}): string =>
  createHash('sha256').update(input.accessKeyId).digest('hex').slice(0, 32);
