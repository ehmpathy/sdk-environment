# F3 — hof wrappers take (fn, options)

## .the fork
- a) `withRetryOnThrottle(fetch, options)` and `withCacheAcrossProcesses(fetch, options)`: wrapped fn first, config second (taken)
- b) one object input: `withRetryOnThrottle({ fetch, ...options })`

## .taken, why
a). `rule.require.hook-wrapper-pattern` (mechanic) names this exact shape as the org form: `withRetry(_processPayment, { maxAttempts: 3 })`, `withLogTrail(_sendInvoice)`. the org's `withSimpleCache(logic, options)` and `withLogTrail(logic, options)` match. a wrapper composes a procedure; it is not itself an `(input, context)` procedure, and the procedure it returns keeps `(input)`. b) would break the composition reads (`withA(withB(fn))`) the pattern exists for.

## .rework, why
clean: two call sites, one file each.

## .confidence, why low
90%. the input-context rule is a hard requirement, and a reader may hold it above the wrapper brief.

## .where
`src/domain.operations/parsers/access/withRetryOnThrottle.ts`, `withCacheAcrossProcesses.ts`

## .verdict
awaits council.
