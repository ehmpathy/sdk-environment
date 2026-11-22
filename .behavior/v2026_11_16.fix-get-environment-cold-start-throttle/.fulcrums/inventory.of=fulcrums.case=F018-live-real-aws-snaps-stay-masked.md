# F018 — the live real-aws snapshots stay masked

## .the fork
- a) the real-aws wildcard and forced cases snap `{ result: TierIfNameReadable<tier> }`, an asymmetric matcher that checks the exact value each runner earns (taken)
- b) snap the plain value
- c) drop the snapshot, keep the assertion

## .taken, why
a). a plain value differs by runner: a name-readable identity earns the tier, ci (no aws creds) and a name-blind identity earn null. a plain snap fails one runner; main's plain `null` pins failed 4 cases on a readable host. the mask asserts the exact value, prints one constant, and `toBe(identity.isReadable ? tier : null)` beside it states the value in plain code. c) would drop a snapshot key main held, which the test-intent lane forbids.

## .rework, why
clean: swap the matcher for a plain value, or delete the snap line.

## .confidence, why low
80%. a hand-rolled matcher is unfamiliar to a reader, and the snap alone does not show the earned value.

## .where
`src/domain.operations/parsers/access/getEnvAccessFromAwsAccountName.integration.test.ts`, the real-aws given

## .verdict
ruled 2026-11-20 by the human: keep the masked real-aws snapshots, a). main's plain pins fail on any runner that can read the account name; the mask holds on every runner. rework clean.
