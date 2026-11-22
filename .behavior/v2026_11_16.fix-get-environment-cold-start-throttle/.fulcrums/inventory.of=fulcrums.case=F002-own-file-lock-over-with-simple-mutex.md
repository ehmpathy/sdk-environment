# F002 — own file lock over with-simple-mutex

## .the fork
- a) own `mkdir` lock with the holder's pid in `withCacheAcrossProcesses.ts` (taken)
- b) `with-simple-mutex@0.1.1` over `simple-on-disk-cache` (local disk) — the org's paved per-machine lock

## .taken, why
a). b) frees a crashed holder's lock only when its lease lapses (default 30 min; v1 has no steal, per its readme "deferred to v2"). a jest worker killed mid-fetch would stall every later test file until the lease lapsed: the exact flaw vision case=3 (l05, l06) rules out. a short lease (e.g. 15s) still exceeds jest's 5s default timeout, and must also outlast the holder's own throttle backoff. a) breaks a dead holder's lock at once via its pid.
second weight: b) adds 3 runtime deps (one at v0.1) to an sdk every service loads.

## .rework, why
clean: the lock lives in one file behind `withCacheAcrossProcesses`; a swap to b) touches that file and package.json, no callers.

## .confidence, why low
75%. the paved-path default favors b); my case against it rests on its readme, not a run.

## .where
`src/domain.operations/parsers/access/withCacheAcrossProcesses.ts`

## .verdict
awaits wisher review. dream caught to upstream a pid-aware steal into with-simple-mutex, after which b) fits.
