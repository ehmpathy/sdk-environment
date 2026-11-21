# inventory.of=fulcrums

| case | title | rework | status | confidence |
|---|---|---|---|---|
| F1-cache-key-is-access-key-id-hash | cache key = hash of resolved access key id, not sts arn or profile | clean | ruled: keep a) | 80% |
| F2-own-file-lock-over-with-simple-mutex | own pid-aware file lock, not with-simple-mutex | clean | best-guessed | 75% |
| F3-hof-wrappers-take-fn-then-options | hof wrappers take (fn, options), per the hook-wrapper brief | clean | disputed | 90% |
| F4-parser-input-signature-unchanged | parser `input?` left as main has it | clean | disputed | 90% |
| F5-release-green-proven-at-the-commit-window | release green proven after the commit window; local suites green on repo code | clean | disputed | 85% |
| F6-husky-hooks-are-not-this-fix | untracked husky hooks stay out of this fix | clean | disputed | 90% |
| F7-cache-dir-rides-in-context | cacheDir rides in context beside the sdk seam | clean | disputed | 80% |
| F8-enum-returns-asserted-exactly-not-snapped | tier returns asserted exactly, not snapped | clean | disputed | 85% |
| F9-lock-and-sdk-factory-stay-at-their-leaf | lock and sdk factory stay at their one-caller leaf | clean | disputed | 85% |
| F10-extant-credential-catch-left-as-is | name parser's credential catch extracted to `isCredentialError`; alias parser's left as main has it | clean | disputed | 80% |
| F11-disk-cache-documented-not-switched | disk cache documented in the readme; no off switch added | clean | disputed | 75% |
| F12-retry-is-bounded-not-endless | throttle retry bounded at 6; the last throttle surfaces as-is | clean | disputed | 80% |
| F13-no-log-channel-for-the-wait | the lock wait and retry emit no log; the wait is bounded instead | clean | disputed | 85% |
| F14-acceptance-suite-left-as-is | cold start proven through `getEnvironment()` on a name-only parser chain (b taken in 5.3) | clean | taken, awaits council | 90% |
| F15-stubbed-send-needs-fake-credentials | a test that stubs `AccountClient.send` must hold fake env credentials | clean | disputed | 75% |
| F16-real-aws-default-case-asserts-null-ungated | real-aws default case asserts null with no readability gate | clean | disputed | 85% |
| F17-predicate-suites-stay-data-driven | predicate unit suites stay table-driven, not given/when/then | clean | disputed | 85% |
| F18-live-real-aws-snaps-stay-masked | live real-aws snapshots stay behind the readability mask | clean | ruled: keep a) | 80% |
| F19-lock-fate-journeys-proven-below-the-contract | lock-fate journeys proven on the wrapper, not walked through `getEnvironment()` | clean | disputed | 80% |
| F20-claude-migration-held-out-of-the-bump | the `.claude` actor migration stays out of the upgrade bump, for one box-local path | clean | ruled: keep a) | 75% |
