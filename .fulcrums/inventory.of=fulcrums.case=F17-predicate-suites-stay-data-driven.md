# F17 — the predicate unit suites stay data-driven, not given/when/then

## .the fork
- a) `isThrottleError`, `isServerTransientError`, `isCredentialError`, `isModuleNotFoundError` suites run a `TEST_CASES` table through `test(description)` (taken)
- b) wrap each row as `given('[caseN]') → when('[t0]') → then(...)`

## .taken, why
a). `rule.prefer.data-driven` names this table form for transformers, and each suite tests a pure predicate. `rule.require.given-when-then` recommends, not requires, its frame for unit tests; for a transformer table, the data-driven rule is the specific one. a row per shape reads as one table a reviewer can scan for the absent boundary.

## .rework, why
clean: map each row into a given/when/then triple; no assertion changes.

## .confidence, why low
85%. two org rules pull apart here, and other suites in this fix (`asCacheKeyFromAccessKeyId`, `getAccessKeyIdFromAccountClient`) use given/when/then, since each holds few cases with distinct setup.

## .where
`src/domain.operations/parsers/access/is*Error.test.ts`

## .verdict
awaits council.
