# S5 — ttl of an hour, keyed by access key id

## .said
can cache for even an hour if its keyed by access key id. no way an access key id ever gets shared across accounts right?

## .settled
ttl = 1 hour. an access key id belongs to one principal in one account for life.

## .landed
- `CACHE_TTL_MS` = 1h in `getEnvAccessFromAwsAccountName.ts`; readme ttl line; pr thread reply
