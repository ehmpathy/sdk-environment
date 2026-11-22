# F014 — the cold start is proven through `getEnvironment()`, on a name-only parser chain

## .the fork
- a) leave `src/getEnvironment*.acceptance.test.ts` as is; pin each part at integration
- b) add an acceptance case that spawns N processes through the public `getEnvironment()` against a local fake aws endpoint that counts and throttles (taken)

## .taken, why
b), as `src/getEnvironment.coldStart.acceptance.test.ts`:
- [case1] 8 real processes, each a cold module registry, call `getEnvironment.filled()` at once; aws sees one `GetAccountInformation`, every process gets `test`. snapped
- [case2] the endpoint throttles every call; `getEnvironment.filled()` surfaces aws's own `TooManyRequestsException` after 18 bounded calls. snapped

each case passes `parsers.access: [fromAwsAccountName()]`, a chain any caller can pass, so the join runs without `fromAwsAccountAlias` (iam), the parser this fix does not touch. that cost was what held a) before.

the fake endpoint speaks the account api's wire shape (a 429 with `x-amzn-errortype`), and the real sdk calls it via `AWS_ENDPOINT_URL_ACCOUNT`. no test asks real aws to throttle: a burst big enough to trip it would spend the shared account's quota and flake every other suite on it; and real aws does not expose a per-caller call count to assert "one".

proven to bite: with the share bypassed in the parser, [case1] reads `Expected: 1` / `Received: 8`; restored, green.

## .rework, why
clean: a new acceptance file and two lifted test assets (`src/.test/assets/`); no prod code changes.

## .confidence, why
90%. the default chain (alias first) is not crossed: a caller on the default chain whose alias parser is throttled by iam is the alias dream's, not this fix's.

## .where
`src/getEnvironment.coldStart.acceptance.test.ts`; `src/.test/assets/getEnvironmentInChildProcess.ts`; `src/.test/assets/genAwsAccountApiFake.ts`

## .verdict
taken in 5.3 after a peer review held a) short; awaits council.
