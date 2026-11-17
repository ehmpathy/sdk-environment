# F7 — cacheDir rides in context, beside sdkAwsAccount

## .the fork
- a) `context?: { sdkAwsAccount?, cacheDir? }` (taken)
- b) a third `options?: { cacheDir? }` argument

## .taken, why
a). the cache dir is the filesystem location the parser does i/o against: an environment dependency, like the sdk client, not static tune config. both exist only as test seams; production derives each. b) adds a third argument to a public-reach parser for one test seam.

## .rework, why
clean: one signature, the test call sites.

## .confidence, why low
80%. `rule.require.input-options-pattern` could read a path as config.

## .where
`src/domain.operations/parsers/access/getEnvAccessFromAwsAccountName.ts`

## .verdict
awaits council.
