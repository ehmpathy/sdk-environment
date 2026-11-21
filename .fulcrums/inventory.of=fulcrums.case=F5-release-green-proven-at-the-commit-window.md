# F5 — release green is proven at the commit window, not at execution

## .the fork
- a) execution stone passes on local gates for this fix; `release --watch` green is proven once the pr exists, after the director's commit window (taken)
- b) hold execution until a green release run exists

## .taken, why
a). the director ruled no commit, push, or pr before the window (seed S2). no release run can exist before then, so b) would halt the route on a gate the director scheduled.

every local suite is green on repo code (`5.3.verification.yield.md`); what stays for ci to prove:
- the unreadable-identity branch of the 4 forced-map cases in `getEnvAccessFromAwsAccountName.integration.test.ts`. each asserts `toBe(isReadable ? tier : null)` from a direct probe; the readable branch passed here. ci's identity reads no name (run 27254151595, `suite / test-integration` ✓, with `null`)
- depcheck on the committed tree: locally it fails only on the pre-route `package.json` rhachet bumps and on `.agent` / `.claude` dirs, none in the commit pathspec
- unit: the only suites that fail to load live under the ignored `.agent/.actors/` plugin dir, not repo code

## .rework, why
clean: if release goes red at the window, the fix lands then.

## .confidence, why low
85%. the ci identity claim rests on the last green run; its logs have expired (http 410), so the job verdict is the evidence.

## .where
`5.1.execution.from_vision.yield.md` gates; `src/domain.operations/parsers/access/getEnvAccessFromAwsAccountName.integration.test.ts`

## .verdict
awaits council.
