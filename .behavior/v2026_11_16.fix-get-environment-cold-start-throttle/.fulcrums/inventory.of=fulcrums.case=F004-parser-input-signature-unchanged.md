# F004 — parser input signature left as main has it

## .the fork
- a) keep `getEnvAccessFromAwsAccountName(input?: { map? })` as on main; add only `context?` (taken)
- b) make `input` required with `map: AwsAccountPatternMap | null`

## .taken, why
a). `git show main:src/domain.operations/parsers/access/getEnvAccessFromAwsAccountName.ts` holds the identical `input?: { map?: AwsAccountPatternMap }`. b) changes an extant contract outside the wish: `getEnvAccess.fromAwsAccountName` is exported, and its callers (`getEnvironment` parsers, consumers who pass no map) would all change. the wish asks for the smallest change that meets done (`0.wish.md`).

the F011 verdict adds one optional field, `input.cache?: 'skip' | null`. it stays optional for the same reason: an exported boundary, read by `getEnvironment` as the parser context (F021).

## .rework, why
clean: b) is a follow-up of its own, if the wisher wants the internal contract tightened.

## .confidence, why low
90%.

## .where
`src/domain.operations/parsers/access/getEnvAccessFromAwsAccountName.ts`

## .verdict
awaits council.
