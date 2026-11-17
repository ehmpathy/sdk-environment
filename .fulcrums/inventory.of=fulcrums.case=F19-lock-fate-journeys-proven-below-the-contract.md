# F19 — the lock-fate journeys are proven below the public contract

## .the fork
- a) the dead-holder, sequential-process, and holder-outlives-lock journeys run against `withCacheAcrossProcesses` with an injected dir (taken)
- b) walk each through `getEnvironment()` in child processes, on the default dir

## .taken, why
a). `getEnvironment()` adds no branch to these paths: it calls the parser, which calls the same wrapper. below the contract a dead pid can be planted, a stale bound shortened, and a deadline observed in seconds. through the contract each needs a planted lock in the host's default dir and a wait on real time bounds. the contract's own path to the default dir is under test: acceptance [case1] runs 8 children on it, and the real-aws default case calls the parser with no context.

## .rework, why
clean: add child-process acceptance cases that plant a lock under the child's TMPDIR.

## .confidence, why low
80%. a reviewer who reads the acceptance suite alone sees one lock journey, not four.

## .where
`src/domain.operations/parsers/access/withCacheAcrossProcesses.integration.test.ts` cases 3, 4, 5, 10, 14, 17, 19; `src/getEnvironment.coldStart.acceptance.test.ts`

## .verdict
awaits council.
