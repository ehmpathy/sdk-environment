# F15 — a test that stubs `AccountClient.send` must now hold fake credentials

## .the fork
- a) keep the key read before `send`; document that a stub needs fake env credentials (taken)
- b) when the key read fails, call `getAccountName()` direct with no cache, so a stubbed `send` answers as before

## .taken, why
a). before this fix, a stub of `AccountClient.prototype.send` with no credentials returned the stubbed name, since `send` was the only aws touch. now the parser reads the access key id first, so with no credentials it returns `null` before the stub runs. b) restores that, but it walks the credential chain twice on every host with no aws credentials (the common non-aws consumer): the second walk repeats the instance-metadata probe, about a second where no metadata service answers. a test double has a sanctioned seam (`context.sdkAwsAccount`) and a one-line remedy (fake env credentials); a production cost on every non-aws host is the larger harm.

## .scope
a module-level mock of `@aws-sdk/client-account` is not in this fork: such a client holds no credential provider, so the key read returns null and the parser asks the mocked `send` direct, with no cache, as before (`getAccessKeyIdFromAccountClient.test.ts` [case2] for the null key; `…keyUnreadable.integration.test.ts` for the parser's direct ask). the fork is only a real client whose `send` alone is stubbed, on a host with no credentials.

## .rework, why
clean: one branch in the parser around the key read, plus a test.

## .confidence, why low
75%. a consumer suite that stubs `send` with no credentials flips from the stubbed tier to `null` with no error; the readme ⛈️ line is the only signal.

## .where
`getEnvAccessFromAwsAccountName.ts` — the key read before the shared fetch; `readme.md` — the ⛈️ line

## .verdict
awaits council.
