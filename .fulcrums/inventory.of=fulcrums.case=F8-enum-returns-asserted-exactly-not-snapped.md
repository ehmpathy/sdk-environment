# F8 — tier returns asserted exactly, not snapped

## .the fork
- a) the new tests assert each tier return with `toEqual('test')` / `toBeNull()` (taken)
- b) snapshot each return variant

## .taken, why
a). the output is a closed enum (`test | prep | prod | null`), and each case asserts the exact member. a snapshot of a one-word enum adds no review surface the assertion lacks. the extant real-aws suite already snapshots every variant of this parser's contract.

## .rework, why
clean: add `toMatchSnapshot()` beside each assertion.

## .confidence, why low
85%.

## .where
`src/domain.operations/parsers/access/getEnvAccessFromAwsAccountName._.sharedCache.integration.test.ts`

## .verdict
awaits council.
