# F10 — the name parser's credential catch is extracted; the alias parser's is left as main has it

## .the fork
- a) extract the name parser's allowlist to `isCredentialError` (shape reads, a TypeError never matches); leave the alias parser's inline copy untouched (taken)
- b) extract it and swap the alias parser to it too
- c) leave both inline

## .taken, why
a). the name parser's catch needed shape reads and a TypeError exclusion, so a seam defect surfaces rather than reads as a skip. the alias parser is outside this fix, and a swap there changes its behavior: its inline copy still reads a TypeError that names credentials as a skip. that divergence is recorded in the alias dream, which owns the swap.

## .rework, why
clean: b) is one import and one catch in the alias parser.

## .confidence, why low
80%. the two copies differ on a TypeError until the alias swap lands.

## .where
`isCredentialError.ts`; `getEnvAccessFromAwsAccountName.ts` catch; `getEnvAccessFromAwsAccountAlias.ts` catch (untouched)

## .verdict
awaits council.
