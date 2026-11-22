# F021 — `cache: 'skip'` reaches the name parser via a parser context arg

## .the fork
- a) `getEnvironment.filled()` calls each async parser with `{ cache: 'skip' | null }`; `AsyncParser<T>` and `Parser<T>` gain an optional `context?: ParserContext` (taken)
- b) a module-level flag that `getEnvironment` sets before the parser chain runs and clears after
- c) `getEnvironment` bypasses the name parser's file directly, with no parser contract change

## .taken, why
a). the skip is the caller's input, so it rides as an input, never as hidden module state (b races across concurrent calls). c) couples `getEnvironment` to one parser's storage, and a custom `fromAwsAccountName({ map })` in the caller's chain would miss it. a) is additive: a parser that takes no arg ignores it, and a zero-arg custom parser still type-checks. the default chain passes `getEnvAccess.fromAwsAccountName` direct, whose first arg already accepts `{ cache }`.

## .rework, why
clean: the context is one optional arg; a rename or a richer shape touches `getEnvironment.ts`, `factories.ts`, and the readme's parser type.

## .confidence, why low
85%. it widens the public `Parser` type, a contract the commander may prefer kept narrow.

## .where
`src/domain.operations/getEnvironment/getEnvironment.ts`; `src/domain.operations/parsers/factories.ts`; `readme.md` (custom parsers)

## .verdict
awaits council.
