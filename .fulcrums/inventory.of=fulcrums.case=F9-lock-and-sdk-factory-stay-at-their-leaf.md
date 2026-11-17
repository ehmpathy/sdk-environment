# F9 — the lock and the sdk factory stay at their leaf

## .the fork
- a) the lock operations stay file-private in `withCacheAcrossProcesses.ts`; `getSdkAwsAccountDefault` stays in `getEnvAccessFromAwsAccountName.ts` (taken)
- b) split the lock into its own `withLockAcrossProcesses` module, and the sdk factory into `sdkAwsAccount.ts`

## .taken, why
a). `rule.prefer.most-common-denominator` (architect): nest an operation at its most specific home; lift it when a second caller needs it, not before. each has one caller today. the lock's likely future is a swap to `with-simple-mutex` once it gains a pid-aware steal (F2, reseed dream), which touches one file under a).

## .rework, why
clean: a move to a new file plus one import each.

## .confidence, why low
85%.

## .where
`src/domain.operations/parsers/access/withCacheAcrossProcesses.ts`, `getEnvAccessFromAwsAccountName.ts`

## .verdict
awaits council.
