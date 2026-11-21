# F16 — the real-aws default case asserts null on every identity, ungated

## .the fork
- a) `calls real aws service` asserts `toBeNull()` with no gate on whether the identity can read the name (taken)
- b) gate it behind the readability probe, as the wildcard case is
- c) mask it behind an asymmetric matcher, as the wildcard case is

## .taken, why
a). on a readable identity the test account's real name fits no default pattern, so the parser returns `null`; on a name-blind identity it returns `null`. one value on every runner, so no gate or mask has two outcomes to choose between. the extant `null` snapshot already enforced this value before the fix; `toBeNull()` states it at equal strength. a rename of the account into a default pattern should fail this case, since the case pins that account's map outcome.

## .rework, why
clean: wrap the assertion in `asTierIfNameReadable({ tier: null, isReadable })`, one line in one test.

## .confidence, why low
85%. a reviewer reads `toBeNull()` beside the gated wildcard case and sees asymmetry; the asymmetry is real, and its cause is that the two cases earn different value sets.

## .where
`src/domain.operations/parsers/access/getEnvAccessFromAwsAccountName.integration.test.ts`, `calls real aws service`

## .verdict
awaits council.
