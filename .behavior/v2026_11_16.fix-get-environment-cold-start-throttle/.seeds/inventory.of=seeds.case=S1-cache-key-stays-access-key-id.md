# S1 — cache key stays the access key id

## .said
F1 ruled: keep the access key id as the cache key (no network call; an sts read could throttle too).

## .settled
the shared cache keys on a hash of the resolved access key id. no sts call. fulcrum F1 closes.

## .landed
- `.fulcrums/inventory.of=fulcrums.case=F1-cache-key-is-access-key-id-hash.md` verdict
