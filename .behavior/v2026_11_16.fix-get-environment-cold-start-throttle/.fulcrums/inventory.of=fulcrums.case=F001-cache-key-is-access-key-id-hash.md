# F001 — cache key is a hash of the resolved access key id

## .the fork
- a) hash of resolved access key id — safe, no new dep; no share under sso
- b) sts caller arn — safe, shares under sso; new optional peer dep + one sts call per process
- c) profile name — shares under sso, no dep; a repointed profile can serve the wrong account's name within the ttl
- d) `credentials().accountId` — shares under sso with no network call where the provider sets it (the sso provider does); absent on static env creds, so a) stays the fallback. peer review raised it after the verdict; a candidate for the sso-share dream, not this fix

## .taken, why
a). it meets the measured case (env creds), adds no dep, and can never serve another caller's name.

## .rework, why
clean: the key is one transformer; a swap to b) touches that file and the peer deps only. no caller depends on the key shape.

## .confidence, why low
80%. the issue text suggested b); the wisher may prefer sso coverage over the smaller change.

## .where
`getEnvAccessFromAwsAccountName.ts` — the cache key transformer.

## .verdict
ruled by the director: keep a). no network call for the key; an sts read could throttle too.
